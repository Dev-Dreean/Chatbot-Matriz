require('dotenv').config();

const WEBHOOK_CONFIG = {
  VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN,
  PORT: process.env.PORT || 3001,
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`
};

const WHATSAPP_CONFIG = {
  TOKEN: process.env.WHATSAPP_TOKEN,
  PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0',
  GRAPH_URL: 'https://graph.facebook.com'
};

function validateConfig() {
  const required = [
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WEBHOOK_VERIFY_TOKEN'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`ERRO: ${key} nao esta configurado no .env`);
      process.exit(1);
    }
  }
  console.log('✓ Configurações validadas com sucesso!');
}

function identifyPhoneNumber(phoneNumberId) {
  return phoneNumberId === WHATSAPP_CONFIG.PHONE_NUMBER_ID ? 'principal' : 'desconhecido';
}

module.exports = {
  WHATSAPP_CONFIG,
  WEBHOOK_CONFIG,
  validateConfig,
  identifyPhoneNumber
};