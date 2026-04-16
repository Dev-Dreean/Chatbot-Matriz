#!/usr/bin/env node

require('dotenv').config({ path: '.env.ready' });
const axios = require('axios');

async function findWabas(token) {
    const urls = [
        'https://graph.facebook.com/v25.0/me',
        'https://graph.facebook.com/v25.0/me/businesses'
    ];

    const results = [];

    try {
        const me = await axios.get(urls[0], {
            params: {
                fields: 'id,name,businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number}}}'
            },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 20000
        });
        results.push({ source: 'me', data: me.data });
    } catch (err) {
        results.push({ source: 'me', error: err.response?.data || { message: err.message } });
    }

    try {
        const biz = await axios.get(urls[1], {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 20000
        });
        results.push({ source: 'me/businesses', data: biz.data });
    } catch (err) {
        results.push({ source: 'me/businesses', error: err.response?.data || { message: err.message } });
    }

    return results;
}

function collectWabaIds(payloads) {
    const ids = new Set();

    for (const item of payloads) {
        const data = item.data;
        if (!data) continue;

        const businesses = (data.businesses && data.businesses.data) || data.data || [];
        for (const b of businesses) {
            const owned = (b.owned_whatsapp_business_accounts && b.owned_whatsapp_business_accounts.data) || [];
            for (const w of owned) {
                if (w.id) ids.add(w.id);
            }
        }
    }

    return Array.from(ids);
}

async function ensureSubscribed(token, wabaId) {
    const before = await axios.get(`https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000
    });

    let subscribed = false;
    const data = before.data && before.data.data ? before.data.data : [];
    if (data.length > 0) {
        subscribed = true;
    }

    if (!subscribed) {
        await axios.post(
            `https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`,
            null,
            {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 20000
            }
        );
    }

    const after = await axios.get(`https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000
    });

    return { before: before.data, after: after.data, subscribedNow: !subscribed };
}

async function main() {
    const token = process.env.WHATSAPP_TOKEN;
    if (!token) {
        throw new Error('WHATSAPP_TOKEN nao configurado');
    }

    const payloads = await findWabas(token);
    console.log('DISCOVERY:', JSON.stringify(payloads, null, 2));

    const wabaIds = collectWabaIds(payloads);
    if (wabaIds.length === 0) {
        console.log('Nenhum WABA ID encontrado pelo token.');
        process.exit(2);
    }

    for (const wabaId of wabaIds) {
        try {
            const result = await ensureSubscribed(token, wabaId);
            console.log(`WABA ${wabaId}:`, JSON.stringify(result, null, 2));
        } catch (err) {
            console.log(`WABA ${wabaId} erro:`, JSON.stringify(err.response?.data || { message: err.message }, null, 2));
        }
    }
}

main().catch((err) => {
    console.error('ERRO:', JSON.stringify(err.response?.data || { message: err.message }, null, 2));
    process.exit(1);
});
