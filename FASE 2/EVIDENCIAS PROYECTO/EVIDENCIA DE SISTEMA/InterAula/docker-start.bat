@echo off
setlocal
pushd "%~dp0"

title InterAula - Servidor Local Docker (Mantener esta ventana abierta)

REM 1. Verificar si Docker esta disponible nativamente en Windows
where docker >nul 2>&1
if not errorlevel 1 (
  goto :RUN_NATIVE
)

REM 2. Si no esta en Windows PATH, verificar si esta disponible en WSL2
where wsl >nul 2>&1
if not errorlevel 1 (
  wsl -d Ubuntu-24.04 docker --version >nul 2>&1
  if not errorlevel 1 (
    goto :RUN_WSL
  )
  wsl docker --version >nul 2>&1
  if not errorlevel 1 (
    goto :RUN_WSL_DEFAULT
  )
)

echo Docker no esta instalado o no esta disponible en PATH ni en WSL.
echo Instale o inicie Docker Desktop, o configure Docker en WSL2 Ubuntu.
pause
popd
exit /b 1

:RUN_NATIVE
docker info >nul 2>&1
if errorlevel 1 (
  echo Iniciando Docker Desktop. Espere a que el motor este listo...
  powershell.exe -NoProfile -Command "$desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'; if (-not (Test-Path -LiteralPath $desktop)) { exit 1 }; Start-Process -FilePath $desktop -WindowStyle Hidden"
  if errorlevel 1 (
    echo No se encontro Docker Desktop. Abra Docker Desktop manualmente.
    pause
    popd
    exit /b 1
  )
  powershell.exe -NoProfile -Command "$deadline = (Get-Date).AddSeconds(120); do { docker info *> $null; if ($LASTEXITCODE -eq 0) { exit 0 }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo Docker Desktop no quedo listo. Revise su ventana y vuelva a intentarlo.
    pause
    popd
    exit /b 1
  )
)
if not exist "backend\.env" (
  echo Falta backend\.env. Copie backend\.env.example y configure Supabase.
  pause
  popd
  exit /b 1
)
docker compose --env-file "backend\.env" up -d --build --force-recreate
if errorlevel 1 (
  echo Fallo la construccion o el inicio de InterAula. Revise el error anterior.
  pause
  popd
  exit /b 1
)
docker compose --env-file "backend\.env" ps
echo.
echo ==========================================================
echo  InterAula ya esta en ejecucion en Docker:
echo    - Frontend (App Web):   http://localhost
echo    - Backend (API REST):   http://localhost:3001/api/health
echo.
echo  Mostrando logs en tiempo real. Mantenga esta ventana abierta.
echo  (Presione Ctrl+C para salir de los logs)
echo ==========================================================
echo.
docker compose --env-file "backend\.env" logs -f --tail=25
pause
popd
endlocal
exit /b 0

:RUN_WSL
echo [Docker WSL2] Asegurando que el servicio Docker este activo en Ubuntu-24.04...
wsl -d Ubuntu-24.04 -u root service docker start >nul 2>&1
wsl -d Ubuntu-24.04 -u root --cd "%~dp0" docker compose up -d --build --force-recreate
if errorlevel 1 (
  echo Fallo el levantamiento de contenedores en WSL2.
  pause
  popd
  exit /b 1
)
wsl -d Ubuntu-24.04 -u root --cd "%~dp0" docker compose ps
echo.
echo ==========================================================
echo  InterAula ya esta en ejecucion en WSL2:
echo    - Frontend (App Web):   http://localhost
echo    - Backend (API REST):   http://localhost:3001/api/health
echo.
echo  IMPORTANTE: Mantenga esta ventana abierta mientras use
echo  InterAula para evitar que Windows suspenda WSL2.
echo  (Presione Ctrl+C para salir de los logs)
echo ==========================================================
echo.
wsl -d Ubuntu-24.04 -u root --cd "%~dp0" docker compose logs -f --tail=25
pause
popd
endlocal
exit /b 0

:RUN_WSL_DEFAULT
echo [Docker WSL] Asegurando servicio Docker...
wsl -u root service docker start >nul 2>&1
wsl --cd "%~dp0" docker compose up -d --build --force-recreate
if errorlevel 1 (
  echo Fallo el levantamiento de contenedores en WSL.
  pause
  popd
  exit /b 1
)
wsl --cd "%~dp0" docker compose ps
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
wsl --cd "%~dp0" docker compose logs -f --tail=25
pause
popd
endlocal
exit /b 0
