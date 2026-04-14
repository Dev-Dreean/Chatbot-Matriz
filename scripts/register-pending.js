try {
    require('dotenv').config();
} catch (err) {
    // dotenv e opcional; variaveis podem vir do ambiente
}

const { registerPendingPhoneNumbers } = require('../lib/whatsapp-cloud-api');

async function main() {
    const phoneNumberIds = process.argv.slice(2);

    if (!process.env.WHATSAPP_TOKEN) {
        console.error('Erro: WHATSAPP_TOKEN nao configurado.');
        process.exit(1);
    }

    if (!process.env.WHATSAPP_REGISTRATION_PIN) {
        console.warn('Aviso: WHATSAPP_REGISTRATION_PIN nao configurado; usando fallback padrao da integracao.');
    }

    if (phoneNumberIds.length > 0) {
        console.log('Registro manual para phone_number_id(s):', phoneNumberIds.join(', '));
    } else {
        console.log('Registro manual para todos os phone_number_id configurados no ambiente.');
    }

    const results = await registerPendingPhoneNumbers({
        phoneNumberIds: phoneNumberIds.length > 0 ? phoneNumberIds : undefined
    });

    const registered = results.filter(r => r.registered).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => r.registered === false).length;

    console.log('\nResumo:');
    console.log(`- registrados: ${registered}`);
    console.log(`- ignorados (ja ativos): ${skipped}`);
    console.log(`- falhas/pendencias: ${failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Erro ao executar registro manual:', err && err.message ? err.message : err);
    process.exit(1);
});
