@echo off
title InterAula - Contenedores Docker Activos (No cerrar esta ventana)
echo ==========================================================
echo       Iniciando InterAula en Docker (WSL2 Ubuntu)
echo ==========================================================
echo 1. Asegurando que el servicio Docker este activo...
wsl -d Ubuntu-24.04 -u root service docker start

echo 2. Levantando los contenedores con Docker Compose...
wsl -d Ubuntu-24.04 -u root --cd "/mnt/c/Users/FELIPE/Documents/GitHub/InterAula/FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula" docker compose up -d

echo.
echo 3. Verificando estado de los contenedores:
wsl -d Ubuntu-24.04 -u root --cd "/mnt/c/Users/FELIPE/Documents/GitHub/InterAula/FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula" docker compose ps

echo.
echo ==========================================================
echo  InterAula ya esta en ejecucion:
echo    - Frontend (App Web):   http://localhost
echo    - Backend (API REST):   http://localhost:3001/api/health
echo.
echo  IMPORTANTE: Mantenga esta ventana abierta mientras use
echo  InterAula para evitar que Windows suspenda WSL2.
echo  (Presione Ctrl+C para dejar de ver los logs)
echo ==========================================================
echo.
wsl -d Ubuntu-24.04 -u root --cd "/mnt/c/Users/FELIPE/Documents/GitHub/InterAula/FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula" docker compose logs -f --tail=25
