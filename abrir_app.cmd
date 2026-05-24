@echo off
cd /d "%~dp0"
start "Option File Editor Pro Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
timeout /t 2 /nobreak >nul
start "" http://localhost:4173
