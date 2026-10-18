# Starts (or with -Stop, only stops) the headless Chrome that scripts/lighthouse.sh drives on
# port 9333, with a fresh throwaway profile each time so runs don't affect each other.
param([switch]$Stop)
$profileDir = Join-Path ([System.IO.Path]::GetTempPath()) 'stags-lighthouse-chrome'
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
  Where-Object { $_.CommandLine -like '*remote-debugging-port=9333*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 800
if (Test-Path $profileDir) { Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue }
if ($Stop) { return }
New-Item -ItemType Directory -Force $profileDir | Out-Null
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Start-Process -FilePath $chrome -ArgumentList @('--headless=new', '--remote-debugging-port=9333', "--user-data-dir=$profileDir", '--no-first-run', '--no-default-browser-check', 'about:blank') | Out-Null
for ($i = 0; $i -lt 20; $i++) {
  try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9333/json/version -TimeoutSec 1 | Out-Null; break } catch { Start-Sleep -Milliseconds 300 }
}
