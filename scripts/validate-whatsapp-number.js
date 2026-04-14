#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

function loadEnv() {
    try {
        const dotenv = require('dotenv');
        const cwd = process.cwd();
        const envPath = process.env.ENV_FILE
            ? path.resolve(cwd, process.env.ENV_FILE)
            : path.resolve(cwd, '.env');
        const readyPath = path.resolve(cwd, '.env.ready');

        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            return envPath;
        }

        if (fs.existsSync(readyPath)) {
            dotenv.config({ path: readyPath });
            return readyPath;
        }

        dotenv.config();
        return '.env';
    } catch (error) {
        return 'system';
    }
}

function isNumericId(value) {
    return /^\d+$/.test(String(value || '').trim());
}

function mask(value, visible = 4) {
    const text = String(value || '');
    if (!text) return '';
    if (text.length <= visible * 2) return '*'.repeat(text.length);
    return `${text.slice(0, visible)}...${text.slice(-visible)}`;
}

async function graphGet(token, objectId, fields) {
    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(objectId)}`;
    const response = await axios.get(url, {
        params: { fields },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000
    });
    return response.data;
}

async function graphEdgeGet(token, objectId, edge, fields) {
    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(objectId)}/${edge}`;
    const response = await axios.get(url, {
        params: { fields },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000
    });
    return response.data;
}

function printSection(title) {
    console.log('\n' + '='.repeat(64));
    console.log(title);
    console.log('='.repeat(64));
}

(async function main() {
    const loadedFrom = loadEnv();
    const token = process.env.WHATSAPP_TOKEN || '';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || '';
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WABA_ID || '';

    printSection('VALIDADOR WHATSAPP CLOUD API');
    console.log(`Env carregado de: ${loadedFrom}`);
    console.log(`Token: ${mask(token, 6) || '(vazio)'}`);
    console.log(`WHATSAPP_PHONE_NUMBER_ID: ${phoneNumberId || '(vazio)'}`);
    console.log(`WHATSAPP_BUSINESS_ACCOUNT_ID: ${wabaId || '(nao informado)'}`);

    if (!token) {
        console.error('\nERRO: WHATSAPP_TOKEN nao configurado.');
        process.exit(1);
    }

    try {
        printSection('1) TOKEN E PERMISSOES');
        const me = await graphGet(token, 'me', 'id,name');
        console.log(`App/Usuario: ${me.name} (${me.id})`);

        const permissionData = await graphEdgeGet(token, 'me', 'permissions', 'permission,status');
        const granted = (permissionData.data || [])
            .filter(item => item.status === 'granted')
            .map(item => item.permission);

        console.log('Permissoes concedidas:');
        if (granted.length === 0) {
            console.log('- nenhuma');
        } else {
            granted.forEach(p => console.log(`- ${p}`));
        }

        const required = [
            'whatsapp_business_management',
            'whatsapp_business_messaging',
            'business_management'
        ];

        const missing = required.filter(scope => !granted.includes(scope));
        if (missing.length > 0) {
            console.log('\nATENCAO: faltam escopos para gestao completa:');
            missing.forEach(scope => console.log(`- ${scope}`));
        } else {
            console.log('\nOK: escopos principais de WhatsApp estao presentes.');
        }

        if (!phoneNumberId) {
            console.log('\nATENCAO: WHATSAPP_PHONE_NUMBER_ID vazio.');
        } else if (!isNumericId(phoneNumberId)) {
            console.log('\nATENCAO: WHATSAPP_PHONE_NUMBER_ID nao e numerico.');
            console.log('Use o Phone Number ID numerico da Meta (WhatsApp > API Setup).');
        } else {
            printSection('2) STATUS DO NUMERO (PHONE_NUMBER_ID)');
            const phone = await graphGet(
                token,
                phoneNumberId,
                'id,display_phone_number,verified_name,code_verification_status,name_status,quality_rating,platform_type,status'
            );

            console.log(`ID: ${phone.id || '-'}`);
            console.log(`Display: ${phone.display_phone_number || '-'}`);
            console.log(`Verified Name: ${phone.verified_name || '-'}`);
            console.log(`Status: ${phone.status || '-'}`);
            console.log(`Code Verification: ${phone.code_verification_status || '-'}`);
            console.log(`Name Status: ${phone.name_status || '-'}`);
            console.log(`Quality: ${phone.quality_rating || '-'}`);
            console.log(`Platform: ${phone.platform_type || '-'}`);
        }

        if (wabaId && isNumericId(wabaId)) {
            printSection('3) NUMEROS CADASTRADOS NA WABA');
            const list = await graphEdgeGet(
                token,
                wabaId,
                'phone_numbers',
                'id,display_phone_number,verified_name,status,code_verification_status,quality_rating,name_status'
            );
            const numbers = list.data || [];

            if (numbers.length === 0) {
                console.log('Nenhum numero retornado para esta WABA.');
            } else {
                numbers.forEach((n, idx) => {
                    console.log(`\n[${idx + 1}] ${n.display_phone_number || '-'} | id=${n.id || '-'} | status=${n.status || '-'}`);
                    console.log(`    verified_name=${n.verified_name || '-'} | code_verification_status=${n.code_verification_status || '-'}`);
                    console.log(`    quality=${n.quality_rating || '-'} | name_status=${n.name_status || '-'}`);
                });
            }
        }

        printSection('RESULTADO');
        console.log('Validacao concluida.');
        process.exit(0);
    } catch (error) {
        const payload = error.response && error.response.data ? error.response.data : null;
        const message = payload && payload.error && payload.error.message
            ? payload.error.message
            : (error.message || 'Erro desconhecido');
        const code = payload && payload.error && payload.error.code ? payload.error.code : '-';

        printSection('ERRO NA VALIDACAO');
        console.error(`Mensagem: ${message}`);
        console.error(`Codigo: ${code}`);

        if (code === 200) {
            console.error('Dica: token sem permissao para esta conta/numero.');
        }

        process.exit(1);
    }
})();
