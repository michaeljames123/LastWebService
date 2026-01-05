@echo off
setlocal

cd /d "%~dp0"

start "AgridroneScan Backend" cmd /k "\"%~dp0run_backend.bat\""
start "AgridroneScan Frontend" cmd /k "\"%~dp0run_frontend.bat\""

endlocal
