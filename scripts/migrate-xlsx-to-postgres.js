try {
    require('dotenv').config();
} catch (err) {
    // dotenv opcional
}

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createPostgresStorage } = require('../lib/postgres-storage');

const PRIVATE_BASE_CANDIDATES = [
    process.env.PRIVATE_BASE_PATH,
    'Z:\\FILIAL PR\\FOLHA PONTO PROJETOS\\WPPCHATBOT - FOLHAS PONTOS\\System',
    '\\\\172.20.30.101\\rh\\FILIAL PR\\FOLHA PONTO PROJETOS\\WPPCHATBOT - FOLHAS PONTOS\\System',
    path.join(process.cwd(), 'bot_data', 'private'),
    process.cwd()
].filter(Boolean);

function resolvePrivateBase() {
    for (const candidate of PRIVATE_BASE_CANDIDATES) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return process.cwd();
}

function readSheetRows(filePath, preferredSheet) {
    if (!fs.existsSync(filePath)) return [];

    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames.includes(preferredSheet)
        ? preferredSheet
        : wb.SheetNames[0];

    if (!sheetName) return [];
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('Erro: DATABASE_URL nao configurada no ambiente/.env.');
        process.exit(1);
    }

    const privateBase = resolvePrivateBase();
    const cadastroPath = path.join(privateBase, 'CADASTRO_FOLHA.xlsx');
    const relatorioPath = path.join(privateBase, 'RELATORIO_ATIVIDADES.xlsx');

    const cadastroRows = readSheetRows(cadastroPath, 'CADASTRO');
    const relatorioRows = readSheetRows(relatorioPath, 'RELATORIO');

    console.log(`Origem CADASTRO_FOLHA.xlsx: ${cadastroPath}`);
    console.log(`Origem RELATORIO_ATIVIDADES.xlsx: ${relatorioPath}`);
    console.log(`Linhas de cadastro encontradas: ${cadastroRows.length}`);
    console.log(`Linhas de relatorio encontradas: ${relatorioRows.length}`);

    const storage = createPostgresStorage();

    try {
        await storage.initialize();

        if (cadastroRows.length > 0) {
            await storage.saveCadastroData(cadastroRows);
            console.log(`✅ Cadastro migrado (${cadastroRows.length} linhas processadas).`);
        } else {
            console.log('ℹ️ Nenhuma linha de cadastro para migrar.');
        }

        let relatorioMigrado = 0;
        for (const row of relatorioRows) {
            await storage.appendRelatorioAtividades(row);
            relatorioMigrado += 1;
        }

        if (relatorioRows.length > 0) {
            console.log(`✅ Relatorio migrado (${relatorioMigrado} linhas inseridas).`);
        } else {
            console.log('ℹ️ Nenhuma linha de relatorio para migrar.');
        }

        console.log('🎉 Migracao concluida com sucesso.');
    } finally {
        await storage.close();
    }
}

main().catch((error) => {
    console.error('❌ Falha na migracao:', error.message);
    process.exit(1);
});
