/**
 * ========== WEBHOOK HANDLER - Processa Mensagens da Cloud API ==========
 * 
 * Extrai mensagens do payload do webhook e converte para formato interno
 */

/**
 * Extrai informações da primeira mensagem de texto do payload
 * 
 * @param {object} webhookBody - Corpo do POST /webhook da Cloud API
 * @returns {object|null} { from, body, pushName, messageId, phoneNumberId, displayPhoneNumber } ou null se não houver mensagem
 */
function extractIncomingMessage(webhookBody) {
    try {
        // Estrutura do webhook da Cloud API:
        // {
        //   "object": "whatsapp_business_account",
        //   "entry": [{
        //     "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
        //     "changes": [{
        //       "value": {
        //         "messaging_product": "whatsapp",
        //         "metadata": { ... },
        //         "contacts": [{ "profile": { "name": "USER_NAME" }, "wa_id": "5511999999999" }],
        //         "messages": [{
        //           "from": "5511999999999",
        //           "id": "wamid.XXX",
        //           "timestamp": "1234567890",
        //           "type": "text",
        //           "text": { "body": "mensagem do usuário" }
        //         }]
        //       },
        //       "field": "messages"
        //     }]
        //   }]
        // }

        if (!webhookBody || !webhookBody.entry || !webhookBody.entry[0]) {
            return null;
        }

        const entry = webhookBody.entry[0];
        if (!entry.changes || !entry.changes[0]) {
            return null;
        }

        const change = entry.changes[0];
        if (!change.value) {
            return null;
        }

        const value = change.value;
        const phoneNumberId = value.metadata && value.metadata.phone_number_id;
        const displayPhoneNumber = value.metadata && value.metadata.display_phone_number;

        // Verifica se há mensagens
        if (!value.messages || !value.messages[0]) {
            return null;
        }

        const message = value.messages[0];

        // Extrai informações do contato (nome)
        let pushName = 'Usuário';
        if (value.contacts && value.contacts[0] && value.contacts[0].profile) {
            pushName = value.contacts[0].profile.name || 'Usuário';
        }

        // ===== MENSAGEM DE TEXTO =====
        if (message.type === 'text') {
            return {
                from: message.from,
                body: message.text.body,
                pushName: pushName,
                messageId: message.id,
                timestamp: message.timestamp,
                type: 'text',
                phoneNumberId,
                displayPhoneNumber
            };
        }

        // ===== MENSAGEM INTERATIVA (BOTÃO OU LISTA) =====
        if (message.type === 'interactive') {
            const interactive = message.interactive;

            // Resposta de BOTÃO
            if (interactive.type === 'button_reply') {
                return {
                    from: message.from,
                    body: interactive.button_reply.title, // Texto do botão clicado (para logs)
                    pushName: pushName,
                    messageId: message.id,
                    timestamp: message.timestamp,
                    type: 'interactive_button',
                    interactiveId: interactive.button_reply.id,
                    interactiveTitle: interactive.button_reply.title,
                    phoneNumberId,
                    displayPhoneNumber
                };
            }

            // Resposta de LISTA
            if (interactive.type === 'list_reply') {
                return {
                    from: message.from,
                    body: interactive.list_reply.title, // Texto da opção escolhida (para logs)
                    pushName: pushName,
                    messageId: message.id,
                    timestamp: message.timestamp,
                    type: 'interactive_list',
                    interactiveId: interactive.list_reply.id,
                    interactiveTitle: interactive.list_reply.title,
                    phoneNumberId,
                    displayPhoneNumber
                };
            }
        }

        // Outros tipos de mensagem (imagem, áudio, etc.) são ignorados por enquanto
        console.log(`⚠️ Mensagem de tipo ${message.type} ignorada (não suportado no momento)`);
        return null;

    } catch (error) {
        console.error('❌ Erro ao extrair mensagem do webhook:', error.message);
        return null;
    }
}

/**
 * Extrai informações de documento/PDF do payload
 * 
 * @param {object} webhookBody - Corpo do POST /webhook
 * @returns {object|null} { from, mediaId, mimeType, fileName, messageId } ou null
 */
function extractIncomingDocument(webhookBody) {
    try {
        if (!webhookBody || !webhookBody.entry || !webhookBody.entry[0]) {
            return null;
        }

        const entry = webhookBody.entry[0];
        if (!entry.changes || !entry.changes[0]) {
            return null;
        }

        const change = entry.changes[0];
        const value = change.value;
        const phoneNumberId = value.metadata && value.metadata.phone_number_id;
        const displayPhoneNumber = value.metadata && value.metadata.display_phone_number;

        if (!value.messages || !value.messages[0]) {
            return null;
        }

        const message = value.messages[0];

        // Verifica se é documento
        if (message.type !== 'document') {
            return null;
        }

        // Extrai nome do contato
        let pushName = 'Usuário';
        if (value.contacts && value.contacts[0] && value.contacts[0].profile) {
            pushName = value.contacts[0].profile.name || 'Usuário';
        }

        return {
            from: message.from,
            mediaId: message.document.id,
            mimeType: message.document.mime_type,
            fileName: message.document.filename || 'documento',
            messageId: message.id,
            pushName: pushName,
            phoneNumberId,
            displayPhoneNumber
        };

    } catch (error) {
        console.error('❌ Erro ao extrair documento do webhook:', error.message);
        return null;
    }
}

/**
 * Verifica se o webhook é uma notificação de status (entrega, leitura)
 * 
 * @param {object} webhookBody
 * @returns {boolean}
 */
function isStatusNotification(webhookBody) {
    try {
        if (!webhookBody || !webhookBody.entry || !webhookBody.entry[0]) {
            return false;
        }

        const entry = webhookBody.entry[0];
        if (!entry.changes || !entry.changes[0]) {
            return false;
        }

        const value = entry.changes[0].value;

        // Notificações de status têm "statuses" ao invés de "messages"
        return !!(value.statuses && value.statuses.length > 0);

    } catch (error) {
        return false;
    }
}

module.exports = {
    extractIncomingMessage,
    extractIncomingDocument,
    isStatusNotification
};
