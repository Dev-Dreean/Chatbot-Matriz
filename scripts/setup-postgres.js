try {
    require('dotenv').config();
} catch (err) {
    // dotenv opcional
}

const { createPostgresStorage } = require('../lib/postgres-storage');

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('Erro: DATABASE_URL nao configurada no ambiente/.env.');
        process.exit(1);
    }

    const storage = createPostgresStorage();

    try {
        await storage.initialize();
        console.log('✅ Banco PostgreSQL inicializado com sucesso.');
        console.log('Tabelas prontas: cadastro_folha, relatorio_atividades');
    } catch (error) {
        console.error('❌ Falha ao inicializar PostgreSQL:', error.message);

        // Diagnóstico melhorado
        if (error.message.includes('password authentication failed')) {
            console.error('\n🔧 DIAGNÓSTICO: Erro de Autenticação\n');
            console.error('Possíveis causas:');
            console.error('1. Senha incorreta ou expirada');
            console.error('2. Caracteres especiais não escapados corretamente');
            console.error('\n📋 SOLUÇÃO:');
            console.error('1. Acesse: https://supabase.com/dashboard');
            console.error('2. Settings → Database → Reset Password');
            console.error('3. Settings → Database → Connection pooler → Session → PostgreSQL');
            console.error('4. Copie a connection string COMPLETA');
            console.error('5. Execute: npm run db:configure');
            console.error('6. Colar a string quando solicitado\n');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.error('\n🔧 DIAGNÓSTICO: Conexão Recusada\n');
            console.error('Host/porta não acessível');
            console.error('Verifique se você está usando Session Pooler (porta 5432)\n');
        }

        process.exit(1);
    } finally {
        try {
            await storage.close();
        } catch (e) {
            // ignore
        }
    }
}

main().catch((error) => {
    console.error('❌ Erro não tratado:', error.message);
    process.exit(1);
});
