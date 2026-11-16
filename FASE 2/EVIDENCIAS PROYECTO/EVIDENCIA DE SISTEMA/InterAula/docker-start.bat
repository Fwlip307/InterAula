@echo off
setlocal enabledelayedexpansion
pushd "%~dp0"

title InterAula - Despliegue Docker

REM Determinar archivo de entorno disponible (.env o backend\.env)
set "ENV_ARG="
if exist "backend\.env" (
  set "ENV_ARG=--env-file backend\.env"
) else if exist ".env" (
  set "ENV_ARG=--env-file .env"
) else if exist ".env.example" (
  copy ".env.example" ".env" >nul
  echo [InterAula] Archivo .env generado automaticamente desde .env.example.
  set "ENV_ARG=--env-file .env"
) else (
  echo [Error] No se encontro backend\.env ni .env.
  echo Copie .env.example a .env ^(o backend\.env.example a backend\.env^) y configure Supabase.
  pause
  popd
  exit /b 1
)

REM Detectar e incorporar al PATH las rutas habituales de Docker Desktop si no esta en el PATH actual
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
  set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;%PATH%"
)
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
  set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
)

REM 1. Verificar si Docker esta disponible nativamente en Windows (Docker Desktop / Docker Engine)
where docker >nul 2>&1
if not errorlevel 1 (
  goto :RUN_NATIVE
)

REM 2. Si no esta en Windows PATH, buscar automaticamente cualquier distro WSL con Docker
where wsl >nul 2>&1
if not errorlevel 1 (
  wsl docker --version >nul 2>&1
  if not errorlevel 1 (
    set "WSL_DISTRO="
    goto :RUN_WSL
  )
  for /f "usebackq delims=" %%D in (`powershell.exe -NoProfile -Command "wsl -l -q | ForEach-Object { $_.Trim([char]0, ' ', [char]9, [char]13, [char]10) } | Where-Object { $_ -ne '' }"`) do (
    wsl -d "%%D" docker --version >nul 2>&1
    if not errorlevel 1 (
      set "WSL_DISTRO=%%D"
      goto :RUN_WSL
    )
  )
)

echo [Error] Docker no esta instalado o no esta disponible en PATH ni en WSL.
echo Instale Docker Desktop ^(https://www.docker.com/products/docker-desktop/^) o Docker Engine en WSL2.
pause
popd
exit /b 1

:RUN_NATIVE
docker info >nul 2>&1
if errorlevel 1 (
  echo Iniciando Docker Desktop. Espere a que el motor este listo...
  powershell.exe -NoProfile -Command "$paths = @((Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'), (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe')); $desktop = $paths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1; if (-not $desktop) { exit 1 }; Start-Process -FilePath $desktop -WindowStyle Hidden"
  if errorlevel 1 (
    echo No se encontro Docker Desktop. Inicie el servicio Docker manualmente y vuelva a intentar.
    pause
    popd
    exit /b 1
  )
  powershell.exe -NoProfile -Command "$deadline = (Get-Date).AddSeconds(120); do { docker info *> $null; if ($LASTEXITCODE -eq 0) { exit 0 }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo Docker Desktop no quedo listo a tiempo. Revise su ventana y vuelva a intentarlo.
    pause
    popd
    exit /b 1
  )
)

set "COMPOSE_CMD=docker compose"
docker compose version >nul 2>&1
if errorlevel 1 (
  where docker-compose >nul 2>&1
  if not errorlevel 1 (
    set "COMPOSE_CMD=docker-compose"
  ) else (
    echo [Error] No se encontro 'docker compose' ni 'docker-compose'. Actualice Docker.
    pause
    popd
    exit /b 1
  )
)

%COMPOSE_CMD% %ENV_ARG% up -d --build --force-recreate
if errorlevel 1 (
  echo Fallo la construccion o el inicio de InterAula. Revise el error anterior.
  pause
  popd
  exit /b 1
)
%COMPOSE_CMD% %ENV_ARG% ps
echo.
echo ==========================================================
echo  InterAula ya esta en ejecucion en Docker:
echo    - Frontend (App Web):   http://localhost
echo    - Backend (API REST):   http://localhost:3001/api/health
echo.
echo  Mostrando logs en tiempo real. Mantenga esta ventana abierta.
echo  (Presione Ctrl+C para salir de los logs; los contenedores seguiran activos)
echo ==========================================================
echo.
%COMPOSE_CMD% %ENV_ARG% logs -f --tail=25
pause
popd
endlocal
exit /b 0

:RUN_WSL
set "WSL_ENV_ARG=%ENV_ARG:\=/%"
if "%WSL_DISTRO%"=="" (
  echo [Docker WSL] Usando distribucion predeterminada de WSL...
  wsl -u root service docker start >nul 2>&1
  wsl --cd "%~dp0" docker compose %WSL_ENV_ARG% up -d --build --force-recreate
  if errorlevel 1 (
    echo Fallo el levantamiento de contenedores en WSL.
    pause
    popd
    exit /b 1
  )
  wsl --cd "%~dp0" docker compose %WSL_ENV_ARG% ps
  echo.
  echo ==========================================================
  echo  InterAula ya esta en ejecucion en WSL:
  echo    - Frontend (App Web):   http://localhost
  echo    - Backend (API REST):   http://localhost:3001/api/health
  echo.
  echo  IMPORTANTE: Mantenga esta ventana abierta mientras use
  echo  InterAula para evitar que Windows suspenda WSL2.
  echo  (Presione Ctrl+C para salir de los logs)
  echo ==========================================================
  echo.
  wsl --cd "%~dp0" docker compose %WSL_ENV_ARG% logs -f --tail=25
) else (
  echo [Docker WSL2] Usando distribucion "%WSL_DISTRO%"...
  wsl -d "%WSL_DISTRO%" -u root service docker start >nul 2>&1
  wsl -d "%WSL_DISTRO%" -u root --cd "%~dp0" docker compose %WSL_ENV_ARG% up -d --build --force-recreate
  if errorlevel 1 (
    echo Fallo el levantamiento de contenedores en WSL2.
    pause
    popd
    exit /b 1
  )
  wsl -d "%WSL_DISTRO%" -u root --cd "%~dp0" docker compose %WSL_ENV_ARG% ps
  echo.
  echo ==========================================================
  echo  InterAula ya esta en ejecucion en WSL2 ^(%WSL_DISTRO%^):
  echo    - Frontend (App Web):   http://localhost
  echo    - Backend (API REST):   http://localhost:3001/api/health
  echo.
  echo  IMPORTANTE: Mantenga esta ventana abierta mientras use
  echo  InterAula para evitar que Windows suspenda WSL2.
  echo  (Presione Ctrl+C para salir de los logs)
  echo ==========================================================
  echo.
  wsl -d "%WSL_DISTRO%" -u root --cd "%~dp0" docker compose %WSL_ENV_ARG% logs -f --tail=25
)
pause
popd
endlocal
exit /b 0
