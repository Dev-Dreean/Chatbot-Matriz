/**
 * 🔄 CONVERSATION STATE MANAGER
 * 
 * Sistema de persistência de estado de conversa
 * Rastreia em qual etapa do fluxo cada usuário está
 * Recupera mensagens perdidas quando o bot reinicia
 * 
 * Estado salvo em: conversation-state.json
 */

const fs = require('fs');
const path = require('path');

// Arquivo de persistência
const STATE_FILE = path.join(__dirname, 'conversation-state.json');

/**
 * Estrutura de um estado de conversa:
 * {
 *   "{{DEV_NUMBER_1}}@s.whatsapp.net": {
 *     "userJid": "{{DEV_NUMBER_1}}@s.whatsapp.net",
 *     "userName": "João Silva",
 *     "currentStatus": "AGUARDANDO_PDF",        // Status atual do fluxo
 *     "currentFlow": "UPLOAD_FOLHA_PONTO",      // Qual fluxo ele está
 *     "flowData": { ... },                       // Dados do fluxo (contexto)
 *     "lastMessageTime": "2025-10-28T14:52:06", // Quando foi a última mensagem
 *     "pendingMessages": [ ... ],                // Mensagens que chegaram enquanto bot tava down
 *     "attempts": 1,                             // Quantas tentativas de responder
 *     "createdAt": "2025-10-28T14:30:00"        // Quando entrou nesse estado
 *   }
 * }
 */

class ConversationStateManager {
    constructor() {
        this.states = this.loadStates();
        this.csvUpdateQueue = []; // Fila de atualizações se CSV estiver travado
        this.csvUpdateInterval = setInterval(() => this.processCsvQueue(), 5000); // Tenta a cada 5s
    }

    /**
     * Carrega o arquivo de estados do disco
     */
    loadStates() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = fs.readFileSync(STATE_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (err) {
            console.error('⚠️ Erro ao carregar conversation-state.json:', err.message);
        }
        return {};
    }

    /**
     * Salva o arquivo de estados no disco
     */
    saveStates() {
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(this.states, null, 2), 'utf8');
            this.exportToCSV(); // Atualiza CSV automaticamente
        } catch (err) {
            console.error('⚠️ Erro ao salvar conversation-state.json:', err.message);
        }
    }

    /**
     * Exporta para CSV para visualizar em planilha
     */
    exportToCSV() {
        try {
            const CSV_FILE = path.join(__dirname, 'conversation-states.csv');
            
            // Cabeçalho
            const headers = [
                'userJid',
                'userName',
                'currentStatus',
                'currentFlow',
                'mes',
                'ano',
                'tentativas',
                'lastMessageTime',
                'createdAt',
                'pendingMessagesCount'
            ];

            // Linhas
            const rows = Object.keys(this.states).map(jid => {
                const state = this.states[jid];
                return [
                    jid,
                    state.userName || '',
                    state.currentStatus || '',
                    state.currentFlow || '',
                    state.flowData?.mes || '',
                    state.flowData?.ano || '',
                    state.attempts || 0,
                    state.lastMessageTime || '',
                    state.createdAt || '',
                    state.pendingMessages?.length || 0
                ];
            });

            // Montar CSV
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            fs.writeFileSync(CSV_FILE, csvContent, 'utf8');
        } catch (err) {
            // Se falhar (arquivo travado), adiciona à fila
            if (err.code === 'EACCES' || err.message.includes('EACCES')) {
                this.csvUpdateQueue.push(true);
                // Silencioso - não reclama se arquivo tá aberto
            } else {
                console.error('⚠️ Erro ao exportar CSV:', err.message);
            }
        }
    }

    /**
     * Processa fila de atualizações CSV se estiver travado
     */
    processCsvQueue() {
        if (this.csvUpdateQueue.length > 0) {
            this.csvUpdateQueue = [];
            this.exportToCSV();
        }
    }

    /**
     * Salva o estado de um usuário
    * @param {string} userJid - ID do usuário (ex: {{DEV_NUMBER_1}}@s.whatsapp.net)
     * @param {string} userName - Nome do usuário
     * @param {string} status - Status atual (ex: AGUARDANDO_PDF, CONFIRMANDO_DADOS)
     * @param {string} flow - Qual fluxo ele está
     * @param {object} flowData - Dados contextuais do fluxo
     */
    saveUserState(userJid, userName, status, flow, flowData = {}) {
        this.states[userJid] = {
            userJid,
            userName: userName || 'Usuário Desconhecido',
            currentStatus: status,
            currentFlow: flow,
            flowData,
            lastMessageTime: new Date().toISOString(),
            pendingMessages: this.states[userJid]?.pendingMessages || [],
            attempts: (this.states[userJid]?.attempts || 0) + 1,
            createdAt: this.states[userJid]?.createdAt || new Date().toISOString()
        };

        this.saveStates();

        console.log(`💾 Estado salvo: ${userName} -> ${status} (${flow})`);
    }

    /**
     * Obtém o estado atual de um usuário
     * @param {string} userJid - ID do usuário
     * @returns {object|null} Estado do usuário ou null se não existe
     */
    getUserState(userJid) {
        return this.states[userJid] || null;
    }

    /**
     * Verifica se um usuário tem estado ativo
     * @param {string} userJid - ID do usuário
     * @returns {boolean}
     */
    hasActiveState(userJid) {
        return !!this.states[userJid];
    }

    /**
     * Adiciona uma mensagem pendente (que chegou enquanto bot tava down)
     * @param {string} userJid - ID do usuário
     * @param {string} messageText - Texto da mensagem
     * @param {string} messageTime - Hora da mensagem
     */
    addPendingMessage(userJid, messageText, messageTime) {
        if (!this.states[userJid]) {
            return; // Se não tem estado, não precisa rastrear
        }

        this.states[userJid].pendingMessages = this.states[userJid].pendingMessages || [];
        this.states[userJid].pendingMessages.push({
            text: messageText,
            timestamp: messageTime || new Date().toISOString()
        });

        this.saveStates();
    }

    /**
     * Obtém e limpa as mensagens pendentes de um usuário
     * @param {string} userJid - ID do usuário
     * @returns {array} Array de mensagens pendentes
     */
    getPendingMessages(userJid) {
        if (!this.states[userJid]) return [];

        const pending = this.states[userJid].pendingMessages || [];
        this.states[userJid].pendingMessages = [];
        this.saveStates();

        return pending;
    }

    /**
     * Remove o estado de um usuário (quando fluxo termina e volta ao menu)
     * @param {string} userJid - ID do usuário
     */
    clearUserState(userJid) {
        if (this.states[userJid]) {
            const userName = this.states[userJid].userName;
            delete this.states[userJid];
            this.saveStates();
            console.log(`🗑️ Estado removido: ${userName} (voltou ao menu)`);
        }
    }

    /**
     * Obtém TODOS os usuários com estado ativo
     * @returns {array} Array de userJids
     */
    getAllActiveUsers() {
        return Object.keys(this.states);
    }

    /**
     * Obtém TODOS os estados
     * @returns {object} Objeto com todos os estados
     */
    getAllStates() {
        return this.states;
    }

    /**
     * Limpa TODOS os estados (apenas para DEBUG/reset)
     */
    clearAllStates() {
        this.states = {};
        this.saveStates();
        console.log('🗑️ TODOS os estados foram limpos');
    }

    /**
     * Fornece estatísticas dos estados ativos
     */
    getStats() {
        const allUsers = Object.keys(this.states);
        const statuses = {};
        const flows = {};

        allUsers.forEach(userJid => {
            const state = this.states[userJid];
            statuses[state.currentStatus] = (statuses[state.currentStatus] || 0) + 1;
            flows[state.currentFlow] = (flows[state.currentFlow] || 0) + 1;
        });

        return {
            totalActiveUsers: allUsers.length,
            byStatus: statuses,
            byFlow: flows,
            allUsers: allUsers.map(jid => ({
                jid,
                name: this.states[jid].userName,
                status: this.states[jid].currentStatus,
                flow: this.states[jid].currentFlow,
                attempts: this.states[jid].attempts,
                lastMessage: this.states[jid].lastMessageTime
            }))
        };
    }

    /**
     * Atualiza apenas o status de um usuário (mantém flowData)
     * @param {string} userJid - ID do usuário
     * @param {string} newStatus - Novo status
     */
    updateUserStatus(userJid, newStatus) {
        if (this.states[userJid]) {
            this.states[userJid].currentStatus = newStatus;
            this.states[userJid].lastMessageTime = new Date().toISOString();
            this.saveStates();
            console.log(`📝 Status atualizado: ${this.states[userJid].userName} -> ${newStatus}`);
        }
    }

    /**
     * Atualiza apenas os dados do fluxo (mantém status)
     * @param {string} userJid - ID do usuário
     * @param {object} newFlowData - Novos dados do fluxo
     */
    updateFlowData(userJid, newFlowData) {
        if (this.states[userJid]) {
            this.states[userJid].flowData = { ...this.states[userJid].flowData, ...newFlowData };
            this.saveStates();
        }
    }

    /**
     * Obtém o tempo decorrido desde que o usuário entrou neste estado
     * @param {string} userJid - ID do usuário
     * @returns {number} Tempo em minutos
     */
    getTimeInState(userJid) {
        if (!this.states[userJid]) return 0;
        const created = new Date(this.states[userJid].createdAt);
        const now = new Date();
        return Math.floor((now - created) / (1000 * 60)); // minutos
    }

    /**
     * Exporta todos os estados como JSON formatado (para logs/debug)
     */
    exportAsJSON() {
        return JSON.stringify(this.states, null, 2);
    }
}

// Exportar instância única
module.exports = new ConversationStateManager();
