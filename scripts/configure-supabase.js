#!/usr/bin/env node

/**
 * Script para configurar CONNECTION STRING do Supabase no .env
 * Uso: node scripts/configure-supabase.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const envPath = path.join(__dirname, '..', '.env');

function prompt(question) {
    return new Promise(resolve => {
        rl.question(question, answer => {
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('\n🔧 Configurador de Supabase - Chat-Bot\n');
    console.log('Este script ajuda a configurar a connection string do Supabase no arquivo .env');
    console.log('───────────────────────────────────────────────────────────────────\n');

    // Validação da string fornecida
    let connectionString = '';
    let valid = false;

    while (!valid) {
        connectionString = await prompt(
            '📋 Cole a CONNECTION STRING do Supabase (Session Pooler): '
        );

        if (!connectionString) {
            console.log('❌ Connection string não pode estar vazia!\n');
            continue;
        }

        if (!connectionString.startsWith('postgresql://')) {
            console.log('❌ String deve começar com "postgresql://"\n');
            continue;
        }

        if (!connectionString.includes('pooler.supabase.com')) {
            console.log('⚠️  Aviso: String não contém "pooler.supabase.com"');
            const confirm = await prompt('Continuar mesmo assim? (s/n): ');
            if (confirm.toLowerCase() !== 's') {
                console.log('Cancelado.\n');
                rl.close();
                process.exit(0);
            }
        }

        valid = true;
    }

    console.log('\n✅ String validada!\n');

    // Ler arquivo .env
    let envContent = '';
    try {
        envContent = fs.readFileSync(envPath, 'utf-8');
    } catch (err) {
        console.log(`⚠️  Arquivo .env não encontrado em ${envPath}`);
        console.log('Criando novo arquivo .env...\n');
    }

    // Atualizar ou adicionar DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
        envContent = envContent.replace(
            /DATABASE_URL=.*/,
            `DATABASE_URL=${connectionString}`
        );
    } else {
        envContent += `\n# Banco PostgreSQL (Supabase)\nDATABASE_URL=${connectionString}\n`;
    }

    // Salvar arquivo .env
    try {
        fs.writeFileSync(envPath, envContent, 'utf-8');
        console.log(`✅ Arquivo .env atualizado com sucesso!\n`);
        console.log(`📁 Arquivo: ${envPath}\n`);
    } catch (err) {
        console.log(`❌ Erro ao salvar arquivo .env: ${err.message}\n`);
        rl.close();
        process.exit(1);
    }

    // Próximos passos
    console.log('🚀 PRÓXIMAS ETAPAS:\n');
    console.log('1. npm run db:setup        (criar tabelas no PostgreSQL)');
    console.log('2. npm run db:migrate:xlsx (migrar dados do Excel)');
    console.log('3. npm run db:check        (verificar conexão)');
    console.log('4. npm start               (iniciar bot com PostgreSQL)\n');

    rl.close();
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err.message);
    rl.close();
    process.exit(1);
});
