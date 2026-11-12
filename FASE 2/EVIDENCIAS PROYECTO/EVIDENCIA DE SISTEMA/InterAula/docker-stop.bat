@echo off
setlocal
pushd "%~dp0"

echo ==========================================================
echo       Deteniendo contenedores de InterAula...
echo ==========================================================

where docker >nul 2>&1
if not errorlevel 1 (
  docker compose --env-file "backend\.env" down
  echo Contenedores detenidos correctamente.
  popd
  exit /b 0
)

where wsl >nul 2>&1
if not errorlevel 1 (
  wsl -d Ubuntu-24.04 -u root --cd "%~dp0" docker compose down
  echo Contenedores detenidos correctamente en WSL2.
  popd
  exit /b 0
)

echo No se encontro Docker ni WSL para detener los contenedores.
popd
exit /b 1
