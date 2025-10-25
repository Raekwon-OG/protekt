@echo off
REM Protekt Agent - Windows Batch Runner
REM This script runs the Protekt Agent with proper environment setup

echo Starting Protekt Agent...

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Check if requirements are installed
python -c "import psutil, requests, cryptography" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Create data directories if they don't exist
if not exist "data" mkdir data
if not exist "backups" mkdir backups
if not exist "quarantine" mkdir quarantine

REM Run the agent
echo Starting Protekt Agent...
python main.py

REM If the agent exits, show error
if errorlevel 1 (
    echo.
    echo Protekt Agent exited with an error
    echo Check the logs in data/logs/ for more information
    pause
)
