@echo off
setlocal
pushd "%~dp0"
docker compose --env-file "backend\.env" down
set "INTERAULA_EXIT=%ERRORLEVEL%"
popd
exit /b %INTERAULA_EXIT%
