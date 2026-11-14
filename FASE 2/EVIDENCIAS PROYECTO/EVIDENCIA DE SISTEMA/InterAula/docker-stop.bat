@echo off
setlocal enabledelayedexpansion
pushd "%~dp0"

echo ==========================================================
echo       Deteniendo contenedores de InterAula...
echo ==========================================================

set "ENV_ARG="
if exist "backend\.env" (
  set "ENV_ARG=--env-file backend\.env"
) else if exist ".env" (
  set "ENV_ARG=--env-file .env"
)

REM Detectar e incorporar al PATH las rutas habituales de Docker Desktop si no esta en el PATH actual
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
  set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;%PATH%"
)
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
  set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
)

where docker >nul 2>&1
if not errorlevel 1 (
  docker compose version >nul 2>&1
  if not errorlevel 1 (
    docker compose %ENV_ARG% down
  ) else (
    docker-compose %ENV_ARG% down
  )
  echo Contenedores detenidos correctamente.
  popd
  exit /b 0
)

where wsl >nul 2>&1
if not errorlevel 1 (
  set "WSL_ENV_ARG=%ENV_ARG:\=/%"
  wsl docker --version >nul 2>&1
  if not errorlevel 1 (
    wsl --cd "%~dp0" docker compose %WSL_ENV_ARG% down
    echo Contenedores detenidos correctamente en WSL.
    popd
    exit /b 0
  )
  for /f "usebackq delims=" %%D in (`powershell.exe -NoProfile -Command "wsl -l -q | ForEach-Object { $_.Trim([char]0, ' ', [char]9, [char]13, [char]10) } | Where-Object { $_ -ne '' }"`) do (
    wsl -d "%%D" docker --version >nul 2>&1
    if not errorlevel 1 (
      wsl -d "%%D" -u root --cd "%~dp0" docker compose %WSL_ENV_ARG% down
      echo Contenedores detenidos correctamente en WSL2 ^(%%D^).
      popd
      exit /b 0
    )
  )
)

echo No se encontro Docker ni WSL para detener los contenedores.
popd
exit /b 1
