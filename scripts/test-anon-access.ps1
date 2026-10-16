<#
  Anonymous-access check against the Supabase REST API (what a logged-out browser can do).
  Uses only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local.

  Works in Windows PowerShell 5.1 and PowerShell 7:
    powershell -ExecutionPolicy Bypass -File scripts\test-anon-access.ps1

  Reads must come back as exactly '[]' (raw Invoke-WebRequest content, not a count of
  Invoke-RestMethod results, which 5.1 gets wrong for empty arrays). The pending-registration
  insert writes a real row tagged @rls-test.invalid; it is deleted at the end through the
  linked Supabase CLI (npx supabase db query --linked). Exit code 1 if any check fails.
#>
$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 may default to TLS 1.0, which Supabase rejects.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
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
function Invoke-Anon {
  param([string]$Method, [string]$Path, [string]$Body, [hashtable]$ExtraHeaders = @{})
  $h = $headers.Clone()
  foreach ($k in $ExtraHeaders.Keys) { $h[$k] = $ExtraHeaders[$k] }
  $params = @{ Uri = "$baseUrl/rest/v1/$Path"; Method = $Method; Headers = $h; UseBasicParsing = $true }
  if ($Body) { $params.Body = $Body; $params.ContentType = 'application/json' }
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

Write-Host "Anonymous access checks against $baseUrl"
Write-Host ''

# 1. Member-only tables: anon must get 200 with an empty array.
foreach ($table in 'players', 'lineup_slots', 'availability', 'matches', 'registrations') {
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
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$pendingEmail = "anon-check-$stamp@rls-test.invalid"
$sneakyEmail = "anon-check-$stamp-sneaky@rls-test.invalid"
$minimal = @{ Prefer = 'return=minimal' }  # anon cannot read the row back, so don't ask for it

$pendingBody = @{ full_name = 'Anon Check'; email = $pendingEmail } | ConvertTo-Json -Compress
$r = Invoke-Anon -Method POST -Path 'registrations' -Body $pendingBody -ExtraHeaders $minimal
Report ($r.Status -eq 201) 'anon inserts a pending registration (201)' "HTTP $($r.Status): $($r.Content)"

$sneakyBody = @{ full_name = 'Anon Sneaky'; email = $sneakyEmail; status = 'invited' } | ConvertTo-Json -Compress
$r = Invoke-Anon -Method POST -Path 'registrations' -Body $sneakyBody -ExtraHeaders $minimal
Report (($r.Status -eq 401 -or $r.Status -eq 403) -and $r.Content -match '42501') `
  'anon cannot insert a self-approved (invited) registration (401/403, 42501)' "HTTP $($r.Status): $($r.Content)"

# 4. Clean up the test registration(s). Anon can't delete, so use the linked CLI.
Write-Host ''
Push-Location $root
# In 5.1, 'Stop' turns any stderr line from a native command (the CLI prints status there) into an error.
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $sql = "delete from public.registrations where email like 'anon-check-$stamp%@rls-test.invalid' returning email"
  $out = & npx.cmd supabase db query --linked $sql 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    Write-Host "cleanup: removed test registrations for anon-check-$stamp (via supabase db query --linked)"
  } else {
    Write-Host "cleanup FAILED; delete registrations with email like 'anon-check-$stamp%' manually." -ForegroundColor Yellow
    Write-Host $out
  }
} finally {
  $ErrorActionPreference = $previousPreference
  Pop-Location
}

Write-Host ''
if ($script:failures -gt 0) {
  Write-Host "$script:failures check(s) failed" -ForegroundColor Red
  exit 1
}
Write-Host 'All anonymous-access checks passed' -ForegroundColor Green
exit 0
