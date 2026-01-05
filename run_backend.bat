@echo off
setlocal

cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo Creating Python virtual environment...
  python -m venv "backend\.venv"
)

call "backend\.venv\Scripts\activate.bat"

pushd "backend"
echo Installing backend dependencies...
python -m pip install --upgrade pip
python -m pip install -r "requirements.txt"
echo.
echo Starting backend on http://localhost:8000 ...
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
popd

endlocal
