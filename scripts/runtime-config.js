const fs = require('fs');
const path = require('path');

try {
    const dotenv = require('dotenv');
    const cwd = process.cwd();
    const envPath = process.env.ENV_FILE
        ? path.resolve(cwd, process.env.ENV_FILE)
        : path.resolve(cwd, '.env');
    const readyPath = path.resolve(cwd, '.env.ready');

    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    } else if (fs.existsSync(readyPath)) {
        dotenv.config({ path: readyPath });
    } else {
        dotenv.config();
    }
} catch (error) {
    // dotenv e opcional; o ambiente pode vir do sistema
}

function parsePort(value, fallback = 3001) {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 ? port : fallback;
}

function getRuntimeConfig() {
    return {
        port: parsePort(process.env.PORT, 3001),
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
        whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || ''
    };
}

module.exports = {
    getRuntimeConfig,
    parsePort
};
