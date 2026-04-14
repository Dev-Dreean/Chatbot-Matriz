# update.ps1 - script seguro de atualização para o bot
# Executar na raiz do projeto

param(
    # update.ps1 - script seguro de atualização para o bot
    # Executar na raiz do projeto

    param(
        [switch]$Force
    )

    Write-Host "[UPDATE] Iniciando atualização segura do projeto..."

    # 1) Backup auth_info_baileys
    if (Test-Path "auth_info_baileys") {
        $time = Get-Date -Format "yyyyMMdd_HHmmss"
        $dest = "auth_info_baileys_backup_$time"
        Write-Host "[UPDATE] Backup em: $dest"
        Copy-Item -Path "auth_info_baileys" -Destination $dest -Recurse -Force
    } else {
        Write-Host "[UPDATE] Pasta auth_info_baileys não encontrada. Pulando backup."
    }

    # 1.5) Verificar alterações locais no repositório
    Write-Host "[UPDATE] Verificando alterações locais..."
    $status = git status --porcelain
    $didStash = $false
    if ($status -and $status.Trim().Length -gt 0) {
        $time = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupDir = "local_changes_backup_$time"
        Write-Host "[UPDATE] Foram detectadas alterações locais. Fazendo backup em: $backupDir"
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

        $statusLines = git status --porcelain
        foreach ($line in $statusLines) {
            # linha no formato 'XY path/to/file'
            if ($line.Length -ge 4) {
                $file = $line.Substring(3).Trim()
                if (Test-Path $file) {
                    $destPath = Join-Path $backupDir $file
                    $destDir = Split-Path $destPath -Parent
                    if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
                    Copy-Item -Path $file -Destination $destPath -Force -Recurse
                }
            }
        }

        if ($Force) {
            Write-Host "[UPDATE] -Force utilizado: criando stash automático das alterações locais..."
            git stash push -u -m "auto-stash pre-update $time"
            if ($LASTEXITCODE -ne 0) { Write-Host "[UPDATE] git stash falhou"; exit 1 }
            $didStash = $true
        } else {
            Write-Host "[UPDATE] Existem alterações locais que seriam sobrescritas pelo pull."
            Write-Host "Passe -Force ao script para fazer stash automático e prosseguir, ou commit/stash manualmente e rode novamente."
            exit 1
        }
    }

    # 2) Git pull
    Write-Host "[UPDATE] Fazendo git fetch & pull..."
    git fetch
    if ($LASTEXITCODE -ne 0) { Write-Host "[UPDATE] git fetch falhou"; exit 1 }

    git pull
    if ($LASTEXITCODE -ne 0) { Write-Host "[UPDATE] git pull falhou"; exit 1 }

    # 3) Instalar dependências
    Write-Host "[UPDATE] Instalando dependências (npm install)..."
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Host "[UPDATE] npm install falhou"; exit 1 }

    # 4) Reiniciar via PM2
    Write-Host "[UPDATE] Reiniciando processo PM2: folha-ponto"
    pm2 restart folha-ponto

    # 5) Reaplicar stash (se aplicável)
    if ($didStash) {
        Write-Host "[UPDATE] Tentando reaplicar stash criado antes do pull..."
        git stash pop
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[UPDATE] git stash pop falhou ou gerou conflitos. Resolva manualmente."
            exit 1
        } else {
            Write-Host "[UPDATE] Stash reaplicado com sucesso."
        }
    }

    # 6) Salvar estado PM2
    pm2 save

    Write-Host "[UPDATE] Atualização completa. Verifique logs: pm2 logs folha-ponto --lines 200"
