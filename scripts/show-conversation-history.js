#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appPath = process.cwd();
const logsDir = path.join(appPath, 'logs', 'conversations');
const phoneArg = String(process.argv[2] || '').replace(/\D/g, '');

if (!phoneArg) {
    console.error('Uso: node scripts/show-conversation-history.js <telefone>');
    process.exit(1);
}

const targetFile = path.join(logsDir, `${phoneArg}.log`);

if (!fs.existsSync(targetFile)) {
    console.error(`Historico nao encontrado para ${phoneArg}.`);
    process.exit(1);
}

const content = fs.readFileSync(targetFile, 'utf8');
process.stdout.write(content);
