// ========== SISTEMA ANTI-SPAM AVANÇADO PARA WHATSAPP ==========
// Este módulo implementa múltiplas estratégias para evitar bloqueio por spam do WhatsApp

const fs = require('fs');
const path = require('path');

class AntiSpamSystem {
    constructor() {
        // Configurações de limite por tipo de mensagem
        this.config = {
            // Limites gerais
            globalDelay: 800,            // Delay mínimo entre mensagens (ms) - reduzido para ser mais rápido
            userDelay: 600,              // Delay adicional por usuário único (ms)

            // Janelas de tempo para diferentes tipos
            messageWindow: 60000,        // Janela de 1 minuto
            dailyWindow: 86400000,       // Janela de 24 horas
            hourlyWindow: 3600000,       // Janela de 1 hora

            // Limites por período
            messagesPerMinute: 10,       // Máx 10 mensagens por minuto por usuário (conversa normal)
            messagesPerHour: 100,        // Máx 100 mensagens por hora por usuário
            messagesPerDay: 500,         // Máx 500 mensagens por dia por usuário

            // Limites globais (do bot inteiro)
            globalMessagesPerMinute: 50, // Máx 50 mensagens/min no total
            globalMessagesPerHour: 500,  // Máx 500 mensagens/hora no total

            // Estratégias de proteção
            batchDelay: 500,             // Delay entre mensagens em lote (ms)
            conversationCooldown: 2000,  // Cooldown após trocar de conversa (ms)
            rapidMessageThreshold: 5,    // Considerar "rápido" após N mensagens
            rapidMessageBackoff: 3000,   // Backoff quando detecta envio rápido (ms)
        };

        // Rastreamento por usuário
        this.userTracking = new Map();

        // Rastreamento global
        this.globalMetrics = {
            totalSent: 0,
            sentInCurrentMinute: 0,
            sentInCurrentHour: 0,
            lastResetMinute: Date.now(),
            lastResetHour: Date.now(),
            lastMessageTime: 0,
            lastUser: null,
        };

        // Fila separada por prioridade
        this.queues = {
            high: [],      // Prioridade alta (cobrança, notificações críticas)
            normal: [],    // Prioridade normal (respostas)
            low: [],       // Prioridade baixa (informativas)
        };

        // Estado do processamento
        this.processing = false;
        this.lastProcessTime = 0;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;

        // Estatísticas
        this.stats = {
            queued: 0,
            sent: 0,
            dropped: 0,
            delayed: 0,
            errors: 0,
            lastHourStats: [],
        };

        // Logs persistentes
        this.logFile = path.join(__dirname, 'logs', 'anti-spam.log');
        this.ensureLogDirectory();

        // Verbosidade: false = silencioso, true = mostra logs
        this.verbose = false;
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(level, message, extra = {}) {
        const timestamp = new Date().toLocaleString('pt-BR');
        const logEntry = `[${timestamp}] [${level}] ${message}`;

        // Apenas mostra no console se verbose ativo
        if (this.verbose) {
            console.log(logEntry, extra);
        }

        // Sempre salva em arquivo para análise posterior
        try {
            fs.appendFileSync(this.logFile, logEntry + '\n');
        } catch (e) {
            // Silencioso se falhar
        }
    }

    // Obtém métricas do usuário
    getUserMetrics(userId) {
        if (!this.userTracking.has(userId)) {
            this.userTracking.set(userId, {
                messages: [],
                lastMessageTime: 0,
                consecutiveMessages: 0,
                isThrottled: false,
                throttleUntil: 0,
            });
        }
        return this.userTracking.get(userId);
    }

    // Limpa métricas antigas
    cleanOldMetrics() {
        const now = Date.now();

        for (const [userId, metrics] of this.userTracking.entries()) {
            // Mantém apenas mensagens da última hora
            metrics.messages = metrics.messages.filter(
                time => now - time < this.config.hourlyWindow
            );

            // Remove usuário se não tiver atividade recente
            if (metrics.messages.length === 0 && now - metrics.lastMessageTime > 3600000) {
                this.userTracking.delete(userId);
            }
        }
    }

    // Verifica limites do usuário
    checkUserLimits(userId) {
        const now = Date.now();
        const metrics = this.getUserMetrics(userId);

        // Se está em throttle, verifica se deve sair
        if (metrics.isThrottled && now < metrics.throttleUntil) {
            return {
                allowed: false,
                reason: 'USER_THROTTLED',
                until: metrics.throttleUntil,
            };
        }
        metrics.isThrottled = false;

        // Limpa mensagens antigas
        metrics.messages = metrics.messages.filter(
            time => now - time < this.config.dailyWindow
        );

        // Conta por período
        const recentMinute = metrics.messages.filter(
            time => now - time < this.config.messageWindow
        );
        const recentHour = metrics.messages.filter(
            time => now - time < this.config.hourlyWindow
        );

        // Verifica limites
        if (recentMinute.length >= this.config.messagesPerMinute) {
            this.log('WARN', `Limite por minuto atingido para ${userId}`, {
                count: recentMinute.length,
                limit: this.config.messagesPerMinute,
            });
            return { allowed: false, reason: 'PER_MINUTE_LIMIT' };
        }

        if (recentHour.length >= this.config.messagesPerHour) {
            this.log('WARN', `Limite por hora atingido para ${userId}`, {
                count: recentHour.length,
                limit: this.config.messagesPerHour,
            });
            return { allowed: false, reason: 'PER_HOUR_LIMIT' };
        }

        if (metrics.messages.length >= this.config.messagesPerDay) {
            this.log('WARN', `Limite diário atingido para ${userId}`, {
                count: metrics.messages.length,
                limit: this.config.messagesPerDay,
            });
            return { allowed: false, reason: 'PER_DAY_LIMIT' };
        }

        // Detecta envio rápido e aplicar backoff
        if (recentMinute.length >= this.config.rapidMessageThreshold) {
            metrics.isThrottled = true;
            metrics.throttleUntil = now + this.config.rapidMessageBackoff;
            this.log('WARN', `Envio rápido detectado para ${userId}`, {
                count: recentMinute.length,
            });
            return { allowed: false, reason: 'RAPID_FIRE' };
        }

        return { allowed: true };
    }

    // Verifica limites globais
    checkGlobalLimits() {
        const now = Date.now();
        const metrics = this.globalMetrics;

        // Reset por minuto
        if (now - metrics.lastResetMinute > this.config.messageWindow) {
            metrics.sentInCurrentMinute = 0;
            metrics.lastResetMinute = now;
        }

        // Reset por hora
        if (now - metrics.lastResetHour > this.config.hourlyWindow) {
            metrics.sentInCurrentHour = 0;
            metrics.lastResetHour = now;
        }

        // Verifica limites globais
        if (metrics.sentInCurrentMinute >= this.config.globalMessagesPerMinute) {
            this.log('WARN', 'Limite global por minuto atingido', {
                count: metrics.sentInCurrentMinute,
                limit: this.config.globalMessagesPerMinute,
            });
            return { allowed: false, reason: 'GLOBAL_PER_MINUTE' };
        }

        if (metrics.sentInCurrentHour >= this.config.globalMessagesPerHour) {
            this.log('WARN', 'Limite global por hora atingido', {
                count: metrics.sentInCurrentHour,
                limit: this.config.globalMessagesPerHour,
            });
            return { allowed: false, reason: 'GLOBAL_PER_HOUR' };
        }

        return { allowed: true };
    }

    // Calcula delay dinâmico baseado em contexto
    calculateDelay(userId, priority, isFollowUp = false) {
        const now = Date.now();
        const metrics = this.globalMetrics;
        let delay = this.config.globalDelay;

        // Adiciona delay para troca de conversa
        if (metrics.lastUser !== userId) {
            delay += this.config.conversationCooldown;
            metrics.lastUser = userId;
        }

        // Reduz delay para mensagens prioritárias
        if (priority === 'high') {
            delay *= 0.6;
        } else if (priority === 'low') {
            delay *= 1.4;
        }

        // Adiciona variação aleatória para parecer mais natural
        const jitter = Math.random() * 300 - 150; // -150ms a +150ms
        delay += jitter;

        // Se é follow-up (resposta rápida), reduz um pouco
        if (isFollowUp && now - metrics.lastMessageTime < 5000) {
            delay *= 0.8;
        }

        return Math.max(300, delay); // Mínimo de 300ms
    }

    // Enfileira mensagem
    queue(userId, text, priority = 'normal', metadata = {}) {
        // Validações básicas
        if (!userId || !text) {
            this.log('ERROR', 'userId ou text inválido');
            return false;
        }

        // Normaliza userId
        if (!userId.includes('@')) {
            userId += '@s.whatsapp.net';
        }

        // Verifica limites
        const userCheck = this.checkUserLimits(userId);
        if (!userCheck.allowed) {
            this.stats.dropped++;
            this.log('BLOCKED', `Mensagem bloqueada para ${userId}`, {
                reason: userCheck.reason,
            });
            return false;
        }

        const globalCheck = this.checkGlobalLimits();
        if (!globalCheck.allowed) {
            this.stats.dropped++;
            this.log('BLOCKED', 'Mensagem bloqueada globalmente', {
                reason: globalCheck.reason,
            });
            return false;
        }

        // Cria objeto da mensagem
        const message = {
            id: `${userId}_${Date.now()}_${Math.random()}`,
            userId,
            text,
            priority: priority || 'normal',
            queuedAt: Date.now(),
            metadata,
            attempts: 0,
            maxAttempts: 3,
        };

        // Adiciona à fila apropriada
        const queueMap = { high: this.queues.high, normal: this.queues.normal, low: this.queues.low };
        const targetQueue = queueMap[priority] || this.queues.normal;
        targetQueue.push(message);

        this.stats.queued++;
        this.log('QUEUED', `Mensagem enfileirada para ${userId}`, {
            priority,
            queueSize: this.getTotalQueueSize(),
        });

        return true;
    }

    // Obtém tamanho total da fila
    getTotalQueueSize() {
        return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
    }

    // Próxima mensagem a enviar
    getNextMessage() {
        // Prioridade: high > normal > low
        if (this.queues.high.length > 0) return this.queues.high.shift();
        if (this.queues.normal.length > 0) return this.queues.normal.shift();
        if (this.queues.low.length > 0) return this.queues.low.shift();
        return null;
    }

    // Marca mensagem como enviada
    markSent(userId) {
        const now = Date.now();
        const metrics = this.getUserMetrics(userId);

        // Atualiza métricas do usuário
        metrics.messages.push(now);
        metrics.lastMessageTime = now;
        metrics.consecutiveMessages++;

        // Atualiza métricas globais
        this.globalMetrics.totalSent++;
        this.globalMetrics.sentInCurrentMinute++;
        this.globalMetrics.sentInCurrentHour++;
        this.globalMetrics.lastMessageTime = now;

        this.stats.sent++;
    }

    // Processa fila (async para esperar delays)
    // ADAPTADO PARA CLOUD API - sendFunction deve ser uma função que retorna Promise<boolean>
    async processQueue(sendFunction) {
        if (this.processing) return;

        this.processing = true;

        try {
            while (this.getTotalQueueSize() > 0) {
                const message = this.getNextMessage();
                if (!message) break;

                // Calcula delay necessário
                const delay = this.calculateDelay(
                    message.userId,
                    message.priority,
                    message.metadata.isFollowUp
                );

                // Aguarda delay
                await new Promise(resolve => setTimeout(resolve, delay));

                try {
                    // Envia mensagem via Cloud API
                    // sendFunction deve aceitar (to, text, metadata) e retornar Promise<boolean>
                    const result = await sendFunction(message.userId, message.text, message.metadata || {});

                    if (result !== false) {
                        this.markSent(message.userId);
                        this.log('SENT', `Mensagem enviada para ${message.userId}`, {
                            queueRemaining: this.getTotalQueueSize(),
                        });
                        this.consecutiveErrors = 0;
                    } else {
                        throw new Error('sendFunction retornou false');
                    }
                } catch (error) {
                    message.attempts++;
                    this.stats.errors++;
                    this.consecutiveErrors++;

                    if (message.attempts < message.maxAttempts) {
                        // Reinsere na fila para tentar novamente
                        if (message.priority === 'high') {
                            this.queues.high.unshift(message);
                        } else {
                            this.queues.normal.push(message);
                        }

                        const backoffDelay = 3000 * message.attempts;
                        this.log('RETRY', `Tentando novamente em ${backoffDelay}ms`, {
                            userId: message.userId,
                            attempt: message.attempts,
                            error: error.message,
                        });

                        await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    } else {
                        this.log('FAILED', `Mensagem desistida após ${message.attempts} tentativas`, {
                            userId: message.userId,
                            error: error.message,
                        });
                    }

                    // Se muitos erros, pausa por um tempo
                    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                        this.log('ERROR', 'Muitos erros consecutivos. Pausando por 10s...');
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        this.consecutiveErrors = 0;
                    }
                }

                // Limpa métricas antigas periodicamente
                if (Math.random() < 0.1) {
                    this.cleanOldMetrics();
                }
            }
        } finally {
            this.processing = false;
        }
    }

    // Obtém status da fila
    getStatus() {
        this.cleanOldMetrics();

        return {
            queueSize: this.getTotalQueueSize(),
            queueByPriority: {
                high: this.queues.high.length,
                normal: this.queues.normal.length,
                low: this.queues.low.length,
            },
            stats: this.stats,
            activeUsers: this.userTracking.size,
            globalMetrics: {
                totalSent: this.globalMetrics.totalSent,
                sentThisMinute: this.globalMetrics.sentInCurrentMinute,
                sentThisHour: this.globalMetrics.sentInCurrentHour,
                lastMessageTime: new Date(this.globalMetrics.lastMessageTime).toLocaleString('pt-BR'),
            },
        };
    }

    // Limpa fila (se necessário)
    clearQueue(priority = null) {
        if (priority) {
            this.queues[priority] = [];
        } else {
            this.queues.high = [];
            this.queues.normal = [];
            this.queues.low = [];
        }
        this.log('INFO', 'Fila limpa', { priority: priority || 'all' });
    }

    // Exporta configurações
    getConfig() {
        return { ...this.config };
    }

    // Atualiza configurações (use com cuidado!)
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.log('CONFIG', 'Configuração atualizada', { config: this.config });
    }
}

module.exports = AntiSpamSystem;
