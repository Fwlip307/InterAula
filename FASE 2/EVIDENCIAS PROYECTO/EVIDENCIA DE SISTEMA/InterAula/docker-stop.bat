@echo off
title InterAula - Detener Contenedores Docker
echo ==========================================================
echo       Deteniendo InterAula en Docker
echo ==========================================================
wsl -d Ubuntu-24.04 -u root --cd "/mnt/c/Users/FELIPE/Documents/GitHub/InterAula/FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula" docker compose down
echo.
echo Contenedores detenidos correctamente.
echo.
pause
