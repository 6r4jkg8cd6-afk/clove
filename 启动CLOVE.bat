@echo off
title CLOVE
cd /d "%~dp0"
start "CLOVE local server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:4173/clove/"
