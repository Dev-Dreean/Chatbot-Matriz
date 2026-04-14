class UserStateManager {
    constructor(storage) {
        this.storage = storage;
        this.states = new Map();
        this.initialized = false;
        this.persistenceEnabled = Boolean(storage && typeof storage.isEnabled === 'function' && storage.isEnabled());
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        if (!this.storage || !this.persistenceEnabled) {
            this.initialized = true;
            console.log('[StateManager] Operando apenas em memória');
            return;
        }

        try {
            const rows = await this.storage.loadAllUserStates();
            this.states = new Map(rows.map(row => [row.userId, row.state]));
            console.log(`[StateManager] Banco carregado com ${this.states.size} estados de usuarios`);
        } catch (error) {
            this.persistenceEnabled = false;
            console.warn(`[StateManager] Falha ao carregar estado persistido, seguindo em memória: ${error.message}`);
        }

        this.initialized = true;
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async getState(userId) {
        await this.ensureInitialized();
        if (!userId) return { step: 'initial' };
        return this.states.get(userId) || { step: 'initial' };
    }

    async setState(userId, newState) {
        await this.ensureInitialized();
        if (!userId) return;

        const timestamp = Date.now();
        const state = {
            ...newState,
            updatedAt: timestamp,
            userId
        };

        this.states.set(userId, state);
        if (this.persistenceEnabled) {
            try {
                await this.storage.saveUserState(userId, state);
            } catch (error) {
                this.persistenceEnabled = false;
                console.warn(`[StateManager] Falha ao persistir estado, seguindo em memória: ${error.message}`);
            }
        }

        console.log(`[StateManager] 👤 ${userId} → step: ${state.step}`);
    }

    async setWelcomeSent(userId) {
        const state = await this.getState(userId);
        state.welcomeSent = true;
        state.welcomeSentAt = Date.now();
        state.step = 'waiting_for_input';
        await this.setState(userId, state);
    }

    async hasReceivedWelcome(userId) {
        const state = await this.getState(userId);
        return state.welcomeSent === true && state.step === 'waiting_for_input';
    }

    async clearState(userId) {
        await this.ensureInitialized();
        this.states.delete(userId);
        if (this.persistenceEnabled) {
            try {
                await this.storage.deleteUserState(userId);
            } catch (error) {
                this.persistenceEnabled = false;
                console.warn(`[StateManager] Falha ao remover estado persistido, seguindo em memória: ${error.message}`);
            }
        }
        console.log(`[StateManager] 🗑️ Estado de ${userId} limpo`);
    }

    async clearAllStates() {
        await this.ensureInitialized();
        this.states.clear();
        if (this.persistenceEnabled) {
            try {
                await this.storage.clearAllUserStates();
            } catch (error) {
                this.persistenceEnabled = false;
                console.warn(`[StateManager] Falha ao limpar estados persistidos, seguindo em memória: ${error.message}`);
            }
        }
        console.log(`[StateManager] 🗑️ Todos os estados foram limpos`);
    }

    getStats() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;

        let active = 0;
        let inactive = 0;

        for (const state of this.states.values()) {
            if (state.updatedAt && (now - state.updatedAt) < oneHourAgo) {
                active++;
            } else {
                inactive++;
            }
        }

        return {
            total: this.states.size,
            active,
            inactive
        };
    }

    async cleanOldStates(daysOld = 7) {
        await this.ensureInitialized();
        const now = Date.now();
        const threshold = now - (daysOld * 24 * 3600000);
        let removed = 0;

        for (const [userId, state] of this.states.entries()) {
            if (state.updatedAt && state.updatedAt < threshold) {
                this.states.delete(userId);
                removed++;
            }
        }

        if (removed > 0) {
            if (this.persistenceEnabled) {
                try {
                    await this.storage.deleteOldUserStates(daysOld);
                } catch (error) {
                    this.persistenceEnabled = false;
                    console.warn(`[StateManager] Falha ao limpar estados antigos persistidos, seguindo em memória: ${error.message}`);
                }
            }
            console.log(`[StateManager] 🧹 Removidos ${removed} estados antigos`);
        }

        return removed;
    }

    async debugUser(userId) {
        const state = await this.getState(userId);
        console.log(`[StateManager] 🔍 DEBUG ${userId}:`, JSON.stringify(state, null, 2));
        return state;
    }

    listActiveUsers() {
        const users = [];
        for (const [userId, state] of this.states.entries()) {
            users.push({
                userId,
                step: state.step,
                welcomeSent: state.welcomeSent,
                updatedAt: new Date(state.updatedAt).toLocaleString('pt-BR')
            });
        }
        return users;
    }
}

module.exports = UserStateManager;
