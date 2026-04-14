const dns = require('dns');
const { Pool } = require('pg');

try {
    dns.setDefaultResultOrder(process.env.PG_DNS_RESULT_ORDER || 'ipv4first');
} catch (error) {
    // Ignora em runtimes sem suporte
}

const DEFAULT_MONTH_COLUMN_MAP = {
    JANEIRO: 'janeiro',
    FEVEREIRO: 'fevereiro',
    'MARÇO': 'marco',
    'MARCO': 'marco',
    ABRIL: 'abril',
    MAIO: 'maio',
    JUNHO: 'junho',
    JULHO: 'julho',
    AGOSTO: 'agosto',
    SETEMBRO: 'setembro',
    OUTUBRO: 'outubro',
    NOVEMBRO: 'novembro',
    DEZEMBRO: 'dezembro'
};

const DEFAULT_MONTHS = [
    'JANEIRO',
    'FEVEREIRO',
    'MARÇO',
    'ABRIL',
    'MAIO',
    'JUNHO',
    'JULHO',
    'AGOSTO',
    'SETEMBRO',
    'OUTUBRO',
    'NOVEMBRO',
    'DEZEMBRO'
];

function toFlag(value) {
    if (value === true) return true;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'sim' || normalized === 'true' || normalized === '1' || normalized === 'x' || normalized === 'ok';
}

function toCheck(flag) {
    return flag ? 'OK' : '';
}

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function getConnectionCandidates(options = {}) {
    return [
        options.connectionString,
        process.env.DATABASE_URL,
        process.env.DATABASE_URL_POOLER,
        process.env.DATABASE_URL_SESSION_POOLER
    ].filter(Boolean);
}

function createPostgresStorage(options = {}) {
    const connectionCandidates = getConnectionCandidates(options);
    const monthColumns = options.monthColumns || DEFAULT_MONTH_COLUMN_MAP;
    const months = options.months || DEFAULT_MONTHS;
    const logger = options.logger || console;

    let pool = null;
    let initialized = false;
    let activeConnectionString = connectionCandidates[0] || '';

    function isEnabled() {
        return connectionCandidates.length > 0;
    }

    async function resetPool() {
        if (pool) {
            await pool.end().catch(() => {});
            pool = null;
        }
    }

    function getPool() {
        if (!isEnabled()) {
            throw new Error('DATABASE_URL nao configurada.');
        }

        if (!pool) {
            pool = new Pool({
                connectionString: activeConnectionString,
                connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
                max: Number(process.env.PG_POOL_MAX || 5),
                ssl: process.env.DATABASE_SSL_DISABLE === 'true'
                    ? false
                    : { rejectUnauthorized: false }
            });
        }

        return pool;
    }

    async function initialize() {
        if (!isEnabled()) return false;
        if (initialized) return true;

        const sql = `
            CREATE TABLE IF NOT EXISTS cadastro_folha (
                telefone VARCHAR(20) PRIMARY KEY,
                nome TEXT NOT NULL DEFAULT '',
                janeiro BOOLEAN NOT NULL DEFAULT FALSE,
                fevereiro BOOLEAN NOT NULL DEFAULT FALSE,
                marco BOOLEAN NOT NULL DEFAULT FALSE,
                abril BOOLEAN NOT NULL DEFAULT FALSE,
                maio BOOLEAN NOT NULL DEFAULT FALSE,
                junho BOOLEAN NOT NULL DEFAULT FALSE,
                julho BOOLEAN NOT NULL DEFAULT FALSE,
                agosto BOOLEAN NOT NULL DEFAULT FALSE,
                setembro BOOLEAN NOT NULL DEFAULT FALSE,
                outubro BOOLEAN NOT NULL DEFAULT FALSE,
                novembro BOOLEAN NOT NULL DEFAULT FALSE,
                dezembro BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS relatorio_atividades (
                id BIGSERIAL PRIMARY KEY,
                timestamp_text TEXT,
                telefone VARCHAR(20),
                nome TEXT,
                acao TEXT,
                path TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS user_conversation_state (
                user_id TEXT PRIMARY KEY,
                state JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS documentos_recebidos (
                id BIGSERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                logical_name TEXT NOT NULL,
                file_name TEXT NOT NULL,
                mime_type TEXT,
                content BYTEA NOT NULL,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                telefone VARCHAR(20),
                nome TEXT,
                month_ref TEXT,
                storage_path TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (category, logical_name)
            );

            CREATE TABLE IF NOT EXISTS conversation_history (
                id BIGSERIAL PRIMARY KEY,
                message_id TEXT,
                direction TEXT NOT NULL,
                telefone VARCHAR(20),
                nome TEXT,
                message_type TEXT,
                body_text TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_relatorio_telefone ON relatorio_atividades (telefone);
            CREATE INDEX IF NOT EXISTS idx_relatorio_acao ON relatorio_atividades (acao);
            CREATE INDEX IF NOT EXISTS idx_user_conversation_state_updated_at ON user_conversation_state (updated_at);
            CREATE INDEX IF NOT EXISTS idx_documentos_categoria ON documentos_recebidos (category);
            CREATE INDEX IF NOT EXISTS idx_documentos_telefone ON documentos_recebidos (telefone);
            CREATE INDEX IF NOT EXISTS idx_conversation_history_telefone ON conversation_history (telefone, created_at DESC);
        `;

        let lastError = null;

        for (const candidate of connectionCandidates) {
            try {
                activeConnectionString = candidate;
                await resetPool();
                const client = await getPool().connect();
                try {
                    await client.query(sql);
                    initialized = true;
                    logger.info('Banco PostgreSQL pronto (tabelas verificadas).');
                    return true;
                } finally {
                    client.release();
                }
            } catch (error) {
                lastError = error;
                initialized = false;
                const host = String(candidate).split('@')[1]?.split('/')[0] || 'host-desconhecido';
                logger.warn(`Falha ao conectar no PostgreSQL (${host}): ${error.message}`);
            }
        }

        throw lastError || new Error('Falha ao inicializar PostgreSQL.');
    }

    async function loadCadastroData() {
        await initialize();

        const monthSelect = months
            .map(month => `${monthColumns[month]} AS "${month}"`)
            .join(', ');

        const result = await getPool().query(
            `SELECT telefone AS "TELEFONE", nome AS "NOME", ${monthSelect}
             FROM cadastro_folha
             ORDER BY nome ASC`
        );

        return result.rows.map(row => {
            const mapped = {
                NOME: row.NOME || '',
                TELEFONE: row.TELEFONE || ''
            };

            months.forEach(month => {
                mapped[month] = toCheck(row[month]);
            });

            return mapped;
        });
    }

    async function saveCadastroData(data = []) {
        await initialize();

        const client = await getPool().connect();
        try {
            await client.query('BEGIN');

            for (const row of data) {
                const telefone = normalizePhone(row.TELEFONE);
                if (!telefone) continue;

                const nome = String(row.NOME || '').trim();
                const monthValues = months.map(month => toFlag(row[month]));

                await client.query(
                    `INSERT INTO cadastro_folha (
                        telefone, nome, janeiro, fevereiro, marco, abril, maio, junho,
                        julho, agosto, setembro, outubro, novembro, dezembro, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
                    )
                    ON CONFLICT (telefone)
                    DO UPDATE SET
                        nome = EXCLUDED.nome,
                        janeiro = EXCLUDED.janeiro,
                        fevereiro = EXCLUDED.fevereiro,
                        marco = EXCLUDED.marco,
                        abril = EXCLUDED.abril,
                        maio = EXCLUDED.maio,
                        junho = EXCLUDED.junho,
                        julho = EXCLUDED.julho,
                        agosto = EXCLUDED.agosto,
                        setembro = EXCLUDED.setembro,
                        outubro = EXCLUDED.outubro,
                        novembro = EXCLUDED.novembro,
                        dezembro = EXCLUDED.dezembro,
                        updated_at = NOW()`,
                    [telefone, nome, ...monthValues]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function appendRelatorioAtividades(entry = {}) {
        await initialize();

        const timestamp = entry.TIMESTAMP || null;
        const telefone = normalizePhone(entry.TELEFONE);
        const nome = entry.NOME || null;
        const acao = entry.ACAO || null;
        const path = entry.PATH || null;

        const metadata = { ...entry };
        delete metadata.TIMESTAMP;
        delete metadata.TELEFONE;
        delete metadata.NOME;
        delete metadata.ACAO;
        delete metadata.PATH;

        await getPool().query(
            `INSERT INTO relatorio_atividades (timestamp_text, telefone, nome, acao, path, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [timestamp, telefone || null, nome, acao, path, JSON.stringify(metadata)]
        );
    }

    async function appendConversationMessage(entry = {}) {
        await initialize();

        await getPool().query(
            `INSERT INTO conversation_history (message_id, direction, telefone, nome, message_type, body_text, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
            [
                entry.messageId || null,
                String(entry.direction || 'unknown'),
                normalizePhone(entry.phone) || null,
                entry.name || null,
                entry.messageType || null,
                entry.body || null,
                JSON.stringify(entry.metadata || {})
            ]
        );
    }

    async function close() {
        if (pool) {
            await pool.end();
            pool = null;
            initialized = false;
        }
    }

    async function loadAllUserStates() {
        await initialize();

        const result = await getPool().query(
            `SELECT user_id, state, EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_at_ms
             FROM user_conversation_state`
        );

        return result.rows.map(row => ({
            userId: row.user_id,
            state: {
                ...(row.state || {}),
                updatedAt: Number(row.updated_at_ms) || Date.now(),
                userId: row.user_id
            }
        }));
    }

    async function saveUserState(userId, state = {}) {
        await initialize();

        await getPool().query(
            `INSERT INTO user_conversation_state (user_id, state, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET
                state = EXCLUDED.state,
                updated_at = NOW()`,
            [userId, JSON.stringify(state)]
        );
    }

    async function deleteUserState(userId) {
        await initialize();
        await getPool().query('DELETE FROM user_conversation_state WHERE user_id = $1', [userId]);
    }

    async function clearAllUserStates() {
        await initialize();
        await getPool().query('DELETE FROM user_conversation_state');
    }

    async function deleteOldUserStates(daysOld = 7) {
        await initialize();

        const result = await getPool().query(
            `DELETE FROM user_conversation_state
             WHERE updated_at < NOW() - ($1::text || ' days')::interval`,
            [String(daysOld)]
        );

        return result.rowCount || 0;
    }

    async function getStoredDocument(category, logicalName) {
        await initialize();

        const result = await getPool().query(
            `SELECT id, category, logical_name AS "logicalName", file_name AS "fileName",
                    mime_type AS "mimeType", size_bytes AS "sizeBytes", telefone AS "phone",
                    nome AS "name", month_ref AS "monthRef", storage_path AS "storagePath",
                    metadata, created_at AS "createdAt", updated_at AS "updatedAt"
             FROM documentos_recebidos
             WHERE category = $1 AND logical_name = $2
             LIMIT 1`,
            [category, logicalName]
        );

        return result.rows[0] || null;
    }

    async function saveDocument(document = {}) {
        await initialize();

        const category = String(document.category || '').trim();
        const logicalName = String(document.logicalName || '').trim();
        const fileName = String(document.fileName || logicalName || '').trim();
        const mimeType = document.mimeType || null;
        const buffer = Buffer.isBuffer(document.buffer)
            ? document.buffer
            : Buffer.from(document.buffer || []);
        const phone = normalizePhone(document.phone);
        const name = document.name || null;
        const monthRef = document.monthRef || null;
        const storagePath = document.storagePath || null;
        const metadata = document.metadata || {};

        if (!category) {
            throw new Error('Categoria do documento nao informada.');
        }

        if (!logicalName) {
            throw new Error('Nome logico do documento nao informado.');
        }

        if (!fileName) {
            throw new Error('Nome do arquivo nao informado.');
        }

        await getPool().query(
            `INSERT INTO documentos_recebidos (
                category, logical_name, file_name, mime_type, content, size_bytes,
                telefone, nome, month_ref, storage_path, metadata, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11::jsonb, NOW(), NOW()
            )
            ON CONFLICT (category, logical_name)
            DO UPDATE SET
                file_name = EXCLUDED.file_name,
                mime_type = EXCLUDED.mime_type,
                content = EXCLUDED.content,
                size_bytes = EXCLUDED.size_bytes,
                telefone = EXCLUDED.telefone,
                nome = EXCLUDED.nome,
                month_ref = EXCLUDED.month_ref,
                storage_path = EXCLUDED.storage_path,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()`,
            [
                category,
                logicalName,
                fileName,
                mimeType,
                buffer,
                buffer.length,
                phone || null,
                name,
                monthRef,
                storagePath,
                JSON.stringify(metadata)
            ]
        );

        return {
            category,
            logicalName,
            fileName,
            sizeBytes: buffer.length,
            phone: phone || null,
            name,
            monthRef,
            storagePath,
            metadata
        };
    }

    return {
        isEnabled,
        initialize,
        loadCadastroData,
        saveCadastroData,
        appendRelatorioAtividades,
        appendConversationMessage,
        loadAllUserStates,
        saveUserState,
        deleteUserState,
        clearAllUserStates,
        deleteOldUserStates,
        getStoredDocument,
        saveDocument,
        close
    };
}

module.exports = {
    createPostgresStorage,
    DEFAULT_MONTH_COLUMN_MAP
};
