@echo off
chcp 65001 >nul
title Locket AI Studio - Flux & Gemini
echo ====================================================
echo   Đang khởi động Locket AI Studio tại cổng 3456...
echo   Trình duyệt sẽ tự động mở: http://localhost:3456
echo ====================================================
start http://localhost:3456
node "%~dp0server.js"
pause

