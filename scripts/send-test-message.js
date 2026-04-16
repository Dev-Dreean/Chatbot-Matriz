#!/usr/bin/env node

require('dotenv').config({ path: '.env.ready' });

const axios = require('axios');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1043310292199972';

async function sendTestMessage() {
    if (!WHATSAPP_TOKEN) {
        console.error('❌ Erro: WHATSAPP_TOKEN não configurado');
        process.exit(1);
    }

    // Número para enviar - mude aqui para o número desejado
    let recipientNumber = process.argv[2] || '5548991482618'; // Padrão: seu próprio número
    
    // Remove formatação (espaços, traços, parênteses)
    recipientNumber = recipientNumber.replace(/[\s\-()]/g, '');
    
    // Valida se é apenas números
    if (!/^\d+$/.test(recipientNumber)) {
        console.error('❌ Erro: Número deve conter apenas dígitos (sem +, espaços ou caracteres especiais)');
        console.error(`Recebido: ${process.argv[2]}`);
        process.exit(1);
    }
    
    // Valida comprimento básico
    if (recipientNumber.length < 10 || recipientNumber.length > 15) {
        console.error(`❌ Erro: Número deve ter entre 10 e 15 dígitos (recebido: ${recipientNumber.length})`);
        process.exit(1);
    }
    
    console.log('📱 Enviando mensagem de teste...');
    console.log(`Token: ${WHATSAPP_TOKEN.slice(0, 10)}...${WHATSAPP_TOKEN.slice(-10)}`);
    console.log(`Phone Number ID: ${PHONE_NUMBER_ID}`);
    console.log(`Destinatário: ${recipientNumber}`);

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: recipientNumber,
                type: 'text',
                text: {
                    preview_url: false,
                    body: 'Teste de mensagem do chatbot Plansul - ' + new Date().toLocaleString('pt-BR')
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            }
        );

        console.log('\n✅ Mensagem enviada com sucesso!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        process.exit(0);
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        const errorCode = error.response?.data?.error?.code || 'N/A';
        
        console.error('\n❌ Erro ao enviar mensagem:');
        console.error(`Código: ${errorCode}`);
        console.error(`Mensagem: ${errorMessage}`);
        
        if (error.response?.data) {
            console.error('Detalhes:', JSON.stringify(error.response.data, null, 2));
        }
        
        process.exit(1);
    }
}

sendTestMessage();
