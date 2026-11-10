@echo off
setlocal
pushd "%~dp0"
where docker >nul 2>&1
if errorlevel 1 (
  echo Docker no esta instalado o no esta disponible en PATH.
  popd
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo Iniciando Docker Desktop. Espere a que el motor este listo...
  powershell.exe -NoProfile -Command "$desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'; if (-not (Test-Path -LiteralPath $desktop)) { exit 1 }; Start-Process -FilePath $desktop -WindowStyle Hidden"
  if errorlevel 1 (
    echo No se encontro Docker Desktop. Abra Docker Desktop manualmente.
    popd
    exit /b 1
  )
  powershell.exe -NoProfile -Command "$deadline = (Get-Date).AddSeconds(120); do { docker info *> $null; if ($LASTEXITCODE -eq 0) { exit 0 }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo Docker Desktop no quedo listo. Revise su ventana y vuelva a intentarlo.
    popd
    exit /b 1
  )
)
if not exist "backend\.env" (
  echo Falta backend\.env. Copie backend\.env.example y configure Supabase.
  popd
  exit /b 1
)
docker compose --env-file "backend\.env" up -d --build
if errorlevel 1 (
  echo Fallo la construccion o el inicio de InterAula. Revise el error anterior.
  popd
  exit /b 1
)
docker compose --env-file "backend\.env" ps
echo InterAula: http://localhost
popd
endlocal
