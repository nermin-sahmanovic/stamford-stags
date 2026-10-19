<#
  Anonymous-access check against the Supabase REST and Storage APIs (what a logged-out browser can do).
  Every check uses only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local.

  Works in Windows PowerShell 5.1 and PowerShell 7:
    powershell -ExecutionPolicy Bypass -File scripts\test-anon-access.ps1

  Reads must come back as exactly '[]' (raw Invoke-WebRequest content, not a count of
  Invoke-RestMethod results, which 5.1 gets wrong for empty arrays).

  Fixtures and cleanup go through the linked Supabase CLI (npx supabase db query --linked):
    * one public and one private photo (photos rows plus their storage.objects rows, no file
      bytes: storage policies, listing and URL signing only look at the rows), under
      photos/anon-check-<stamp>/, removed at the end;
    * the pending-registration insert writes a real row tagged @rls-test.invalid, deleted at the end.
  Covers: member tables, standings (read yes, write no), photos and the photos bucket (public
  only), calendar tokens, the calendar RPCs and public_results(). Exit code 1 if any check fails.
#>
$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 may default to TLS 1.0, which Supabase rejects.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot

# Fixtures are written through the linked CLI, so refuse unless it points at Stags-Dev (same rule as scripts/linked-ref.mjs).
$devRef = 'jljyylzalwiczrimaguz'
$refFile = Join-Path $root 'supabase\.temp\project-ref'
$linked = if (Test-Path $refFile) { (Get-Content $refFile -Raw).Trim() } else { 'nothing' }
if ($linked -ne $devRef) {
  throw "Refusing to run: the Supabase CLI is linked to $linked, not Stags-Dev ($devRef). Relink: npx supabase link --project-ref $devRef"
}

$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) { throw ".env.local not found at $envFile" }

$envVars = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*([^#\s]*)') { $envVars[$Matches[1]] = $Matches[2] }
}
$baseUrl = $envVars['NEXT_PUBLIC_SUPABASE_URL']
$anonKey = $envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']
if (-not $baseUrl -or -not $anonKey) { throw 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local' }

# Publishable keys are not JWTs, so send only the apikey header (no Authorization: Bearer).
$headers = @{ apikey = $anonKey }

# Returns @{ Status = <int>; Content = <string> } for both success and HTTP errors.
# -Api picks the service: 'rest/v1' (PostgREST) or 'storage/v1'.
function Invoke-Anon {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Body,
    [hashtable]$ExtraHeaders = @{},
    [string]$Api = 'rest/v1',
    [byte[]]$Bytes,
    [string]$ContentType = 'application/json'
  )
  $h = $headers.Clone()
  foreach ($k in $ExtraHeaders.Keys) { $h[$k] = $ExtraHeaders[$k] }
  $params = @{ Uri = "$baseUrl/$Api/$Path"; Method = $Method; Headers = $h; UseBasicParsing = $true }
  if ($Bytes) { $params.Body = $Bytes; $params.ContentType = $ContentType }
  elseif ($Body) { $params.Body = $Body; $params.ContentType = $ContentType }
  try {
    $r = Invoke-WebRequest @params
    return @{ Status = [int]$r.StatusCode; Content = [string]$r.Content }
  } catch {
    $resp = $_.Exception.Response
    if (-not $resp) { throw }
    $content = ''
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $content = $_.ErrorDetails.Message
    } elseif ($resp -is [System.Net.HttpWebResponse]) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $content = $reader.ReadToEnd()
    }
    return @{ Status = [int]$resp.StatusCode; Content = [string]$content }
  }
}

# SQL as the database owner through the linked CLI. Returns @{ Ok = <bool>; Out = <string> }.
function Invoke-Linked {
  param([string]$Sql)
  Push-Location $root
  # In 5.1, 'Stop' turns any stderr line from a native command (the CLI prints status there) into an error.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    # npx.cmd is a batch file: a newline inside an argument cuts the SQL short, so send one line.
    $oneLine = ($Sql -replace '\s*\r?\n\s*', ' ').Trim()
    $out = & npx.cmd supabase db query --linked $oneLine 2>&1 | Out-String
    return @{ Ok = ($LASTEXITCODE -eq 0); Out = $out }
  } finally {
    $ErrorActionPreference = $previousPreference
    Pop-Location
  }
}

$script:failures = 0
function Report {
  param([bool]$Passed, [string]$Name, [string]$Detail)
  if ($Passed) {
    Write-Host "ok     - $Name" -ForegroundColor Green
  } else {
    $script:failures++
    Write-Host "NOT OK - $Name" -ForegroundColor Red
    if ($Detail) { Write-Host "         $Detail" }
  }
}

# PostgREST refusals: permission denied (42501) as 401/403. A function anon can't execute may
# also be hidden from the schema cache (PGRST202, 404).
function Test-Refused {
  param($Response)
  return (($Response.Status -in 401, 403) -and $Response.Content -match '42501') -or
         ($Response.Status -eq 404 -and $Response.Content -match 'PGRST202')
}

Write-Host "Anonymous access checks against $baseUrl"
Write-Host ''

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$prefix = "anon-check-$stamp"
$publicPath = "$prefix/public.jpg"
$privatePath = "$prefix/private.jpg"

$fixtureSql = @"
insert into public.photos (path, thumb_path, width, height, caption, is_public) values
  ('$publicPath',  '$prefix/public-thumb.jpg',  800, 600, 'anon check public',  true),
  ('$privatePath', '$prefix/private-thumb.jpg', 800, 600, 'anon check private', false);
insert into storage.objects (bucket_id, name) values
  ('photos', '$publicPath'), ('photos', '$prefix/public-thumb.jpg'),
  ('photos', '$privatePath'), ('photos', '$prefix/private-thumb.jpg');
"@
$fixtures = Invoke-Linked $fixtureSql
if (-not $fixtures.Ok) {
  Write-Host $fixtures.Out
  throw 'Could not create the photo fixtures through the linked CLI (run npx supabase link first).'
}
Write-Host "fixtures: public and private photo under photos/$prefix/"
Write-Host ''

try {
  # 1. Member-only tables: anon must get 200 with an empty array.
  foreach ($table in 'players', 'lineup_slots', 'availability', 'matches', 'registrations', 'events', 'calendar_tokens') {
    $r = Invoke-Anon -Method GET -Path "$table`?select=*&limit=5"
    $body = $r.Content.Trim()
    Report ($r.Status -eq 200 -and $body -eq '[]') "anon reads $table -> []" "HTTP $($r.Status): $body"
  }

  # 2. Public summary RPC: anon may call it and gets team numbers.
  $r = Invoke-Anon -Method POST -Path 'rpc/public_team_summary' -Body '{}'
  $summaryOk = $false
  if ($r.Status -eq 200) {
    $summary = $r.Content | ConvertFrom-Json
    $summaryOk = ($null -ne $summary.player_count) -and ($null -ne $summary.open_spots)
  }
  Report $summaryOk 'anon calls public_team_summary()' "HTTP $($r.Status): $($r.Content)"
  if ($summaryOk) { Write-Host "         season=$($summary.season) players=$($summary.player_count) open_spots=$($summary.open_spots)" }

  # 3. Registrations: pending insert allowed, self-approved insert refused.
  $pendingEmail = "$prefix@rls-test.invalid"
  $sneakyEmail = "$prefix-sneaky@rls-test.invalid"
  $minimal = @{ Prefer = 'return=minimal' }  # anon cannot read the row back, so don't ask for it
  $representation = @{ Prefer = 'return=representation' }

  $pendingBody = @{ full_name = 'Anon Check'; email = $pendingEmail } | ConvertTo-Json -Compress
  $r = Invoke-Anon -Method POST -Path 'registrations' -Body $pendingBody -ExtraHeaders $minimal
  Report ($r.Status -eq 201) 'anon inserts a pending registration (201)' "HTTP $($r.Status): $($r.Content)"

  $sneakyBody = @{ full_name = 'Anon Sneaky'; email = $sneakyEmail; status = 'invited' } | ConvertTo-Json -Compress
  $r = Invoke-Anon -Method POST -Path 'registrations' -Body $sneakyBody -ExtraHeaders $minimal
  Report (($r.Status -eq 401 -or $r.Status -eq 403) -and $r.Content -match '42501') `
    'anon cannot insert a self-approved (invited) registration (401/403, 42501)' "HTTP $($r.Status): $($r.Content)"

  # 4. Standings: everyone reads, nobody but captains writes.
  $r = Invoke-Anon -Method GET -Path 'standings?select=rank,team_name,wins&order=rank'
  $standings = @()
  # -InputObject, not the pipeline: 5.1 passes a JSON array down the pipeline as one object.
  if ($r.Status -eq 200) { $standings = @(ConvertFrom-Json -InputObject $r.Content) }
  Report ($r.Status -eq 200 -and $standings.Count -gt 0) "anon reads standings ($($standings.Count) rows)" "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method POST -Path 'standings' -ExtraHeaders $minimal -Body (@{
      season_id = '22222222-0000-0000-0000-000000000001'; rank = 99; team_name = 'Anon Check' } | ConvertTo-Json -Compress)
  Report (Test-Refused $r) 'anon cannot add a standings row (401/403, 42501)' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method PATCH -Path 'standings?rank=gte.1' -Body '{"wins":99}' -ExtraHeaders $representation
  $after = Invoke-Anon -Method GET -Path 'standings?select=id&wins=eq.99'
  Report ($r.Status -eq 200 -and $r.Content.Trim() -eq '[]' -and $after.Content.Trim() -eq '[]') `
    'anon cannot change standings (PATCH -> [], nothing changed)' "PATCH HTTP $($r.Status): $($r.Content); re-read: $($after.Content)"

  $r = Invoke-Anon -Method DELETE -Path 'standings?rank=gte.1' -ExtraHeaders $representation
  $after = Invoke-Anon -Method GET -Path 'standings?select=id'
  Report ($r.Status -eq 200 -and $r.Content.Trim() -eq '[]' -and $after.Content.Trim() -ne '[]') `
    'anon cannot delete standings (DELETE -> [], rows still there)' "DELETE HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method POST -Path 'rpc/save_standings' -Body '{"p_rows":[]}'
  Report (Test-Refused $r) 'anon cannot call save_standings()' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method POST -Path 'rpc/invite_registration' -Body '{"p_registration_id":"00000000-0000-0000-0000-000000000000"}'
  Report (Test-Refused $r) 'anon cannot invite a registration onto the roster' "HTTP $($r.Status): $($r.Content)"

  # 5. Photos table: only rows the captain marked public.
  $r = Invoke-Anon -Method GET -Path "photos?select=path&path=like.$prefix*"
  Report ($r.Status -eq 200 -and $r.Content -match [regex]::Escape($publicPath) -and $r.Content -notmatch 'private') `
    'anon reads only the public photo row' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method PATCH -Path "photos?path=eq.$privatePath" -Body '{"is_public":true}' -ExtraHeaders $representation
  Report ($r.Status -eq 200 -and $r.Content.Trim() -eq '[]') 'anon cannot make a photo public (PATCH -> [])' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method POST -Path 'rpc/set_team_photo' -Body '{"p_photo_id":"00000000-0000-0000-0000-000000000000"}'
  Report (Test-Refused $r) 'anon cannot choose the Home team photo (set_team_photo)' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method GET -Path 'photos?select=is_public&is_team_photo=eq.true'
  Report ($r.Status -eq 200 -and $r.Content -notmatch 'false') 'anon sees only a public team photo (if any)' "HTTP $($r.Status): $($r.Content)"

  # 6. Storage bucket "photos" (private): anon lists and signs only public photos' files, uploads and deletes nothing.
  $listBody = @{ prefix = $prefix; limit = 100 } | ConvertTo-Json -Compress
  $r = Invoke-Anon -Api 'storage/v1' -Method POST -Path 'object/list/photos' -Body $listBody
  $names = @()
  if ($r.Status -eq 200) { $names = @((ConvertFrom-Json -InputObject $r.Content) | ForEach-Object { $_.name }) }
  # Compare as a set: 5.1 sorts culture-aware (it ignores the hyphen), so order is not reliable.
  Report ($r.Status -eq 200 -and $names.Count -eq 2 -and $names -contains 'public.jpg' -and $names -contains 'public-thumb.jpg') `
    'anon lists only the public photo files in the bucket' "HTTP $($r.Status): $($r.Content)"

  $signBody = '{"expiresIn":60}'
  $r = Invoke-Anon -Api 'storage/v1' -Method POST -Path "object/sign/photos/$publicPath" -Body $signBody
  Report ($r.Status -eq 200 -and $r.Content -match 'signedURL') 'anon can sign a public photo URL' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Api 'storage/v1' -Method POST -Path "object/sign/photos/$privatePath" -Body $signBody
  Report ($r.Status -in 400, 403, 404 -and $r.Content -notmatch 'signedURL') 'anon cannot sign a private photo URL' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Api 'storage/v1' -Method GET -Path "object/photos/$publicPath"
  Report ($r.Status -in 400, 401, 403, 404) 'anon cannot download straight from the private bucket' "HTTP $($r.Status)"

  [byte[]]$jpeg = 0xFF, 0xD8, 0xFF, 0xD9
  $r = Invoke-Anon -Api 'storage/v1' -Method POST -Path "object/photos/$prefix/anon-upload.jpg" -Bytes $jpeg -ContentType 'image/jpeg'
  Report ($r.Status -in 400, 401, 403) 'anon cannot upload to the photos bucket' "HTTP $($r.Status): $($r.Content)"

  $deleteBody = @{ prefixes = @($publicPath) } | ConvertTo-Json -Compress
  $r = Invoke-Anon -Api 'storage/v1' -Method DELETE -Path 'object/photos' -Body $deleteBody
  $relist = Invoke-Anon -Api 'storage/v1' -Method POST -Path 'object/list/photos' -Body $listBody
  Report ($relist.Content -match '"public\.jpg"') 'anon cannot delete photo files' "DELETE HTTP $($r.Status): $($r.Content); re-list: $($relist.Content)"

  # 7. Calendar: public RPC shows public events only; the personal feed and token RPCs are off limits.
  $r = Invoke-Anon -Method POST -Path 'rpc/public_calendar' -Body '{}'
  # Exact, case-sensitive titles of the seed's members-only events (captains may add similar public ones).
  Report ($r.Status -eq 200 -and $r.Content -match 'Open hitting session' -and $r.Content -cnotmatch '"title":"(Team practice|Playoff roster deadline)"') `
    'anon calls public_calendar(): public events only' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method POST -Path 'rpc/calendar_feed' -Body '{"p_token":"cccccccc-0000-0000-0000-000000000000"}'
  Report (Test-Refused $r) 'anon cannot call calendar_feed() (service role only)' "HTTP $($r.Status): $($r.Content)"

  $r = Invoke-Anon -Method POST -Path 'rpc/regenerate_my_calendar_token' -Body '{}'
  Report (Test-Refused $r) 'anon cannot call regenerate_my_calendar_token()' "HTTP $($r.Status): $($r.Content)"

  # 8. Public results: aggregates and standings, no player names.
  $r = Invoke-Anon -Method POST -Path 'rpc/public_results' -Body '{}'
  $resultsOk = $false
  if ($r.Status -eq 200) {
    $results = $r.Content | ConvertFrom-Json
    $resultsOk = ($null -ne $results.singles_won) -and (@($results.standings).Count -gt 0) -and ($r.Content -notmatch 'J\. Chen|M\. Alvarez')
  }
  Report $resultsOk 'anon calls public_results(): totals and standings, no player names' "HTTP $($r.Status): $($r.Content)"
} finally {
  # 9. Clean up the fixtures and test registration(s). Anon can't delete, so use the linked CLI.
  #    Storage refuses direct deletes unless storage.allow_delete_query is set (the Storage API sets it).
  Write-Host ''
  $cleanupSql = @"
select set_config('storage.allow_delete_query', 'true', false);
delete from storage.objects where bucket_id = 'photos' and name like '$prefix/%';
delete from public.photos where path like '$prefix/%';
delete from public.registrations where email like '$prefix%@rls-test.invalid';
"@
  $cleanup = Invoke-Linked $cleanupSql
  if ($cleanup.Ok) {
    Write-Host "cleanup: removed photo fixtures and test registrations for $prefix (via supabase db query --linked)"
  } else {
    Write-Host "cleanup FAILED; remove photos/storage objects under '$prefix/' and registrations like '$prefix%' manually." -ForegroundColor Yellow
    Write-Host $cleanup.Out
  }
}

Write-Host ''
if ($script:failures -gt 0) {
  Write-Host "$script:failures check(s) failed" -ForegroundColor Red
  exit 1
}
Write-Host 'All anonymous-access checks passed' -ForegroundColor Green
exit 0
