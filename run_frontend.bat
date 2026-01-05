@echo off
setlocal

cd /d "%~dp0"

pushd "frontend"
if not exist "node_modules" (
  echo Installing frontend dependencies...
  npm install
)
echo.
echo Starting frontend on http://localhost:5174 ...
npm run dev
popd

endlocal
