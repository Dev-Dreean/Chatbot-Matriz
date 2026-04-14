/**
 * ============================================================================
 * REGRAS DE NOMENCLATURA E IDENTIFICAÇÃO DE USUÁRIOS
 * ============================================================================
 * 
 * REGRA #1: Nunca use "colega"
 * REGRA #2: Use sempre pushName (nome WhatsApp) ou cadastro
 * REGRA #3: Se sem nome, use rota alternativa SEM mencionar nome
 * REGRA #4: Repescagem de mensagens não lidas ao reiniciar
 * REGRA #5: Broadcast é status@broadcast - ignorar ou rota especial
 */

// ============================================================================
// FUNÇÃO: Obter nome do usuário com segurança
// ============================================================================
// Compatibilidade com Cloud API: tenta usar o módulo de envio se disponível
let _cloudApi = {};
try {
    _cloudApi = require('./lib/whatsapp-cloud-api');
} catch (e) {
    // módulo não disponível — tudo bem, usamos socket se fornecido
}

async function sendViaAvailable(remoteJid, text, socket) {
    // Prioriza: sendWhatsAppText -> global.queueMessage -> socket.sendMessage
    try {
        if (_cloudApi && typeof _cloudApi.sendWhatsAppText === 'function') {
            return await _cloudApi.sendWhatsAppText(remoteJid, text);
        }

        if (global && typeof global.queueMessage === 'function') {
            return await global.queueMessage(remoteJid, text, 2);
        }

        if (socket && typeof socket.sendMessage === 'function') {
            // Baileys socket compatibility
            return await socket.sendMessage(remoteJid, { text });
        }

        console.warn('Nenhum método de envio disponível para', remoteJid);
        return false;
    } catch (err) {
        console.error('Erro ao enviar via disponível:', err.message);
        return false;
    }
}

function getUserName(msg) {
    const { pushName, key } = msg;
    const { remoteJid } = key;

    // ❌ NUNCA use "colega"
    // ✅ SEMPRE use pushName primeiro
    if (pushName && pushName.trim()) {
        return pushName.trim();
    }

    // Se é broadcast, retorna null (veja regra de broadcast)
    if (remoteJid === 'status@broadcast') {
        return null;
    }

    // Se chegou aqui, não tem nome
    return null;
}

// ============================================================================
// FUNÇÃO: Verificar se é broadcast
// ============================================================================
function isBroadcast(msg) {
    const { key } = msg;
    const { remoteJid, participant } = key;

    return remoteJid === 'status@broadcast' || msg.broadcast === true;
}

// ============================================================================
// FUNÇÃO: Tratamento de usuário SEM NOME
// ============================================================================
async function handleNoNameUser(msg, socket) {
    const { key } = msg;
    const { remoteJid } = key;

    // Enviar mensagem sem mencionar nome
    const noNameMenu = `Olá! 👋

Bem-vindo ao assistente Plansul.
Não conseguimos identificar seu nome no cadastro.

Para continuar, por favor escolha uma opção:

1️⃣ - Fazer cadastro / atualizar dados
2️⃣ - Voltar ao menu principal

Responda com 1 ou 2`;

    // Resposta instantânea (sem mencionar nome) - usa camada disponível (Cloud API / queue / socket)
    try {
        await sendViaAvailable(remoteJid, noNameMenu, socket);
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem para usuário sem nome:', error.message);
    }

    // Armazenar estado: usuário sem cadastro
    if (!global.userStates) global.userStates = new Map();
    global.userStates.set(remoteJid, {
        stage: 'NO_NAME',
        timestamp: Date.now(),
        needsCadastro: true
    });
}

// ============================================================================
// FUNÇÃO: Tratamento de BROADCAST
// ============================================================================
async function handleBroadcast(msg, socket) {
    const { pushName, key } = msg;
    const { remoteJid } = key;

    console.log(`\n🔔 BROADCAST RECEBIDO:`);
    console.log(`   Nome: ${pushName}`);
    console.log(`   Tipo: status@broadcast`);
    console.log(`   Horário: ${new Date().toLocaleString('pt-BR')}`);

    // OPÇÃO 1: Ignorar broadcasts (geralmente é status/stories)
    // return;

    // OPÇÃO 2: Responder com rota especial
    const broadcastResponse = `Olá ${pushName || 'usuário'}!

Recebemos seu status. Para dúvidas ou solicitações, entre em contato direto! 📞

Responda esta mensagem.`;

    try {
        await sendViaAvailable(remoteJid, broadcastResponse, socket);
    } catch (error) {
        console.error('❌ Erro ao enviar resposta de broadcast:', error.message);
    }
}

// ============================================================================
// FUNÇÃO: Validar nome antes de usar
// ============================================================================
function shouldUseName(msg, requiresCadastro = false) {
    const name = getUserName(msg);
    const { key } = msg;
    const { remoteJid } = key;

    // Se é broadcast, NUNCA use nome na resposta
    if (isBroadcast(msg)) {
        return false;
    }

    // Se não tem nome e exige cadastro, NÃO use
    if (!name && requiresCadastro) {
        return false;
    }

    // Se tem nome, use
    if (name) {
        return true;
    }

    return false;
}

// ============================================================================
// FUNÇÃO: Repescagem de mensagens não lidas
// ============================================================================
async function rescueUnreadMessages(socket) {
    console.log('\n📥 INICIANDO REPESCAGEM DE MENSAGENS NÃO LIDAS...');

    try {
        // Usar store.chats ao invés de getAllChats()
        if (!socket.store || !socket.store.chats) {
            console.log('⚠️ Store não disponível ainda, pulando repescagem');
            return 0;
        }

        let unreadCount = 0;
        const chatsMap = socket.store.chats;

        // Iterar sobre os chats armazenados
        for (const [chatId, chatData] of chatsMap.entries()) {
            if (chatData.unreadCount > 0) {
                console.log(`   Chat: ${chatData.name || chatId}`);
                console.log(`   Mensagens não lidas: ${chatData.unreadCount}`);
                unreadCount += chatData.unreadCount;

                // Marcar como lido
                try {
                    await socket.readMessages(chatData.messages.map(msg => msg.key));
                } catch (readError) {
                    // Continuar mesmo se falhar em marcar como lido
                }
            }
        }

        console.log(`✅ Total de mensagens verificadas: ${unreadCount}`);

        if (unreadCount > 0) {
            console.log(`   ⚠️ ${unreadCount} mensagens estavam não lidas`);
        }

        return unreadCount;
    } catch (error) {
        console.error('❌ Erro na repescagem:', error.message);
        return 0;
    }
}

// ============================================================================
// FUNÇÃO: Construir mensagem com nome (SEGURA)
// ============================================================================
function buildMessageWithName(msg, template) {
    const name = getUserName(msg);
    const { key } = msg;

    // Se é broadcast, retorna template sem nome
    if (isBroadcast(msg)) {
        return template.replace(/{NAME}/g, 'usuário');
    }

    // Se tem nome, usa
    if (name) {
        return template.replace(/{NAME}/g, name);
    }

    // Se não tem nome, retorna template genérico
    return template.replace(/{NAME}/g, 'olá');
}

// ============================================================================
// INTEGRAÇÃO NO BOT - Exemplo de uso
// ============================================================================
/*

// NO SEU EVENT LISTENER:

socket.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    
    // 1. Verificar se é broadcast
    if (isBroadcast(msg)) {
        await handleBroadcast(msg, socket);
        return;
    }
    
    // 2. Obter nome com segurança
    const userName = getUserName(msg);
    
    // 3. Se não tem nome, rota especial
    if (!userName) {
        await handleNoNameUser(msg, socket);
        return;
    }
    
    // 4. Se tem nome, usar no template
    const response = buildMessageWithName(msg, 
        `Olá {NAME}! Bem-vindo ao assistente Plansul 🤖`);
    
    await instantSendMessage(msg.key.remoteJid, response, socket);
});

// AO INICIAR O BOT:
socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'open') {
        console.log('✅ Bot conectado!');
        
        // Repescagem de mensagens não lidas
        const rescued = await rescueUnreadMessages(socket);
        
        if (rescued > 0) {
            console.log(`\n📢 ${rescued} mensagens foram reenviadas para processamento`);
        }
    }
});

*/

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    getUserName,
    isBroadcast,
    handleNoNameUser,
    handleBroadcast,
    shouldUseName,
    rescueUnreadMessages,
    buildMessageWithName
};
