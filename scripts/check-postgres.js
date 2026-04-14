try {
    require('dotenv').config();
} catch (err) {
    // dotenv opcional
}

const { createPostgresStorage } = require('../lib/postgres-storage');

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('Erro: DATABASE_URL nao configurada.');
        process.exit(1);
    }

    const storage = createPostgresStorage();

    try {
        await storage.initialize();

        const cadastro = await storage.loadCadastroData();

        console.log('✅ Conexao PostgreSQL OK');
        console.log(`Cadastros carregados: ${cadastro.length}`);
    } finally {
        await storage.close();
    }
}

main().catch((error) => {
    console.error('❌ Falha ao validar PostgreSQL:', error.message);
    process.exit(1);
});
