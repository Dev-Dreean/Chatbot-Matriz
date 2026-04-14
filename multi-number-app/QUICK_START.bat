@echo off
REM ============================================
REM Quick Start Script - Multi-Number WhatsApp
REM ============================================

cls
echo.
echo ╔════════════════════════════════════════════╗
echo ║  WhatsApp Multi-Number - Quick Start 🚀   ║
echo ╚════════════════════════════════════════════╝
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [!] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [x] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies already installed
)

echo.
echo What would you like to do?
echo [1] Run tests (npm test)
echo [2] Start development server (npm run dev)
echo [3] Both - install, test, and dev
echo [0] Exit
echo.

set /p option="👉 Select option: "

if "%option%"=="1" (
    echo.
    echo Running tests...
    call npm test
    pause
) else if "%option%"=="2" (
    echo.
    echo Starting development server...
    call npm run dev
) else if "%option%"=="3" (
    echo.
    echo Running tests...
    call npm test
    echo.
    echo Starting development server...
    call npm run dev
) else if "%option%"=="0" (
    echo.
    echo Goodbye!
    exit /b 0
) else (
    echo.
    echo Invalid option
    pause
    exit /b 1
)

pause
