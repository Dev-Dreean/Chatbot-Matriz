#!/usr/bin/env node

const { getRuntimeConfig } = require('./runtime-config');

const config = getRuntimeConfig();
const missing = [];
const invalid = [];

function isPlaceholder(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return true;
    return (
        normalized.includes('COLOQUE_') ||
        normalized.includes('CONFIGURE_') ||
        normalized.includes('SEU_TOKEN') ||
        normalized.includes('SEU_PHONE_NUMBER_ID') ||
        normalized.includes('TOKEN_AQUI') ||
        normalized.includes('PHONE_NUMBER_ID_AQUI')
    );
}

if (!process.env.WHATSAPP_TOKEN) {
    missing.push('WHATSAPP_TOKEN');
} else if (isPlaceholder(process.env.WHATSAPP_TOKEN)) {
    invalid.push('WHATSAPP_TOKEN');
}

if (!config.whatsappPhoneNumberId) {
    missing.push('WHATSAPP_PHONE_NUMBER_ID');
} else if (isPlaceholder(config.whatsappPhoneNumberId)) {
    invalid.push('WHATSAPP_PHONE_NUMBER_ID');
}

if (!config.webhookVerifyToken) {
    missing.push('WEBHOOK_VERIFY_TOKEN');
} else if (isPlaceholder(config.webhookVerifyToken)) {
    invalid.push('WEBHOOK_VERIFY_TOKEN');
}

if (missing.length > 0) {
    console.error('Configuracao incompleta.');
    console.error(`Faltando: ${missing.join(', ')}`);
    process.exit(1);
}

if (invalid.length > 0) {
    console.error('Configuracao invalida.');
    console.error(`Valores de exemplo detectados em: ${invalid.join(', ')}`);
    process.exit(1);
}

console.log(`PORT=${config.port}`);
console.log(`WEBHOOK_VERIFY_TOKEN=${config.webhookVerifyToken}`);
console.log(`WHATSAPP_PHONE_NUMBER_ID=${config.whatsappPhoneNumberId}`);
