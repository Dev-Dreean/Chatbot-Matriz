/**
 * DIAGNÓSTICO COMPLETO DO SISTEMA
 * Execute para validar toda a configuração antes dos testes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.clear();

// ═══════════════════════════════════════════════════════════════════
// CORES E FORMATAÇÃO
// ═══════════════════════════════════════════════════════════════════

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

function header(title) {
    console.log(`\n${colors.cyan}╔${'═'.repeat(60)}╗${colors.reset}`);
    console.log(`${colors.cyan}║ ${title.padEnd(58)} ║${colors.reset}`);
    console.log(`${colors.cyan}╚${'═'.repeat(60)}╝${colors.reset}\n`);
}

function success(msg) {
    console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg) {
    console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function info(msg) {
    console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

function warn(msg) {
    console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

function section(title) {
    console.log(`\n${colors.cyan}${title}${colors.reset}`);
    console.log('─'.repeat(60));
}

// ═══════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════

function checkCommand(cmd) {
    try {
        execSync(`${cmd} --version`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function getNodeVersion() {
    try {
        return execSync('node --version', { encoding: 'utf-8' }).trim();
    } catch {
        return null;
    }
}

function getNpmVersion() {
    try {
        return execSync('npm --version', { encoding: 'utf-8' }).trim();
    } catch {
        return null;
    }
}

function fileExists(filePath) {
    return fs.existsSync(path.join(__dirname, '..', filePath));
}

function dirExists(dirPath) {
    return fs.existsSync(path.join(__dirname, '..', dirPath));
}

function readEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
        return {};
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=#\s]+)\s*=\s*(.*)$/);
        if (match) {
            env[match[1]] = match[2].trim();
        }
    });
    return env;
}

// ═══════════════════════════════════════════════════════════════════
// INÍCIO DO DIAGNÓSTICO
// ═══════════════════════════════════════════════════════════════════

header('DIAGNÓSTICO COMPLETO DO SISTEMA');

let totalChecks = 0;
let passedChecks = 0;

// ─────────────────────────────────────────────────────────────────
// 1. VERIFICAÇÃO DO AMBIENTE
// ─────────────────────────────────────────────────────────────────

section('1. AMBIENTE');

const nodeVersion = getNodeVersion();
if (nodeVersion) {
    success(`Node.js ${nodeVersion}`);
    passedChecks++;
} else {
    error('Node.js não encontrado');
}
totalChecks++;

const npmVersion = getNpmVersion();
if (npmVersion) {
    success(`npm ${npmVersion}`);
    passedChecks++;
} else {
    error('npm não encontrado');
}
totalChecks++;

const systemInfo = process.platform === 'win32' ? 'Windows' :
    process.platform === 'darwin' ? 'macOS' : 'Linux';
info(`Sistema: ${systemInfo}`);

// ─────────────────────────────────────────────────────────────────
// 2. ARQUIVOS ESSENCIAIS
// ─────────────────────────────────────────────────────────────────

section('2. ARQUIVOS ESSENCIAIS');

const files = [
    'app.js',
    'package.json',
    '.env',
    'config/whatsappConfig.js',
    'services/whatsappSender.js',
    'middleware/webhookHandler.js',
    'routes/webhook.js',
    'database/userData.js',
    'tests/testMultiNumber.js',
];

files.forEach(file => {
    totalChecks++;
    if (fileExists(file)) {
        success(file);
        passedChecks++;
    } else {
        error(`${file} - FALTANDO`);
    }
});

// ─────────────────────────────────────────────────────────────────
// 3. DIRETÓRIOS
// ─────────────────────────────────────────────────────────────────

section('3. DIRETÓRIOS');

const dirs = ['config', 'services', 'middleware', 'routes', 'database', 'tests'];

dirs.forEach(dir => {
    totalChecks++;
    if (dirExists(dir)) {
        success(dir);
        passedChecks++;
    } else {
        error(`${dir} - FALTANDO`);
    }
});

// ─────────────────────────────────────────────────────────────────
// 4. VARIÁVEIS DE AMBIENTE
// ─────────────────────────────────────────────────────────────────

section('4. VARIÁVEIS DE AMBIENTE');

const env = readEnv();
const envVars = [
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WEBHOOK_VERIFY_TOKEN',
    'WHATSAPP_GRAPH_API_VERSION',
    'PORT',
];

envVars.forEach(varName => {
    totalChecks++;
    if (env[varName]) {
        const displayValue = varName === 'WHATSAPP_TOKEN'
            ? `${env[varName].substring(0, 15)}...`
            : env[varName];
        success(`${varName} = ${displayValue}`);
        passedChecks++;
    } else {
        error(`${varName} - NÃO CONFIGURADO`);
    }
});

// ─────────────────────────────────────────────────────────────────
// 5. DEPENDÊNCIAS
// ─────────────────────────────────────────────────────────────────

section('5. DEPENDÊNCIAS');

const nodeModulesExists = dirExists('node_modules');
totalChecks++;

if (nodeModulesExists) {
    success('node_modules instalado');
    passedChecks++;

    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    info('\nDependências esperadas:');
    Object.keys(packageJson.dependencies).forEach(dep => {
        console.log(`  • ${dep} (${packageJson.dependencies[dep]})`);
    });
} else {
    error('node_modules NÃO instalado');
    info('Execute: npm install');
}

// ─────────────────────────────────────────────────────────────────
// 6. CONFIGURAÇÃO DO PACKAGE.JSON
// ─────────────────────────────────────────────────────────────────

section('6. SCRIPTS NPM');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

Object.keys(packageJson.scripts || {}).forEach(script => {
    console.log(`  ${colors.green}npm run ${script}${colors.reset}      ${packageJson.scripts[script]}`);
});

// ─────────────────────────────────────────────────────────────────
// 7. VALIDAÇÃO DA PORTA
// ─────────────────────────────────────────────────────────────────

section('7. VALIDAÇÃO DA PORTA');

const port = env.PORT || 3001;
info(`Porta configurada: ${port}`);

try {
    if (process.platform === 'win32') {
        execSync(`netstat -ano | findstr :${port}`, { stdio: 'ignore' });
        warn(`Porta ${port} pode estar em uso (verifique)`);
    } else {
        execSync(`lsof -i :${port}`, { stdio: 'ignore' });
        warn(`Porta ${port} pode estar em uso (verifique)`);
    }
} catch {
    success(`Porta ${port} disponível`);
    passedChecks++;
}
totalChecks++;

// ─────────────────────────────────────────────────────────────────
// 8. VALIDAÇÃO DO TOKEN
// ─────────────────────────────────────────────────────────────────

section('8. VALIDAÇÃO DO TOKEN WHATSAPP');

if (env.WHATSAPP_TOKEN) {
    const token = env.WHATSAPP_TOKEN;
    if (token.length > 10) {
        success('Token possui formato esperado');
        passedChecks++;
        totalChecks++;

        if (token.startsWith('EAAJ') || token.startsWith('EAA')) {
            success('Token inicia com prefixo esperado (EAA)');
            passedChecks++;
        } else {
            warn('Token não inicia com prefixo esperado (EAA ou EAAJ)');
        }
        totalChecks++;
    } else {
        error('Token muito curto (< 10 caracteres)');
        totalChecks += 2;
    }
} else {
    error('Token não configurado');
    totalChecks += 2;
}

// ─────────────────────────────────────────────────────────────────
// 9. VALIDAÇÃO DO PHONE NUMBER ID
// ─────────────────────────────────────────────────────────────────

section('9. VALIDAÇÃO DO PHONE NUMBER ID');

if (env.WHATSAPP_PHONE_NUMBER_ID) {
    const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
    totalChecks++;

    if (/^\d+$/.test(phoneId)) {
        success('Phone Number ID é numérico');
        passedChecks++;

        if (phoneId.length >= 15) {
            success('Phone Number ID possui comprimento esperado');
            passedChecks++;
        } else {
            warn('Phone Number ID pode ser mais longo');
        }
        totalChecks++;
    } else {
        error('Phone Number ID contém caracteres não-numéricos');
    }
} else {
    error('Phone Number ID não configurado');
    totalChecks += 2;
}

// ─────────────────────────────────────────────────────────────────
// RESUMO FINAL
// ─────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));

const percentage = Math.round((passedChecks / totalChecks) * 100);
const status = percentage === 100 ? colors.green : percentage >= 80 ? colors.yellow : colors.red;

console.log(`\n${status}RESULTADO: ${passedChecks}/${totalChecks} verificações passaram (${percentage}%)${colors.reset}`);

// ─────────────────────────────────────────────────────────────────
// RECOMENDAÇÕES
// ─────────────────────────────────────────────────────────────────

console.log(`\n${colors.cyan}RECOMENDAÇÕES:${colors.reset}\n`);

if (!nodeModulesExists) {
    console.log(`1. ${colors.yellow}Instale as dependências:${colors.reset}`);
    console.log(`   npm install\n`);
}

if (percentage === 100) {
    console.log(`${colors.green}✨ TUDO PRONTO!${colors.reset}\n`);
    console.log('Próximos passos:');
    console.log(`  ${colors.cyan}npm test${colors.reset}          - Executar testes interativos`);
    console.log(`  ${colors.cyan}npm run dev${colors.reset}       - Iniciar servidor de desenvolvimento`);
    console.log(`  ${colors.cyan}npm run check${colors.reset}     - Executar pré-teste\n`);
} else if (percentage >= 80) {
    console.log(`${colors.yellow}⚠️ Existem alguns problemas.${colors.reset}`);
    console.log('Verifique os itens marcados com ✗ acima.\n');
} else {
    console.log(`${colors.red}❌ Há problemas significativos.${colors.reset}`);
    console.log('Por favor, corrija os itens marcados com ✗.\n');
}

console.log('═'.repeat(60) + '\n');
