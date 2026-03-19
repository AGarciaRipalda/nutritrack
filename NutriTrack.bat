@echo off
title NutriTrack — Iniciando...
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║         NutriTrack  Startup          ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── 1. Matar instancias previas ──────────────────────────────────────────────
echo  [1/3] Limpiando sesion anterior...
taskkill /F /IM ngrok.exe >nul 2>&1

:: ── 2. Arrancar ngrok en ventana separada ────────────────────────────────────
echo  [2/3] Arrancando tunel ngrok...
start "ngrok - NutriTrack" cmd /k "ngrok http 8000"

:: Dar tiempo a ngrok para inicializarse
timeout /t 4 /nobreak >nul

:: ── 3. Arrancar script principal en WSL ──────────────────────────────────────
echo  [3/3] Arrancando backend y configurando Vercel...
echo.
wsl -e bash /mnt/c/Users/Alejandro/iniciar_nutritrack.sh

:: Si WSL cierra inesperadamente
echo.
echo  El script ha terminado. Pulsa cualquier tecla para cerrar.
pause >nul
