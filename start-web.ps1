$ErrorActionPreference = 'SilentlyContinue'
$root = 'C:\Users\ACER\.gemini\antigravity\scratch\locket-ai-studio'
$dataDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# Dừng tiến trình cũ nếu đang kẹt
Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*locket-ai-studio*server.js*') -or
  ($_.Name -eq 'cloudflared.exe')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

$serverOut = Join-Path $dataDir 'server.log'
$serverErr = Join-Path $dataDir 'server.err.log'
$tunnelOut = Join-Path $dataDir 'tunnel.out.log'
$tunnelLog = Join-Path $dataDir 'tunnel.log'
Remove-Item $tunnelLog, $tunnelOut -Force

Start-Process -FilePath 'node' -ArgumentList (Join-Path $root 'server.js') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr
Start-Process -FilePath 'C:\Program Files (x86)\cloudflared\cloudflared.exe' -ArgumentList 'tunnel','--url','http://localhost:3456' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelLog

$url = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tunnelLog) {
    $content = Get-Content $tunnelLog -Raw
    if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
      $url = $Matches[0]
      break
    }
  }
}

Write-Output "TUNNEL_URL=$url"

