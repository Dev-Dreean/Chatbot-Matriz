/**
 * Script de Teste Completo - WhatsApp Multi-Number API
 * Testa: Webhook, Envio de Mensagens, Leitura de Mensagens
 */

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const config = {
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0',
  baseUrl: `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0'}`,
};

// Cores para terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type, msg) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const prefix = {
    '✓': `${colors.green}[✓ OK]${colors.reset}`,
    '✗': `${colors.red}[✗ ERRO]${colors.reset}`,
    '?': `${colors.blue}[?]${colors.reset}`,
    '→': `${colors.cyan}[→]${colors.reset}`,
  }[type] || `${colors.yellow}[!]${colors.reset}`;
  console.log(`${prefix} ${timestamp} - ${msg}`);
}

async function validateConfig() {
  log('?', 'Validando configuração...');

  if (!config.token) {
    log('✗', 'WHATSAPP_TOKEN não configurado!');
    return false;
  }
  if (!config.phoneNumberId) {
    log('✗', 'WHATSAPP_PHONE_NUMBER_ID não configurado!');
    return false;
  }

  log('✓', 'Configuração validada');
  console.log(`   Token: ${config.token.substring(0, 20)}...`);
  console.log(`   Phone Number ID: ${config.phoneNumberId}`);
  console.log(`   API Base URL: ${config.baseUrl}`);
  return true;
}

async function testWebhookValidation() {
  log('?', 'Testando validação de webhook...');
  try {
    // Simula a validação que WhatsApp enviará
    const webhookUrl = `http://localhost:${process.env.PORT || 3001}/webhook`;
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
    const hubChallenge = 'test_challenge_12345';

    log('→', `Enviando GET para: ${webhookUrl}`);
    log('→', `Parâmetros: hub.verify_token=${verifyToken}`);

    console.log(`\n   Endpoint esperado: ${webhookUrl}`);
    console.log(`   Query params: ?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${hubChallenge}\n`);

    // Tenta conectar ao servidor local
    try {
      const response = await axios.get(`${webhookUrl}`, {
        timeout: 5000,
      });
      log('✓', 'Servidor está rodando e respondendo');
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        log('✗', `Servidor não está rodando em http://localhost:${process.env.PORT || 3001}`);
        log('→', 'Inicie com: npm run dev');
      } else {
        log('✗', `Erro ao conectar: ${err.message}`);
      }
    }
  } catch (error) {
    log('✗', `Erro: ${error.message}`);
  }
}

async function testSendMessage() {
  log('?', 'Testando envio de mensagem de texto...');

  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const phoneNumber = await new Promise((resolve) => {
      rl.question('📱 Digite o número para receber mensagem (ex: 5511999999999): ', resolve);
    });

    const message = 'Oi! Teste do WhatsApp Cloud API Multi-Number em 🚀';

    const url = `${config.baseUrl}/${config.phoneNumberId}/messages`;

    log('→', `Enviando POST para: ${url}`);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    console.log(`\n${colors.cyan}Payload da requisição:${colors.reset}`);
    console.log(JSON.stringify(payload, null, 2));
    console.log();

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    log('✓', 'Mensagem enviada com sucesso!');
    console.log(`   Message ID: ${response.data.messages[0].id}`);
    console.log(`   Status: ${response.data.messages[0].message_status}`);

    rl.close();
  } catch (error) {
    if (error.response) {
      log('✗', `API retornou erro: ${error.response.status}`);
      console.log(`   ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      log('✗', `Erro: ${error.message}`);
    }
  }
}

async function testMediaMessage() {
  log('?', 'Testando envio de mensagem com imagem...');

  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const phoneNumber = await new Promise((resolve) => {
      rl.question('📱 Digite o número para receber imagem (ex: 5511999999999): ', resolve);
    });

    const url = `${config.baseUrl}/${config.phoneNumberId}/messages`;

    log('→', `Enviando POST para: ${url}`);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'image',
      image: {
        link: 'https://www.gstatic.com/webp/gallery/1.png',
      },
    };

    console.log(`\n${colors.cyan}Payload da requisição:${colors.reset}`);
    console.log(JSON.stringify(payload, null, 2));
    console.log();

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    log('✓', 'Imagem enviada com sucesso!');
    console.log(`   Message ID: ${response.data.messages[0].id}`);

    rl.close();
  } catch (error) {
    if (error.response) {
      log('✗', `API retornou erro: ${error.response.status}`);
      console.log(`   ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      log('✗', `Erro: ${error.message}`);
    }
  }
}

async function testMarkAsRead() {
  log('?', 'Testando marcação de mensagem como lida...');

  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const messageId = await new Promise((resolve) => {
      rl.question('📨 Digite o Message ID para marcar como lido (ex: wamid.xxx...): ', resolve);
    });

    const url = `${config.baseUrl}/${config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      wamid: messageId,
    };

    log('→', `Enviando POST para: ${url}`);
    console.log(`\n${colors.cyan}Payload da requisição:${colors.reset}`);
    console.log(JSON.stringify(payload, null, 2));
    console.log();

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    log('✓', 'Mensagem marcada como lida!');

    rl.close();
  } catch (error) {
    if (error.response) {
      log('✗', `API retornou erro: ${error.response.status}`);
      console.log(`   ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      log('✗', `Erro: ${error.message}`);
    }
  }
}

async function main() {
  console.clear();
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   WhatsApp Cloud API - Multi-Number Test Suite 🚀       ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

  if (!(await validateConfig())) {
    process.exit(1);
  }

  console.log();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const choices = {
    '1': { name: 'Validar Webhook', fn: testWebhookValidation },
    '2': { name: 'Enviar Mensagem de Texto', fn: testSendMessage },
    '3': { name: 'Enviar Imagem', fn: testMediaMessage },
    '4': { name: 'Marcar como Lido', fn: testMarkAsRead },
  };

  console.log(`${colors.yellow}Escolha um teste:${colors.reset}`);
  Object.entries(choices).forEach(([key, val]) => {
    console.log(`  [${key}] ${val.name}`);
  });
  console.log(`  [0] Sair`);

  rl.question('\n👉 Selecione uma opção: ', async (option) => {
    rl.close();

    if (option === '0') {
      log('→', 'Encerrando...');
      process.exit(0);
    }

    if (choices[option]) {
      console.log();
      await choices[option].fn();
      console.log();
      process.exit(0);
    } else {
      log('✗', 'Opção inválida!');
      process.exit(1);
    }
  });
}

main().catch((err) => {
  log('✗', `Erro fatal: ${err.message}`);
  process.exit(1);
});