# ============================================================================
# INICIA BOT + NGROK EM TERMINAIS SEPARADOS
# ============================================================================

Write-Host "BOT FOLHA PONTO - MATRIZ" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

$botDir = $PSScriptRoot

function Stop-ProcessOnPort {
    param([int]$Port)

    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if (!$connections) {
            Write-Host "Porta $Port ja esta livre." -ForegroundColor DarkGray
            return
        }

        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            if ($pid -and $pid -gt 0) {
                $processInfo = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($processInfo) {
                    Write-Host "Encerrando processo na porta ${Port}: $($processInfo.ProcessName) (PID $pid)" -ForegroundColor Yellow
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        Write-Host "Nao foi possivel verificar/liberar a porta ${Port}: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (!(Test-Path "$botDir\.env") -and !(Test-Path "$botDir\.env.ready")) {
    Write-Host "Arquivo .env/.env.ready nao encontrado." -ForegroundColor Red
    Write-Host "Crie um .env a partir de .env.example ou mantenha o .env.ready versionado." -ForegroundColor Yellow
    exit 1
}

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js nao encontrado." -ForegroundColor Red
    Write-Host "Instale em: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Set-Location $botDir

if (!(Test-Path "$botDir\node_modules")) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Falha ao instalar dependencias." -ForegroundColor Red
        exit 1
    }
}

$configOutput = node .\scripts\validate-runtime-config.js 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Configuracao obrigatoria ausente no .env." -ForegroundColor Red
    Write-Host "Confirme WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WEBHOOK_VERIFY_TOKEN." -ForegroundColor Yellow
    exit 1
}

$config = @{}
foreach ($line in $configOutput) {
    if ($line -match '^(.*?)=(.*)$') {
        $config[$matches[1]] = $matches[2]
    }
}

$botPort = [int]$config['PORT']
$webhookToken = $config['WEBHOOK_VERIFY_TOKEN']

Stop-ProcessOnPort -Port $botPort

Write-Host "Abrindo NGROK em novo terminal..." -ForegroundColor Cyan
$ngrokCommand = "cd '$botDir'; npm run ngrok:start; Read-Host 'Pressione Enter para fechar'"
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", $ngrokCommand -WindowStyle Normal -PassThru | Out-Null

Write-Host "Aguardando ngrok iniciar (3s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Abrindo BOT em novo terminal..." -ForegroundColor Green
$botCommand = "cd '$botDir'; npm run dev; Read-Host 'Pressione Enter para fechar'"
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", $botCommand -WindowStyle Normal -PassThru | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "BOT INICIADO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "1. Guarde a URL do NGROK (terminal 1)"
Write-Host "2. Configure webhook na Meta:"
Write-Host "   URL: https://seu-ngrok.ngrok.io/webhook"
Write-Host "   Token: $webhookToken"
Write-Host "3. Confirme que o phone_number_id configurado no .env pertence ao numero oficial"
Write-Host ""
