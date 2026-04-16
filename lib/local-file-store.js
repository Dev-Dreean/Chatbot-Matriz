const fs = require('fs');
const path = require('path');

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function safeSegment(value, fallback = 'SEM_NOME') {
    const normalized = String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ');

    return normalized || fallback;
}

function yearFolder(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return String(date.getFullYear());
}

function collaboratorFolder(name, phone) {
    const safeName = safeSegment(name, 'SEM_NOME');
    const safePhone = normalizePhone(phone) || 'SEM_TELEFONE';
    return `${safeName} - ${safePhone}`;
}

function buildRecordFile(rootPath, entry, category) {
    const year = entry.year || yearFolder(entry.timestamp || entry.createdAt || new Date());
    const collaborator = collaboratorFolder(entry.name || entry.nome || '', entry.phone || entry.telefone || '');
    return path.join(
        rootPath,
        year,
        'colaboradores',
        collaborator,
        category,
        'registro.jsonl'
    );
}

function readJsonFile(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        return raw.trim() ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function appendJsonLine(filePath, entry) {
    ensureDir(path.dirname(filePath));
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function createLocalFileStore(options = {}) {
    const rootPath = path.resolve(
        options.rootPath || 'C:\\Sistemas\\Chatbot-Matriz\\Banco de dados'
    );
    const stateFile = path.join(rootPath, 'estado', 'user-states.json');

    ensureDir(rootPath);

    function isEnabled() {
        return true;
    }

    async function loadAllUserStates() {
        const data = readJsonFile(stateFile, {});
        return Object.keys(data).map(userId => ({
            userId,
            state: data[userId]
        }));
    }

    async function saveUserState(userId, state = {}) {
        const data = readJsonFile(stateFile, {});
        data[userId] = state;
        writeJsonFile(stateFile, data);
    }

    async function deleteUserState(userId) {
        const data = readJsonFile(stateFile, {});
        delete data[userId];
        writeJsonFile(stateFile, data);
    }

    async function clearAllUserStates() {
        writeJsonFile(stateFile, {});
    }

    async function deleteOldUserStates(daysOld = 7) {
        const data = readJsonFile(stateFile, {});
        const threshold = Date.now() - (Number(daysOld) || 7) * 24 * 3600000;
        let removed = 0;

        for (const [userId, state] of Object.entries(data)) {
            if (state && state.updatedAt && Number(state.updatedAt) < threshold) {
                delete data[userId];
                removed += 1;
            }
        }

        if (removed > 0) {
            writeJsonFile(stateFile, data);
        }

        return removed;
    }

    async function appendRelatorioAtividades(entry = {}) {
        const normalized = {
            timestamp: entry.TIMESTAMP || entry.timestamp || new Date().toISOString(),
            telefone: normalizePhone(entry.TELEFONE || entry.phone),
            nome: entry.NOME || entry.nome || '',
            acao: entry.ACAO || entry.acao || '',
            path: entry.PATH || entry.path || '',
            metadata: entry.metadata || {}
        };

        const filePath = buildRecordFile(rootPath, normalized, 'relatorios');
        appendJsonLine(filePath, normalized);
    }

    async function appendConversationMessage(entry = {}) {
        const normalized = {
            timestamp: entry.timestamp || new Date().toISOString(),
            direction: entry.direction || 'unknown',
            telefone: normalizePhone(entry.phone || entry.telefone),
            nome: entry.name || entry.nome || '',
            messageType: entry.messageType || 'text',
            body: entry.body || '',
            messageId: entry.messageId || '',
            metadata: entry.metadata || {}
        };

        const phonePath = path.join(
            rootPath,
            'historico',
            'por-telefone',
            `${normalized.telefone || 'desconhecido'}.jsonl`
        );
        appendJsonLine(phonePath, normalized);

        const filePath = buildRecordFile(rootPath, normalized, 'historico');
        appendJsonLine(filePath, normalized);
    }

    function getRootPath() {
        return rootPath;
    }

    function buildDocumentDir({ year, name, phone, category, monthLabel }) {
        const collaborator = collaboratorFolder(name, phone);
        const parts = [rootPath, yearFolder(year), 'colaboradores', collaborator, 'documentos'];
        if (category) parts.push(safeSegment(category, 'geral'));
        if (monthLabel) parts.push(safeSegment(monthLabel, 'sem_mes'));
        return path.join(...parts);
    }

    function buildHistoryDir({ year, name, phone }) {
        const collaborator = collaboratorFolder(name, phone);
        return path.join(rootPath, yearFolder(year), 'colaboradores', collaborator, 'historico');
    }

    function buildRelatorioDir({ year, name, phone }) {
        const collaborator = collaboratorFolder(name, phone);
        return path.join(rootPath, yearFolder(year), 'colaboradores', collaborator, 'relatorios');
    }

    return {
        isEnabled,
        loadAllUserStates,
        saveUserState,
        deleteUserState,
        clearAllUserStates,
        deleteOldUserStates,
        appendRelatorioAtividades,
        appendConversationMessage,
        getRootPath,
        buildDocumentDir,
        buildHistoryDir,
        buildRelatorioDir,
        ensureDir
    };
}

module.exports = {
    createLocalFileStore,
    normalizePhone,
    safeSegment,
    yearFolder,
    collaboratorFolder
};
