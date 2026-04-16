#!/usr/bin/env node

require('dotenv').config({ path: '.env.ready' });
const axios = require('axios');

async function main() {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
        console.error('Faltam variaveis: WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID');
        process.exit(1);
    }

    const phoneResp = await axios.get(`https://graph.facebook.com/v25.0/${phoneNumberId}`, {
        params: {
            fields: 'id,display_phone_number,status,code_verification_status,whatsapp_business_account'
        },
        headers: {
            Authorization: `Bearer ${token}`
        },
        timeout: 20000
    });

    const phone = phoneResp.data;
    console.log('PHONE:', JSON.stringify(phone, null, 2));

    const wabaId = phone.whatsapp_business_account && phone.whatsapp_business_account.id;
    if (!wabaId) {
        console.log('WABA nao retornada para este numero.');
        return;
    }

    const subsResp = await axios.get(`https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`, {
        headers: {
            Authorization: `Bearer ${token}`
        },
        timeout: 20000
    });

    console.log('SUBSCRIBED_APPS:', JSON.stringify(subsResp.data, null, 2));
}

main().catch((error) => {
    const payload = error.response && error.response.data ? error.response.data : null;
    console.error('ERRO:', JSON.stringify(payload || { message: error.message }, null, 2));
    process.exit(1);
});
