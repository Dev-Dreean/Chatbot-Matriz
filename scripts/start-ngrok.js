#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getRuntimeConfig } = require('./runtime-config');

function main() {
    const config = getRuntimeConfig();
    const isWindows = process.platform === 'win32';
    const projectConfigPath = path.join(process.cwd(), 'ngrok.chatbot.yml');
    const command = isWindows ? 'cmd.exe' : 'npx';
    const ngrokArgs = ['ngrok'];

    if (fs.existsSync(projectConfigPath)) {
        ngrokArgs.push('--config', projectConfigPath);
    }

    ngrokArgs.push('http', String(config.port));

    const args = isWindows
        ? ['/c', 'npx', ...ngrokArgs]
        : ngrokArgs;

    console.log('\nIniciando ngrok...\n');
    console.log(`Webhook para configurar na Meta: https://SEU-NGROK/webhook`);
    console.log(`Token: ${config.webhookVerifyToken}\n`);

    const child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false
    });

    child.on('error', (error) => {
        console.error('Erro ao iniciar ngrok:', error.message);
        process.exit(1);
    });

    child.on('exit', (code) => {
        process.exit(code || 0);
    });
}

main();
