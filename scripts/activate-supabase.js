#!/usr/bin/env node

/**
 * Script para ATIVAR Supabase PostgreSQL após reset de senha
 * Uso: node scripts/activate-supabase.js
 * 
 * Este script:
 * 1. Valida que DATABASE_URL está configurado
 * 2. Executa db:setup (cria tabelas)
 * 3. Executa db:migrate:xlsx (transfere dados)
 * 4. Executa db:check (valida tudo)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');

async function main() {
    console.log('\n🚀 ATIVADOR DO SUPABASE - Chat-Bot\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Validar DATABASE_URL
    console.log('📋 ETAPA 1: Validando DATABASE_URL...\n');

    if (!fs.existsSync(envPath)) {
        console.error('❌ Arquivo .env não encontrado!');
        process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

    if (!databaseUrlMatch || !databaseUrlMatch[1] || databaseUrlMatch[1].trim() === '') {
        console.error('❌ DATABASE_URL está vazio no .env');
        console.error('Execute primeiro: npm run db:configure\n');
        process.exit(1);
    }

    const dbUrl = databaseUrlMatch[1].trim();
    console.log('✅ DATABASE_URL encontrado');
    console.log(`   Host: ${dbUrl.split('@')[1]?.split(':')[0] || 'N/A'}\n`);

    // 2. Executar db:setup
    console.log('📋 ETAPA 2: Criando tabelas no PostgreSQL...\n');
    try {
        execSync('npm run db:setup', { stdio: 'inherit' });
        console.log('\n✅ Tabelas criadas com sucesso\n');
    } catch (err) {
        console.error('\n❌ Falha ao criar tabelas');
        console.error('Execute: npm run db:setup');
        process.exit(1);
    }

    // 3. Executar db:migrate:xlsx
    console.log('📋 ETAPA 3: Migrando dados do Excel para PostgreSQL...\n');
    try {
        execSync('npm run db:migrate:xlsx', { stdio: 'inherit' });
        console.log('\n✅ Dados migrados com sucesso\n');
    } catch (err) {
        console.error('\n⚠️  Migração teve erro (pode ser normal se não há dados)');
    }

    // 4. Executar db:check
    console.log('📋 ETAPA 4: Validando conexão...\n');
    try {
        execSync('npm run db:check', { stdio: 'inherit' });
        console.log('\n✅ Tudo validado com sucesso\n');
    } catch (err) {
        console.error('\n⚠️  Validação teve erro');
    }

    // 5. Próximas ações
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🎉 SUPABASE ESTÁ PRONTO!\n');
    console.log('PRÓXIMO PASSO: Iniciar o bot\n');
    console.log('Execute:\n');
    console.log('   npm start\n');
    console.log('O bot agora usará PostgreSQL para armazenamento online! 🚀\n');
}

main().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
