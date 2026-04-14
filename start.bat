@echo off
setlocal

REM ============================================================================
REM INICIA BOT + NGROK
REM ============================================================================

cd /d "%~dp0"

echo.
echo ==================================
echo  BOT FOLHA PONTO - MATRIZ
echo ==================================
echo.

if not exist ".env" if not exist ".env.ready" (
    echo Arquivo .env/.env.ready nao encontrado.
    echo Crie um .env a partir de .env.example ou mantenha o .env.ready versionado.
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js nao encontrado.
    echo Instale em: https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo Falha ao instalar dependencias.
        pause
        exit /b 1
    )
    echo.
)

set "CONFIG_FILE=%TEMP%\chat-bot-config-%RANDOM%.tmp"
node scripts\validate-runtime-config.js > "%CONFIG_FILE%"
if errorlevel 1 (
    del "%CONFIG_FILE%" >nul 2>&1
    echo Configuracao obrigatoria ausente no .env.
    echo Confirme WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WEBHOOK_VERIFY_TOKEN.
    pause
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do set "%%A=%%B"
del "%CONFIG_FILE%" >nul 2>&1

for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo Encerrando processo na porta %PORT%: PID %%P
    taskkill /PID %%P /F >nul 2>&1
)

echo Abrindo NGROK...
start "BOT - NGROK" cmd /k "npm run ngrok:start && pause"

timeout /t 3 /nobreak >nul

echo Abrindo BOT...
start "BOT - NPM SERVER" cmd /k "npm run dev && pause"

echo.
echo ========================================
echo  BOT INICIADO
echo ========================================
echo.
echo Proximos passos:
echo  1. Guarde a URL do NGROK
echo  2. Configure webhook na Meta:
echo     URL: https://seu-ngrok.ngrok.io/webhook
echo     Token: %WEBHOOK_VERIFY_TOKEN%
echo  3. Confirme que o phone_number_id do .env pertence ao numero oficial
echo.
pause
