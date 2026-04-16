#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const databaseRoot = path.resolve(process.env.LOCAL_DATABASE_ROOT || 'C:\\Sistemas\\Chatbot-Matriz\\Banco de dados');
const phoneArg = String(process.argv[2] || '').replace(/\D/g, '');

if (!phoneArg) {
    console.error('Uso: node scripts/show-conversation-history.js <telefone>');
    process.exit(1);
}

const candidates = [
    path.join(databaseRoot, 'historico', 'por-telefone', `${phoneArg}.jsonl`),
    path.join(databaseRoot, 'historico', 'por-telefone', `${phoneArg}.log`),
    path.join(process.cwd(), 'logs', 'conversations', `${phoneArg}.log`)
];

const targetFile = candidates.find(filePath => fs.existsSync(filePath));

if (!targetFile) {
    console.error(`Historico nao encontrado para ${phoneArg}.`);
    process.exit(1);
}

const content = fs.readFileSync(targetFile, 'utf8');
process.stdout.write(content);
