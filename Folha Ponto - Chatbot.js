// ========== VERIFICAÇÃO DE DEPENDÊNCIAS E INICIALIZAÇÃO SEGURA ==========
console.clear();
// Função de log otimizada

function logEvento({ tipo = 'INFO', mensagem, nome = '', telefone = '', extra = '' }) {
    const horario = new Date().toLocaleString('pt-BR');
    let info = `[${horario}] [${tipo}]`;
    if (nome) info += ` [${nome}]`;
    if (telefone) info += ` [${telefone}]`;
    if (extra) info += ` [${extra}]`;
    console.log(`${info} ${mensagem}`);
}

// Helper: se estamos em um terminal interativo (TTY) e não em produção
function isInteractive() {
    try {
        return !!(process.stdout && process.stdout.isTTY) && (process.env.NODE_ENV !== 'production');
    } catch (e) {
        return false;
    }
}

logEvento({ tipo: 'START', mensagem: 'BOT FOLHA PONTO - XAXIM v2.0 iniciado.' });
logEvento({ tipo: 'INFO', mensagem: `Sistema: ${process.platform} ${process.arch}` });
logEvento({ tipo: 'INFO', mensagem: `Node.js: ${process.version}` });
logEvento({ tipo: 'INFO', mensagem: `Executando de: ${process.cwd()}` });
if (process.pkg) {
    logEvento({ tipo: 'INFO', mensagem: 'Modo: EXECUTÁVEL STANDALONE', extra: process.execPath });
} else {
    logEvento({ tipo: 'INFO', mensagem: 'Modo: DESENVOLVIMENTO NODE.JS' });
}
logEvento({ tipo: 'INFO', mensagem: 'Verificando dependências...' });

// Carregamento de dependências com tratamento especial para executável
let qrcode, makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage, fetchLatestBaileysVersion, fs, path, XLSX, cron, Boom, AntiSpamSystem;

try {
    // Dependências básicas (sempre funcionam)
    fs = require('fs');
    path = require('path');

    console.log('✅ Módulos básicos carregados');

    // Dependências externas
    qrcode = require('qrcode-terminal');
    console.log('✅ qrcode-terminal carregado');

    XLSX = require('xlsx');
    console.log('✅ XLSX carregado');

    cron = require('node-cron');
    console.log('✅ node-cron carregado');

    const { Boom: BoomClass } = require('@hapi/boom');
    Boom = BoomClass;
    console.log('✅ @hapi/boom carregado');

    // Baileys (pode ter problemas com ES modules)
    const baileys = require('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    DisconnectReason = baileys.DisconnectReason;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    downloadMediaMessage = baileys.downloadMediaMessage;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
    console.log('✅ @whiskeysockets/baileys carregado');

    // Sistema Anti-Spam Avançado
    AntiSpamSystem = require('./anti-spam-system.js');
    console.log('✅ Sistema Anti-Spam carregado');

    // Sistema de Variação de Mensagens (evita detecção de padrão)
    const { getVariation } = require('./message-variations.js');
    global.getVariation = getVariation;
    console.log('✅ Sistema de Variação de Mensagens carregado');

    // Regras de Nomenclatura e Identificação
    const NameHandling = require('./name-handling-rules.js');
    global.NameHandling = NameHandling;
    console.log('✅ Regras de Nomenclatura carregadas');

    console.log('✅ Todas as dependências carregadas com sucesso!');
} catch (error) {
    console.error('❌ ERRO AO CARREGAR DEPENDÊNCIAS:', error.message);
    console.log('\n🔍 DIAGNÓSTICO DETALHADO:');
    console.log(`Erro completo: ${error.stack || error}`);
    console.log(`Tipo de erro: ${error.constructor.name}`);

    console.log('\n💡 POSSÍVEIS SOLUÇÕES:');
    console.log('1. Execute como Administrador');
    console.log('2. Coloque o executável em uma pasta sem espaços');
    console.log('3. Desative temporariamente o antivírus');
    console.log('4. Execute em uma pasta com permissões completas');

    console.log('\n⚠️ Se o problema persistir, use a versão Node.js diretamente');
    console.log('\n' + '='.repeat(80));
    console.log('⏸️ TERMINAL PAUSADO - Pressione ENTER para fechar...');
    console.log('='.repeat(80));
    if (isInteractive()) {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.once('data', () => {
            console.log('👋 Encerrando o bot...');
            process.exit(1);
        });
    } else {
        console.log('Non-interactive environment detected; exiting without pause.');
        process.exit(1);
    }
}

const DEV_NUMBER = '554191852345@s.whatsapp.net'; // Número do desenvolvedor principal
const TEST_DEV_NUMBER = '554188386407@s.whatsapp.net'; // Número do desenvolvedor teste (André)
const DEV_NUMBERS = ['554191852345', '554188386407']; // Array com números dos desenvolvedores
// Número do bot de produção (não responder). Formato sem sufixo @s.whatsapp.net
const PRODUCTION_BOT_NUMBER = '554191059350'; // +55 41 9105-9350
const MODO_TESTE = true; // true = modo teste, false = modo produção

// ========== SISTEMA DE COMUNICAÇÃO SILENCIOSA ==========
// Formato: #admin: mensagem
// O bot recebe mas NÃO responde, apenas loga
const ADMIN_PREFIX = '#admin:';
const adminLog = path.join(__dirname, 'admin-messages.log');

function isAdminMessage(texto) {
    return texto && texto.trim().toLowerCase().startsWith('#admin:');
}

function logAdminMessage(from, userName, texto) {
    const mensagem = texto.trim().replace(/#admin:/i, '').trim();
    const hora = new Date().toLocaleString('pt-BR');
    const linha = `[${hora}] [${userName}] [${from}] ${mensagem}\n`;
    try {
        fs.appendFileSync(adminLog, linha, 'utf8');
    } catch (err) {
        console.error('⚠️ Erro ao logar mensagem admin:', err.message);
    }
    console.log(`📢 [ADMIN MSG] ${userName}: ${mensagem}`);
}

// Detecta se está rodando como executável
const isExecutable = process.pkg !== undefined;
const appPath = isExecutable ? path.dirname(process.execPath) : process.cwd();

console.log(`🔧 Modo de execução: ${isExecutable ? 'EXECUTÁVEL' : 'NODE.JS'}`);
console.log(`📁 Diretório de trabalho: ${appPath}`);

// FUNÇÕES UTILITÁRIAS
function logCurrentDay() {
    const hoje = new Date();
    const dia = hoje.getDate();
    const mesAtual = MONTHS[hoje.getMonth()];
    console.log(`🗓️ Hoje é dia ${dia} de ${mesAtual}.`);
}

// Sanitiza objetos antes de logar para evitar expor credenciais sensíveis
function sanitizeForLog(obj) {
    try {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (!value) return value;
            const k = (key || '').toString().toLowerCase();
            // remove campos de autenticação e blobs grandes
            if (k.includes('creds') || k.includes('auth') || k === 'state' || k === 'creds' || k === 'authinfo') return '[REDACTED]';
            if (typeof value === 'string' && value.length > 1000) return value.slice(0, 1000) + '[TRUNC]';
            return value;
        }));
    } catch (e) {
        return '[SANITIZE ERROR]';
    }
}

// Verifica se está em horário comercial (9h às 18h)
function isHorarioComercial() {
    const agora = new Date();
    const hora = agora.getHours();
    const diaSemana = agora.getDay(); // 0=domingo, 6=sábado

    // Só em dias úteis (segunda a sexta) e das 9h às 18h
    return diaSemana >= 1 && diaSemana <= 5 && hora >= 9 && hora < 18;
}

// Calcula próximo horário comercial
function proximoHorarioComercial() {
    const agora = new Date();
    const proximoComercial = new Date(agora);

    // Se for fim de semana, vai para segunda 9h
    if (agora.getDay() === 0) { // Domingo
        proximoComercial.setDate(agora.getDate() + 1); // Segunda
        proximoComercial.setHours(9, 0, 0, 0);
    } else if (agora.getDay() === 6) { // Sábado
        proximoComercial.setDate(agora.getDate() + 2); // Segunda
        proximoComercial.setHours(9, 0, 0, 0);
    } else if (agora.getHours() < 9) { // Antes das 9h
        proximoComercial.setHours(9, 0, 0, 0);
    } else if (agora.getHours() >= 18) { // Depois das 18h
        proximoComercial.setDate(agora.getDate() + 1);
        proximoComercial.setHours(9, 0, 0, 0);
        // Se próximo dia for sábado, pula para segunda
        if (proximoComercial.getDay() === 6) {
            proximoComercial.setDate(proximoComercial.getDate() + 2);
        }
    } else {
        return agora; // Já está em horário comercial
    }

    return proximoComercial;
}

// MENSAGENS COBRANÇA COM NÍVEIS DE URGÊNCIA E ENVIO DIRETO
const mensagens = [
    (nome, mesAtual) => `*📣 DIA DE ENVIO da FOLHA-PONTO*\n\n` +
        `*${nome}*, hoje é o prazo\n` +
        `para envio da sua *FOLHA-PONTO*\n` +
        `referente a *${mesAtual}*.\n\n` +
        `🚀 *ENVIO RÁPIDO:* Responda esta mensagem\n` +
        `anexando seu PDF preenchido e assinado!\n\n` +
        `_Ou digite *4* para seguir o processo normal._`,

    (nome, mesAtual) => `*⚠️ 2º DIA - Aviso Importante!*\n\n` +
        `*${nome}*, ainda não recebemos\n` +
        `sua *FOLHA-PONTO* de *${mesAtual}*.\n\n` +
        `🚀 *ENVIO RÁPIDO:* Anexe seu PDF\n` +
        `como resposta a esta mensagem!\n\n` +
        `_Evite transtornos salariais._`,

    (nome, mesAtual) => `*⏳ 3º DIA - Alerta de Atraso!*\n\n` +
        `*${nome}*, sua folha de *${mesAtual}*\n` +
        `ainda não foi entregue.\n\n` +
        `🚀 *ENVIO RÁPIDO:* Responda com seu PDF!\n\n` +
        `_Atrasos podem impactar o fechamento\n` +
        `da folha de pagamento._`,

    (nome, mesAtual) => `*❗4º DIA - URGÊNCIA MÁXIMA!*\n\n` +
        `*${nome}*, sua *FOLHA-PONTO*\n` +
        `de *${mesAtual}* ainda não foi enviada.\n\n` +
        `🚀 *ENVIO RÁPIDO:* Anexe seu PDF AGORA!\n\n` +
        `_Estamos em fase final de processamento.\n` +
        `Envie hoje para não perder o prazo!_`,

    (nome, mesAtual) => `*🚨 5º DIA - ÚLTIMA OPORTUNIDADE!*\n\n` +
        `*${nome}*, sua folha ponto de *${mesAtual}*\n` +
        `segue pendente há *5 DIAS*.\n\n` +
        `🚀 *ENVIO RÁPIDO:* Responda COM SEU PDF!\n\n` +
        `_⚠️ O fechamento acontece HOJE!\n` +
        `Após hoje podem ocorrer inconsistências\n` +
        `em seu pagamento._`
];

const dispararCobrancaDoDia = async (forceTeste = false) => {
    const hoje = new Date();
    const dia = hoje.getDate();
    const mesIndex = hoje.getMonth();

    // Determina o mês de referência
    const mesReferencia = (dia < 25)
        ? MONTHS[mesIndex - 1 < 0 ? 11 : mesIndex - 1] // mês anterior
        : MONTHS[mesIndex]; // mês atual

    // Verifica horário comercial (exceto para testes forçados)
    if (!forceTeste && !isHorarioComercial()) {
        const proximo = proximoHorarioComercial();
        console.log(`⏰ Fora do horário comercial. Próxima cobrança: ${formatDateTime(proximo)}`);
        return;
    }

    if (!forceTeste && (dia < 1 || dia > 5)) {
        console.log(`⚠️ Hoje é dia ${dia}. Fora do período de cobrança (1 a 5).`);
        return;
    }

    const data = await loadCadastroData();
    const pessoasPendentes = data.filter(pessoa => pessoa[mesReferencia] !== '✔');

    if (pessoasPendentes.length === 0) {
        console.log(`✅ Sem pendentes para cobrar hoje (dia ${dia}).`);
        return;
    }

    const tempoUtilDia = 8 * 60 * 60; // 9h às 17h = 28800s
    const delayPorPessoa = Math.floor(tempoUtilDia / pessoasPendentes.length) * 1000;

    console.log(`\n🚨 [COBRANÇA AUTOMÁTICA] 🚨`);
    console.log(`📅 Data: ${formatDateTime()}`);
    console.log(`📊 ${pessoasPendentes.length} pendentes para dia ${dia}`);
    console.log(`📆 Referente ao mês: ${mesReferencia}`);
    console.log(`⏰ Delay entre mensagens: ${delayPorPessoa / 1000}s`);
    console.log(`🧪 Modo: ${MODO_TESTE || forceTeste ? 'TESTE' : 'PRODUÇÃO'}`);
    console.log(`\n📋 LISTA DE PESSOAS PENDENTES:`);

    // Mostra log das primeiras 10 pessoas
    pessoasPendentes.slice(0, 10).forEach((pessoa, idx) => {
        const { TELEFONE, NOME } = pessoa;
        const telefoneStr = String(TELEFONE || '').replace(/\D/g, ''); // Converte para string e remove não-dígitos
        const telefoneFormatado = telefoneStr.startsWith('55') ? telefoneStr : `55${telefoneStr}`;
        console.log(`${idx + 1}. ${NOME} - ${telefoneFormatado}`);
    });

    if (pessoasPendentes.length > 10) {
        console.log(`... e mais ${pessoasPendentes.length - 10} pessoas`);
    }

    // Se for modo teste ou teste forçado
    if (MODO_TESTE || forceTeste) {
        console.log(`\n🧪 [MODO TESTE] Enviando apenas para André Oliveira`);
        const mensagemTeste = mensagens[dia - 1]('André Oliveira', mesReferencia);
        const resumoTeste = `🧪 *TESTE DE COBRANÇA AUTOMÁTICA*\n\n` +
            `📅 Data: ${formatDateTime()}\n` +
            `📊 Pessoas pendentes: ${pessoasPendentes.length}\n` +
            `📆 Mês: ${mesReferencia}\n` +
            `📋 Dia da cobrança: ${dia}\n\n` +
            `Esta é uma mensagem de teste. Em produção, ${pessoasPendentes.length} pessoas receberiam a cobrança.\n\n` +
            `📝 *Exemplo da mensagem que seria enviada:*\n\n${mensagemTeste}`;

        setTimeout(() => {
            queueMessage(TEST_DEV_NUMBER, resumoTeste, 2); // Alta prioridade para testes
            console.log(`✅ Mensagem de teste enviada para André Oliveira (${TEST_DEV_NUMBER})`);
        }, 1000);
        return;
    }

    // Modo produção - envia para todos exceto DEV
    console.log(`\n🚀 [MODO PRODUÇÃO] Enviando para ${pessoasPendentes.length} pessoas`);

    pessoasPendentes.forEach((pessoa, idx) => {
        const { TELEFONE, NOME } = pessoa;
        const telefoneStr = String(TELEFONE || '').replace(/\D/g, ''); // Converte para string e remove não-dígitos
        const telefoneFormatado = telefoneStr.startsWith('55') ? telefoneStr : `55${telefoneStr}`;
        const chatId = `${telefoneFormatado}@s.whatsapp.net`;

        // Pula telefones inválidos
        if (!telefoneStr || telefoneStr.length < 10) {
            console.log(`🚫 Telefone inválido: ${NOME} - ${TELEFONE}`);
            return;
        }

        // Não envia para o número DEV
        if (telefoneFormatado === DEV_NUMBER.replace('@s.whatsapp.net', '')) {
            console.log(`🚫 Pulando envio para DEV: ${NOME}`);
            return;
        }

        const jitter = Math.random() * 5000;
        const mensagem = mensagens[dia - 1](NOME || 'Colaborador', mesReferencia);

        setTimeout(() => {
            queueMessage(chatId, mensagem, 1); // Prioridade média para cobrança

            // Marca que esta pessoa está aguardando PDF após cobrança
            awaitingPDF.set(chatId, {
                nome: NOME,
                telefone: telefoneFormatado,
                mesReferencia,
                timestamp: Date.now()
            });

            console.log(`[${idx + 1}] ✅ Enviado para ${NOME} (${telefoneFormatado}) - Aguardando PDF`);
        }, idx * delayPorPessoa + jitter);
    });

    console.log(`\n📤 Cobrança automática finalizada!`);
};

// ========== CONFIGURAÇÃO DE CAMINHOS PORTÁTIL ==========
let PRIVATE_BASE, PUBLIC_BASE;

try {
    // Tenta usar caminhos de rede primeiro
    PRIVATE_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\FOLHA PONTO PROJETOS\\WPPCHATBOT - FOLHAS PONTOS\\System';
    PUBLIC_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\FOLHA PONTO PROJETOS\\WPPCHATBOT - FOLHAS PONTOS';

    // Testa se os caminhos de rede estão acessíveis
    if (!fs.existsSync(path.dirname(PRIVATE_BASE))) {
        throw new Error('Caminhos de rede não acessíveis');
    }

    console.log('✅ Usando caminhos de rede corporativa');
} catch (error) {
    // Se não conseguir acessar rede, usa caminhos locais
    const localDataPath = path.join(process.cwd(), 'bot_data');
    PRIVATE_BASE = path.join(localDataPath, 'private');
    PUBLIC_BASE = path.join(localDataPath, 'public');

    console.log('⚠️ Rede corporativa não acessível. Usando armazenamento local:');
    console.log(`📁 Dados em: ${localDataPath}`);
}

// Caminhos dos arquivos de Excel dentro de PRIVATE_BASE ou PUBLIC_BASE
const WORKBOOK_PATH = path.join(PRIVATE_BASE, 'CADASTRO_FOLHA.xlsx');
const PUBLIC_WORKBOOK_PATH = path.join(PUBLIC_BASE, 'CADASTRO_FOLHA_PUBLICA.xlsx');
const REPORT_PATH = path.join(PRIVATE_BASE, 'RELATORIO_ATIVIDADES.xlsx');
const PUBLIC_REPORT_PATH = path.join(PUBLIC_BASE, 'RELATORIO_ATIVIDADES_PUBLICO.xlsx');

// Caminhos para sistema de atestados - Localização no servidor
let ATESTADOS_BASE;
if (fs.existsSync('\\\\172.20.30.101\\rh\\FILIAL PR')) {
    // Servidor - pasta dedicada para atestados
    ATESTADOS_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\PROJETO ATESTADOS';
} else {
    // Desenvolvimento local
    ATESTADOS_BASE = path.join(PUBLIC_BASE, 'ATESTADOS');
}
const ATESTADOS_RECEBIDOS_PATH = path.join(ATESTADOS_BASE, 'RELATORIO_RECEBIDOS.xlsx');
const ATESTADOS_PROCESSADOS_PATH = path.join(ATESTADOS_BASE, 'RELATORIO_ATESTADOS.xlsx');

// Caminhos para sistema de termos de ciência - Localização no servidor
let TERMOS_CIENCIA_BASE;
if (fs.existsSync('\\\\172.20.30.101\\rh\\FILIAL PR')) {
    // Servidor - pasta dedicada para termos de ciência
    TERMOS_CIENCIA_BASE = '\\\\172.20.30.101\\rh\\FILIAL PR\\PROJETO TERMOS_CIENCIA';
} else {
    // Desenvolvimento local
    TERMOS_CIENCIA_BASE = path.join(PUBLIC_BASE, 'TERMOS_CIENCIA');
}
const TERMOS_CIENCIA_RELATORIO_PATH = path.join(TERMOS_CIENCIA_BASE, 'RELATORIO_TERMOS.xlsx');

// Nome da aba de cadastro
const SHEET_NAME = 'CADASTRO';

// Meses para cabeçalho e para colunas em planilha de cadastro
const MONTHS = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL',
    'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
    'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

// Cria as pastas necessárias de forma segura
try {
    if (!fs.existsSync(PRIVATE_BASE)) {
        fs.mkdirSync(PRIVATE_BASE, { recursive: true });
        console.log(`📁 Pasta privada criada: ${PRIVATE_BASE}`);
    }

    if (!fs.existsSync(PUBLIC_BASE)) {
        fs.mkdirSync(PUBLIC_BASE, { recursive: true });
        console.log(`📁 Pasta pública criada: ${PUBLIC_BASE}`);
    }

    if (!fs.existsSync(ATESTADOS_BASE)) {
        fs.mkdirSync(ATESTADOS_BASE, { recursive: true });
        console.log(`📁 Pasta de atestados criada: ${ATESTADOS_BASE}`);
    }

    if (!fs.existsSync(TERMOS_CIENCIA_BASE)) {
        fs.mkdirSync(TERMOS_CIENCIA_BASE, { recursive: true });
        console.log(`📁 Pasta de termos de ciência criada: ${TERMOS_CIENCIA_BASE}`);
    }
} catch (error) {
    console.error('❌ Erro ao criar pastas:', error.message);
    console.log('⚠️ O bot funcionará com funcionalidades limitadas.');
}

// Sistema de relatórios em memória (eventos novos desde o último save)
const REPORT_DATA = {
    cadastros: [],
    enviosPDF: [],
    substituicoesPDF: [],
    naoSubstituicoes: [],
    termosCiencia: []
};

// ========== UTILITÁRIOS ==========

// Formata data/hora como "dd/MM/yyyy HH:mm"
function formatDateTime(date = new Date()) {
    const pad = num => num.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(date.getFullYear())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Regex para validar nomes (apenas letras e espaços, acentos permitidos)
const validNameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ ]+$/;

// Lista expandida de termos proibidos para nomes
const bannedKeywords = [
    // Cumprimentos
    'BOM DIA', 'BOA TARDE', 'BOA NOITE', 'TUDO BEM', 'OI', 'OLÁ', 'ALÔ', 'E AÍ',
    // Termos técnicos
    'FOLHA PONTO', 'PDF', 'WHATSAPP', 'SCANNER', 'CAMSCANNER',
    // Expressões comuns
    'OBRIGADA', 'OBRIGADO', 'POR FAVOR', 'DESCULPA', 'VALEU', 'BELEZA', 'BLZ',
    'TUDO CERTO', 'OKAY', 'OK', 'SIM', 'NÃO', 'NAO', 'TÁ', 'TA', 'TCHAU',
    // Risadas
    'KKK', 'KKKK', 'KKKKK', 'KKKKKK', 'KKKKKKK', 'HAHA', 'RSRS', 'KKAKA',
    // Números por extenso
    'UM', 'UMA', 'DOIS', 'DUAS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE', 'DEZ',
    // Outros termos inválidos
    'TESTE', 'ADMIN', 'SISTEMA', 'BOT', 'CHATBOT', 'PLANSUL', 'EMPRESA', 'FUNCIONARIO',
    'EU', 'VOCÊ', 'ELE', 'ELA', 'NÓS', 'VOCÊS', 'ELES', 'ELAS', 'MEU', 'MINHA', 'SEU', 'SUA',
    // Meses
    ...MONTHS
];

// Função melhorada para validar nomes
function isValidName(nome) {
    const nomeUpper = nome.toUpperCase().trim();

    // Deve ter pelo menos 2 caracteres
    if (nomeUpper.length < 2) return false;

    // Não pode ter apenas uma palavra (nome deve ter sobrenome)
    const palavras = nomeUpper.split(' ').filter(p => p.length > 0);
    if (palavras.length < 2) return false;

    // Cada palavra deve ter pelo menos 2 caracteres
    if (palavras.some(palavra => palavra.length < 2)) return false;

    // Não pode conter números
    if (/\d/.test(nomeUpper)) return false;

    // Só pode conter letras, espaços e acentos
    if (!validNameRegex.test(nomeUpper)) return false;

    // Não pode conter termos proibidos
    if (detectBannedTerms(nomeUpper).length > 0) return false;

    // Não pode ser muito longo (máximo 80 caracteres)
    if (nomeUpper.length > 80) return false;

    return true;
}

// Testa se a unidade Z: está acessível (basta verificar permissão de escrita na PRIVATE_BASE)
async function isPrivateAvailable() {
    try {
        await fs.promises.access(PRIVATE_BASE, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

// Retorna caminho para gravação "privada" (cadastro + relatório)
// Caso PRIVATE_BASE esteja inacessível, usa backup local "./backup"
async function getPrivateDestino(subPathParts = []) {
    const disponivel = await isPrivateAvailable();
    if (disponivel) {
        return path.join(PRIVATE_BASE, ...subPathParts);
    } else {
        return path.join(__dirname, 'backup', ...subPathParts);
    }
}

// Retorna caminho para gravação "pública" (public workbook ou PDF)
// Se PUBLIC_BASE estiver inacessível, também cai em backup local
async function getPublicDestino(subPathParts = []) {
    const disponivel = await isPrivateAvailable();
    if (disponivel) {
        return path.join(PUBLIC_BASE, ...subPathParts);
    } else {
        return path.join(__dirname, 'backup', ...subPathParts);
    }
}

// Detecta quais termos proibidos (bannedKeywords) aparecem como PALAVRAS COMPLETAS no texto
function detectBannedTerms(upperName) {
    const palavras = upperName.split(/\s+/); // Separa em palavras
    return bannedKeywords.filter(term => palavras.includes(term)); // Verifica palavra exata
}

// ========== INICIALIZAÇÃO E REPLICAÇÃO DE PLANILHAS ==========

async function initAllExcels() {
    // CADASTRO
    try {
        const mainCadPath = await getPrivateDestino(['CADASTRO_FOLHA.xlsx']);
        const publicCadPath = await getPublicDestino(['CADASTRO_FOLHA_PUBLICA.xlsx']);
        if (!fs.existsSync(mainCadPath)) {
            const pasta = path.dirname(mainCadPath);
            await fs.promises.mkdir(pasta, { recursive: true });
            const wb = XLSX.utils.book_new();
            const header = [['NOME', 'TELEFONE', ...MONTHS]];
            const ws = XLSX.utils.aoa_to_sheet(header);
            XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
            XLSX.writeFile(wb, mainCadPath);
        }
        if (!fs.existsSync(publicCadPath)) {
            const wbCopy = XLSX.readFile(mainCadPath);
            const pastaPub = path.dirname(publicCadPath);
            await fs.promises.mkdir(pastaPub, { recursive: true });
            XLSX.writeFile(wbCopy, publicCadPath);
        }
    } catch { }

    // RELATÓRIO
    try {
        const mainRepPath = await getPrivateDestino(['RELATORIO_ATIVIDADES.xlsx']);
        const publicRepPath = await getPublicDestino(['RELATORIO_ATIVIDADES_PUBLICO.xlsx']);
        if (!fs.existsSync(mainRepPath)) {
            const pasta = path.dirname(mainRepPath);
            await fs.promises.mkdir(pasta, { recursive: true });
            const wb = XLSX.utils.book_new();
            const sheetNames = [
                'Novos Cadastros',
                'PDFs Enviados',
                'PDFs Substituídos',
                'PDFs Não Substituídos'
            ];
            for (const name of sheetNames) {
                const ws = XLSX.utils.json_to_sheet([]);
                XLSX.utils.book_append_sheet(wb, ws, name);
            }
            XLSX.writeFile(wb, mainRepPath);
        }
        if (!fs.existsSync(publicRepPath)) {
            const wbCopy = XLSX.readFile(mainRepPath);
            const pastaPub = path.dirname(publicRepPath);
            await fs.promises.mkdir(pastaPub, { recursive: true });
            XLSX.writeFile(wbCopy, publicRepPath);
        }
    } catch { }
}

// Replica planilha de CADASTRO de PRIVATE_BASE para PUBLIC_BASE
async function replicateCadastroPublic() {
    try {
        const mainPath = await getPrivateDestino(['CADASTRO_FOLHA.xlsx']);
        const publicPath = await getPublicDestino(['CADASTRO_FOLHA_PUBLICA.xlsx']);
        const wb = XLSX.readFile(mainPath);
        const pastaPub = path.dirname(publicPath);
        await fs.promises.mkdir(pastaPub, { recursive: true });
        XLSX.writeFile(wb, publicPath);
    } catch (e) {
        if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) {
            setTimeout(replicateCadastroPublic, 60 * 1000);
        }
    }
}

// Replica planilha de RELATÓRIO de PRIVATE_BASE para PUBLIC_BASE
async function replicateReportPublic() {
    try {
        const mainPath = await getPrivateDestino(['RELATORIO_ATIVIDADES.xlsx']);
        const publicPath = await getPublicDestino(['RELATORIO_ATIVIDADES_PUBLICO.xlsx']);
        const wb = XLSX.readFile(mainPath);
        const pastaPub = path.dirname(publicPath);
        await fs.promises.mkdir(pastaPub, { recursive: true });
        XLSX.writeFile(wb, publicPath);
    } catch (e) {
        if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) {
            setTimeout(replicateReportPublic, 60 * 1000);
        }
    }
}

// ========== LEITURA E GRAVAÇÃO DE CADASTRO (EXCEL) ==========

async function loadCadastroData() {
    await initAllExcels();
    try {
        const workbookPath = await getPrivateDestino(['CADASTRO_FOLHA.xlsx']);
        const wb = XLSX.readFile(workbookPath);
        return XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAME], { defval: '' });
    } catch {
        return [];
    }
}

async function saveCadastroData(data) {
    try {
        const workbookPath = await getPrivateDestino(['CADASTRO_FOLHA.xlsx']);
        const pasta = path.dirname(workbookPath);
        if (!fs.existsSync(pasta)) {
            await fs.promises.mkdir(pasta, { recursive: true });
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data, { header: ['NOME', 'TELEFONE', ...MONTHS] });
        XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
        XLSX.writeFile(wb, workbookPath);
        replicateCadastroPublic();
    } catch { }
}

// ========== LEITURA E GRAVAÇÃO DE RELATÓRIO (EXCEL) ==========

async function saveReport() {
    try {
        const mainRepPath = await getPrivateDestino(['RELATORIO_ATIVIDADES.xlsx']);
        const existingWb = XLSX.readFile(mainRepPath);
        const sheetNovos = XLSX.utils.sheet_to_json(existingWb.Sheets['Novos Cadastros'] || XLSX.utils.json_to_sheet([]), { defval: '' });
        const sheetEnvios = XLSX.utils.sheet_to_json(existingWb.Sheets['PDFs Enviados'] || XLSX.utils.json_to_sheet([]), { defval: '' });
        const sheetSubst = XLSX.utils.sheet_to_json(existingWb.Sheets['PDFs Substituídos'] || XLSX.utils.json_to_sheet([]), { defval: '' });
        const sheetNaoSub = XLSX.utils.sheet_to_json(existingWb.Sheets['PDFs Não Substituídos'] || XLSX.utils.json_to_sheet([]), { defval: '' });
        const sheetTermos = XLSX.utils.sheet_to_json(existingWb.Sheets['Termos de Ciência'] || XLSX.utils.json_to_sheet([]), { defval: '' });

        const todosNovos = sheetNovos.concat(REPORT_DATA.cadastros);
        const todosEnvios = sheetEnvios.concat(REPORT_DATA.enviosPDF);
        const todosSubstit = sheetSubst.concat(REPORT_DATA.substituicoesPDF);
        const todosNaoSub = sheetNaoSub.concat(REPORT_DATA.naoSubstituicoes);
        const todosTermos = sheetTermos.concat(REPORT_DATA.termosCiencia);

        const newWb = XLSX.utils.book_new();
        const wsNovos = XLSX.utils.json_to_sheet(todosNovos);
        const wsEnvios = XLSX.utils.json_to_sheet(todosEnvios);
        const wsSubst = XLSX.utils.json_to_sheet(todosSubstit);
        const wsNaoSub = XLSX.utils.json_to_sheet(todosNaoSub);
        const wsTermos = XLSX.utils.json_to_sheet(todosTermos);

        XLSX.utils.book_append_sheet(newWb, wsNovos, 'Novos Cadastros');
        XLSX.utils.book_append_sheet(newWb, wsEnvios, 'PDFs Enviados');
        XLSX.utils.book_append_sheet(newWb, wsSubst, 'PDFs Substituídos');
        XLSX.utils.book_append_sheet(newWb, wsNaoSub, 'PDFs Não Substituídos');
        XLSX.utils.book_append_sheet(newWb, wsTermos, 'Termos de Ciência');

        const pasta = path.dirname(mainRepPath);
        if (!fs.existsSync(pasta)) {
            await fs.promises.mkdir(pasta, { recursive: true });
        }
        XLSX.writeFile(newWb, mainRepPath);
        replicateReportPublic();
        REPORT_DATA.cadastros = [];
        REPORT_DATA.enviosPDF = [];
        REPORT_DATA.substituicoesPDF = [];
        REPORT_DATA.naoSubstituicoes = [];
        REPORT_DATA.termosCiencia = [];
    } catch { }
}

setInterval(async () => {
    const hasData = Object.values(REPORT_DATA).some(arr => arr.length > 0);
    if (hasData) await saveReport();
}, 30 * 60 * 1000);

setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 1 && now.getMinutes() === 0) {
        await saveReport();
    }
}, 60 * 1000);

// ========== CLIENTE WHATSAPP COM BAILEYS ==========

let sock;
const userStates = {};
const cleanPhone = phone => phone.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');

// ========== SISTEMA DE GARANTIA DE RESPOSTA ==========
// Rastreia mensagens que falharam para retry automático
const pendingResponses = new Map(); // {userId -> {text, priority, timestamp, attempts, type}}

async function guaranteedSendMessage(to, text, priority = 0) {
    /**
     * Versão GARANTIDA de envio de mensagem
     * - Sempre tenta enviar
     * - Se falhar imediatamente, retenta em background
     * - Se falhar persistentemente, envia erro ao usuário
     */

    const messageId = `${to}_${Date.now()}`;
    let queued = queueMessage(to, text, priority);

    if (!queued) {
        // Falhou ao enfileirar - provavelmente limite global
        // Registra para retry automático com máxima prioridade
        pendingResponses.set(messageId, {
            to,
            text,
            priority: 2, // ALTA PRIORIDADE no retry
            timestamp: Date.now(),
            attempts: 0,
            maxAttempts: 5,
            originalPriority: priority
        });

        logEvento({
            tipo: 'RESP-GARANTIDA',
            mensagem: `⚠️ Mensagem NÃO enfileirada inicialmente, registrando para retry automático`,
            telefone: to.replace('@s.whatsapp.net', '')
        });

        // Agenda retry em background (exponencial backoff)
        retryPendingResponse(messageId);
    }

    return queued;
}

async function retryPendingResponse(messageId) {
    /**
     * Tenta reenviar mensagem pendente com backoff exponencial
     */
    const pending = pendingResponses.get(messageId);
    if (!pending) return;

    // Aguarda um tempo antes de tentar novamente
    const delayMs = Math.min(1000 * Math.pow(2, pending.attempts), 30000); // max 30s
    await new Promise(resolve => setTimeout(resolve, delayMs));

    pending.attempts++;

    // Tenta enfileirar novamente
    const queued = queueMessage(pending.to, pending.text, pending.priority);

    if (queued) {
        logEvento({
            tipo: 'RESP-GARANTIDA',
            mensagem: `✅ Mensagem reenfileirada (tentativa ${pending.attempts})`,
            telefone: pending.to.replace('@s.whatsapp.net', '')
        });
        pendingResponses.delete(messageId);
    } else if (pending.attempts < pending.maxAttempts) {
        // Tenta novamente
        logEvento({
            tipo: 'RESP-GARANTIDA',
            mensagem: `🔄 Será retentada em ${delayMs}ms (tentativa ${pending.attempts}/${pending.maxAttempts})`,
            telefone: pending.to.replace('@s.whatsapp.net', '')
        });
        retryPendingResponse(messageId); // Agenda nova tentativa
    } else {
        // Desistiu após N tentativas
        logEvento({
            tipo: 'ERRO-CRITICO',
            mensagem: `❌ Falha ao enviar resposta após ${pending.attempts} tentativas!`,
            telefone: pending.to.replace('@s.whatsapp.net', ''),
            extra: `Texto: ${pending.text.substring(0, 50)}...`
        });

        // Envia notificação de erro direto ao usuário
        try {
            await sock.sendMessage(pending.to, {
                text: `⚠️ *ERRO CRÍTICO* ⚠️\n\nDesculpe! Estou tendo dificuldades para responder no momento. Sua mensagem foi recebida, mas não consegui enviar a resposta.\n\nTente:\n1️⃣ Aguarde alguns minutos e tente novamente\n2️⃣ Envie "menu" para voltar ao menu\n3️⃣ Se persisti r, contate um atendente\n\n*Regra de ouro: SEMPRE terá resposta!* ✅`
            });
            logEvento({
                tipo: 'RESP-GARANTIDA',
                mensagem: `✅ Notificação de erro enviada diretamente via socket`,
                telefone: pending.to.replace('@s.whatsapp.net', '')
            });
        } catch (directErr) {
            logEvento({
                tipo: 'ERRO-CRITICO',
                mensagem: `FALHA TOTAL: Nem mesmo notificação de erro conseguiu ser enviada!`,
                telefone: pending.to.replace('@s.whatsapp.net', ''),
                extra: directErr.message
            });
        }

        pendingResponses.delete(messageId);
    }
}

// Limpa respostas pendentes muito antigas (>5 minutos sem resolver)
setInterval(() => {
    const agora = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

    for (const [messageId, pending] of pendingResponses.entries()) {
        if (agora - pending.timestamp > TIMEOUT_MS) {
            logEvento({
                tipo: 'LIMPEZA',
                mensagem: `Removendo resposta pendente por timeout`,
                telefone: pending.to.replace('@s.whatsapp.net', '')
            });
            pendingResponses.delete(messageId);
        }
    }
}, 60000); // Verifica a cada minuto

async function getUserName(from) {
    try {
        // Primeiro, tenta buscar na planilha pelo telefone
        const phone = cleanPhone(from);
        const data = await loadCadastroData();
        const user = data.find(r => r.TELEFONE === phone);

        if (user && user.NOME && user.NOME.trim()) {
            return user.NOME.trim();
        }

        // Se não encontrou na planilha, tenta pegar do WhatsApp
        const [result] = await sock.onWhatsApp(from);
        if (result?.name && result.name.trim()) {
            return result.name.trim();
        }

        return 'Colega';
    } catch {
        return 'Colega';
    }
}

function formatName(name) {
    return name.split(' ')[0] || 'Colega';
}

function currentMonth() {
    const hoje = new Date();
    const dia = hoje.getDate();
    const mesIdx = hoje.getMonth();
    return dia >= 25 ? MONTHS[mesIdx] : MONTHS[mesIdx === 0 ? 11 : mesIdx - 1];
}

async function verificarFolhasPendentes() {
    const data = await loadCadastroData();
    const hoje = new Date();
    const mesAtual = MONTHS[hoje.getMonth()];
    const diaHoje = hoje.getDate();

    if (diaHoje < 1) return;

    for (const user of data) {
        const tel = user.TELEFONE;
        const nome = user.NOME || 'Colega';
        const enviado = user[mesAtual] === '✔';

        if (!enviado) {
            const atraso = diaHoje - 1;
            const chatId = `${tel}@s.whatsapp.net`;

            let msg = '';

            if (atraso === 0) {
                msg = `📢 *Hoje é dia de enviar sua Folha Ponto, ${formatName(nome)}!* Assine tudo certinho e envie aqui mesmo. 📄✅`;
            } else if (atraso === 1) {
                msg = `⚠️ *Olá ${formatName(nome)}*, já passou 1 dia e ainda não recebemos sua folha ponto de *${mesAtual}*.\nPor favor, envie o quanto antes para evitar problemas com seu pagamento.`;
            } else if (atraso === 2) {
                msg = `🔔 *${formatName(nome)}, sua folha de ${mesAtual} ainda não chegou!*\nEvite transtornos, envie agora mesmo. Estamos aguardando.`;
            } else if (atraso <= 5) {
                msg = `📣 *${formatName(nome)}*, sua folha ponto de ${mesAtual} continua pendente. Isso pode impactar seu salário. Último lembrete!`;
            } else {
                continue; // para de cobrar depois de 5 dias
            }

            // Envia mensagem com delay aleatório pra evitar bloqueio (com garantia de resposta)
            setTimeout(() => {
                guaranteedSendMessage(chatId, msg, 1);
            }, Math.random() * 20000); // até 20s de atraso
        }
    }
}

// ========== SISTEMA DE FILA ANTI-SPAM AVANÇADO ==========

// Instancia o sistema anti-spam
let spamGuard = null;

function initializeAntiSpam() {
    spamGuard = new AntiSpamSystem();
    const config = spamGuard.getConfig();
    logEvento({
        tipo: 'ANTI-SPAM',
        mensagem: `✅ Sistema Anti-Spam inicializado (${config.messagesPerMinute}/min, ${config.globalMessagesPerMinute} global/min)`
    });
}

// Wrapper para enviar mensagens com proteção anti-spam
async function queueMessage(to, text, priority = 0, metadata = {}) {
    // Garante que o sistema está inicializado
    if (!spamGuard) initializeAntiSpam();

    // Converte prioridade numérica (sistema antigo) para textual
    let priorityLevel = 'normal';
    if (priority === 2) priorityLevel = 'high';      // Alta prioridade
    else if (priority === 1) priorityLevel = 'normal'; // Normal
    else if (priority === 0) priorityLevel = 'normal'; // Normal (padrão)

    // Enfileira a mensagem
    const queued = spamGuard.queue(to, text, priorityLevel, metadata);

    if (!queued) {
        // Silencioso - log no arquivo apenas
        return false;
    }

    return true;
}

// Função para processar a fila
async function processQueue() {
    if (!spamGuard) initializeAntiSpam();

    // Define a função que efetivamente envia a mensagem
    const sendFunction = async (to, text, metadata) => {
        try {
            if (!sock || !sock.sendMessage) {
                throw new Error('Socket não conectado');
            }

            // Simula digitação (mas bem rápido para não parecer spam)
            await sock.sendPresenceUpdate('composing', to);
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

            // Envia a mensagem
            await sock.sendMessage(to, { text });

            // Log apenas para número DEV para não poluir console
            if (to === DEV_NUMBER) {
                logEvento({
                    tipo: 'MSG-SENT',
                    mensagem: `✅ Mensagem enviada`,
                    telefone: to.replace('@s.whatsapp.net', '')
                });
            }

            return true;
        } catch (error) {
            logEvento({
                tipo: 'ERRO',
                mensagem: `Erro ao enviar mensagem para ${to}`,
                extra: error.message
            });
            return false;
        }
    };

    // Processa a fila com a função de envio
    await spamGuard.processQueue(sendFunction);
}

// Inicia o processamento periódico (fila sempre processando)
async function startQueueProcessor() {
    if (!spamGuard) initializeAntiSpam();

    setInterval(async () => {
        try {
            await processQueue();
        } catch (error) {
            logEvento({
                tipo: 'ERRO',
                mensagem: 'Erro no processador de fila',
                extra: error.message
            });
        }
    }, 500); // Verifica fila a cada 500ms
}

// ✅ ENVIO IMEDIATO PARA RESPOSTAS AO USUÁRIO (SEM FILA/DELAY)
// Isso garante que o usuário sempre veja resposta INSTANTÂNEA
async function instantSendMessage(to, text) {
    /**
     * Envia resposta DIRETAMENTE sem fila para parecer bot natural
     * Usado para respostas ao usuário (não para cobranças/notificações)
     * 
     * DIFERENÇA CRÍTICA:
     * - queueMessage(): Espera na fila, delay 800ms+ (LENTO)
     * - instantSendMessage(): Direto via socket, 50-100ms (MUITO RÁPIDO)
     */
    try {
        if (!sock || !sock.sendMessage) {
            // Socket não está pronto, enfileira normalmente
            return queueMessage(to, text, 1);
        }

        // Simula digitação rápida (apenas 50-100ms, não 800ms+)
        await sock.sendPresenceUpdate('composing', to);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 30));

        // Envia DIRETO via socket (MUITO RÁPIDO, SEM FILA)
        await sock.sendMessage(to, { text });

        // Log silencioso (apenas registra, não polui console)
        const telefone = to.replace('@s.whatsapp.net', '');
        logEvento({
            tipo: 'RESP-IMEDIATA',
            telefone,
            mensagem: '✅ Resposta enviada instantaneamente'
        });

        return true;
    } catch (error) {
        const telefone = to.replace('@s.whatsapp.net', '');
        logEvento({
            tipo: 'WARN',
            mensagem: 'Falha ao enviar direto, tentando fila',
            telefone,
            extra: error.message
        });
        // Fallback: enfileira com prioridade alta
        return queueMessage(to, text, 2);
    }
}

// Wrapper para compatibilidade (USA ENVIO IMEDIATO)
function sendMessage(from, text, priority = 0) {
    // Priority 2 (ALTA) = Resposta ao usuário = ENVIO IMEDIATO
    if (priority >= 2) {
        return instantSendMessage(from, text);
    }
    // Priority 1 (NORMAL) = Enfileira normalmente
    return queueMessage(from, text, priority);
}

// Função para marcar mensagem como lida
const markAsRead = async (jid, messageKey) => {
    try {
        if (sock && messageKey) {
            await sock.readMessages([messageKey]);
            // Log removido para simplificação
        }
    } catch (error) {
        // Erro silencioso - marcar como lida não é crítico
    }
};

// Função para processar mensagens pendentes após reconexão
const processarMensagensPendentes = async () => {
    try {
        // Não há API direta para buscar mensagens pendentes no Baileys
        // O bot processará mensagens conforme elas chegarem

    } catch (error) {
        logEvento({ tipo: 'ERRO', mensagem: 'Erro ao processar pendentes', extra: error.message });
    }
};

// ========== MENUS E MENSAGENS FIXAS ==========

const MAIN_MENU = (name = 'Colega') => {
    // Usa variação de mensagens para evitar detecção de padrão
    return getVariation('MAIN_MENU', { NAME: formatName(name) });
};

const CONTATOS = {
    1: `📋 *ALTERAÇÃO CADASTRAL/PAGAMENTOS*\n\n` +
        `Para questões sobre cadastro ou benefícios:\n` +
        `📧 suporteadmpr@plansul.com.br\n` +
        `📞 (41) 3087-2573\n\n` +
        `🔙  Digite *menu* para voltar`,
    2: `🤝 *PROCESSO SELETIVO*\n\n` +
        `Fale com nosso time de recrutamento:\n` +
        `📧 processoseletivo@plansul.com.br\n` +
        `📞 (41) 99148-9677\n\n` +
        `🔙  Digite *menu* para voltar`,
    3: `🏥 *ATESTADOS*\n\n` +
        `Escolha uma opção:\n` +
        `1️⃣ 📤 Enviar atestado via bot\n` +
        `2️⃣ 📧 Enviar por email: rhfilialcolombo@plansul.com.br\n\n` +
        `🔙  Digite *menu* para voltar`,
    5: `⏱️ *PONTO ELETRÔNICO*\n\n` +
        `Suporte para o aplicativo de ponto eletrônico para os colaboradres que usufruem do app WAPPI:\n` +
        `📞 (41) 99259-3700\n\n` +
        `🔙  Digite *menu* para voltar`,
    6: `⏱️ *PONTO MANUAL*\n\n` +
        `Suporte para o ponto manual:\n` +
        `📞 *(41) 3087-2570* ou pelo e-mail *folhaponto.750@plansul.com.br*\n\n` +
        `🔙  Digite *menu* para voltar`,
    7: `👕 *UNIFORMES*\n\n` +
        `Para mais informações, entre em contato com:\n` +
        `📞 (41) 99113-5703\n\n` +
        `🔙  Digite *menu* para voltar`,
    9: `🌴 *FÉRIAS*\n\n` +
        `Para agendar suas férias:\n` +
        `📧 auxiliarrh.750@plansul.com.br\n\n` +
        `🔙  Digite *menu* para voltar`,
    10: `🧑‍💻 *FALAR COM ATENDENTE*\n\n` +
        `CADASTRO & PAGAMENTOS:\n` +
        `📞 (41) 3087-2573\n\n` +
        `PROCESSO SELETIVO:\n` +
        `📞 (41) 99148-9677\n\n` +
        `PONTO ELETRÔNICO:\n` +
        `📞 (41) 99259-3700\n\n` +
        `UNIFORMES:\n` +
        `📞 (41) 99113-5703\n\n` +
        `🔙  Digite *menu* para voltar`,
};

// ========== FLUXO RESCISÃO ==========

const RESCISAO_SUBMENU = (name = 'Colega') =>
    `🚪 *RESCISÃO*\n\n` +
    `${formatName(name)}, para solicitar seu desligamento, escolha uma das opções abaixo:\n\n` +
    `1️⃣- Aviso prévio *(30 dias trabalhados)*\n` +
    `2️⃣- Aviso prévio *sem cumprimento*\n` +
    `3️⃣- Interrupção do cumprimento do *aviso prévio trabalhado*\n` +
    `4️⃣- Término de contrato *(30 dias ou 90 dias)*\n\n` +
    `🔙 Digite *menu* para voltar`;

const RESCISAO_TEXTS = {
    1: (name = 'Colega') =>
        `*1️⃣ AVISO PRÉVIO (30 DIAS TRABALHADOS)*\n\n` +
        `Vamos precisar que você faça uma carta de próprio punho em folha em branco conforme o modelo abaixo:\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta, solicitar meu desligamento da Empresa PLANSUL – PLANEJAMENTO E CONSULTORIA por motivos pessoais.\n` +
        `*Informo que irei cumprir aviso.*\n\n` +
        `LOCAL, DIA – MÊS – ANO\n` +
        `ASSINATURA\n\n` +
        `📧 Enviar no e-mail: aux01.colombo@plansul.com.br\n\n` +
        `🔙  Digite *menu* para voltar`,

    2: (name = 'Colega') =>
        `*2️⃣ AVISO PRÉVIO SEM CUMPRIMENTO*\n\n` +
        `Vamos precisar que você faça uma carta de próprio punho em folha em branco conforme o modelo abaixo:\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta, solicitar meu desligamento da Empresa PLANSUL – PLANEJAMENTO E CONSULTORIA por motivos pessoais.\n` +
        `*Informo que não irei cumprir aviso.*\n\n` +
        `LOCAL, DIA – MÊS – ANO\n` +
        `ASSINATURA\n\n` +
        `*Obs:* É descontado na rescisão a multa referente ao aviso prévio não cumprido.\n\n` +
        `🔙  Digite *menu* para voltar`,

    3: (name = 'Colega') =>
        `*3️⃣ INTERRUPÇÃO DO CUMPRIMENTO DO AVISO PRÉVIO TRABALHADO*\n\n` +
        `Precisamos que faça uma carta de próprio punho seguindo o modelo abaixo.\n\n` +
        `*CARTA DE DESLIGAMENTO – MODELO (INTERRUPÇÃO DE AVISO)*\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXXXXXXXX XXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta, solicitar meu desligamento imediato, não vou continuar cumprindo o aviso prévio que se iniciou dia xx/xx/xxxx.\n` +
        `Esta sendo interrompido no dia de hoje por minha parte.\n` +
        `Estou ciente dos descontos dos dias faltantes.\n\n` +
        `CURITIBA, DIA – MÊS – ANO\n\n` +
        `ASSINATURA\n\n` +
        `📧 Enviar no e-mail: aux01.colombo@plansul.com.br\n\n` +
        `*Obs:* É descontado na rescisão a multa por quebra de contrato pelos dias não trabalhados do aviso prévio.\n\n` +
        `🔙  Digite *menu* para voltar`,

    4: (name = 'Colega') =>
        `*4️⃣ TÉRMINO DE CONTRATO (30 DIAS OU 90 DIAS)*\n\n` +
        `Vamos precisar que você faça uma carta de próprio punho em folha em branco conforme o modelo abaixo:\n\n` +
        `Eu XXXXXXXXXXXXXXXXXXX XXXXXXXXXXXXXXXX, portador(a) do CPF: 000.000.000-00, venho através desta, solicitar meu desligamento da Empresa PLANSUL – PLANEJAMENTO E CONSULTORIA por motivos pessoais, em razão do término do meu contrato de experiência/prazo determinado.\n` +
        `*Informo que não irei cumprir aviso*\n\n` +
        `LOCAL, DIA – MÊS – ANO\n` +
        `ASSINATURA\n\n` +
        `📧 Enviar no e-mail: aux01.colombo@plansul.com.br\n\n` +
        `🔙  Digite *menu* para voltar`
};

const INVALID_RESCISAO_OPTION_TEXT = (name = 'Colega') =>
    `❌ *Opção inválida, ${formatName(name)}!* Por favor, escolha uma das opções de 1 a 4 para Rescisão, ou digite *menu* para voltar.`;

// ========== FLUXO DE CADASTRO + PDF (OPÇÃO 4) ==========

async function handleFolhaPonto(from) {
    const userName = await getUserName(from);
    const phone = cleanPhone(from);
    const data = await loadCadastroData();
    const user = data.find(r => r.TELEFONE === phone);

    if (!user) {
        // Novo cadastro: pede nome
        userStates[from] = { step: 'await_name', userName };
        console.log(`${formatDateTime()} | 📝 Novo cadastro iniciado: ${phone}`);
        return sendMessage(from,
            `*Perfeito ${formatName(userName)}!*\n\n` +
            `📝 Então vamos cadastrar você!\n` +
            `Envie seu *NOME COMPLETO*:\n\n` +
            `*Regras:*\n` +
            `- *SEM ABREVIAÇÕES*\n` +
            `- Escrito apenas com *LETRAS*\n` +
            `- Sem caracteres *ESPECIAIS* \n\n` +
            `_*Exemplo: João Pedro da Silva Oliveira*_\n\n` +
            `🔙  Digite *menu* para voltar`
            , 2);
    }

    // Se já existe, verifica se o nome armazenado é válido e sem termos proibidos
    const nomeCadastro = (user.NOME || '').trim().toUpperCase();
    const foundBanned = detectBannedTerms(nomeCadastro);
    if (!nomeCadastro || !validNameRegex.test(nomeCadastro) || foundBanned.length > 0) {
        console.log(`${formatDateTime()} | ⚠️ Nome inválido: "${nomeCadastro || 'vazio'}" (telefone: ${phone})`);
        userStates[from] = { step: 'await_name_correction', phone, userName };
        const motivos = [];
        if (!nomeCadastro || !validNameRegex.test(nomeCadastro)) motivos.push('caracteres inválidos ou números');
        if (foundBanned.length > 0) motivos.push(`palavras como: ${foundBanned.join(', ')}`);
        return sendMessage(from,
            `⚠️ *${formatName(userName)}*, seu nome cadastrado não está ok:\n` +
            `"${nomeCadastro || 'vazio'}" contém ${motivos.join(' e ')}.\n\n` +
            `Envie seu *nome completo* apenas com letras e espaços,\n` +
            `sem cumprimentos, sem "PDF" nem meses.\n\n` +
            `🔙 Se quiser voltar: digite *menu*`
            , 2);
    }

    // Se o nome é válido, prossegue para recolher PDF
    const month = currentMonth();
    if (user[month] === '✔' && !userStates[from]?.confirming) {
        userStates[from] = {
            step: 'confirm_replace',
            name: user.NOME,
            phone,
            month,
            userName,
            confirming: true
        };
        console.log(`${formatDateTime()} | ⚠️ Substituição solicitada: ${user.NOME} - ${month}`);
        return sendMessage(from,
            `⚠️ *${formatName(userName)}*, você já mandou a folha de *${month}* ✅\n` +
            `Quer substituir pelo novo PDF?\n\n` +
            `✅ 1 - SIM, substituir\n` +
            `❌ 0 - NÃO, manter o que já tinha\n\n` +
            `🔙  Digite *menu* para voltar`
            , 2);
    }

    // Se ainda não enviou, pede PDF
    userStates[from] = { step: 'await_pdf', name: user.NOME, phone, month, userName };
    console.log(`${formatDateTime()} | 📤 Solicitado PDF de folha ponto: ${user.NOME} - ${month}`);
    return sendMessage(from,
        `📤 *Perfeito! ${formatName(userName)}*\n` +
        `Agora me manda o *PDF* da sua folha de *${month}*\n` +
        `(Aceitamos somente *PDF*, hein!)\n\n` +
        `🔙  Digite *menu* para voltar`
        , 2);
}

// ========== FLUXO DE ATESTADO (OPÇÃO 3.1) ==========
async function handleAtestado(from) {
    const phone = cleanPhone(from);
    const userName = await getUserName(from);

    logEvento({ tipo: 'ATESTADO', mensagem: 'Iniciando fluxo de atestado', telefone: phone });

    // Verificar se o usuário está cadastrado
    const data = await loadCadastroData();
    const user = data.find(r => r.TELEFONE === phone);

    if (!user) {
        userStates[from] = { step: 'await_name_for_atestado', phone, userName };
        return sendMessage(from,
            `👋 *${formatName(userName)}*, não encontrei você no cadastro!\n\n` +
            `Para enviar seu atestado, preciso que me envie seu *nome completo* exatamente como está na sua carteira de trabalho.\n\n` +
            `🔙  Digite *menu* para voltar`
            , 2);
    }

    // Validar nome do usuário cadastrado
    const validNameRegex = /^[A-Za-zÀ-ÿ\s]{2,}$/;
    const bannedTerms = ['PDF', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO', 'OI', 'OLÁ', 'BOM DIA', 'BOA TARDE', 'BOA NOITE'];

    const detectBannedTerms = (text) => {
        const upperText = text.toUpperCase();
        return bannedTerms.filter(term => upperText.includes(term));
    };

    const nomeCadastro = (user.NOME || '').trim().toUpperCase();
    const foundBanned = detectBannedTerms(nomeCadastro);
    if (!nomeCadastro || !validNameRegex.test(nomeCadastro) || foundBanned.length > 0) {
        console.log(`${formatDateTime()} | ⚠️ Nome inválido para atestado: "${nomeCadastro || 'vazio'}" (telefone: ${phone})`);
        userStates[from] = { step: 'await_name_correction_atestado', phone, userName };
        const motivos = [];
        if (!nomeCadastro || !validNameRegex.test(nomeCadastro)) motivos.push('caracteres inválidos ou números');
        if (foundBanned.length > 0) motivos.push(`palavras como: ${foundBanned.join(', ')}`);
        return sendMessage(from,
            `⚠️ *${formatName(userName)}*, seu nome cadastrado não está ok:\n` +
            `"${nomeCadastro || 'vazio'}" contém ${motivos.join(' e ')}.\n\n` +
            `Envie seu *nome completo* apenas com letras e espaços,\n` +
            `sem cumprimentos, sem "PDF" nem meses.\n\n` +
            `🔙 Se quiser voltar: digite *menu*`
            , 2);
    }

    // Se o nome é válido, solicita diretamente o PDF
    userStates[from] = { step: 'await_atestado_pdf', name: user.NOME, phone, userName };
    return sendMessage(from,
        `� *Perfeito ${formatName(userName)}!*\n\n` +
        `Agora envie o *PDF do seu atestado*.\n\n` +
        `⚠️ *IMPORTANTE:* Após o envio, seu atestado será analisado pelo RH e você receberá uma resposta automática.\n\n` +
        `🔙  Digite *menu* para voltar`
        , 2);
}

// ========== FLUXO DE TERMO DE CIÊNCIA (OPÇÃO 11) ==========
async function handleTermoCiencia(from) {
    const phone = cleanPhone(from);
    const userName = await getUserName(from);

    logEvento({ tipo: 'TERMO_CIENCIA', mensagem: 'Iniciando fluxo de termo de ciência', telefone: phone });

    // Verificar se o usuário está cadastrado
    const data = await loadCadastroData();
    const user = data.find(r => r.TELEFONE === phone);

    if (!user) {
        userStates[from] = { step: 'await_name_for_termo', phone, userName };
        return sendMessage(from,
            `👋 *${formatName(userName)}*, não encontrei você no cadastro!\n\n` +
            `Para enviar seu termo de ciência, preciso que me envie seu *nome completo* exatamente como está na sua carteira de trabalho.\n\n` +
            `🔙  Digite *menu* para voltar`
            , 2);
    }

    // Validar nome do usuário cadastrado
    const validNameRegex = /^[A-Za-zÀ-ÿ\s]{2,}$/;
    const bannedTerms = ['PDF', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO', 'OI', 'OLÁ', 'BOM DIA', 'BOA TARDE', 'BOA NOITE'];

    const detectBannedTerms = (text) => {
        const upperText = text.toUpperCase();
        return bannedTerms.filter(term => upperText.includes(term));
    };

    const nomeCadastro = (user.NOME || '').trim().toUpperCase();
    const foundBanned = detectBannedTerms(nomeCadastro);
    if (!nomeCadastro || !validNameRegex.test(nomeCadastro) || foundBanned.length > 0) {
        console.log(`${formatDateTime()} | ⚠️ Nome inválido para termo de ciência: "${nomeCadastro || 'vazio'}" (telefone: ${phone})`);
        userStates[from] = { step: 'await_name_correction_termo', phone, userName };
        const motivos = [];
        if (!nomeCadastro || !validNameRegex.test(nomeCadastro)) motivos.push('caracteres inválidos ou números');
        if (foundBanned.length > 0) motivos.push(`palavras como: ${foundBanned.join(', ')}`);
        return sendMessage(from,
            `⚠️ *${formatName(userName)}*, seu nome cadastrado não está ok:\n` +
            `"${nomeCadastro || 'vazio'}" contém ${motivos.join(' e ')}.\n\n` +
            `Envie seu *nome completo* apenas com letras e espaços,\n` +
            `sem cumprimentos, sem "PDF" nem meses.\n\n` +
            `🔙 Se quiser voltar: digite *menu*`
            , 2);
    }

    // Verificar se já enviou termo anteriormente (em QUALQUER data anterior)
    const baseName = user.NOME
        .replace(/[/\\?%*:|"<>]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    let termoJaExiste = false;
    try {
        // Procura por QUALQUER arquivo do usuário na pasta (independente da data)
        if (fs.existsSync(TERMOS_CIENCIA_BASE)) {
            const arquivos = fs.readdirSync(TERMOS_CIENCIA_BASE);
            // Procura por qualquer arquivo que comece com o nome do usuário
            termoJaExiste = arquivos.some(arquivo =>
                arquivo.startsWith(baseName) && arquivo.endsWith('.pdf')
            );
        }
    } catch (err) {
        // Se falhar ao verificar (erro de rede), assume que não existe
        termoJaExiste = false;
    }

    // Se já enviou em qualquer data anterior, perguntar se quer substituir
    if (termoJaExiste && !userStates[from]?.confirming) {
        userStates[from] = {
            step: 'confirm_replace_termo',
            name: user.NOME,
            phone,
            userName,
            confirming: true
        };
        console.log(`${formatDateTime()} | ⚠️ Substituição de termo solicitada: ${user.NOME}`);
        return sendMessage(from,
            `⚠️ *${formatName(userName)}*, você já enviou seu termo de ciência ✅\n` +
            `Deseja substituir pelo novo PDF?\n\n` +
            `✅ 1 - SIM, substituir\n` +
            `❌ 0 - NÃO, manter o que já tinha\n\n` +
            `🔙  Digite *menu* para voltar`
            , 2);
    }

    // Se ainda não enviou ou confirmou substituição, pede PDF
    userStates[from] = { step: 'await_termo_pdf', name: user.NOME, phone, userName };
    console.log(`${formatDateTime()} | 📤 Solicitado PDF de termo de ciência: ${user.NOME}`);
    return sendMessage(from,
        `📝 *Olá ${formatName(userName)}!*\n\n` +
        `Esperamos que esteja bem.\n` +
        `A opção selecionada é para envio do *Manual de Normas e Condutas assinado*.\n\n` +
        `Nos encaminhe em formato *PDF*.\n\n` +
        `🔙  Digite *menu* para voltar`
        , 2);
}

// ========== EVENTOS WHATSAPP COM BAILEYS ==========

const pausedChats = new Set();

async function connectToWhatsApp() {
    const authPath = path.join(appPath, 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    // contador de tentativas de conexão com QR (reiniciado a cada novo processo)
    if (!global.connRetry) global.connRetry = 0;

    // Busca a versão mais recente do WhatsApp dinamicamente (SOLUÇÃO DEFINITIVA para erro 405)
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logEvento({ tipo: 'CONN', mensagem: `Usando versão do WhatsApp: ${version.join('.')}, isLatest: ${isLatest}` });

    // Ativa debug para diagnóstico detalhado (descomente para troubleshooting)
    // process.env.DEBUG = process.env.DEBUG ? process.env.DEBUG + ',baileys:*' : 'baileys:*';
    sock = makeWASocket({
        version, // CRITICAL: passa a versão mais recente do WhatsApp para evitar erro 405
        auth: state,
        logger: require('pino')({ level: 'silent' }), // modo silent para produção (use 'debug' para troubleshooting)
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // grava todos os updates sanitizados em arquivo para análise
        try {
            const logsDir = path.join(appPath, 'logs');
            if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
            const upPath = path.join(logsDir, 'connection_updates.log');
            const entry = { time: new Date().toISOString(), update: sanitizeForLog(update) };
            fs.appendFileSync(upPath, JSON.stringify(entry) + '\n');
        } catch (e) {
            console.error('Falha ao gravar update de conexão:', e.message);
        }

        if (qr) {
            console.log('📱 Escaneie o QR Code abaixo no WhatsApp:');
            console.log('================================');
            qrcode.generate(qr, { small: true });
            console.log('================================');
            console.log('⏳ Aguardando conexão...');
            global.connRetry = (global.connRetry || 0) + 1;
            logEvento({ tipo: 'CONN', mensagem: `Tentativa de conexão via QR #${global.connRetry}` });

            // Se atingir o máximo, remove credenciais e reinicia conexão
            if (global.connRetry >= 5) {
                logEvento({ tipo: 'CONN', mensagem: `Máximo de tentativas alcançado (5). Razão: ${lastDisconnect?.error?.message || 'Motivo desconhecido'}` });
                try {
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                        logEvento({ tipo: 'CONN', mensagem: 'Credenciais locais removidas (auth_info_baileys).' });
                    }
                } catch (e) {
                    logEvento({ tipo: 'ERRO', mensagem: `Falha ao limpar auth: ${e.message}` });
                }
                global.connRetry = 0;
                setTimeout(() => {
                    logEvento({ tipo: 'CONN', mensagem: 'Reiniciando conexão para novo QR...' });
                    connectToWhatsApp();
                }, 2000);
                return;
            }
        }

        if (connection === 'close') {
            // grava lastDisconnect completo (sanitizado) para análise
            try {
                const logsDir = path.join(appPath, 'logs');
                if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
                const fullPath = path.join(logsDir, 'last_disconnect_full.log');
                const obj = { time: new Date().toISOString(), lastDisconnect: sanitizeForLog(lastDisconnect) };
                fs.appendFileSync(fullPath, JSON.stringify(obj) + '\n');
            } catch (e) {
                console.error('Erro ao gravar lastDisconnect completo:', e.message);
            }
            // Determina se deve tentar reconectar: se o motivo for 'loggedOut' não reconecta.
            // lastDisconnect.error pode não ser uma instância de Boom, então acessamos o statusCode de forma segura.
            const statusCode = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.statusCode ?? null;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Conexão perdida:', (lastDisconnect && (lastDisconnect.error?.message || lastDisconnect.reason || JSON.stringify(lastDisconnect.error))) || 'Motivo desconhecido');
            logEvento({ tipo: 'CONN', mensagem: `StatusCode: ${statusCode || 'N/A'}` });

            if (shouldReconnect) {
                console.log('🔄 Reconectando em 5 segundos...');
                // Log detalhado em arquivo para debug avançado
                try {
                    const logsDir = path.join(appPath, 'logs');
                    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
                    const debugPath = path.join(logsDir, 'last_disconnect_debug.log');
                    const debugObj = {
                        time: new Date().toISOString(),
                        lastDisconnect: lastDisconnect || null,
                        statusCode: lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.statusCode ?? null,
                        errorOutput: lastDisconnect?.error?.output ?? null
                    };
                    fs.appendFileSync(debugPath, JSON.stringify(debugObj) + '\n');
                } catch (e) {
                    console.error('Erro ao gravar debug de desconexão:', e.message);
                }

                global.connRetry = (global.connRetry || 0) + 1;
                if (global.connRetry >= 5) {
                    logEvento({ tipo: 'CONN', mensagem: `Máximo de tentativas de reconexão alcançado (5). Razão: ${lastDisconnect?.error?.message || 'Motivo desconhecido'}` });
                    try {
                        if (fs.existsSync(authPath)) {
                            fs.rmSync(authPath, { recursive: true, force: true });
                            logEvento({ tipo: 'CONN', mensagem: 'Credenciais locais removidas (auth_info_baileys).' });
                        }
                    } catch (e) {
                        logEvento({ tipo: 'ERRO', mensagem: `Falha ao limpar auth: ${e.message}` });
                    }
                    global.connRetry = 0;
                    setTimeout(() => {
                        logEvento({ tipo: 'CONN', mensagem: 'Reiniciando conexão para novo QR...' });
                        connectToWhatsApp();
                    }, 2000);
                } else {
                    setTimeout(connectToWhatsApp, 5000);
                }
            } else {
                console.log('🛑 Bot deslogado. Reinicie para reconectar.');
                if (isInteractive()) {
                    console.log('\nPressione ENTER para fechar...');
                    process.stdin.resume();
                    process.stdin.once('data', () => process.exit(0));
                } else {
                    console.log('Non-interactive environment detected; exiting process quietly.');
                    process.exit(0);
                }
            }
        } else if (connection === 'open') {
            // conexão bem sucedida, reset contador
            global.connRetry = 0;
            const numeroAtual = sock.user.id.split(':')[0];

            console.clear();
            console.log('🤖 BOT FOLHA PONTO - XAXIM');
            console.log('================================');
            console.log(`✅ Conectado: ${numeroAtual}`);

            const isDev = DEV_NUMBERS.includes(numeroAtual);
            console.log(`🔧 Modo: ${isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO'}`);
            console.log('📞 Bot pronto para receber mensagens!');
            console.log('================================');

            // ===== REPESCAGEM DE MENSAGENS NÃO LIDAS =====
            if (global.NameHandling && global.NameHandling.rescueUnreadMessages) {
                try {
                    await global.NameHandling.rescueUnreadMessages(sock);
                } catch (error) {
                    console.error('❌ Erro na repescagem de mensagens:', error.message);
                }
            }

            // ===== INICIALIZA SISTEMA ANTI-SPAM =====
            initializeAntiSpam();
            startQueueProcessor();
            console.log('🛡️ Sistema Anti-Spam inicializado e ativado');
            console.log('✅ Sistema de Garantia de Resposta ATIVADO - ZERO respostas perdidas!');
            // ==========================================

            // inicializa planilhas e registra o dia
            await initAllExcels();
            logCurrentDay();

            // 1) Log diário às 9h
            cron.schedule('0 9 * * *', () => {
                logCurrentDay();
            }, { timezone: 'America/Sao_Paulo' });

            // COBRANÇA AUTOMÁTICA DESATIVADA PARA ESTE MÊS
            // Será reativada no próximo mês
            /*
            if (numeroAtual !== DEV_NUMBER.replace('@s.whatsapp.net', '')) {
                const cobrancaJob = cron.schedule('0 9 * * *', async () => {
                    const dia = new Date().getDate();
                    if (dia >= 1 && dia <= 5) {
                        console.log('⏰ Iniciando cobrança automática...');
                        await dispararCobrancaDoDia();
                    } else {
                        cobrancaJob.stop();
                        console.log('🔒 Cobrança diária desativada após o dia 05.');
                    }
                }, { timezone: 'America/Sao_Paulo' });
            } else {
            */
            console.log('⏸️ Cobrança automática DESATIVADA para este mês');

            if (numeroAtual !== DEV_NUMBER.replace('@s.whatsapp.net', '')) {
                console.log('🚫 Dev mode: cobrança diária DESATIVADA');
            }

            // Sistema de notificações de atestados - executa às 6h de segunda a sábado
            cron.schedule('0 6 * * 1-6', async () => {
                const agora = new Date();
                const hora = agora.getHours();

                // Só processa se estiver realmente às 6h (evita execuções múltiplas)
                if (hora === 6) {
                    logEvento({ tipo: 'ATESTADO', mensagem: 'Iniciando verificação automática de atestados' });
                    await processarAtestadosVerificados();
                }
            }, {
                timezone: 'America/Sao_Paulo',
                scheduled: true
            });

            console.log('✅ Sistema de notificações de atestados ativado (6h, seg-sáb)');

            // Notifica desenvolvedor de forma discreta
            setTimeout(async () => {
                queueMessage(DEV_NUMBER, `🤖 Bot conectado - ${formatDateTime()}`, 2);

                // Processar mensagens pendentes após reconexão
                processarMensagensPendentes();
            }, 3000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const from = msg.key.remoteJid;

            // ===== VERIFICAÇÃO DE BROADCAST =====
            if (global.NameHandling && global.NameHandling.isBroadcast) {
                if (global.NameHandling.isBroadcast(msg)) {
                    try {
                        await global.NameHandling.handleBroadcast(msg, sock);
                    } catch (error) {
                        console.error('❌ Erro ao processar broadcast:', error.message);
                    }
                    continue;
                }
            }

            // Ignorar grupos
            if (from.endsWith('@g.us')) continue;

            // PROTEÇÃO ANTI-LOOP: Não responder ao bot de produção
            const numeroRemetente = from.replace('@s.whatsapp.net', '');

            if (numeroRemetente === PRODUCTION_BOT_NUMBER) {
                console.log(`🤖 PROTEÇÃO ANTI-LOOP: Ignorando mensagem do bot de produção (${PRODUCTION_BOT_NUMBER})`);
                continue;
            }

            // se for mensagem de cliente E este chat estiver pausado, sai sem responder
            if (pausedChats.has(from)) {
                console.log(`🚫 Ignorando mensagem de ${from} — chat pausado`);
                return;
            }

            const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const texto = body?.trim().toLowerCase() || '';
            const state = userStates[from] || {};
            const userName = state.userName || await getUserName(from);

            // Marcar mensagem como lida
            markAsRead(from, msg.key);

            // ===== VERIFICAÇÃO: MENSAGEM SILENCIOSA =====
            if (isAdminMessage(body)) {
                // Não converte para lowercase para verificar o prefixo original
                logAdminMessage(from, userName, body);
                continue; // Não responde, apenas loga
            }

            // Buscar nome do usuário
            let nomeUsuario = '';
            const data = await loadCadastroData();
            const user = data.find(r => r.TELEFONE === cleanPhone(from));
            if (user && user.NOME) {
                nomeUsuario = user.NOME;
            } else if (msg.pushName) {
                nomeUsuario = msg.pushName;
            } else {
                nomeUsuario = 'Desconhecido';
            }

            // ===== VERIFICAÇÃO: USUÁRIO SEM NOME =====
            if (nomeUsuario === 'Desconhecido' && global.NameHandling && global.NameHandling.handleNoNameUser) {
                // Verificar se precisa realmente de nome (alguns fluxos não precisam)
                if (!estado.dataColetada) {
                    try {
                        await global.NameHandling.handleNoNameUser(msg, sock);
                        continue;
                    } catch (error) {
                        console.error('❌ Erro ao tratar usuário sem nome:', error.message);
                    }
                }
            }

            // Extrair apenas primeiro e último nome
            if (nomeUsuario && nomeUsuario !== 'Desconhecido') {
                const partes = nomeUsuario.trim().split(/\s+/);
                if (partes.length > 1) {
                    nomeUsuario = `${partes[0]} ${partes[partes.length - 1]}`;
                }
            }

            // Definir se é DEV antes dos logs
            const numeroLimpo = cleanPhone(from);
            const isDevUser = (from === DEV_NUMBER || from === TEST_DEV_NUMBER);

            // Obter etapa/contexto da conversa
            let etapa = '';
            if (state.step) {
                // Mapeamento de etapas para nomes amigáveis
                const etapasMap = {
                    await_name: 'Nome',
                    await_name_correction: 'Correção Nome',
                    confirm_replace: 'Confirma Substituição',
                    await_pdf: 'Atestados',
                    await_pagamento: 'Pagamentos',
                    await_recrutamento: 'Recrutamento',
                    await_folha: 'Folha Ponto',
                    await_ponto: 'Ponto',
                    await_uniforme: 'Uniformes',
                    await_rescisao: 'Rescisão',
                    await_ferias: 'Férias',
                    await_name_for_termo: 'Nome Termo Ciência',
                    await_name_correction_termo: 'Correção Nome Termo',
                    confirm_replace_termo: 'Confirma Substituição Termo',
                    await_termo_pdf: 'Termo de Ciência',
                    await_name_for_atestado: 'Nome Atestado',
                    await_name_correction_atestado: 'Correção Nome Atestado',
                    await_atestado_pdf: 'Atestado PDF',
                    await_atestado_option: 'Opção Atestado',
                    await_rescisao_option: 'Opção Rescisão'
                };
                etapa = etapasMap[state.step] || state.step;
            }

            // Log especial se o número estiver vazio
            if (!numeroLimpo) {
                console.log(`[LOG ESPECIAL] Mensagem recebida sem número! Dados completos:`);
                console.dir(msg, { depth: null });
            }

            // Log simplificado de mensagem recebida
            let comentarioEtapa = etapa ? ` --${etapa}` : '';
            if (!isDevUser) {
                console.log(`${formatDateTime()} | ${numeroLimpo} (${nomeUsuario}) -> "${body.split('\n')[0].substring(0, 30)}${body.length > 30 ? '...' : ''}"${comentarioEtapa}`);
            }

            // Comandos especiais para DEV (ambos números)
            if (isDevUser) {
                console.log(`${formatDateTime()} | 🤖💬 DEV ${numeroLimpo} (${nomeUsuario}) -> "${body.split('\n')[0].substring(0, 30)}${body.length > 30 ? '...' : ''}"${comentarioEtapa}`);

                if (texto === '#testecobranca' || texto === '#teste') {
                    console.log(`Teste DEV executado.`);
                    await dispararCobrancaDoDia(true); // força modo teste
                    return sendMessage(from, '🧪 Teste de cobrança executado! Verifique os logs no terminal.', 1, 2);
                }

                if (texto === '#status') {
                    console.log(`📊 Executando comando de status...`);
                    const data = await loadCadastroData();
                    const hoje = new Date();
                    const mesAtual = MONTHS[hoje.getMonth()];
                    const pendentes = data.filter(pessoa => pessoa[mesAtual] !== '✔');
                    const userType = from === DEV_NUMBER ? 'DEV Principal' : 'DEV Teste';
                    return sendMessage(from,
                        `📊 *STATUS DO SISTEMA* (${userType})\n\n` +
                        `📅 Data: ${formatDateTime()}\n` +
                        `📆 Mês atual: ${mesAtual}\n` +
                        `👥 Total cadastros: ${data.length}\n` +
                        `⏳ Pendentes: ${pendentes.length}\n` +
                        `🧪 Modo: ${MODO_TESTE ? 'TESTE' : 'PRODUÇÃO'}\n` +
                        `🚀 Fila: ${messageQueue.length} mensagens\n\n` +
                        `Comandos disponíveis:\n` +
                        `#teste - Testa cobrança\n` +
                        `#status - Mostra este status\n` +
                        `#fila - Status da fila\n` +
                        `#limpar - Limpa fila\n` +
                        `#testeatestado - Teste notificação atestado\n` +
                        `#processaratestados - Processa atestados verificados`, 1
                        , 2);
                }

                if (texto === '#fila') {
                    const horarioOk = isHorarioComercial() ? '✅ Horário comercial' : '⏰ Fora do horário';
                    const status = spamGuard ? spamGuard.getStatus() : null;

                    if (!status) {
                        return sendMessage(from, '⚠️ Sistema anti-spam não inicializado', 1, 2);
                    }

                    return sendMessage(from,
                        `📋 *STATUS AVANÇADO DO SISTEMA*\n\n` +
                        `📤 Fila total: ${status.queueSize} mensagens\n` +
                        `  ├ Alta prioridade: ${status.queueByPriority.high}\n` +
                        `  ├ Normal: ${status.queueByPriority.normal}\n` +
                        `  └ Baixa: ${status.queueByPriority.low}\n\n` +
                        `📊 Estatísticas:\n` +
                        `  ├ Enviadas: ${status.stats.sent}\n` +
                        `  ├ Bloqueadas: ${status.stats.dropped}\n` +
                        `  ├ Erros: ${status.stats.errors}\n` +
                        `  └ Usuários ativos: ${status.activeUsers}\n\n` +
                        `⏱️ Taxa atual (este minuto): ${status.globalMetrics.sentThisMinute} msgs\n` +
                        `⏱️ Taxa atual (esta hora): ${status.globalMetrics.sentThisHour} msgs\n` +
                        `${horarioOk}`, 1
                        , 2);
                }


                if (texto === '#limpar') {
                    if (spamGuard) {
                        spamGuard.clearQueue();
                        return sendMessage(from, '🧹 Fila de mensagens limpa! Sistema anti-spam resetado.', 1, 2);
                    } else {
                        return sendMessage(from, '⚠️ Sistema anti-spam não ativo', 1, 2);
                    }
                }

                if (texto === '#testeatestado') {
                    console.log(`Teste inteligente de notificação de atestado executado.`);
                    await testarNotificacaoAtestado();
                    return sendMessage(from, '🔍 Verificando se você existe na planilha para teste real... Aguarde a resposta!', 1, 2);
                }

                if (texto === '#processaratestados') {
                    console.log(`Processamento manual de atestados executado.`);
                    await processarAtestadosVerificados();
                    return sendMessage(from, '🔄 Processamento de atestados executado! Verifique os logs.', 1, 2);
                }

                if (texto === '#antispam') {
                    if (spamGuard) {
                        const config = spamGuard.getConfig();
                        return sendMessage(from,
                            `🛡️ *CONFIGURAÇÃO ANTI-SPAM*\n\n` +
                            `⏱️ Delay global: ${config.globalDelay}ms\n` +
                            `⏱️ Delay por usuário: ${config.userDelay}ms\n\n` +
                            `📊 Limites por usuário:\n` +
                            `  ├ Por minuto: ${config.messagesPerMinute}\n` +
                            `  ├ Por hora: ${config.messagesPerHour}\n` +
                            `  └ Por dia: ${config.messagesPerDay}\n\n` +
                            `🌐 Limites globais:\n` +
                            `  ├ Por minuto: ${config.globalMessagesPerMinute}\n` +
                            `  └ Por hora: ${config.globalMessagesPerHour}\n\n` +
                            `⚡ Backoff rápido: ${config.rapidMessageBackoff}ms\n` +
                            `🔄 Limite de erros: ${config.maxConsecutiveErrors}`, 1
                            , 2);
                    } else {
                        return sendMessage(from, '⚠️ Sistema anti-spam não ativo', 1, 2);
                    }
                }
            }

            // Se enviar "menu", volta ao menu principal
            if (texto === 'menu') {
                delete userStates[from];
                return sendMessage(from, MAIN_MENU(userName), 2);
            }

            // Se não estiver em fluxo, interpreta como escolha de menu
            if (!state.step) {
                const opcao = parseInt(texto, 10);
                if (opcao === 3) {
                    // Fluxo alterado: o submenu de ATESTADOS foi temporariamente desativado.
                    // Ao escolher 3 o usuário será direcionado diretamente para o envio por e-mail (opção 2).
                    /*
                    // Código antigo que exibia o submenu (mantido para futura reativação):
                    userStates[from] = { step: 'await_atestado_option', userName };
                    return sendMessage(from, CONTATOS[3], 2);
                    */
                    // Comportamento atual: enviar instruções para envio por e-mail
                    return sendMessage(from,
                        `📧 *ATESTADOS POR EMAIL*\n\n` +
                        `Envie seu atestado para:\n` +
                        `📧 rhfilialcolombo@plansul.com.br\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
                if (opcao === 4) return handleFolhaPonto(from);

                if (opcao === 8) {
                    userStates[from] = { step: 'await_rescisao_option', userName };
                    return sendMessage(from, RESCISAO_SUBMENU(userName), 2);
                }

                if (opcao === 11) return handleTermoCiencia(from);

                const contactMessage = CONTATOS[opcao];
                return sendMessage(from, contactMessage || MAIN_MENU(userName), 2);
            }

            // ========== FLUXO DE ATESTADOS ==========
            if (state.step === 'await_atestado_option') {
                const subOpcao = parseInt(texto, 10);
                if (subOpcao === 1) {
                    // A opção 1 (Enviar atestado via bot) está temporariamente desativada.
                    // Mantemos o código pronto para implementação abaixo, mas por enquanto
                    // redirecionamos o usuário para a opção 2 (envio por e-mail).
                    /*
                    // Código original para processar envio via bot (desativado temporariamente):
                    return handleAtestado(from);
                    */
                    delete userStates[from];
                    return sendMessage(from,
                        `📧 *ATESTADOS POR EMAIL*\n\n` +
                        `A opção de envio pelo bot está temporariamente desativada. Por favor, envie seu atestado por e-mail para:\n` +
                        `📧 rhfilialcolombo@plansul.com.br\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                } else if (subOpcao === 2) {
                    delete userStates[from];
                    return sendMessage(from,
                        `📧 *ATESTADOS POR EMAIL*\n\n` +
                        `Envie seu atestado para:\n` +
                        `📧 rhfilialcolombo@plansul.com.br\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                } else {
                    return sendMessage(from,
                        `❌ *Opção inválida!* Por favor, escolha 1 ou 2.\n\n` +
                        `🏥 *ATESTADOS*\n\n` +
                        `Escolha uma opção:\n` +
                        `1️⃣ 📤 Enviar atestado via bot\n` +
                        `2️⃣ 📧 Enviar por email: rhfilialcolombo@plansul.com.br\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
            }

            // ========== FLUXO DE RESCISÃO ==========
            if (state.step === 'await_rescisao_option') {
                const subOpcao = parseInt(texto, 10);
                const rescisaoMsgFn = RESCISAO_TEXTS[subOpcao];
                if (rescisaoMsgFn) {
                    delete userStates[from];
                    return sendMessage(from, rescisaoMsgFn(userName), 2);
                } else {
                    return sendMessage(from, INVALID_RESCISAO_OPTION_TEXT(userName), 2);
                }
            }

            // ========== CORREÇÃO DE NOME CADASTRADO ==========
            if (state.step === 'await_name_correction') {
                const nomeRecebidoRaw = body.trim();
                const upperReceived = nomeRecebidoRaw.toUpperCase();

                // Validação completa de nome
                if (!isValidName(nomeRecebidoRaw)) {
                    const problemas = [];
                    const upperReceived = nomeRecebidoRaw.toUpperCase();

                    if (nomeRecebidoRaw.length < 2) problemas.push('muito curto');
                    if (nomeRecebidoRaw.split(' ').filter(p => p.length > 0).length < 2) problemas.push('falta sobrenome');
                    if (/\d/.test(nomeRecebidoRaw)) problemas.push('contém números');
                    if (!validNameRegex.test(nomeRecebidoRaw)) problemas.push('caracteres inválidos');
                    if (detectBannedTerms(upperReceived).length > 0) {
                        const banned = detectBannedTerms(upperReceived);
                        problemas.push(`palavras proibidas: ${banned.slice(0, 3).join(', ')}`);
                    }
                    if (nomeRecebidoRaw.length > 80) problemas.push('muito longo');

                    return sendMessage(from,
                        `❌ *Nome inválido, ${formatName(userName)}!*\n\n` +
                        `Problemas encontrados: ${problemas.join(', ')}.\n\n` +
                        `✅ *Nome válido deve ter:*\n` +
                        `• Nome e sobrenome\n` +
                        `• Apenas letras e espaços\n` +
                        `• Sem números ou símbolos\n` +
                        `• Sem cumprimentos ou palavras técnicas\n\n` +
                        `*Exemplo:* João Silva Santos\n\n` +
                        `🔙 Digite *menu* para voltar`
                        , 2);
                }

                // Nome válido: atualiza o cadastro
                const oldName = (await loadCadastroData()).find(r => r.TELEFONE === state.phone)?.NOME || '(desconhecido)';
                const nomeClean = upperReceived;
                const phone = state.phone;
                const data = await loadCadastroData();
                const updated = data.map(r => {
                    if (r.TELEFONE === phone) {
                        r.NOME = nomeClean;
                    }
                    return r;
                });
                await saveCadastroData(updated);

                console.log(
                    `${formatDateTime()} | ✏️ Nome corrigido: "${oldName}" -> "${nomeClean}" (${phone})`
                );
                REPORT_DATA.cadastros.push({
                    Data: formatDateTime(),
                    Nome: nomeClean,
                    Telefone: phone
                });

                delete userStates[from];
                return handleFolhaPonto(from);
            }

            // ========== NOVO CADASTRO DE USUÁRIO ==========
            if (state.step === 'await_name') {
                const nomeRecebidoRaw = body.trim();
                const upperReceived = nomeRecebidoRaw.toUpperCase();

                // Só letras e espaços?
                if (!validNameRegex.test(upperReceived)) {
                    return sendMessage(from,
                        `❌ *Ei ${formatName(userName)}*, esse nome tá com números ou caractere inválido.\n` +
                        `Envie *apenas* seu nome completo com letras e espaços.\n\n` +
                        `🔙 Se quiser voltar: digite *menu*`
                        , 2);
                }

                // Contém termos proibidos?
                const foundBanned = detectBannedTerms(upperReceived);
                if (foundBanned.length > 0) {
                    return sendMessage(from,
                        `❌ *${formatName(userName)}*, seu nome contém ${foundBanned.join(', ')}.\n` +
                        `Envie *apenas* seu nome completo com letras e espaços,\n` +
                        `sem "PDF", sem mês e sem cumprimentos.\n\n` +
                        `🔙 Se quiser voltar: digite *menu*`
                        , 2);
                }

                // Nome OK: cadastra
                const nomeClean = upperReceived;
                const phone = cleanPhone(from);
                const data = await loadCadastroData();
                data.push({ NOME: nomeClean, TELEFONE: phone });
                await saveCadastroData(data);

                console.log(`${formatDateTime()} | 🎉 Novo cadastro: "${nomeClean}" (${phone})`);
                REPORT_DATA.cadastros.push({
                    Data: formatDateTime(),
                    Nome: nomeClean,
                    Telefone: phone
                });

                const mesNovo = currentMonth();
                userStates[from] = {
                    step: 'await_pdf',
                    name: nomeClean,
                    phone,
                    month: mesNovo,
                    userName: state.userName
                };

                return sendMessage(from,
                    `🎉 *Beleza ${formatName(userName)}!* Cadastro realizado ✅\n` +
                    `Agora me manda o arquivo em *PDF* da folha de *${mesNovo}*\n\n` +
                    `🔙  Digite *menu* para voltar`
                    , 2);
            }

            // ========== CONFIRMAÇÃO PARA SUBSTITUIR PDF ==========
            if (state.step === 'confirm_replace') {
                if (texto === '1') { // SIM, substituir
                    console.log(`${formatDateTime()} | 🔄 Substituição confirmada para "${state.name}" - (${state.month})`);
                    userStates[from] = {
                        step: 'await_pdf',
                        name: state.name,
                        phone: state.phone,
                        month: state.month,
                        userName: state.userName
                    };
                    return sendMessage(from,
                        `🔄 *Beleza ${formatName(state.userName)}!* Pode mandar o novo *PDF* de *${state.month}* quando quiser 📄✅\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
                if (texto === '0') { // NÃO, mantém anterior
                    console.log(`${formatDateTime()} | ❌ "${state.name}" manteve arquivo de ${state.month}`);
                    delete userStates[from];
                    REPORT_DATA.naoSubstituicoes.push({
                        Data: formatDateTime(),
                        Nome: state.name,
                        Mes: state.month
                    });
                    return sendMessage(from,
                        `👍 *Entendido!* Seu arquivo anterior de *${state.month}* segue valendo ✅\n` +
                        `Volte sempre que precisar!\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
                return sendMessage(from,
                    `❌ *Não entendi, ${formatName(state.userName)}!* Diga:\n` +
                    `✅ 1 - SIM, substituir\n` +
                    `❌ 0 - NÃO, manter o anterior\n\n` +
                    `🔙  Digite *menu* para voltar`
                    , 2);
            }

            // ========== CONFIRMAÇÃO PARA SUBSTITUIR TERMO DE CIÊNCIA ==========
            if (state.step === 'confirm_replace_termo') {
                if (texto === '1') { // SIM, substituir
                    console.log(`${formatDateTime()} | 🔄 Substituição de termo confirmada para "${state.name}"`);
                    userStates[from] = {
                        step: 'await_termo_pdf',
                        name: state.name,
                        phone: state.phone,
                        userName: state.userName
                    };
                    return sendMessage(from,
                        `🔄 *Beleza ${formatName(state.userName)}!* Pode mandar o novo *PDF* do termo quando quiser 📄✅\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
                if (texto === '0') { // NÃO, mantém anterior
                    console.log(`${formatDateTime()} | ❌ "${state.name}" manteve termo anterior`);
                    delete userStates[from];
                    REPORT_DATA.termosCiencia.push({
                        Data: formatDateTime(),
                        Nome: state.name,
                        Telefone: state.phone,
                        Status: 'Não substituído (manteve anterior)',
                        Arquivo: 'N/A'
                    });
                    return sendMessage(from,
                        `👍 *Entendido!* Seu termo anterior segue valendo ✅\n` +
                        `Volte sempre que precisar!\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
                return sendMessage(from,
                    `❌ *Não entendi, ${formatName(state.userName)}!* Diga:\n` +
                    `✅ 1 - SIM, substituir\n` +
                    `❌ 0 - NÃO, manter o anterior\n\n` +
                    `🔙  Digite *menu* para voltar`
                    , 2);
            }

            // ========== AGUARDANDO PDF ==========
            if (state.step === 'await_pdf') {
                if (texto === 'menu') {
                    delete userStates[from];
                    return sendMessage(from, MAIN_MENU(state.userName), 2);
                }

                // Aceita documentMessage ou documentWithCaptionMessage
                const document = msg.message?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage;

                if (!document) {
                    return sendMessage(from,
                        `❌ *Formato inválido, ${formatName(state.userName)}!* Só aceito arquivos em *PDF* 📄\n` +
                        `Tente novamente enviando o PDF.\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }

                try {
                    if (!document.mimetype?.includes('pdf')) {
                        return sendMessage(from,
                            `❌ *Tipo de arquivo inválido, ${formatName(state.userName)}!* Só PDF.\n` +
                            `🔙 Digite *menu* para voltar.`
                            , 2);
                    }

                    const { name, phone, month, userName: stateUserName } = state;
                    const agora = new Date();
                    let anoAjustado = agora.getFullYear();
                    if (month === 'DEZEMBRO' && agora.getMonth() === 0 && agora.getDate() < 25) {
                        anoAjustado = agora.getFullYear() - 1;
                    }

                    // Grava PDF em PUBLIC_BASE, dentro de {ano}/{mês}

                    const dirDestino = await getPublicDestino([String(anoAjustado), month]);
                    await fs.promises.mkdir(dirDestino, { recursive: true });

                    const baseName = name
                        .replace(/[/\\?%*:|"<>]/g, '')
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '');
                    const filePath = path.join(dirDestino, `${baseName}.pdf`);

                    const existeAntes = fs.existsSync(filePath);

                    // Download do arquivo PDF
                    const media = await downloadMediaMessage(msg, 'buffer');
                    await fs.promises.writeFile(filePath, media);

                    const data = await loadCadastroData();
                    const updated = data.map(r => {
                        if (r.TELEFONE === phone) r[month] = '✔';
                        return r;
                    });
                    await saveCadastroData(updated);

                    const evento = existeAntes ? '🔄 PDF SUBSTITUÍDO' : '📤 PDF ENVIADO';
                    console.log(
                        `${formatDateTime()} | ${evento}: "${name}" - ${month}/${anoAjustado} (${phone})`
                    );
                    if (existeAntes) {
                        REPORT_DATA.substituicoesPDF.push({
                            Data: formatDateTime(),
                            Nome: name,
                            Mes: month,
                            Ano: anoAjustado
                        });
                    } else {
                        REPORT_DATA.enviosPDF.push({
                            Data: formatDateTime(),
                            Nome: name,
                            Mes: month,
                            Ano: anoAjustado
                        });
                    }

                    delete userStates[from];
                    return sendMessage(from,
                        `🎉 *Tudo certo ${formatName(stateUserName)}!* ` +
                        `Sua folha de *${month}* foi ${existeAntes ? 'atualizada' : 'salva'} com sucesso ✅\n` +
                        `Valeu por manter tudo em dia! 📅\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                } catch (err) {
                    console.error('Erro ao processar PDF:', err);
                    return sendMessage(from,
                        `❌ *Ops! Erro ao processar o PDF.* Tente enviar novamente.\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
            }

            // ========== FLUXOS DE ATESTADO ==========

            // Novo cadastro para atestado
            if (state.step === 'await_name_for_atestado') {
                const nomeRecebidoRaw = body.trim();
                const upperReceived = nomeRecebidoRaw.toUpperCase();
                const validNameRegex = /^[A-Za-zÀ-ÿ\s]{2,}$/;

                if (!validNameRegex.test(upperReceived)) {
                    return sendMessage(from,
                        `❌ *Nome inválido, ${formatName(userName)}!* Use apenas letras e espaços.\n\n` +
                        `🔙 Digite *menu* para voltar`
                        , 2);
                }

                const phone = cleanPhone(from);
                const data = await loadCadastroData();
                data.push({ NOME: upperReceived, TELEFONE: phone });
                await saveCadastroData(data);

                console.log(`${formatDateTime()} | 🎉 Novo cadastro para atestado: "${upperReceived}" (${phone})`);

                userStates[from] = { step: 'await_atestado_pdf', name: upperReceived, phone, userName };
                return sendMessage(from,
                    `🎉 *Cadastro realizado, ${formatName(userName)}!*\n\n` +
                    `Agora envie o *PDF do seu atestado*.\n\n` +
                    `⚠️ *IMPORTANTE:* Após o envio, seu atestado será analisado pelo RH e você receberá uma resposta automática.\n\n` +
                    `🔙  Digite *menu* para voltar`
                    , 2);
            }

            // Correção de nome para atestado
            if (state.step === 'await_name_correction_atestado') {
                const nomeRecebidoRaw = body.trim();
                const upperReceived = nomeRecebidoRaw.toUpperCase();
                const validNameRegex = /^[A-Za-zÀ-ÿ\s]{2,}$/;

                if (!validNameRegex.test(upperReceived)) {
                    return sendMessage(from,
                        `❌ *Nome ainda inválido, ${formatName(userName)}!* Use apenas letras e espaços.\n\n` +
                        `🔙 Digite *menu* para voltar`
                        , 2);
                }

                const phone = state.phone;
                const data = await loadCadastroData();
                const updated = data.map(r => {
                    if (r.TELEFONE === phone) r.NOME = upperReceived;
                    return r;
                });
                await saveCadastroData(updated);

                console.log(`${formatDateTime()} | ✏️ Nome corrigido para atestado: "${upperReceived}" (${phone})`);

                userStates[from] = { step: 'await_atestado_pdf', name: upperReceived, phone, userName };
                return sendMessage(from,
                    `✅ *Nome corrigido, ${formatName(userName)}!*\n\n` +
                    `Agora envie o *PDF do seu atestado*.\n\n` +
                    `⚠️ *IMPORTANTE:* Após o envio, seu atestado será analisado pelo RH e você receberá uma resposta automática.\n\n` +
                    `🔙  Digite *menu* para voltar`
                    , 2);
            }



            // Aguardando PDF do atestado
            if (state.step === 'await_atestado_pdf') {
                // Aceita documentMessage ou documentWithCaptionMessage
                const document = msg.message?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage;

                if (!document) {
                    return sendMessage(from,
                        `❌ *Formato inválido, ${formatName(state.userName)}!* Envie o atestado em *PDF* 📄\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }

                try {
                    if (!document.mimetype?.includes('pdf')) {
                        return sendMessage(from,
                            `❌ *Tipo de arquivo inválido, ${formatName(state.userName)}!* Só aceito PDF.\n\n` +
                            `🔙 Digite *menu* para voltar`
                            , 2);
                    }

                    const { name, userName: stateUserName, phone } = state;
                    const agora = new Date();
                    const ano = agora.getFullYear();
                    const mesNome = MONTHS[agora.getMonth()]; // Nome do mês (ex: OUTUBRO)
                    const dia = String(agora.getDate()).padStart(2, '0');

                    // Criar estrutura de pastas: ATESTADOS/ano/NOMES_MES/dia
                    const dirDestino = path.join(ATESTADOS_BASE, String(ano), mesNome, dia);
                    await fs.promises.mkdir(dirDestino, { recursive: true });

                    const baseName = name
                        .replace(/[/\\?%*:|"<>]/g, '')
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '');
                    const filePath = path.join(dirDestino, `${baseName}.pdf`);

                    const existeAntes = fs.existsSync(filePath);

                    // Download do arquivo PDF
                    const media = await downloadMediaMessage(msg, 'buffer');
                    await fs.promises.writeFile(filePath, media);

                    // Atualizar relatório de atestados recebidos
                    await updateAtestadosRecebidos(name, phone, existeAntes);

                    const evento = existeAntes ? '🔄 ATESTADO SUBSTITUÍDO' : '📤 ATESTADO RECEBIDO';
                    console.log(
                        `${formatDateTime()} | ${evento}: "${name}" - ${phone}`
                    );

                    delete userStates[from];
                    return sendMessage(from,
                        `🎉 *Atestado ${existeAntes ? 'atualizado' : 'recebido'} com sucesso, ${formatName(stateUserName)}!*\n\n` +
                        `✅ Seu atestado foi salvo e será analisado pelo RH.\n` +
                        `📲 Você receberá uma resposta automática assim que a análise for concluída.\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                } catch (err) {
                    console.error('Erro ao processar atestado:', err);
                    return sendMessage(from,
                        `❌ *Ops! Erro ao processar o atestado.* Tente enviar novamente.\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
            }

            // ========== FLUXOS DE TERMO DE CIÊNCIA ==========

            // Novo cadastro para termo de ciência
            if (state.step === 'await_name_for_termo') {
                const nomeRecebidoRaw = body.trim();
                const upperReceived = nomeRecebidoRaw.toUpperCase();
                const validNameRegex = /^[A-Za-zÀ-ÿ\s]{2,}$/;

                if (!validNameRegex.test(upperReceived)) {
                    return sendMessage(from,
                        `❌ *Nome inválido, ${formatName(userName)}!* Use apenas letras e espaços.\n\n` +
                        `🔙 Digite *menu* para voltar`
                        , 2);
                }

                const phone = cleanPhone(from);
                const data = await loadCadastroData();
                data.push({ NOME: upperReceived, TELEFONE: phone });
                await saveCadastroData(data);

                console.log(`${formatDateTime()} | 🎉 Novo cadastro para termo de ciência: "${upperReceived}" (${phone})`);

                userStates[from] = { step: 'await_termo_pdf', name: upperReceived, phone, userName };
                return sendMessage(from,
                    `🎉 *Cadastro realizado, ${formatName(userName)}!*\n\n` +
                    `Agora nos encaminhe o *Manual de Normas e Condutas assinado* em formato *PDF*.\n\n` +
                    `🔙  Digite *menu* para voltar`
                    , 2);
            }

            // Correção de nome para termo de ciência
            if (state.step === 'await_name_correction_termo') {
                const nomeRecebidoRaw = body.trim();
                const upperReceived = nomeRecebidoRaw.toUpperCase();
                const validNameRegex = /^[A-Za-zÀ-ÿ\s]{2,}$/;

                if (!validNameRegex.test(upperReceived)) {
                    return sendMessage(from,
                        `❌ *Nome ainda inválido, ${formatName(userName)}!* Use apenas letras e espaços.\n\n` +
                        `🔙 Digite *menu* para voltar`
                        , 2);
                }

                const phone = state.phone;
                const data = await loadCadastroData();
                const updated = data.map(r => {
                    if (r.TELEFONE === phone) r.NOME = upperReceived;
                    return r;
                });
                await saveCadastroData(updated);

                console.log(`${formatDateTime()} | ✏️ Nome corrigido para termo de ciência: "${upperReceived}" (${phone})`);

                userStates[from] = { step: 'await_termo_pdf', name: upperReceived, phone, userName };
                return sendMessage(from,
                    `✅ *Nome corrigido, ${formatName(userName)}!*\n\n` +
                    `Agora nos encaminhe o *Manual de Normas e Condutas assinado* em formato *PDF*.\n\n` +
                    `🔙  Digite *menu* para voltar`
                    , 2);
            }

            // Aguardando PDF do termo de ciência
            if (state.step === 'await_termo_pdf') {
                // Aceita documentMessage ou documentWithCaptionMessage
                const document = msg.message?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage;

                if (!document) {
                    return sendMessage(from,
                        `❌ *Formato inválido, ${formatName(state.userName)}!* Envie o termo em *PDF* 📄\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }

                try {
                    if (!document.mimetype?.includes('pdf')) {
                        return sendMessage(from,
                            `❌ *Tipo de arquivo inválido, ${formatName(state.userName)}!* Só aceito PDF.\n\n` +
                            `🔙 Digite *menu* para voltar`
                            , 2);
                    }

                    const { name, userName: stateUserName, phone } = state;
                    const agora = new Date();

                    // Formatar data apenas (dd-MM-aaaa) para o nome do arquivo
                    const dataSomente = formatDateTime(agora).split(' ')[0].replace(/\//g, '-');

                    // Nome base do usuário (sem caracteres inválidos)
                    const baseName = name
                        .replace(/[/\\?%*:|"<>]/g, '')
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '');

                    // Salvar diretamente dentro de TERMOS_CIENCIA_BASE (sem subpastas por usuário)
                    let dirDestino = TERMOS_CIENCIA_BASE;
                    try {
                        await fs.promises.mkdir(dirDestino, { recursive: true });
                    } catch (mkdirErr) {
                        logEvento({
                            tipo: 'ERRO',
                            mensagem: 'Falha ao criar diretório TERMOS_CIENCIA_BASE (fallback local)',
                            nome: name,
                            telefone: phone,
                            extra: mkdirErr.message
                        });

                        // Fallback local
                        dirDestino = path.join(appPath, 'TERMOS_CIENCIA_LOCAL');
                        await fs.promises.mkdir(dirDestino, { recursive: true });
                    }

                    const fileName = `${baseName}_${dataSomente}.pdf`;
                    const filePath = path.join(dirDestino, fileName);

                    // Verificar se EXISTE TERMO ANTERIOR (qualquer data)
                    let existeAntes = false;
                    try {
                        if (fs.existsSync(dirDestino)) {
                            const arquivos = fs.readdirSync(dirDestino);
                            const arquisAntigosDoUsuario = arquivos.filter(arquivo =>
                                arquivo.startsWith(baseName) && arquivo.endsWith('.pdf')
                            );
                            existeAntes = arquisAntigosDoUsuario.length > 0;

                            // Se existem arquivos antigos, deletar TODOS eles (substituição completa)
                            if (existeAntes) {
                                for (const arquivoAntigo of arquisAntigosDoUsuario) {
                                    try {
                                        await fs.promises.unlink(path.join(dirDestino, arquivoAntigo));
                                    } catch (unlinkErr) {
                                        logEvento({
                                            tipo: 'AVISO',
                                            mensagem: `Não consegui deletar arquivo antigo: ${arquivoAntigo}`,
                                            nome: name,
                                            telefone: phone,
                                            extra: unlinkErr.message
                                        });
                                    }
                                }
                            }
                        }
                    } catch (searchErr) {
                        logEvento({
                            tipo: 'AVISO',
                            mensagem: 'Erro ao procurar arquivos antigos do termo',
                            nome: name,
                            telefone: phone,
                            extra: searchErr.message
                        });
                    }

                    // Download do arquivo PDF (salvar o novo)
                    const media = await downloadMediaMessage(msg, 'buffer');
                    await fs.promises.writeFile(filePath, media);

                    // Registrar no relatório (marca se foi substituído ou recebido)
                    REPORT_DATA.termosCiencia.push({
                        Data: formatDateTime(agora),
                        Nome: name,
                        Telefone: phone,
                        Status: existeAntes ? 'Substituído' : 'Recebido com sucesso',
                        Arquivo: fileName
                    });

                    const evento = existeAntes ? '🔄 TERMO SUBSTITUÍDO' : '📤 TERMO RECEBIDO';
                    logEvento({
                        tipo: 'TERMO_CIENCIA',
                        mensagem: evento,
                        nome: name,
                        telefone: phone,
                        extra: fileName
                    });

                    delete userStates[from];
                    return sendMessage(from,
                        `✅ *Perfeito, ${formatName(stateUserName)}!*\n\n` +
                        `O seu documento foi recebido e será analisado.\n` +
                        `Agradecemos o envio.\n\n` +
                        `Até logo 👋\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                } catch (err) {
                    logEvento({
                        tipo: 'ERRO',
                        mensagem: 'Erro ao processar termo de ciência',
                        nome: state.name,
                        telefone: state.phone,
                        extra: err.message
                    });

                    // Registrar erro no relatório
                    REPORT_DATA.termosCiencia.push({
                        Data: formatDateTime(),
                        Nome: state.name,
                        Telefone: state.phone,
                        Status: 'Erro ao salvar',
                        Arquivo: 'N/A'
                    });

                    return sendMessage(from,
                        `❌ *Houve um erro ao salvar seu documento.*\n\n` +
                        `Tente novamente mais tarde. ⚠️\n\n` +
                        `🔙  Digite *menu* para voltar`
                        , 2);
                }
            }
        }
    });
}

// ========== FUNÇÕES DE RELATÓRIO DE ATESTADOS ==========
async function updateAtestadosRecebidos(nome, telefone, foiSubstituido) {
    try {
        // Criar pasta de atestados se não existir
        if (!fs.existsSync(ATESTADOS_BASE)) {
            fs.mkdirSync(ATESTADOS_BASE, { recursive: true });
        }

        let workbook;
        const agora = new Date();
        const mesNome = getMesNome(agora.getMonth() + 1);
        const ano = agora.getFullYear();
        const abaName = `${mesNome} ${ano}`;

        // Tentar abrir planilha existente ou criar nova
        if (fs.existsSync(ATESTADOS_RECEBIDOS_PATH)) {
            workbook = XLSX.readFile(ATESTADOS_RECEBIDOS_PATH);
        } else {
            workbook = XLSX.utils.book_new();
        }

        // Verificar se a aba do mês existe
        let worksheet;
        if (workbook.Sheets[abaName]) {
            worksheet = workbook.Sheets[abaName];
        } else {
            // Criar nova aba com cabeçalhos
            const headers = [
                ['Nome', 'Telefone', 'Data Entrega', 'Verificado', 'Por que Indeferido']
            ];
            worksheet = XLSX.utils.aoa_to_sheet(headers);
            XLSX.utils.book_append_sheet(workbook, worksheet, abaName);
        }

        // Converter worksheet para array para facilitar manipulação
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Procurar se já existe entrada para esta pessoa
        let linhaExistente = -1;
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === nome && data[i][1] === telefone) {
                linhaExistente = i;
                break;
            }
        }

        const dataEntrega = formatDateTime().split(' ')[0]; // Só a data, sem hora
        const novaLinha = [nome, telefone, dataEntrega, 'Não', ''];

        if (linhaExistente >= 0) {
            // Atualizar linha existente (mantém verificação e motivo se já existirem)
            data[linhaExistente][2] = dataEntrega; // Atualiza data de entrega
        } else {
            // Adicionar nova linha
            data.push(novaLinha);
        }

        // Reconverter para worksheet e salvar
        const newWorksheet = XLSX.utils.aoa_to_sheet(data);
        workbook.Sheets[abaName] = newWorksheet;
        XLSX.writeFile(workbook, ATESTADOS_RECEBIDOS_PATH);

        console.log(`${formatDateTime()} | 📊 Relatório de recebidos atualizado: ${nome}`);

    } catch (error) {
        console.error('Erro ao atualizar relatório de recebidos:', error);
    }
}

function getMesNome(numeroMes) {
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril',
        'Maio', 'Junho', 'Julho', 'Agosto',
        'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[numeroMes - 1] || 'Mês';
}

// ========== SISTEMA DE NOTIFICAÇÕES DE ATESTADOS ==========
async function processarAtestadosVerificados() {
    try {
        if (!fs.existsSync(ATESTADOS_RECEBIDOS_PATH)) {
            logEvento({ tipo: 'ATESTADO', mensagem: 'Arquivo de recebidos não encontrado para processamento' });
            return;
        }

        const workbook = XLSX.readFile(ATESTADOS_RECEBIDOS_PATH);
        const sheetNames = Object.keys(workbook.Sheets);
        let totalProcessados = 0;
        let pessoasParaNotificar = [];

        for (const sheetName of sheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Procurar por linhas com verificação "deferido" ou "indeferido"
            for (let i = 1; i < data.length; i++) {
                const linha = data[i];
                if (!linha || linha.length < 4) continue;

                const [nome, telefone, dataEntrega, verificado, motivo] = linha;

                if (verificado && (verificado.toLowerCase() === 'deferido' || verificado.toLowerCase() === 'indeferido')) {
                    pessoasParaNotificar.push({
                        nome,
                        telefone,
                        verificado: verificado.toLowerCase(),
                        motivo: motivo || '',
                        linha: i,
                        aba: sheetName
                    });
                }
            }
        }

        if (pessoasParaNotificar.length === 0) {
            logEvento({ tipo: 'ATESTADO', mensagem: 'Nenhum atestado verificado encontrado para notificar' });
            return;
        }

        // Verificar se estamos em ambiente de desenvolvimento
        const numeroAtual = sock?.user?.id?.split(':')[0];
        const isDev = DEV_NUMBERS.includes(numeroAtual);

        if (isDev) {
            logEvento({ tipo: 'ATESTADO', mensagem: `Ambiente DEV: ${pessoasParaNotificar.length} pessoas seriam notificadas, mas disparos desabilitados` });
            return;
        }

        logEvento({ tipo: 'ATESTADO', mensagem: `Iniciando notificações para ${pessoasParaNotificar.length} pessoas` });

        // Calcular intervalo inteligente entre mensagens (9h às 18h = 9 horas = 32400 segundos)
        const horasDisponiveis = 9;
        const segundosDisponiveis = horasDisponiveis * 3600;
        const intervaloEntreMensagens = Math.max(30, Math.floor(segundosDisponiveis / pessoasParaNotificar.length)) * 1000;

        // Calcular quando iniciar (9h se estivermos antes das 9h, ou agora se já estivermos no horário)
        const agora = new Date();
        const horaAtual = agora.getHours();
        let inicioDisparos = new Date();

        if (horaAtual < 9) {
            inicioDisparos.setHours(9, 0, 0, 0);
        } else if (horaAtual >= 18) {
            // Se já passou das 18h, agenda para o próximo dia às 9h
            inicioDisparos.setDate(inicioDisparos.getDate() + 1);
            inicioDisparos.setHours(9, 0, 0, 0);
        }

        const delayInicial = inicioDisparos.getTime() - Date.now();

        // Enviar notificações com intervalo calculado, começando no horário adequado
        for (let i = 0; i < pessoasParaNotificar.length; i++) {
            const pessoa = pessoasParaNotificar[i];

            setTimeout(async () => {
                // Verificar novamente se estamos em horário comercial no momento do envio
                const agoraEnvio = new Date();
                const horaEnvio = agoraEnvio.getHours();

                if (horaEnvio >= 9 && horaEnvio < 18) {
                    await enviarNotificacaoAtestado(pessoa);

                    // Após enviar, mover para planilha de processados
                    await moverParaProcessados(pessoa);
                } else {
                    logEvento({
                        tipo: 'ATESTADO',
                        mensagem: `Envio cancelado (fora do horário): ${pessoa.nome}`
                    });
                }

            }, delayInicial + (i * intervaloEntreMensagens));
        }

        totalProcessados = pessoasParaNotificar.length;
        logEvento({
            tipo: 'ATESTADO',
            mensagem: `Processamento iniciado: ${totalProcessados} notificações agendadas com intervalo de ${intervaloEntreMensagens / 1000}s`
        });

    } catch (error) {
        console.error('Erro ao processar atestados verificados:', error);
        logEvento({ tipo: 'ERRO', mensagem: `Erro no processamento de atestados: ${error.message}` });
    }
}

async function enviarNotificacaoAtestado(pessoa) {
    try {
        const { nome, telefone, verificado, motivo } = pessoa;
        const chatId = `${telefone}@s.whatsapp.net`;

        let mensagem;
        if (verificado === 'deferido') {
            mensagem = `✅ *Atestado Aprovado!*\n\n` +
                `Olá *${nome}*!\n\n` +
                `Seu atestado foi analisado e *APROVADO* pelo RH.\n\n` +
                `✅ Tudo certo com sua documentação!\n\n` +
                `Para dúvidas: (41) 3087-2573`;
        } else {
            const motivoTexto = motivo ? ` ${motivo}` : ' documentação não atende aos critérios necessários';
            mensagem = `❌ *Atestado Não Aprovado*\n\n` +
                `Olá *${nome}*!\n\n` +
                `Seu atestado não foi aprovado porque${motivoTexto}.\n\n` +
                `📞 Entre em contato com (41) 3087-2573 para mais informações.`;
        }

        await queueMessage(chatId, mensagem, 1);

        logEvento({
            tipo: 'ATESTADO',
            mensagem: `Notificação enviada: ${nome} - ${verificado}`,
            telefone: telefone
        });

    } catch (error) {
        console.error('Erro ao enviar notificação de atestado:', error);
        logEvento({
            tipo: 'ERRO',
            mensagem: `Erro ao notificar ${pessoa.nome}: ${error.message}`
        });
    }
}

async function moverParaProcessados(pessoa) {
    try {
        // Remover da planilha de recebidos
        await removerDeRecebidos(pessoa);

        // Adicionar na planilha de processados
        await adicionarAProcessados(pessoa);

        logEvento({
            tipo: 'ATESTADO',
            mensagem: `Movido para processados: ${pessoa.nome}`
        });

    } catch (error) {
        console.error('Erro ao mover para processados:', error);
    }
}

async function removerDeRecebidos(pessoa) {
    try {
        const workbook = XLSX.readFile(ATESTADOS_RECEBIDOS_PATH);
        const worksheet = workbook.Sheets[pessoa.aba];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Remover a linha específica
        data.splice(pessoa.linha, 1);

        // Recriar worksheet e salvar
        const newWorksheet = XLSX.utils.aoa_to_sheet(data);
        workbook.Sheets[pessoa.aba] = newWorksheet;
        XLSX.writeFile(workbook, ATESTADOS_RECEBIDOS_PATH);

    } catch (error) {
        console.error('Erro ao remover de recebidos:', error);
    }
}

async function adicionarAProcessados(pessoa) {
    try {
        let workbook;

        // Tentar abrir planilha existente ou criar nova
        if (fs.existsSync(ATESTADOS_PROCESSADOS_PATH)) {
            workbook = XLSX.readFile(ATESTADOS_PROCESSADOS_PATH);
        } else {
            workbook = XLSX.utils.book_new();
        }

        // Verificar se a aba existe
        let worksheet;
        if (workbook.Sheets[pessoa.aba]) {
            worksheet = workbook.Sheets[pessoa.aba];
        } else {
            // Criar nova aba com cabeçalhos
            const headers = [
                ['Nome', 'Telefone', 'Data Entrega', 'Verificado', 'Por que Indeferido', 'Data Processamento']
            ];
            worksheet = XLSX.utils.aoa_to_sheet(headers);
            XLSX.utils.book_append_sheet(workbook, worksheet, pessoa.aba);
        }

        // Converter worksheet para array
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Adicionar nova linha
        const dataProcessamento = formatDateTime().split(' ')[0];
        const novaLinha = [
            pessoa.nome,
            pessoa.telefone,
            '', // Data entrega será preenchida se necessário
            pessoa.verificado,
            pessoa.motivo,
            dataProcessamento
        ];

        data.push(novaLinha);

        // Reconverter para worksheet e salvar
        const newWorksheet = XLSX.utils.aoa_to_sheet(data);
        workbook.Sheets[pessoa.aba] = newWorksheet;
        XLSX.writeFile(workbook, ATESTADOS_PROCESSADOS_PATH);

    } catch (error) {
        console.error('Erro ao adicionar a processados:', error);
    }
}

// ========== COMANDO DE TESTE PARA DEV ==========
async function testarNotificacaoAtestado() {
    if (!sock) return;

    const numeroAtual = sock.user.id.split(':')[0];
    const isDev = DEV_NUMBERS.includes(numeroAtual);

    if (!isDev) {
        logEvento({ tipo: 'ERRO', mensagem: 'Comando de teste só funciona em ambiente DEV' });
        return;
    }

    logEvento({ tipo: 'DEV', mensagem: 'Verificando se DEV existe na planilha de atestados para teste real...' });

    try {
        // Debug: Mostrar caminhos e verificações
        logEvento({ tipo: 'DEBUG', mensagem: `ATESTADOS_BASE: ${ATESTADOS_BASE}` });
        logEvento({ tipo: 'DEBUG', mensagem: `ATESTADOS_PROCESSADOS_PATH: ${ATESTADOS_PROCESSADOS_PATH}` });
        logEvento({ tipo: 'DEBUG', mensagem: `Pasta ATESTADOS_BASE existe: ${fs.existsSync(ATESTADOS_BASE)}` });

        // Verificar se existe planilha de atestados processados
        if (!fs.existsSync(ATESTADOS_PROCESSADOS_PATH)) {
            logEvento({ tipo: 'AVISO', mensagem: 'Planilha de atestados não encontrada. Enviando mensagem de status.' });

            // Listar arquivos na pasta para debug
            if (fs.existsSync(ATESTADOS_BASE)) {
                const arquivos = fs.readdirSync(ATESTADOS_BASE);
                logEvento({ tipo: 'DEBUG', mensagem: `Arquivos na pasta ATESTADOS: ${arquivos.join(', ')}` });
            }

            queueMessage(DEV_NUMBER,
                `🏥 *TESTE DE ATESTADO - DEBUG*\n\n` +
                `❌ Planilha não encontrada em:\n${ATESTADOS_PROCESSADOS_PATH}\n\n` +
                `📁 Pasta base: ${ATESTADOS_BASE}\n` +
                `📂 Pasta existe: ${fs.existsSync(ATESTADOS_BASE) ? 'SIM' : 'NÃO'}\n\n` +
                `${fs.existsSync(ATESTADOS_BASE) ? `📋 Arquivos: ${fs.readdirSync(ATESTADOS_BASE).join(', ') || 'Pasta vazia'}` : '❌ Pasta não existe'}\n\n` +
                `ℹ️ Crie alguns atestados primeiro para testar o sistema.`, 1
            );
            return;
        }

        // Ler planilha de atestados
        const workbook = XLSX.readFile(ATESTADOS_PROCESSADOS_PATH);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Procurar por números de DEV na planilha
        let devEncontrado = null;
        const numerosDevParaBuscar = DEV_NUMBERS; // ['554191852345', '554188386407']

        for (let i = 1; i < dados.length; i++) { // Pula cabeçalho
            const linha = dados[i];
            if (!linha || linha.length < 3) continue;

            const telefone = String(linha[2] || '').replace(/\D/g, ''); // Remove caracteres não numéricos

            // Verifica se algum dos números DEV está na planilha
            for (const numeroDev of numerosDevParaBuscar) {
                if (telefone.includes(numeroDev) || numeroDev.includes(telefone)) {
                    devEncontrado = {
                        nome: linha[1] || 'DEV TESTE',
                        telefone: numeroDev,
                        verificado: linha[3] || 'pendente',
                        motivo: linha[4] || '',
                        linha: i + 1
                    };
                    break;
                }
            }

            if (devEncontrado) break;
        }

        if (devEncontrado) {
            logEvento({
                tipo: 'DEV',
                mensagem: `DEV encontrado na planilha: ${devEncontrado.nome} (linha ${devEncontrado.linha})`
            });

            // Enviar notificação real usando os dados da planilha
            await enviarNotificacaoAtestado(devEncontrado);

            queueMessage(DEV_NUMBER,
                `✅ *TESTE REAL DE ATESTADO*\n\n` +
                `👤 Encontrado na planilha: ${devEncontrado.nome}\n` +
                `📱 Telefone: ${devEncontrado.telefone}\n` +
                `📄 Status: ${devEncontrado.verificado}\n` +
                `📝 Motivo: ${devEncontrado.motivo || 'Não informado'}\n\n` +
                `✅ Notificação enviada com dados reais da planilha!`, 1
            );

        } else {
            logEvento({ tipo: 'AVISO', mensagem: 'DEV não encontrado na planilha de atestados' });

            queueMessage(DEV_NUMBER,
                `⚠️ *TESTE DE ATESTADO - DEV NÃO ENCONTRADO*\n\n` +
                `❌ Seu número não foi encontrado na planilha de atestados.\n\n` +
                `📋 Planilha verificada: ${path.basename(ATESTADOS_PROCESSADOS_PATH)}\n` +
                `🔍 Números buscados: ${DEV_NUMBERS.join(', ')}\n\n` +
                `💡 Para testar, cadastre um atestado primeiro.`, 1
            );
        }

    } catch (error) {
        logEvento({ tipo: 'ERRO', mensagem: `Erro no teste de atestado: ${error.message}` });

        queueMessage(DEV_NUMBER,
            `❌ *ERRO NO TESTE DE ATESTADO*\n\n` +
            `Erro: ${error.message}\n\n` +
            `Verifique os logs para mais detalhes.`, 1
        );
    }
}

// Inicia o bot
console.log(`${formatDateTime()} | === BOT FOLHA PONTO (BAILEYS) ===`);
console.log(`${formatDateTime()} | Iniciando sistema...`);
// ========== INICIALIZAÇÃO PRINCIPAL ==========

async function inicializarBot() {
    try {
        console.log('\n🚀 INICIANDO BOT FOLHA PONTO - XAXIM');
        console.log('='.repeat(50));

        // Verificar se pasta auth existe (no diretório correto)
        const authPath = path.join(appPath, 'auth_info_baileys');
        if (!fs.existsSync(authPath)) {
            fs.mkdirSync(authPath, { recursive: true });
            console.log(`📁 Pasta de autenticação criada: ${authPath}`);
        }

        // Verificar permissões de escrita
        try {
            const testFile = path.join(appPath, 'test_write.tmp');
            fs.writeFileSync(testFile, 'teste');
            fs.unlinkSync(testFile);
            console.log('✅ Permissões de escrita OK');
        } catch (error) {

            console.log('⚠️ Permissões limitadas, mas continuando...');
            console.log(`   Erro: ${error.message}`);
        }

        // Inicializar planilhas
        console.log('📊 Inicializando planilhas...');
        await initAllExcels();
        console.log('✅ Planilhas inicializadas');

        // Conectar ao WhatsApp
        console.log('📱 Conectando ao WhatsApp...');
        await connectToWhatsApp();

    } catch (error) {
        console.error('❌ Erro na inicialização:', error.message);
        console.error('Stack trace:', error.stack);
        console.log('\n⏸️ TERMINAL PAUSADO - Pressione ENTER para fechar...');
        if (isInteractive()) {
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            process.stdin.once('data', () => {
                console.log('👋 Encerrando o bot...');
                process.exit(1);
            });
        } else {
            console.log('Non-interactive environment detected; exiting without pause.');
            process.exit(1);
        }
    }
}

// Iniciar o bot
inicializarBot();

// Manter o processo vivo
process.stdin.resume();

// Tratamento de erros já configurado acima na seção de inicialização
