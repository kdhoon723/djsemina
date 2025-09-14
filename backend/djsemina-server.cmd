@echo off
setlocal

rem Ensure working directory is this script's directory
cd /d "%~dp0"

rem Start npm server in a new CMD window
start "npm start" cmd /k npm start

rem Start Cloudflare tunnel in a new CMD window
start "cloudflared tunnel" cmd /k cloudflared tunnel run kdhoon-api

exit /b


