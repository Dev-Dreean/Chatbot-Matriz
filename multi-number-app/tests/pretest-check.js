/**
 * CHECKLIST DE PRÉ-TESTE
 * Execute este script antes de começar os testes
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.clear();
console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║          PRÉ-TESTE - VERIFICAÇÃO DE CONFIGURAÇÃO         ║`);
console.log(`╚══════════════════════════════════════════════════════════╝\n`);

const checks = [];
const BASE_PATH = __dirname;

// 1. Verificar arquivos essenciais
console.log(`📁 Verificando arquivos essenciais...\n`);

const requiredFiles = [
    '.env',
    'app.js',
    'package.json',
    'config/whatsappConfig.js',
    'services/whatsappSender.js',
    'middleware/webhookHandler.js',
    'routes/webhook.js',
    'database/userData.js',
    'tests/testMultiNumber.js',
];

requiredFiles.forEach(file => {
    const fullPath = path.join(BASE_PATH, file);
    const exists = fs.existsSync(fullPath);
    const status = exists ? '✅' : '❌';
    console.log(`   ${status} ${file}`);
    checks.push({ file, exists });
});

// 2. Verificar variáveis de ambiente
console.log(`\n🔐 Verificando variáveis de ambiente...\n`);

const envVars = {
    WHATSAPP_TOKEN: 'Token de acesso da API',
    WHATSAPP_PHONE_NUMBER_ID: 'ID do número de telefone',
    WEBHOOK_VERIFY_TOKEN: 'Token de verificação do webhook',
    WHATSAPP_GRAPH_API_VERSION: 'Versão da API',
    PORT: 'Porta do servidor',
};

Object.entries(envVars).forEach(([key, description]) => {
    const value = process.env[key];
    const status = value ? '✅' : '❌';
    const display = value ? `${value.substring(0, 20)}...` : 'NÃO CONFIGURADO';
    console.log(`   ${status} ${key}`);
    console.log(`      └─ ${description}: ${display}`);
});

// 3. Verificar node_modules
console.log(`\n📦 Verificando dependências...\n`);

const packageJsonPath = path.join(BASE_PATH, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const nodeModulesExists = fs.existsSync(path.join(BASE_PATH, 'node_modules'));

if (nodeModulesExists) {
    console.log(`   ✅ node_modules instalado`);
} else {
    console.log(`   ❌ node_modules NÃO instalado`);
    console.log(`      └─ Execute: npm install`);
}

console.log(`\n   Dependências necessárias:`);
Object.keys(packageJson.dependencies).forEach(dep => {
    const version = packageJson.dependencies[dep];
    console.log(`      ✓ ${dep} (${version})`);
});

// 4. Resumo do status
console.log(`\n═══════════════════════════════════════════════════════════\n`);

const fileChecks = checks.filter(c => c.exists).length;
const totalFiles = checks.length;
const filesOk = fileChecks === totalFiles;

const envChecks = Object.keys(envVars).filter(key => process.env[key]).length;
const envOk = envChecks === Object.keys(envVars).length;

console.log(`📊 RESUMO:\n`);
console.log(`   Arquivos: ${fileChecks}/${totalFiles} ${filesOk ? '✅' : '⚠️'}`);
console.log(`   Variáveis de Ambiente: ${envChecks}/${Object.keys(envVars).length} ${envOk ? '✅' : '⚠️'}`);
console.log(`   node_modules: ${nodeModulesExists ? '✅' : '❌'}`);

// 5. Recomendações
console.log(`\n💡 PRÓXIMAS AÇÕES:\n`);

if (!nodeModulesExists) {
    console.log(`   1️⃣ Instalar dependências:`);
    console.log(`      npm install\n`);
}

if (filesOk && envOk && nodeModulesExists) {
    console.log(`   ✨ Tudo pronto! Comece com:\n`);
    console.log(`   npm test`);
    console.log(`   ou`);
    console.log(`   npm run dev\n`);
} else {
    if (!filesOk) {
        console.log(`   ⚠️ Alguns arquivos estão faltando. Verifique a estrutura.\n`);
    }
    if (!envOk) {
        console.log(`   ⚠️ Configure as variáveis de ambiente no arquivo .env\n`);
    }
}

console.log(`═══════════════════════════════════════════════════════════\n`);

// 6. Dicas de debug
console.log(`🐛 DICAS DE DEBUG:\n`);
console.log(`   • Verifique .env com: cat .env`);
console.log(`   • Teste a porta com: netstat -an | findstr :3001`);
console.log(`   • Valide Token em: https://developers.facebook.com/tools/debug/\n`);
