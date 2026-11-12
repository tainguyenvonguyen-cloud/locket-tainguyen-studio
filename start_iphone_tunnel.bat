@echo off
chcp 65001 >nul
title Locket AI Studio - Server & iPhone HTTPS Tunnel
cd /d "%~dp0"
echo ========================================================
echo   KHOI DONG LOCKET AI STUDIO + HTTPS TUNNEL CHO IPHONE
echo ========================================================
echo.
start "Locket Server (3456)" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
echo Dang mo ket noi HTTPS Cloudflare Tunnel...
echo Hay copy duong link https://*.trycloudflare.com ben duoi mo tren Safari iPhone!
echo.
if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
  "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3456
) else if exist "C:\Program Files\cloudflared\cloudflared.exe" (
  "C:\Program Files\cloudflared\cloudflared.exe" tunnel --url http://localhost:3456
) else (
  cloudflared tunnel --url http://localhost:3456
)
pause
