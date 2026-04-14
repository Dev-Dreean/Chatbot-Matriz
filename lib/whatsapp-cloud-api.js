/**
 * ========== WHATSAPP CLOUD API - Funções de Envio e Recebimento ==========
 * 
 * Camada de integração com a WhatsApp Cloud API (Graph API v22.0)
 * 
 * IMPORTANTE: Este bot NUNCA inicia conversas.
 * Todas as mensagens são enviadas apenas em resposta a mensagens recebidas.
 */

const axios = require('axios');

// ========== CONFIGURAÇÃO (VARIÁVEIS DE AMBIENTE) ==========
// TODO: Configure estas variáveis no seu ambiente (.env ou sistema)
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // Token de acesso permanente da Cloud API
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // ID do número de telefone (padrão)
const ALT_PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // Alias compatível (opcional)
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0';
const PHONE_NUMBER_ID_PREFIX = 'WHATSAPP_PHONE_NUMBER_ID_';
const ALT_PHONE_NUMBER_ID_PREFIX = 'PHONE_NUMBER_ID_';

function getConfiguredPhoneNumberIds() {
    const ids = [];
    if (WHATSAPP_PHONE_NUMBER_ID) ids.push(WHATSAPP_PHONE_NUMBER_ID);
    if (ALT_PHONE_NUMBER_ID) ids.push(ALT_PHONE_NUMBER_ID);
    for (const key of Object.keys(process.env)) {
        if (key.startsWith(PHONE_NUMBER_ID_PREFIX) && process.env[key]) {
            ids.push(process.env[key]);
        }
        if (key.startsWith(ALT_PHONE_NUMBER_ID_PREFIX) && process.env[key]) {
            ids.push(process.env[key]);
        }
    }
    return ids;
}

function getPhoneNumberIdMap() {
    const map = {};
    for (const key of Object.keys(process.env)) {
        if (key.startsWith(PHONE_NUMBER_ID_PREFIX) && process.env[key]) {
            const suffix = key.substring(PHONE_NUMBER_ID_PREFIX.length).toLowerCase();
            map[suffix] = process.env[key];
        }
    }
    for (const key of Object.keys(process.env)) {
        if (key.startsWith(ALT_PHONE_NUMBER_ID_PREFIX) && process.env[key]) {
            const suffix = key.substring(ALT_PHONE_NUMBER_ID_PREFIX.length).toLowerCase();
            if (!map[suffix]) map[suffix] = process.env[key];
        }
    }
    return map;
}

function resolvePhoneNumberId(options = {}) {
    if (typeof options === 'string') {
        return options;
    }

    if (options && options.phoneNumberId) {
        return options.phoneNumberId;
    }

    if (options && options.phoneNumberKey) {
        const map = getPhoneNumberIdMap();
        const key = String(options.phoneNumberKey).toLowerCase();
        if (map[key]) return map[key];
    }

    if (WHATSAPP_PHONE_NUMBER_ID) {
        return WHATSAPP_PHONE_NUMBER_ID;
    }
    if (ALT_PHONE_NUMBER_ID) {
        return ALT_PHONE_NUMBER_ID;
    }

    const ids = getConfiguredPhoneNumberIds();
    return ids.length > 0 ? ids[0] : null;
}

function buildMessagesUrl(phoneNumberId) {
    return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

function getUniqueConfiguredPhoneNumberIds() {
    return Array.from(new Set(getConfiguredPhoneNumberIds().filter(Boolean)));
}

function isActivePhoneStatus(status) {
    return ['CONNECTED', 'ACTIVE'].includes(String(status || '').toUpperCase());
}

async function fetchPhoneNumberStatus(phoneNumberId) {
    const response = await axios.get(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}`,
        {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,status'
            },
            timeout: 10000
        }
    );

    return response.data || {};
}

/**
 * Registra números pendentes na Cloud API.
 * - Suporta múltiplos WHATSAPP_PHONE_NUMBER_ID_* / PHONE_NUMBER_ID_*
 * - Não tenta registrar número já ativo
 * - Mostra erro claro quando o número precisa de verificação prévia
 */
async function registerPendingPhoneNumbers(options = {}) {
    if (!WHATSAPP_TOKEN) {
        throw new Error('WHATSAPP_TOKEN não configurado nas variáveis de ambiente');
    }

    const logger = options.logger || console;
    const pin = String(options.pin || process.env.WHATSAPP_REGISTRATION_PIN || '123456');
    const ids = options.phoneNumberIds && options.phoneNumberIds.length
        ? Array.from(new Set(options.phoneNumberIds.filter(Boolean)))
        : getUniqueConfiguredPhoneNumberIds();

    const results = [];

    for (const phoneNumberId of ids) {
        try {
            const before = await fetchPhoneNumberStatus(phoneNumberId);
            logger.info(`📞 [REGISTER] ${phoneNumberId} antes: status=${before.status || 'N/A'}, code_verification_status=${before.code_verification_status || 'N/A'}`);

            if (isActivePhoneStatus(before.status)) {
                logger.info(`✅ [REGISTER] ${phoneNumberId} já está ativo; registro ignorado.`);
                results.push({ phoneNumberId, skipped: true, reason: 'already-active', before, after: before });
                continue;
            }

            if (String(before.code_verification_status || '').toUpperCase() !== 'VERIFIED') {
                const clearError = `Número ${phoneNumberId} precisa de verificação antes do registro (code_verification_status=${before.code_verification_status || 'N/A'}).`;
                logger.error(`❌ [REGISTER] ${clearError}`);
                results.push({ phoneNumberId, registered: false, error: clearError, before });
                continue;
            }

            await axios.post(
                `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/register`,
                {
                    messaging_product: 'whatsapp',
                    pin
                },
                {
                    headers: {
                        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            const after = await fetchPhoneNumberStatus(phoneNumberId);
            logger.info(`📞 [REGISTER] ${phoneNumberId} depois: status=${after.status || 'N/A'}, code_verification_status=${after.code_verification_status || 'N/A'}`);
            results.push({ phoneNumberId, registered: true, before, after });
        } catch (error) {
            const apiMessage = error.response && error.response.data && error.response.data.error && error.response.data.error.message
                ? error.response.data.error.message
                : error.message;
            const clearError = `Falha ao registrar número ${phoneNumberId}: ${apiMessage}`;
            logger.error(`❌ [REGISTER] ${clearError}`);
            results.push({ phoneNumberId, registered: false, error: clearError });
        }
    }

    return results;
}

/**
 * Normaliza número de telefone para formato Cloud API
 * 
 * @param {string} phone - Número no formato JID (5511999999999@s.whatsapp.net) ou puro (5511999999999)
 * @returns {string} Número normalizado (5511999999999)
 */
function normalizePhoneNumber(phone) {
    if (!phone) {
        throw new Error('Número de telefone não fornecido');
    }

    // Remove sufixos do Baileys (@s.whatsapp.net, @c.us, @g.us)
    let normalized = phone.replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '');

    // Remove caracteres não numéricos
    normalized = normalized.replace(/\D/g, '');

    // Garante que começa com 55 (Brasil)
    if (!normalized.startsWith('55')) {
        normalized = '55' + normalized;
    }

    return normalized;
}

/**
 * Envia mensagem de texto via WhatsApp Cloud API
 * 
 * REGRA CRÍTICA: Esta função NUNCA deve ser chamada proativamente.
 * Apenas em resposta a mensagens recebidas do usuário.
 * 
 * @param {string} to - Número de destino (aceita JID ou número puro)
 * @param {string} text - Texto da mensagem
 * @returns {Promise<boolean>} true se enviou com sucesso, false caso contrário
 */
async function sendWhatsAppText(to, text, options = {}) {
    try {
        // Validações
        if (!WHATSAPP_TOKEN) {
            throw new Error('WHATSAPP_TOKEN não configurado nas variáveis de ambiente');
        }

        const phoneNumberId = resolvePhoneNumberId(options);
        if (!phoneNumberId) {
            throw new Error('WHATSAPP_PHONE_NUMBER_ID não configurado nas variáveis de ambiente');
        }

        if (!to || !text) {
            throw new Error('Parâmetros "to" e "text" são obrigatórios');
        }

        // Normaliza o número de telefone
        const normalizedPhone = normalizePhoneNumber(to);

        // Payload da Cloud API
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizedPhone,
            type: 'text',
            text: {
                preview_url: false,
                body: text
            }
        };

        // Envia requisição para a Cloud API
        const response = await axios.post(buildMessagesUrl(phoneNumberId), payload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 segundos de timeout
        });

        // Verifica se foi bem-sucedido
        if (response.status === 200 && response.data.messages) {
            return true;
        }

        console.error('❌ Resposta inesperada da Cloud API:', response.data);
        return false;

    } catch (error) {
        // Log detalhado do erro
        if (error.response) {
            // Erro da API do WhatsApp
            console.error('❌ Erro na Cloud API:', {
                status: error.response.status,
                data: error.response.data,
                to: normalizePhoneNumber(to)
            });
        } else if (error.request) {
            // Erro de rede
            console.error('❌ Erro de rede ao enviar mensagem:', error.message);
        } else {
            // Erro de configuração
            console.error('❌ Erro ao preparar requisição:', error.message);
        }

        return false;
    }
}

/**
 * Marca mensagem como lida (opcional, mas recomendado)
 * 
 * @param {string} messageId - ID da mensagem recebida
 * @returns {Promise<boolean>}
 */
async function markMessageAsRead(messageId, options = {}) {
    try {
        if (!WHATSAPP_TOKEN) {
            return false;
        }

        const phoneNumberId = resolvePhoneNumberId(options);
        if (!phoneNumberId) {
            return false;
        }

        const payload = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        };

        const response = await axios.post(buildMessagesUrl(phoneNumberId), payload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        return response.status === 200;
    } catch (error) {
        // Falha silenciosa - marcar como lido não é crítico
        return false;
    }
}

/**
 * Envia mensagem com botões interativos (até 3 botões)
 * 
 * @param {string} to - Número de destino
 * @param {string} bodyText - Texto principal da mensagem
 * @param {string} footerText - Texto do rodapé (opcional)
 * @param {Array} buttons - Array de botões: [{ id: "BTN_1", title: "Texto" }]
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppInteractiveButtons(to, bodyText, footerText, buttons, options = {}) {
    try {
        if (!WHATSAPP_TOKEN) {
            throw new Error('Credenciais não configuradas');
        }

        const phoneNumberId = resolvePhoneNumberId(options);
        if (!phoneNumberId) {
            throw new Error('WHATSAPP_PHONE_NUMBER_ID não configurado nas variáveis de ambiente');
        }

        if (!buttons || buttons.length === 0 || buttons.length > 3) {
            throw new Error('Botões devem ter entre 1 e 3 itens');
        }

        const normalizedPhone = normalizePhoneNumber(to);

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizedPhone,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: bodyText
                },
                action: {
                    buttons: buttons.map(btn => ({
                        type: 'reply',
                        reply: {
                            id: btn.id,
                            title: btn.title.substring(0, 20) // Limite de 20 caracteres
                        }
                    }))
                }
            }
        };

        // Adiciona footer se fornecido
        if (footerText) {
            payload.interactive.footer = { text: footerText };
        }

        const response = await axios.post(buildMessagesUrl(phoneNumberId), payload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.status === 200 && response.data.messages) {
            return true;
        }

        console.error('❌ Resposta inesperada ao enviar botões:', response.data);
        return false;

    } catch (error) {
        if (error.response) {
            console.error('❌ Erro ao enviar botões interativos:', {
                status: error.response.status,
                data: error.response.data,
                to: normalizePhoneNumber(to)
            });
        } else {
            console.error('❌ Erro ao enviar botões:', error.message);
        }
        return false;
    }
}

/**
 * Envia mensagem com lista interativa (até 10 itens por seção)
 * 
 * @param {string} to - Número de destino
 * @param {string} headerText - Texto do cabeçalho
 * @param {string} bodyText - Texto principal
 * @param {string} footerText - Texto do rodapé
 * @param {string} buttonText - Texto do botão que abre a lista
 * @param {Array} sections - Array de seções: [{ title: "Seção", rows: [{ id: "ID", title: "Título", description: "Desc" }] }]
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppInteractiveList(to, headerText, bodyText, footerText, buttonText, sections, options = {}) {
    try {
        if (!WHATSAPP_TOKEN) {
            throw new Error('Credenciais não configuradas');
        }

        const phoneNumberId = resolvePhoneNumberId(options);
        if (!phoneNumberId) {
            throw new Error('WHATSAPP_PHONE_NUMBER_ID não configurado nas variáveis de ambiente');
        }

        if (!sections || sections.length === 0 || sections.length > 10) {
            throw new Error('Seções devem ter entre 1 e 10 itens');
        }

        const normalizedPhone = normalizePhoneNumber(to);

        // Estrutura CORRETA conforme Meta v22.0: header e footer vão em 'interactive', não em 'action'
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizedPhone,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: {
                    text: bodyText.substring(0, 1024)
                },
                action: {
                    button: buttonText.substring(0, 20),
                    sections: sections.map(section => {
                        const sectionObj = {
                            rows: section.rows.map(row => {
                                const rowObj = {
                                    id: row.id.substring(0, 200),
                                    title: row.title.substring(0, 24)
                                };
                                // Adiciona description APENAS se existir
                                if (row.description) {
                                    rowObj.description = row.description.substring(0, 72);
                                }
                                return rowObj;
                            })
                        };
                        // Adiciona title da seção APENAS se existir
                        if (section.title) {
                            sectionObj.title = section.title.substring(0, 24);
                        }
                        return sectionObj;
                    })
                }
            }
        };

        console.log('📤 LIST MESSAGE payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(buildMessagesUrl(phoneNumberId), payload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.status === 200 && response.data.messages) {
            console.log('✅ Lista interativa enviada com sucesso');
            return true;
        }

        console.error('❌ Resposta inesperada ao enviar lista:', response.data);
        return false;

    } catch (error) {
        if (error.response) {
            console.error('❌ Erro ao enviar lista interativa:', {
                status: error.response.status,
                code: error.response.data?.error?.code,
                message: error.response.data?.error?.message,
                to: to
            });
        } else {
            console.error('❌ Erro ao enviar lista:', error.message);
        }
        return false;
    }
}

/**
 * Valida se as credenciais estão configuradas
 * 
 * @returns {object} { valid: boolean, missing: string[] }
 */
function validateCredentials() {
    const missing = [];

    if (!WHATSAPP_TOKEN) missing.push('WHATSAPP_TOKEN');
    if (getConfiguredPhoneNumberIds().length === 0) {
        missing.push('WHATSAPP_PHONE_NUMBER_ID (ou WHATSAPP_PHONE_NUMBER_ID_1/_2, PHONE_NUMBER_ID, PHONE_NUMBER_ID_1/_2)');
    }

    return {
        valid: missing.length === 0,
        missing
    };
}

module.exports = {
    sendWhatsAppText,
    markMessageAsRead,
    normalizePhoneNumber,
    validateCredentials,
    registerPendingPhoneNumbers,
    sendWhatsAppInteractiveButtons,
    sendWhatsAppInteractiveList,
    // Baixa mídia (mediaId) da Graph API e retorna buffer + mimeType
    downloadWhatsAppMedia: async function (mediaId) {
        try {
            if (!WHATSAPP_TOKEN) throw new Error('WHATSAPP_TOKEN não configurado');
            if (!mediaId) throw new Error('mediaId obrigatório');

            // Primeiro, obtém a URL do media
            const metaRes = await axios.get(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
                timeout: 10000
            });

            const mediaUrl = metaRes.data && (metaRes.data.url || metaRes.data['url']);
            if (!mediaUrl) throw new Error('URL de mídia não encontrada na resposta da API');

            // Faz download do conteúdo
            const fileRes = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
                timeout: 20000
            });

            const contentType = fileRes.headers['content-type'] || fileRes.headers['Content-Type'] || '';
            return { buffer: Buffer.from(fileRes.data), mimeType: contentType };

        } catch (err) {
            if (err.response) {
                console.error('❌ Erro ao obter mídia da Cloud API:', { status: err.response.status, data: err.response.data });
            } else {
                console.error('❌ Erro ao baixar mídia:', err.message);
            }
            throw err;
        }
    }
};
