# ============================================================================
# SCRIPT COMPLETO: BOT + NGROK
# ============================================================================

Write-Host "Iniciando Bot Folha Ponto - Xaxim" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js nao encontrado. Instale em nodejs.org" -ForegroundColor Red
    exit 1
}

if (!(Test-Path "$PSScriptRoot\.env") -and !(Test-Path "$PSScriptRoot\.env.ready")) {
    Write-Host "Arquivo .env/.env.ready nao encontrado." -ForegroundColor Red
    Write-Host "Crie um .env a partir de .env.example ou mantenha o .env.ready versionado." -ForegroundColor Yellow
    exit 1
}

Set-Location $PSScriptRoot

if (!(Test-Path "node_modules")) {
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
    exit 1
}

Write-Host "`nIniciando ngrok em novo terminal..." -ForegroundColor Yellow
$ngrokCmd = "cd '$PSScriptRoot'; npm run ngrok:start; Read-Host 'Pressione Enter para fechar'"
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", $ngrokCmd -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host "`nIniciando servidor bot..." -ForegroundColor Green
npm run dev
