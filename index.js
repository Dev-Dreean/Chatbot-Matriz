/**
 * ============================================================================
 * BOT FOLHA PONTO - PLANSUL (WhatsApp Cloud API)
 * ============================================================================
 * 
 * Versão 2.0 - Migrado de Baileys para WhatsApp Cloud API Oficial
 * 
 * REGRA CRÍTICA: Este bot NUNCA inicia conversas.
 * Todas as mensagens são enviadas apenas em resposta a mensagens recebidas.
 * 
 * TODO: Antes de rodar, configure as variáveis de ambiente (.env):
 * - WHATSAPP_TOKEN
 * - WHATSAPP_PHONE_NUMBER_ID
 * - WEBHOOK_VERIFY_TOKEN
 * - PORT (opcional, padrão: 3000)
 * 
 * TODO: Configure a URL do webhook no painel da Meta:
 * URL: https://seu-dominio.com/webhook
 * Token: o mesmo valor de WEBHOOK_VERIFY_TOKEN
 * ============================================================================
 */
// Carrega variaveis do arquivo .env (ou .env.ready) quando disponivel
try {
    const fs = require('fs');
    const path = require('path');
    const dotenv = require('dotenv');
    const envPath = process.env.ENV_FILE
        ? path.resolve(process.cwd(), process.env.ENV_FILE)
        : path.resolve(process.cwd(), '.env');
    const readyPath = path.resolve(process.cwd(), '.env.ready');

    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    } else if (fs.existsSync(readyPath)) {
        dotenv.config({ path: readyPath });
    } else {
        dotenv.config();
    }
} catch (e) {
    console.warn('⚠️ dotenv não instalado — variáveis de ambiente devem ser definidas no sistema.');
}

console.clear();
const BOT_INSTANCE_NAME = process.env.BOT_INSTANCE_NAME || 'MATRIZ';
console.log(`🤖 BOT FOLHA PONTO - ${BOT_INSTANCE_NAME} v2.0 (Cloud API)`);
console.log('='.repeat(60));

// ========== DEPENDÊNCIAS ==========
const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');

// Módulos customizados
const { sendWhatsAppText, markMessageAsRead, normalizePhoneNumber, validateCredentials, sendWhatsAppInteractiveButtons, sendWhatsAppInteractiveList } = require('./lib/whatsapp-cloud-api');
const { extractIncomingMessage, extractIncomingDocument, isStatusNotification } = require('./lib/webhook-handler');
const AntiSpamSystem = require('./anti-spam-system');
const { getVariation } = require('./message-variations');
const NameHandling = require('./name-handling-rules');
const { createPostgresStorage } = require('./lib/postgres-storage');
const UserStateManager = require('./lib/user-state-manager');

// ========== CONFIGURAÇÃO ==========
// Use porta do .env ou sistema; padrão alterado para 3001 para evitar conflitos locais
const PORT = process.env.PORT || 3001;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// Valida credenciais no início
const credsCheck = validateCredentials();
if (!credsCheck.valid) {
    console.error('❌ ERRO: Variáveis de ambiente não configuradas!');
    console.error(`   Faltando: ${credsCheck.missing.join(', ')}`);
    console.error('\n💡 Configure as variaveis no arquivo .env ou .env.ready');
    console.error('   Veja o arquivo .env.example para referencia\n');
    process.exit(1);
}

console.log('✅ Variáveis de ambiente configuradas');

// ========== CONSTANTES GLOBALS ==========
const MONTHS = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL',
    'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
    'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

const cadastroStorage = createPostgresStorage({ months: MONTHS });
let DATABASE_STORAGE_ENABLED = cadastroStorage.isEnabled();

// ========== CAMINHOS DE ARQUIVOS ==========
const appPath = process.cwd();
let PRIVATE_BASE, PUBLIC_BASE, ATESTADOS_BASE, TERMOS_CIENCIA_BASE;
let NETWORK_STORAGE_AVAILABLE = false;
const LOGS_DIR = path.join(appPath, 'logs');
const CONVERSATION_LOG_FILE = path.join(LOGS_DIR, 'conversation-history.jsonl');
const CONVERSATION_VIEW_DIR = path.join(LOGS_DIR, 'conversations');

try {
    PRIVATE_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\FOLHA PONTO PROJETOS\\WPPCHATBOT - FOLHAS PONTOS\\System';
    PUBLIC_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\FOLHA PONTO PROJETOS\\WPPCHATBOT - FOLHAS PONTOS';
    ATESTADOS_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\PROJETO ATESTADOS';
    TERMOS_CIENCIA_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\PROJETO TERMOS_CIENCIA';

    if (!fs.existsSync(path.dirname(PRIVATE_BASE))) {
        throw new Error('Rede não acessível');
    }
    NETWORK_STORAGE_AVAILABLE = true;
    console.log('✅ Usando caminhos de rede corporativa');
} catch (error) {
    const localDataPath = path.join(appPath, 'bot_data');
    PRIVATE_BASE = path.join(localDataPath, 'private');
    PUBLIC_BASE = path.join(localDataPath, 'public');
    ATESTADOS_BASE = path.join(PUBLIC_BASE, 'ATESTADOS');
    TERMOS_CIENCIA_BASE = path.join(PUBLIC_BASE, 'TERMOS_CIENCIA');

    console.warn('⚠️ Rede corporativa indisponível:', error.message);
    console.log(`📁 Usando armazenamento local secundário em: ${localDataPath}`);
}

// Criar pastas necessárias
[PRIVATE_BASE, PUBLIC_BASE, ATESTADOS_BASE, TERMOS_CIENCIA_BASE, LOGS_DIR, CONVERSATION_VIEW_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

if (DATABASE_STORAGE_ENABLED) {
    console.log('✅ PostgreSQL habilitado como armazenamento primário');
} else {
    console.warn('⚠️ DATABASE_URL não configurada; usando filesystem como armazenamento primário');
}

// ========== ESTADO DA APLICAÇÃO ==========
const stateManager = new UserStateManager(cadastroStorage);
const REPORT_DATA = {
    cadastros: [],
    enviosPDF: [],
    substituicoesPDF: [],
    naoSubstituicoes: [],
    termosCiencia: []
};

// ========== SISTEMA ANTI-SPAM ==========
const spamGuard = new AntiSpamSystem();
console.log('✅ Sistema Anti-Spam inicializado');

// Mapeia o número do usuário para o phone_number_id correto
const recipientContexts = new Map();

function rememberRecipientContext(phone, phoneNumberId) {
    if (!phone || !phoneNumberId) return;
    try {
        const normalized = normalizePhoneNumber(phone);
        recipientContexts.set(normalized, { phoneNumberId, updatedAt: Date.now() });
    } catch (err) {
        // Silencioso: não bloqueia fluxo por erro de normalização
    }
}

function getRecipientContext(phone) {
    if (!phone) return {};
    try {
        const normalized = normalizePhoneNumber(phone);
        return recipientContexts.get(normalized) || {};
    } catch (err) {
        return {};
    }
}

// Função para enfileirar mensagens (com anti-spam)
function queueMessage(to, text, priority = 0, context = {}) {
    const priorityMap = { 0: 'normal', 1: 'normal', 2: 'high' };
    const priorityLevel = priorityMap[priority] || 'normal';

    const normalizedTo = normalizePhoneNumber(to);
    const rememberedContext = getRecipientContext(normalizedTo);
    const mergedContext = { ...rememberedContext, ...context };

    return spamGuard.queue(
        normalizedTo,
        text,
        priorityLevel,
        mergedContext
    );
}

function stripMenuHint(text) {
    return String(text || '')
        .replace(/\n+\s*🔙\s*Digite \*?menu\*? para voltar/giu, '')
        .replace(/\n+\s*Digite \*?menu\*? para voltar/giu, '')
        .trim();
}

async function sendDirectText(to, text, context = {}, metadata = {}) {
    const sent = await sendWhatsAppText(to, text, context);
    if (sent) {
        await appendConversationHistory({
            direction: 'out',
            phone: to,
            name: metadata.userName || '',
            messageType: metadata.messageType || 'text',
            body: text,
            metadata: {
                source: 'direct',
                phoneNumberId: context.phoneNumberId || ''
            }
        });
    }
    return sent;
}

// Processa fila periodicamente
setInterval(async () => {
    await spamGuard.processQueue(async (to, text, metadata) => {
        // Envia via Cloud API
        const sent = await sendWhatsAppText(to, text, metadata);
        if (sent) {
            await appendConversationHistory({
                direction: 'out',
                phone: to,
                name: metadata && metadata.userName ? metadata.userName : '',
                messageType: metadata && metadata.messageType ? metadata.messageType : 'text',
                body: text,
                metadata: {
                    source: 'queue',
                    phoneNumberId: metadata && metadata.phoneNumberId ? metadata.phoneNumberId : ''
                }
            });
        }
        return sent;
    });
}, 500);

// ========== FUNÇÕES UTILITÁRIAS ==========
function logEvento({ tipo = 'INFO', mensagem, nome = '', telefone = '', extra = '' }) {
    const horario = new Date().toLocaleString('pt-BR');
    let info = `[${horario}] [${tipo}]`;
    if (nome) info += ` [${nome}]`;
    if (telefone) info += ` [${telefone}]`;
    if (extra) info += ` [${extra}]`;
    console.log(`${info} ${mensagem}`);
}

function formatDateTime(date = new Date()) {
    const pad = num => num.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cleanPhone(phone) {
    return phone.replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').replace(/\D/g, '');
}

function formatName(name) {
    return (name || 'Colega').split(' ')[0] || 'Colega';
}

function currentMonth() {
    const hoje = new Date();
    const dia = hoje.getDate();
    const mesIdx = hoje.getMonth();
    return dia >= 25 ? MONTHS[mesIdx] : MONTHS[mesIdx === 0 ? 11 : mesIdx - 1];
}

function monthFolderLabel(monthName) {
    const normalized = String(monthName || '').toUpperCase();
    const idx = MONTHS.findIndex(m => m.toUpperCase() === normalized);
    const monthIndex = idx >= 0 ? idx : new Date().getMonth();
    const number = String(monthIndex + 1).padStart(2, '0');
    return `${number}-${MONTHS[monthIndex]}`;
}

function toSafeFileName(value, fallback = 'SEM_NOME') {
    const illegalRe = /[\\/:*?"<>|]/g;
    const normalized = String(value || '').replace(illegalRe, '').trim();
    return normalized || fallback;
}

function normalizeSelectionText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function resolveMainMenuSelection(value) {
    const normalized = normalizeSelectionText(value);

    if (!normalized) return null;
    if (normalized === '1' || normalized.includes('cadastros') || normalized.includes('pagamentos')) return '1';
    if (normalized === '2' || normalized.includes('recrutamento') || normalized.includes('selecao')) return '2';
    if (normalized === '3' || normalized.includes('atestados')) return '3';
    if (normalized === '4' || normalized.includes('enviar folha ponto') || /\bponto\b/.test(normalized)) return '4';
    if (normalized === '5' || normalized.includes('uniformes') || normalized.includes('uniforme')) return '5';
    if (normalized === '6' || normalized.includes('rescisao')) return '6';
    if (normalized === '7' || normalized.includes('ferias')) return '7';
    if (normalized === '8' || normalized.includes('falar com atendente') || normalized.includes('atendente')) return '8';
    if (normalized === '9' || normalized.includes('termo de ciencia') || normalized.includes('termo')) return '9';

    return null;
}

function resolvePontoSelection(value) {
    const normalized = normalizeSelectionText(value);

    if (!normalized) return null;
    if (normalized === '1' || normalized.includes('enviar folha ponto') || normalized.includes('folha ponto')) return 1;
    if (normalized === '2' || normalized.includes('ponto eletronico')) return 2;
    if (normalized === '3' || normalized.includes('ponto manual')) return 3;

    return null;
}

async function saveFileToSecondaryStorage(destPath, buffer) {
    try {
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(destPath, buffer);
        return {
            path: destPath,
            sizeBytes: fs.statSync(destPath).size
        };
    } catch (error) {
        logEvento({ tipo: 'WARN', mensagem: 'Falha ao gravar espelho em filesystem', extra: error.message });
        return null;
    }
}

// ========== PLANILHAS EXCEL ==========
async function loadCadastroData() {
    if (!DATABASE_STORAGE_ENABLED) {
        return [];
    }

    try {
        return await cadastroStorage.loadCadastroData();
    } catch (error) {
        DATABASE_STORAGE_ENABLED = false;
        logEvento({ tipo: 'WARN', mensagem: 'Falha ao carregar cadastro do PostgreSQL; usando lista vazia', extra: error.message });
        return [];
    }
}

async function saveCadastroData(data) {
    if (!DATABASE_STORAGE_ENABLED) {
        return;
    }

    try {
        await cadastroStorage.saveCadastroData(data);
    } catch (error) {
        DATABASE_STORAGE_ENABLED = false;
        logEvento({ tipo: 'WARN', mensagem: 'Falha ao salvar cadastro no PostgreSQL', extra: error.message });
    }
}

// Adiciona uma entrada simples ao relatório de atividades
async function appendRelatorioAtividades(entry) {
    if (!DATABASE_STORAGE_ENABLED) {
        return;
    }

    try {
        await cadastroStorage.appendRelatorioAtividades(entry);
    } catch (error) {
        DATABASE_STORAGE_ENABLED = false;
        logEvento({ tipo: 'WARN', mensagem: 'Falha ao gravar relatório no PostgreSQL', extra: error.message });
    }
}

function appendConversationMirror(entry) {
    try {
        const line = JSON.stringify(entry);
        fs.appendFileSync(CONVERSATION_LOG_FILE, `${line}\n`, 'utf8');

        const phoneLabel = cleanPhone(entry.phone || '') || 'desconhecido';
        const perPhonePath = path.join(CONVERSATION_VIEW_DIR, `${phoneLabel}.log`);
        const preview = String(entry.body || '').replace(/\s+/g, ' ').trim();
        const rendered = `[${entry.timestamp}] [${entry.direction}] [${entry.messageType || 'text'}] ${entry.name || ''} ${preview}`.trim();
        fs.appendFileSync(perPhonePath, `${rendered}\n`, 'utf8');
    } catch (error) {
        logEvento({ tipo: 'WARN', mensagem: 'Falha ao gravar historico local da conversa', extra: error.message });
    }
}

async function appendConversationHistory(entry) {
    const safeEntry = {
        timestamp: formatDateTime(),
        direction: entry.direction || 'unknown',
        phone: cleanPhone(entry.phone || ''),
        name: entry.name || '',
        messageType: entry.messageType || 'text',
        body: entry.body || '',
        messageId: entry.messageId || '',
        metadata: entry.metadata || {}
    };

    appendConversationMirror(safeEntry);

    if (!DATABASE_STORAGE_ENABLED || typeof cadastroStorage.appendConversationMessage !== 'function') {
        return;
    }

    try {
        await cadastroStorage.appendConversationMessage(safeEntry);
    } catch (error) {
        DATABASE_STORAGE_ENABLED = false;
        logEvento({ tipo: 'WARN', mensagem: 'Falha ao gravar historico no PostgreSQL', extra: error.message });
    }
}

// ========== MENUS E MENSAGENS ==========
const MAIN_MENU = (name = 'Colega') => {
    const v = getVariation('MAIN_MENU', { NAME: formatName(name) });
    // Se o template for um objeto (interativo), converte para texto legível como fallback
    if (v && typeof v === 'object') {
        const header = v.header ? `${v.header}\n\n` : '';
        const body = v.body || '';
        const footer = v.footer ? `\n\n${v.footer}` : '';
        return `${header}${body}${footer}`;
    }
    return v || '';
};

function getMainMenuRows() {
    return [
        { id: 'MENU_1_CADASTROS', title: 'Cadastros', description: 'Pagamentos e cadastro' },
        { id: 'MENU_2_RECRUTAMENTO', title: 'Recrutamento', description: 'Selecao e processo seletivo' },
        { id: 'MENU_3_ATESTADOS', title: 'Atestados', description: 'Procedimento de envio' },
        { id: 'MENU_4_PONTO', title: 'Ponto', description: 'Envio e duvidas' },
        { id: 'MENU_5_UNIFORMES', title: 'Uniformes', description: 'Duvidas sobre uniforme' },
        { id: 'MENU_6_RESCISAO', title: 'Rescisao', description: 'Informacoes de desligamento' },
        { id: 'MENU_7_FERIAS', title: 'Ferias', description: 'Duvidas sobre ferias' },
        { id: 'MENU_8_ATENDENTE', title: 'Falar com atendente', description: 'Numeros dos atendentes' }
    ];
}

const CONTATOS = {
    1: `📋 *ALTERAÇÃO CADASTRAL/PAGAMENTOS*\n\n` +
        `📧 suporteadmpr@plansul.com.br\n` +
        `📞 (41) 3087-2573\n\n` +
        `🔙 Digite *menu* para voltar`,
    2: `🤝 *PROCESSO SELETIVO*\n\n` +
        `📧 processoseletivo@plansul.com.br\n` +
        `📞 (41) 99148-9677\n\n` +
        `🔙 Digite *menu* para voltar`,
    3: `🏥 *ATESTADOS*\n\n` +
        `📧 rhfilialcolombo@plansul.com.br\n\n` +
        `🔙 Digite *menu* para voltar`,
    5: `⏱️ *PONTO ELETRÔNICO*\n\n` +
        `📞 (41) 99259-3700\n\n` +
        `🔙 Digite *menu* para voltar`,
    6: `⏱️ *PONTO MANUAL*\n\n` +
        `📞 (41) 3087-2570\n` +
        `📧 folhaponto.750@plansul.com.br\n\n` +
        `🔙 Digite *menu* para voltar`,
    7: `👕 *UNIFORMES*\n\n` +
        `📞 (41) 99113-5703\n\n` +
        `🔙 Digite *menu* para voltar`,
    8: `🌴 *FÉRIAS*\n\n` +
        `📧 auxiliarrh.750@plansul.com.br\n\n` +
        `🔙 Digite *menu* para voltar`,
    9: `🧑‍💻 *FALAR COM ATENDENTE*\n\n` +
        `CADASTRO & PAGAMENTOS: (41) 3087-2573\n` +
        `PROCESSO SELETIVO: (41) 99148-9677\n` +
        `PONTO ELETRÔNICO: (41) 99259-3700\n` +
        `UNIFORMES: (41) 99113-5703\n\n` +
        `🔙 Digite *menu* para voltar`,
    10: `📝 *TERMO DE CIÊNCIA*\n\n` +
        `Envie o termo assinado em PDF para registro.\n\n` +
        `🔙 Digite *menu* para voltar`
};

const RESCISAO_SUBMENU = (name = 'Colega') =>
    `🚪 *RESCISÃO*\n\n` +
    `${formatName(name)}, para solicitar seu desligamento, escolha uma das opções abaixo:\n\n` +
    `1️⃣ Aviso prévio *(30 dias trabalhados)*\n` +
    `2️⃣ Aviso prévio *sem cumprimento*\n` +
    `3️⃣ Interrupção do cumprimento do *aviso prévio trabalhado*\n` +
    `4️⃣ Término de contrato *(30 dias ou 90 dias)*\n\n` +
    `🔙 Digite *menu* para voltar`;

const RESCISAO_TEXTS = {
    1: () =>
        `*1️⃣ AVISO PRÉVIO (30 DIAS TRABALHADOS)*\n\n` +
        `Faça uma carta de próprio punho em folha em branco conforme o modelo abaixo:\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta, solicitar meu desligamento da Empresa PLANSUL – PLANEJAMENTO E CONSULTORIA por motivos pessoais.\n` +
        `*Informo que irei cumprir aviso.*\n\n` +
        `LOCAL, DIA – MÊS – ANO\n` +
        `ASSINATURA\n\n` +
        `📧 Enviar para: aux01.colombo@plansul.com.br\n\n` +
        `🔙 Digite *menu* para voltar`,
    2: () =>
        `*2️⃣ AVISO PRÉVIO SEM CUMPRIMENTO*\n\n` +
        `Faça uma carta de próprio punho em folha em branco conforme o modelo abaixo:\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta, solicitar meu desligamento da Empresa PLANSUL – PLANEJAMENTO E CONSULTORIA por motivos pessoais.\n` +
        `*Informo que não irei cumprir aviso.*\n\n` +
        `LOCAL, DIA – MÊS – ANO\n` +
        `ASSINATURA\n\n` +
        `*Obs:* É descontada na rescisão a multa referente ao aviso prévio não cumprido.\n\n` +
        `🔙 Digite *menu* para voltar`,
    3: () =>
        `*3️⃣ INTERRUPÇÃO DO CUMPRIMENTO DO AVISO PRÉVIO TRABALHADO*\n\n` +
        `Faça uma carta de próprio punho seguindo o modelo abaixo.\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXXXXXXXX XXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta solicitar meu desligamento imediato e informo que não continuarei cumprindo o aviso prévio iniciado em xx/xx/xxxx.\n` +
        `Estou ciente dos descontos dos dias faltantes.\n\n` +
        `CURITIBA, DIA – MÊS – ANO\n\n` +
        `ASSINATURA\n\n` +
        `📧 Enviar para: aux01.colombo@plansul.com.br\n\n` +
        `*Obs:* É descontada na rescisão a multa pelos dias não trabalhados do aviso prévio.\n\n` +
        `🔙 Digite *menu* para voltar`,
    4: () =>
        `*4️⃣ TÉRMINO DE CONTRATO (30 DIAS OU 90 DIAS)*\n\n` +
        `Faça uma carta de próprio punho em folha em branco conforme o modelo abaixo:\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta solicitar meu desligamento da Empresa PLANSUL – PLANEJAMENTO E CONSULTORIA por motivos pessoais, em razão do término do meu contrato de experiência/prazo determinado.\n` +
        `*Informo que não irei cumprir aviso.*\n\n` +
        `LOCAL, DIA – MÊS – ANO\n` +
        `ASSINATURA\n\n` +
        `📧 Enviar para: aux01.colombo@plansul.com.br\n\n` +
        `🔙 Digite *menu* para voltar`
};

const INVALID_RESCISAO_OPTION_TEXT = (name = 'Colega') =>
    `❌ *Opção inválida, ${formatName(name)}!* Escolha uma opção de 1 a 4 para Rescisão, ou digite *menu* para voltar.`;

// ========== FUNÇÕES DE MENSAGENS INTERATIVAS ==========
/**
 * Envia mensagem de boas-vindas com botão único
 * 🔒 PROTEGIDA: Envia apenas uma vez por usuário
 * 
 * @param {string} to - Número de destino (formato JID ou puro)
 * @param {string} userName - Nome do usuário
 */
async function sendWelcomeWithButton(to, userName, context = {}) {
    const fromJid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const phone = cleanPhone(to);

    // ⚠️ VERIFICAÇÃO: Já recebeu boas-vindas?
    if (await stateManager.hasReceivedWelcome(fromJid)) {
        logEvento({ tipo: 'INFO', mensagem: 'Usuário já recebeu boas-vindas, enviando menu', telefone: phone });
        await sendMainMenuList(fromJid, userName, context);
        return;
    }

    const name = formatName(userName) || 'colaborador(a)';
    // Mensagem de boas-vindas textual (sem botão)
    const welcomeText = `Olá ${name}! 👋\n\n` +
        `Sou o assistente da Plansul!\n` +
        `No que posso te ajudar?`;

    // MARCA COMO ENVIADO ANTES de enviar (evita race condition)
    await stateManager.setWelcomeSent(fromJid);
    logEvento({ tipo: 'WELCOME', mensagem: 'Boas-vindas marcadas como enviadas', telefone: phone });

    // Envia a saudação
    await sendWhatsAppText(fromJid, welcomeText, context);

    // Após uma pequena pausa, envia a lista de opções
    try {
        await new Promise(resolve => setTimeout(resolve, 1200));
        await sendMainMenuList(fromJid, userName, context);
    } catch (err) {
        logEvento({ tipo: 'ERRO', mensagem: 'Erro ao enviar lista após saudação', telefone: phone, extra: err.message });
    }
}

/**
 * Envia lista interativa com o menu principal
 * 
 * @param {string} to - Número de destino
 * @param {string} userName - Nome do usuário
 */
async function sendMainMenuList(to, userName, context = {}) {
    const bodyText = 'Escolha uma das opções:';
    const buttonText = 'Opções';

    // Menu com 10 opções em uma única seção (sem 'Outros serviços')
    const sections = [
        {
            title: 'Menu',
            rows: [
                { id: 'MENU_1_CADASTROS', title: '📋 Cadastros', description: '& Pagamentos' },
                { id: 'MENU_2_RECRUTAMENTO', title: '🤝 Recrutamento', description: '& Seleção' },
                { id: 'MENU_3_ATESTADOS', title: '🏥 Atestados', description: 'Procedimento de envio' },
                { id: 'MENU_4_PONTO', title: '⏱️ Ponto', description: 'Acesso a envio e dúvidas' },
                { id: 'MENU_5_UNIFORMES', title: '👕 Uniformes', description: 'Fale sobre o uniforme' },
                { id: 'MENU_6_RESCISAO', title: '🚪 Rescisão', description: 'Informações sobre rescisão' },
                { id: 'MENU_7_FERIAS', title: '🌴 Férias', description: 'Dúvidas sobre férias' },
                { id: 'MENU_8_ATENDENTE', title: '🧑‍💻 Falar com atend.', description: 'Numeros dos atendente' }
            ]
        }
    ];

    const ok = await sendWhatsAppInteractiveList(
        to,
        null, // sem header
        bodyText,
        null, // sem footer
        buttonText,
        sections,
        context
    );

    // Fallback para o menu em texto, se a lista interativa falhar
    if (!ok) {
        logEvento({ tipo: 'WARN', mensagem: 'Falha ao enviar lista interativa, usando fallback de texto', telefone: cleanPhone(to) });
        const menuText = MAIN_MENU(userName);
        return queueMessage(to, menuText, 2, context);
    }

    logEvento({ tipo: 'INFO', mensagem: 'Lista interativa enviada', telefone: cleanPhone(to) });
}

async function sendRemainingMenuList(to, userName, currentMenuId, context = {}) {
    const rows = getMainMenuRows()
        .filter(row => row.id !== currentMenuId);

    rows.unshift({
        id: 'MENU_HOME',
        title: 'Menu principal',
        description: 'Ver todas as opcoes'
    });

    const ok = await sendWhatsAppInteractiveList(
        to,
        null,
        'Escolha outra opcao ou volte ao menu principal:',
        null,
        'Opcoes',
        [{ title: 'Outras opcoes', rows }],
        context
    );

    if (!ok) {
        return sendMainMenuList(to, userName, context);
    }

    logEvento({ tipo: 'INFO', mensagem: 'Lista contextual enviada', telefone: cleanPhone(to) });
}

async function sendInfoScreen(to, userName, text, currentMenuId, context = {}) {
    const normalizedText = stripMenuHint(text);
    await sendDirectText(to, normalizedText, context, { userName });
    await new Promise(resolve => setTimeout(resolve, 700));
    return sendRemainingMenuList(to, userName, currentMenuId, context);
}

// Sub-menu para escolher tipo de Ponto (Eletrônico ou Manual)
async function sendPontoSubMenu(to, userName, context = {}) {
    const name = formatName(userName) || 'colaborador(a)';

    // Mantém o usuário no contexto do submenu para respostas por texto (fallback)
    await stateManager.setState(to, { step: 'ponto_submenu', userName });

    const bodyText = `${name}, qual opção de ponto você deseja?`;
    const buttonText = 'Escolher';

    const sections = [
        {
            title: 'Ponto',
            rows: [
                { id: 'PONTO_ENVIAR_FOLHA', title: '📤 Enviar folha ponto', description: 'Enviar sua folha ponto' },
                { id: 'PONTO_ELETRONICO', title: '📱 Ponto eletronico', description: 'Tirar duvidas' },
                { id: 'PONTO_MANUAL', title: '✍️ Ponto manual', description: 'Tirar duvidas' }
            ]
        }
    ];

    const ok = await sendWhatsAppInteractiveList(
        to,
        null,
        bodyText,
        null,
        buttonText,
        sections,
        context
    );

    if (!ok) {
        // Fallback texto
        await queueMessage(
            to,
            `${name}, escolha uma opção de ponto:\n\n1️⃣ Enviar folha ponto\n2️⃣ Ponto eletronico\n3️⃣ Ponto manual\n\nDigite 1, 2 ou 3:`,
            2,
            context
        );
    }
}

// Envia botões para confirmar substituição de arquivo (SIM / NÃO)
async function sendConfirmReplaceButtons(to, userName, month, context = {}) {
    const bodyText = `⚠️ ${formatName(userName)}, você já enviou a folha de ${month} ✅\nQuer substituir?`;
    const footer = '';
    const buttons = [
        { id: 'REPLACE_YES', title: '✅ 1 - SIM' },
        { id: 'REPLACE_NO', title: '❌ 0 - NÃO' }
    ];

    const ok = await sendWhatsAppInteractiveButtons(to, bodyText, footer, buttons, context);
    if (!ok) {
        // Fallback em texto se botões não funcionarem
        await queueMessage(to,
            `⚠️ ${formatName(userName)}, você já enviou a folha de ${month} ✅\nQuer substituir?\n\n✅ 1 - SIM\n❌ 0 - NÃO\n\n🔙 Digite *menu* para voltar`, 2, context);
    }
}

// ========== FUNÇÃO DE TRATAMENTO DE MENSAGENS ==========
// Esta é a função central que processa todas as mensagens recebidas
// REGRA CRÍTICA: Só é chamada quando uma mensagem é recebida do usuário
async function handleIncomingMessage({ from, body, pushName, messageId, type, interactiveId, interactiveTitle, phoneNumberId }) {
    try {
        // Normaliza o número para formato interno
        const fromJid = from.includes('@') ? from : `${from}@s.whatsapp.net`;
        const context = phoneNumberId ? { phoneNumberId } : {};
        rememberRecipientContext(from, phoneNumberId);
        let texto = (body || '').trim().toLowerCase();
        const state = await stateManager.getState(fromJid);
        const userName = pushName || 'Colega';

        logEvento({
            tipo: 'MSG',
            mensagem: `Recebido (${type || 'text'})`,
            nome: userName,
            telefone: from,
            extra: type === 'text' ? texto.substring(0, 50) : `Interactive: ${interactiveId}`
        });

        await appendConversationHistory({
            direction: 'in',
            phone: from,
            name: userName,
            messageType: type || 'text',
            body: body || interactiveTitle || '',
            messageId,
            metadata: {
                interactiveId: interactiveId || '',
                phoneNumberId: phoneNumberId || ''
            }
        });

        // Marca como lida (opcional)
        if (messageId) {
            await markMessageAsRead(messageId, context);
        }

        // ===== TRATAMENTO DE MENSAGENS INTERATIVAS =====

        // Usuário clicou no botão "Ver opções" → envia a LISTA
        if (type === 'interactive_button' && interactiveId === 'OPEN_MAIN_MENU') {
            logEvento({ tipo: 'INTERACTIVE', mensagem: 'Botão clicado: OPEN_MAIN_MENU', telefone: from });
            await sendMainMenuList(fromJid, userName, context);
            return;
        }

        // Usuário escolheu uma opção da LISTA → mapeia para o número correspondente
        if (type === 'interactive_list' && interactiveId) {
            // Mapeamento do menu principal (10 itens)
            const mapMenu = {
                MENU_1_CADASTROS: '1',
                MENU_2_RECRUTAMENTO: '2',
                MENU_3_ATESTADOS: '3',
                MENU_5_UNIFORMES: '5',
                MENU_6_RESCISAO: '6',
                MENU_7_FERIAS: '7',
                MENU_8_ATENDENTE: '8'
            };

            if (interactiveId === 'MENU_HOME') {
                await stateManager.clearState(fromJid);
                await sendMainMenuList(fromJid, userName, context);
                return;
            }

            if (interactiveId === 'MENU_9_TERMO') {
                await stateManager.clearState(fromJid);
                await sendInfoScreen(fromJid, userName, 'Essa opcao foi removida do atendimento.', 'MENU_HOME', context);
                return;
            }

            // Se usuário escolheu Ponto no menu principal, abrir sub-menu
            if (interactiveId === 'MENU_4_PONTO') {
                logEvento({ tipo: 'INTERACTIVE', mensagem: 'Abrindo sub-menu de Ponto', telefone: from });
                await sendPontoSubMenu(fromJid, userName, context);
                return;
            }

            // Sub-menu de Ponto: Enviar folha, Eletrônico ou Manual
            if (interactiveId === 'PONTO_ENVIAR_FOLHA') {
                logEvento({ tipo: 'INTERACTIVE', mensagem: 'Enviar folha ponto selecionado', telefone: from });
                return handleFolhaPonto(fromJid, userName, context);
            }

            if (interactiveId === 'PONTO_ELETRONICO') {
                logEvento({ tipo: 'INTERACTIVE', mensagem: 'Ponto Eletrônico selecionado', telefone: from });
                await stateManager.clearState(fromJid);
                return sendInfoScreen(fromJid, userName, CONTATOS[5], 'MENU_4_PONTO', context);
            }

            if (interactiveId === 'PONTO_MANUAL') {
                logEvento({ tipo: 'INTERACTIVE', mensagem: 'Ponto Manual selecionado', telefone: from });
                await stateManager.clearState(fromJid);
                return sendInfoScreen(fromJid, userName, CONTATOS[6], 'MENU_4_PONTO', context);
            }

            if (mapMenu[interactiveId]) {
                logEvento({ tipo: 'INTERACTIVE', mensagem: `Lista: ${interactiveId} → opção ${mapMenu[interactiveId]}`, telefone: from });
                texto = mapMenu[interactiveId];
            }
        }

        const resolvedMainMenuSelection = resolveMainMenuSelection(body || interactiveTitle || texto);
        if (resolvedMainMenuSelection && (type === 'text' || !interactiveId)) {
            texto = resolvedMainMenuSelection;
        }

        if (resolvedMainMenuSelection) {
            await stateManager.clearState(fromJid);
            state.step = 'initial';
            state.welcomeSent = true;
        }

        // Se o usuário digitou explicitamente 'ver opcoes' ou 'ver opções', abre a lista
        if (!type || type === 'text') {
            const trigger = texto.replace(/\s+/g, ' ').trim();
            if (trigger === 'ver opcoes' || trigger === 'ver opções' || trigger === 'veropcoes') {
                await sendMainMenuList(fromJid, userName, context);
                return;
            }
        }

        // ===== COMANDO PARA VOLTAR AO MENU =====
        if (texto === 'menu') {
            await stateManager.clearState(fromJid);
            // Envia lista interativa ao invés do menu de texto
            await sendMainMenuList(fromJid, userName, context);
            return;
        }

        // ===== SUBMENU DE PONTO (fallback textual) =====
        if (state.step === 'ponto_submenu') {
            const opcaoPonto = resolvePontoSelection(body || interactiveTitle || texto) || parseInt(texto, 10);

            if (opcaoPonto === 1) {
                return handleFolhaPonto(fromJid, userName, context);
            }

            if (opcaoPonto === 2) {
                await stateManager.clearState(fromJid);
                return sendInfoScreen(fromJid, userName, CONTATOS[5], 'MENU_4_PONTO', context);
            }

            if (opcaoPonto === 3) {
                await stateManager.clearState(fromJid);
                return sendInfoScreen(fromJid, userName, CONTATOS[6], 'MENU_4_PONTO', context);
            }

            await queueMessage(fromJid, '❌ Opção inválida. Escolha 1, 2 ou 3.', 2, context);
            return sendPontoSubMenu(fromJid, userName, context);
        }

        // ===== SE NÃO ESTÁ EM UM FLUXO, INTERPRETA COMO ESCOLHA DE MENU =====
        if (!state.step || state.step === 'initial') {
            const opcao = parseInt(texto, 10);

            // Opção 4: Ponto (abre sub-menu)
            if (opcao === 4) {
                return sendPontoSubMenu(fromJid, userName, context);
            }

            // Opção 6: Rescisão
            if (opcao === 6) {
                await stateManager.setState(fromJid, { step: 'await_rescisao_option', userName, welcomeSent: true });
                return queueMessage(fromJid, RESCISAO_SUBMENU(userName), 2, context);
            }

            const menuOptionToContact = {
                1: CONTATOS[1],
                2: CONTATOS[2],
                3: CONTATOS[3],
                5: CONTATOS[7],
                7: CONTATOS[8],
                8: CONTATOS[9]
            };
            const menuOptionToId = {
                1: 'MENU_1_CADASTROS',
                2: 'MENU_2_RECRUTAMENTO',
                3: 'MENU_3_ATESTADOS',
                5: 'MENU_5_UNIFORMES',
                7: 'MENU_7_FERIAS',
                8: 'MENU_8_ATENDENTE'
            };

            // Outras opções: mostrar contatos
            const contactMessage = menuOptionToContact[opcao];
            if (contactMessage) {
                return sendInfoScreen(fromJid, userName, contactMessage, menuOptionToId[opcao], context);
            }

            // Opção inválida ou primeira mensagem:
            // Verifica se o usuário já recebeu boas-vindas (via stateManager)
            const currentState = await stateManager.getState(fromJid);
            if (currentState.step === 'initial' || !currentState.welcomeSent) {
                await sendWelcomeWithButton(fromJid, userName, context);
            } else {
                await sendMainMenuList(fromJid, userName, context);
            }
            return;
        }

        // FLUXOS ESPECÍFICOS (cadastro, PDF, etc.)
        // Tratamento: confirmação de substituição (botões ou texto)
        if (state.step === 'confirm_replace') {
            // Permite resposta tanto via botão interativo quanto via texto
            let resp = texto;
            if (type === 'interactive_button' && interactiveId) {
                if (interactiveId === 'REPLACE_YES') resp = '1';
                if (interactiveId === 'REPLACE_NO') resp = '0';
            }

            if (resp === '1' || resp === 'sim') {
                // Usuário confirmou substituição -> pede novo PDF
                await stateManager.setState(fromJid, { step: 'await_pdf', name: state.name, phone: state.phone, month: state.month, userName: state.userName, replace: true, welcomeSent: true });
                return queueMessage(fromJid, `📤 Ok ${formatName(state.userName)} — envie o *PDF* da folha para substituir a anterior (apenas 1 página).`, 2);
            }

            if (resp === '0' || resp === 'nao' || resp === 'não') {
                // Cancela substituição
                await stateManager.clearState(fromJid);
                await queueMessage(fromJid, `❌ Substituição cancelada.`, 2, context);
                return sendMainMenuList(fromJid, state.userName, context);
            }

            // Resposta inválida
            await sendConfirmReplaceButtons(fromJid, state.userName, state.month, context);
            return;
        }

        if (state.step === 'await_rescisao_option') {
            const subOpcao = parseInt(texto, 10);
            const rescisaoMsgFn = RESCISAO_TEXTS[subOpcao];

            if (rescisaoMsgFn) {
                await stateManager.clearState(fromJid);
                return sendInfoScreen(fromJid, userName, rescisaoMsgFn(userName), 'MENU_6_RESCISAO', context);
            }

            return queueMessage(fromJid, INVALID_RESCISAO_OPTION_TEXT(userName), 2, context);
        }

        // Implementação mínima para cadastro (await_name) e para salvar relatório
        if (state.step === 'await_name') {
            const fullName = (body || '').trim();
            const phone = cleanPhone(fromJid);

            // Validação básica: pelo menos 3 caracteres e apenas letras e espaços
            const nameValid = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,}$/.test(fullName);
            if (!nameValid) {
                return queueMessage(fromJid,
                    `⚠️ Nome inválido.\n\nEnvie seu *NOME COMPLETO* apenas com letras e espaços.\n\n_Exemplo: João Pedro da Silva_\n\n🔙 Digite *menu* para voltar`, 2);
            }

            // Carrega cadastro atual, insere ou atualiza registro
            try {
                const data = await loadCadastroData();
                const existing = data.find(r => String(r.TELEFONE || '') === String(phone));
                if (existing) {
                    existing.NOME = fullName;
                } else {
                    const newRow = { NOME: fullName, TELEFONE: phone };
                    // Adiciona colunas de meses vazias se necessário
                    MONTHS.forEach(m => {
                        if (!(m in newRow)) newRow[m] = '';
                    });
                    data.push(newRow);
                }

                await saveCadastroData(data);

                // Registra no relatório de atividades
                await appendRelatorioAtividades({
                    TIMESTAMP: formatDateTime(),
                    TELEFONE: phone,
                    NOME: fullName,
                    ACAO: 'CADASTRO'
                });

                logEvento({ tipo: 'INFO', mensagem: `Usuário cadastrado: ${fullName}`, telefone: phone });

                const month = currentMonth();
                await stateManager.setState(fromJid, {
                    step: 'await_pdf',
                    name: fullName,
                    phone,
                    month,
                    userName: state.userName || userName,
                    welcomeSent: true
                });
                return queueMessage(fromJid,
                    `✅ *Perfeito ${formatName(fullName)}!* Você foi cadastrado com sucesso.\n\n` +
                    `📤 Agora envie o *PDF* da sua folha de *${month}*.`, 2);

            } catch (err) {
                logEvento({ tipo: 'ERRO', mensagem: 'Erro ao salvar cadastro', telefone: phone, extra: err.message });
                await stateManager.clearState(fromJid);
                return queueMessage(fromJid, `❌ Erro ao processar cadastro. Tente novamente mais tarde.`, 2);
            }
        }

        // Quando o usuário envia texto em um fluxo que espera PDF, mantém orientação sem derrubar o fluxo
        if (state.step === 'await_pdf') {
            return queueMessage(fromJid,
                `📄 Estou aguardando o *PDF* da sua folha de *${state.month || currentMonth()}*.\n\n` +
                `Assim que você enviar o arquivo, eu continuo o atendimento.\n\n🔙 Digite *menu* para voltar`, 2, context);
        }

        logEvento({
            tipo: 'WARN',
            mensagem: `Fluxo nao reconhecido: ${state.step}`,
            telefone: from
        });

        await stateManager.clearState(fromJid);
        await queueMessage(fromJid, `Nao consegui continuar o fluxo anterior, entao voltei voce para o menu principal.`, 2, context);
        return sendMainMenuList(fromJid, userName, context);

    } catch (error) {
        logEvento({
            tipo: 'ERRO',
            mensagem: 'Erro ao processar mensagem',
            telefone: from,
            extra: error.message
        });
    }
}

// Função auxiliar para fluxo de folha ponto
async function handleFolhaPonto(fromJid, userName, context = {}) {
    const phone = cleanPhone(fromJid);
    const data = await loadCadastroData();
    const user = data.find(r => r.TELEFONE === phone);

    if (!user) {
        // Novo cadastro
        await stateManager.setState(fromJid, { step: 'await_name', userName, welcomeSent: true });
        return queueMessage(fromJid,
            `*Perfeito ${formatName(userName)}!*\n\n` +
            `📝 Vamos cadastrar você!\n` +
            `Envie seu *NOME COMPLETO*:\n\n` +
            `*Regras:*\n` +
            `- SEM ABREVIAÇÕES\n` +
            `- Apenas LETRAS\n` +
            `- Sem caracteres ESPECIAIS\n\n` +
            `_Exemplo: João Pedro da Silva_\n\n` +
            `🔙 Digite *menu* para voltar`, 2);
    }

    // Usuário já cadastrado
    const month = currentMonth();
    const jaEnviou = user[month] === '✔';

    if (jaEnviou) {
        await stateManager.setState(fromJid, {
            step: 'confirm_replace',
            name: user.NOME,
            phone,
            month,
            userName,
            welcomeSent: true
        });
        // Envia botões interativos para confirmar substituição
        await sendConfirmReplaceButtons(fromJid, userName, month, context);
        return;
    }

    // Solicita PDF
    await stateManager.setState(fromJid, { step: 'await_pdf', name: user.NOME, phone, month, userName, welcomeSent: true });
    return queueMessage(fromJid,
        `📤 *Perfeito! ${formatName(userName)}*\n` +
        `Envie o *PDF* da sua folha de *${month}*\n\n` +
        `🔙 Digite *menu* para voltar`, 2);
}

// ========== SERVIDOR EXPRESS ==========
const app = express();
app.use(express.json());

// Rota de saúde (health check)
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        version: '2.0.0',
        platform: 'WhatsApp Cloud API',
        timestamp: new Date().toISOString()
    });
});

// GET /webhook - Verificação do webhook pela Meta
// TODO: Configure esta URL no painel da Meta como webhook
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logEvento({ tipo: 'WEBHOOK', mensagem: 'Verificação recebida', extra: `mode=${mode}` });

    // Se WEBHOOK_VERIFY_TOKEN não estiver definido, aceita a verificação em modo teste
    const expectedToken = WEBHOOK_VERIFY_TOKEN || 'test-token';

    if (mode === 'subscribe' && token === expectedToken) {
        logEvento({ tipo: 'WEBHOOK', mensagem: '✅ Verificação bem-sucedida' });
        res.status(200).send(challenge);
    } else {
        logEvento({ tipo: 'WEBHOOK', mensagem: '❌ Verificação falhou', extra: `token recebido: ${token}, esperado: ${expectedToken}` });
        res.sendStatus(403);
    }
});

// POST /webhook - Recebe mensagens da Cloud API
app.post('/webhook', async (req, res) => {
    try {
        // Responde imediatamente para a Meta (requisito da API)
        res.sendStatus(200);

        const body = req.body;

        try {
            const msg = body && body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0];
            if (msg) {
                logEvento({
                    tipo: 'WEBHOOK',
                    mensagem: `Evento recebido: type=${msg.type || 'unknown'}`,
                    telefone: msg.from || '',
                    extra: msg.id || ''
                });
            }
        } catch (parseErr) {
            logEvento({ tipo: 'WARN', mensagem: 'Não foi possível resumir evento do webhook', extra: parseErr.message });
        }

        // Ignora notificações de status
        if (isStatusNotification(body)) {
            logEvento({ tipo: 'WEBHOOK', mensagem: 'Notificação de status recebida (ignorada)' });
            return;
        }

        // Extrai mensagem de texto
        const message = extractIncomingMessage(body);

        if (message) {
            // Processa mensagem em background (não bloqueia o webhook)
            setImmediate(async () => {
                await handleIncomingMessage(message);
            });
            return;
        }

        // Extrai documento (PDF)
        const document = extractIncomingDocument(body);

        if (document) {
            logEvento({
                tipo: 'DOC',
                mensagem: 'Documento recebido (processando...)',
                telefone: document.from,
                extra: document.fileName
            });

            await appendConversationHistory({
                direction: 'in',
                phone: document.from,
                name: document.pushName || 'Usuario',
                messageType: 'document',
                body: document.fileName || 'documento',
                messageId: document.messageId,
                metadata: {
                    mimeType: document.mimeType || '',
                    phoneNumberId: document.phoneNumberId || ''
                }
            });

            // Processa em background
            setImmediate(async () => {
                try {
                    const { downloadWhatsAppMedia } = require('./lib/whatsapp-cloud-api');

                    const fromJid = document.from.includes('@') ? document.from : `${document.from}@s.whatsapp.net`;
                    const context = document.phoneNumberId ? { phoneNumberId: document.phoneNumberId } : {};
                    rememberRecipientContext(document.from, document.phoneNumberId);
                    const phone = cleanPhone(fromJid);
                    const state = await stateManager.getState(fromJid);

                    logEvento({
                        tipo: 'DOC',
                        mensagem: `Iniciando validação do arquivo (${document.mimeType || 'sem-mime'})`,
                        telefone: phone,
                        extra: `step=${state.step || 'sem_fluxo'}`
                    });

                    // Baixa a mídia
                    let media;
                    try {
                        media = await downloadWhatsAppMedia(document.mediaId);
                    } catch (err) {
                        logEvento({ tipo: 'ERRO', mensagem: 'Falha ao baixar mídia', telefone: phone, extra: err.message });
                        await queueMessage(fromJid, '❌ Não foi possível baixar o arquivo. Tente novamente mais tarde.', 2);
                        return;
                    }

                    // Regras de negócio: somente PDF, somente 1 página, somente folha ponto
                    try {
                        const pdfParse = require('pdf-parse');

                        // Verifica mimeType/extension
                        const isPdfMime = (media.mimeType || '').toLowerCase().includes('pdf');
                        const hasPdfExt = (document.fileName || '').toLowerCase().endsWith('.pdf');
                        if (!isPdfMime && !hasPdfExt) {
                            await appendRelatorioAtividades({ TIMESTAMP: formatDateTime(), TELEFONE: phone, NOME: document.pushName || '', ACAO: 'REJEITADO_TIPO', PATH: '' });
                            await queueMessage(fromJid, '❌ Apenas arquivos em formato PDF são aceitos. Seu arquivo foi recusado e não será salvo.', 2);
                            logEvento({ tipo: 'WARN', mensagem: 'Arquivo rejeitado: não é PDF', telefone: phone });
                            return;
                        }

                        // Analisa PDF para número de páginas e texto
                        const pdfData = await pdfParse(media.buffer);
                        const numPages = pdfData.numpages || 0;
                        if (numPages !== 1) {
                            await appendRelatorioAtividades({ TIMESTAMP: formatDateTime(), TELEFONE: phone, NOME: document.pushName || '', ACAO: 'REJEITADO_PAGINAS', PATH: '' });
                            await queueMessage(fromJid, '❌ O PDF deve conter apenas 1 página. Envie apenas a folha de ponto em PDF de página única.', 2);
                            logEvento({ tipo: 'WARN', mensagem: `Arquivo rejeitado: ${numPages} páginas`, telefone: phone });
                            return;
                        }

                        // Verifica se o conteúdo é referente à folha ponto (heurística de texto)
                        const text = (pdfData.text || '').toLowerCase();
                        const isFolhaPonto = text.includes('folha') && text.includes('ponto') || text.includes('folha de ponto') || text.includes('folha ponto');
                        if (!isFolhaPonto) {
                            await appendRelatorioAtividades({ TIMESTAMP: formatDateTime(), TELEFONE: phone, NOME: document.pushName || '', ACAO: 'REJEITADO_CONTEUDO', PATH: '' });
                            await queueMessage(fromJid, '❌ O PDF enviado não parece ser uma folha de ponto. Apenas PDFs de folha de ponto (1 página) são aceitos. Seu arquivo foi recusado e não será salvo.', 2);
                            logEvento({ tipo: 'WARN', mensagem: 'Arquivo rejeitado: conteúdo não corresponde a folha ponto', telefone: phone });
                            return;
                        }

                        // Se passou nas validações, prossegue com salvamento
                    } catch (validationErr) {
                        logEvento({ tipo: 'ERRO', mensagem: 'Erro ao validar PDF', telefone: phone, extra: validationErr.message });
                        await queueMessage(fromJid, '❌ Erro ao validar o PDF. Tente novamente mais tarde.', 2);
                        return;
                    }

                    // Determina destino baseado no fluxo do usuário
                    let destDir = PRIVATE_BASE; // secundário / espelho
                    let action = 'DOC_RECEBIDO';
                    let storageCategory = 'documento';
                    let storageRelativePath = '';
                    let monthRef = null;

                    if (state.step === 'await_pdf') {
                        // Folha ponto -> salva em \...\WPPCHATBOT - FOLHAS PONTOS\<ANO>\<MM-MES>
                        const monthName = state.month || currentMonth();
                        const yearDir = String(new Date().getFullYear());
                        const monthDir = monthFolderLabel(monthName);
                        destDir = path.join(PUBLIC_BASE, yearDir, monthDir);
                        action = 'ENVIO_PDF';
                        storageCategory = 'folha_ponto';
                        monthRef = monthName;
                        storageRelativePath = path.join(yearDir, monthDir);
                    } else if (document.fileName && /atestad/i.test(document.fileName)) {
                        // heurística: se filename contém 'atest', salva em ATESTADOS_BASE
                        destDir = ATESTADOS_BASE;
                        action = 'ATESTADO_PDF';
                        storageCategory = 'atestado';
                        storageRelativePath = 'ATESTADOS';
                    }

                    // Garante pasta destino
                    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

                    logEvento({
                        tipo: 'DOC',
                        mensagem: 'Destino de salvamento definido',
                        telefone: phone,
                        extra: destDir
                    });

                    // Determina nome do arquivo: deve ser NOME COMPLETO da pessoa (quando disponível no estado)
                    const personName = (state && state.name) ? state.name : (document.pushName || 'SEM_NOME');
                    const safePersonName = toSafeFileName(personName);

                    // Extensão do arquivo
                    let ext = path.extname(document.fileName || '') || '';
                    if (!ext && media.mimeType) {
                        if (media.mimeType.includes('pdf')) ext = '.PDF';
                        else {
                            const parts = media.mimeType.split('/');
                            ext = parts[1] ? `.${parts[1]}` : '';
                        }
                    }
                    // Normaliza extensão para uppercase .PDF
                    ext = ext ? ext.toUpperCase() : '';

                    // Monta nome final: NOME_COMPLETO + ext
                    const baseName = `${safePersonName.toUpperCase()}${ext}`;
                    let finalName = baseName;
                    let logicalName = storageRelativePath ? path.join(storageRelativePath, finalName) : finalName;
                    const shouldReplace = state.step === 'await_pdf' && state.replace;

                    if (DATABASE_STORAGE_ENABLED) {
                        const existingDocument = await cadastroStorage.getStoredDocument(storageCategory, logicalName);
                        if (existingDocument) {
                            if (shouldReplace) {
                                action = 'SUBSTITUIU_PDF';
                            } else {
                                const ts = Date.now();
                                finalName = `${safePersonName.toUpperCase()}_${ts}${ext}`;
                                logicalName = storageRelativePath ? path.join(storageRelativePath, finalName) : finalName;
                            }
                        }
                    } else {
                        const existingFile = path.join(destDir, finalName);
                        if (fs.existsSync(existingFile)) {
                            if (shouldReplace) {
                                try {
                                    fs.unlinkSync(existingFile);
                                } catch (e) {
                                    logEvento({ tipo: 'WARN', mensagem: 'Falha ao remover arquivo antigo antes de substituir', telefone: phone, extra: e.message });
                                }
                                action = 'SUBSTITUIU_PDF';
                            } else {
                                const ts = Date.now();
                                finalName = `${safePersonName.toUpperCase()}_${ts}${ext}`;
                                logicalName = storageRelativePath ? path.join(storageRelativePath, finalName) : finalName;
                            }
                        }
                    }

                    const secondaryDest = path.join(destDir, finalName);
                    let primaryStorageRef = secondaryDest;
                    let savedBytes = media.buffer.length;

                    if (DATABASE_STORAGE_ENABLED) {
                        try {
                            await cadastroStorage.saveDocument({
                                category: storageCategory,
                                logicalName,
                                fileName: finalName,
                                mimeType: media.mimeType || document.mimeType || null,
                                buffer: media.buffer,
                                phone,
                                name: personName,
                                monthRef,
                                storagePath: secondaryDest,
                                metadata: {
                                    action,
                                    originalFileName: document.fileName || finalName,
                                    step: state.step || null,
                                    networkStorageAvailable: NETWORK_STORAGE_AVAILABLE
                                }
                            });
                            primaryStorageRef = `postgres://${storageCategory}/${logicalName.replace(/\\/g, '/')}`;
                        } catch (error) {
                            DATABASE_STORAGE_ENABLED = false;
                            logEvento({ tipo: 'WARN', mensagem: 'Falha ao salvar documento no PostgreSQL; usando filesystem', telefone: phone, extra: error.message });
                        }
                    }

                    if (!DATABASE_STORAGE_ENABLED) {
                        const primaryWrite = await saveFileToSecondaryStorage(secondaryDest, media.buffer);
                        if (!primaryWrite) {
                            await queueMessage(fromJid, '❌ Não foi possível salvar o arquivo no momento. Tente novamente mais tarde.', 2);
                            return;
                        }
                        savedBytes = primaryWrite.sizeBytes;
                        primaryStorageRef = primaryWrite.path;
                    }

                    const mirrorWrite = DATABASE_STORAGE_ENABLED
                        ? await saveFileToSecondaryStorage(secondaryDest, media.buffer)
                        : null;

                    // Se for envios de folha, marca no cadastro mês como enviado
                    if (state.step === 'await_pdf') {
                        try {
                            const data = await loadCadastroData();
                            const user = data.find(r => String(r.TELEFONE || '') === String(phone));
                            const month = state.month || currentMonth();
                            if (user) {
                                user[month] = '✔';
                                await saveCadastroData(data);
                            }
                        } catch (err) {
                            logEvento({ tipo: 'ERRO', mensagem: 'Erro atualizando cadastro (marca mês)', telefone: phone, extra: err.message });
                        }
                    }

                    // Registra em relatório de atividades
                    await appendRelatorioAtividades({ TIMESTAMP: formatDateTime(), TELEFONE: phone, NOME: personName, ACAO: action, PATH: primaryStorageRef, ESPELHO_PATH: mirrorWrite ? mirrorWrite.path : '' });

                    // Limpa estado se aplicável
                    if (state.step) {
                        await stateManager.clearState(fromJid);
                    }

                    // Confirma ao usuário: mensagem diferente se foi substituição
                    if (state.step === 'await_pdf' && state.replace) {
                        const month = state.month || currentMonth();
                        await queueMessage(fromJid, `✅ Substituí sua folha de *${month}* e salvei com sucesso.`, 2);
                    } else {
                        await queueMessage(fromJid, `✅ Recebi seu arquivo *${document.fileName}* e salvei com sucesso.`, 2);
                    }

                    logEvento({ tipo: 'INFO', mensagem: `Documento salvo: ${primaryStorageRef}`, telefone: phone, extra: `${savedBytes} bytes` });
                    logEvento({ tipo: 'DOC', mensagem: 'Fluxo concluído com sucesso', telefone: phone });

                } catch (err) {
                    logEvento({ tipo: 'ERRO', mensagem: 'Erro processando documento', extra: err.message });
                }
            });

            return;
        }

    } catch (error) {
        logEvento({
            tipo: 'ERRO',
            mensagem: 'Erro no webhook',
            extra: error.message
        });
    }
});

// ========== ENDPOINT DE DEBUG (Monitorar estados dos usuários) ==========
app.get('/status-debug', (req, res) => {
    const stats = stateManager.getStats();
    const users = stateManager.listActiveUsers();
    
    res.json({
        status: 'online',
        timestamp: new Date().toLocaleString('pt-BR'),
        userStats: stats,
        activeUsers: users.slice(0, 50), // Mostra os 50 primeiros usuários
        totalUsersTracked: users.length
    });
});

// ========== INICIALIZAÇÃO ==========
const server = app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`📡 Webhook: http://localhost:${PORT}/webhook`);
    console.log('='.repeat(60));
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Configure as variáveis de ambiente (.env)');
    console.log('2. Exponha o webhook publicamente (ngrok/similar)');
    console.log('3. Configure a URL no painel da Meta');
    console.log('4. Teste enviando uma mensagem para o número\n');

    logEvento({ tipo: 'START', mensagem: 'Bot iniciado com sucesso' });

    // Inicializa banco PostgreSQL e o gerenciador de estado antes do uso
    (async () => {
        if (!cadastroStorage.isEnabled()) {
            await stateManager.initialize();
            logEvento({ tipo: 'WARN', mensagem: 'DATABASE_URL não configurada; bot operando sem PostgreSQL' });
            return;
        }

        try {
            await cadastroStorage.initialize();
            await stateManager.initialize();
            logEvento({ tipo: 'INFO', mensagem: 'PostgreSQL ativo para cadastro, relatório e estado de conversa' });
        } catch (error) {
            DATABASE_STORAGE_ENABLED = false;
            await stateManager.initialize();
            logEvento({ tipo: 'WARN', mensagem: 'Falha ao inicializar PostgreSQL; seguindo sem banco', extra: error.message });
        }
    })();

    // Registro mínimo dos números pendentes na Cloud API (sem repetir se já ativo)
    // ⚠️ DESABILITADO: números já confirmados na Meta
    // Se precisar registrar novo número, execute: npm run whatsapp:register-pending
    /*
    (async () => {
        const logger = {
            info: (msg) => logEvento({ tipo: 'REGISTER', mensagem: msg }),
            warn: (msg) => logEvento({ tipo: 'REGISTER', mensagem: msg }),
            error: (msg) => logEvento({ tipo: 'ERRO', mensagem: msg })
        };

        await registerPendingPhoneNumbers({
            pin: process.env.WHATSAPP_REGISTRATION_PIN || '123456',
            logger
        });
    })();
    */

    // Se configurado para autostart, tenta iniciar ngrok automaticamente
    (async () => {
        if (process.env.NGROK_AUTOSTART === 'true') {
            try {
                const ngrok = require('ngrok');

                // Tenta suportar diferentes versões da biblioteca ngrok (v5 beta e v4)
                let publicUrl = null;

                // Primeiro, tenta a API v5 (opções estruturadas)
                try {
                    const cfg = { proto: 'http', addr: PORT };
                    // Se houver token de autenticação, adiciona
                    if (process.env.NGROK_AUTH_TOKEN) cfg.authtoken = process.env.NGROK_AUTH_TOKEN;

                    const result = await ngrok.connect(cfg);
                    // result pode ser string (v4) ou objeto (v5)
                    if (typeof result === 'string') {
                        publicUrl = result;
                    } else if (result && (result.public_url || result.url || result.forwarding_url)) {
                        publicUrl = result.public_url || result.url || result.forwarding_url;
                    }
                } catch (errV5) {
                    // Se falhar, tenta formato compatível com v4
                    try {
                        const fallback = await ngrok.connect(PORT);
                        if (typeof fallback === 'string') publicUrl = fallback;
                    } catch (errV4) {
                        // Ambos falharam — lança o erro original para o outer catch
                        throw new Error(`ngrok v5 erro: ${errV5 && errV5.message}; ngrok v4 erro: ${errV4 && errV4.message}`);
                    }
                }

                if (publicUrl) {
                    console.log(`📡 ngrok publicado em: ${publicUrl}`);
                    logEvento({ tipo: 'INFO', mensagem: `ngrok iniciado em ${publicUrl}` });
                    console.log('⚠️ Lembre-se de configurar a URL do webhook no painel da Meta:');
                    console.log(`   ${publicUrl}/webhook`);
                } else {
                    throw new Error('ngrok retornou URL inválida');
                }

            } catch (err) {
                console.error('⚠️ Não foi possível iniciar o ngrok automaticamente. Instale com: npm i ngrok');
                console.error('Erro ngrok:', err && err.message ? err.message : err);
                console.error(`Dica: você pode iniciar ngrok manualmente: npx ngrok http ${PORT}`);
            }
        }
    })();
});

// Tratamento de erro de listen (ex: porta em uso)
server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`❌ ERRO: Porta ${PORT} já em uso (EADDRINUSE).`);
        logEvento({ tipo: 'ERRO-CRÍTICO', mensagem: `listen EADDRINUSE: porta ${PORT} em uso` });
        console.error('\nDICAS:');
        console.error('- Verifique se outra instância do bot está rodando (PM2 / node).');
        console.error(`- No PowerShell: execute \`netstat -ano | findstr :${PORT}\` para achar o PID, e \`taskkill /PID <PID> /F\` para encerrar.`);
        process.exit(1);
    } else {
        logEvento({ tipo: 'ERRO-CRÍTICO', mensagem: 'Erro no servidor', extra: err && err.message });
        throw err;
    }
});

// ========== TRATAMENTO DE ERROS ==========
process.on('uncaughtException', (error) => {
    logEvento({ tipo: 'ERRO-CRÍTICO', mensagem: 'Exceção não capturada', extra: error.message });
    console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
    logEvento({ tipo: 'ERRO-CRÍTICO', mensagem: 'Promise rejeitada', extra: reason });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Encerrando bot...');
    process.exit(0);
});

console.log('✅ Bot inicializado - aguardando mensagens...\n');

