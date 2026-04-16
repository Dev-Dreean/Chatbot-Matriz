/**
 * ========== CONFIGURAÇÃO DE RESPONSÁVEIS ==========
 * 
 * Mapeamento de responsáveis por categoria de demanda
 * Inclui: Contato Direto, Email, Telefone WhatsApp
 */

const STAFF_CONTACTS = {
    LETICIA: {
        name: 'LETICIA',
        phone: '48991548500',
        email: 'folha.sc@plansul.com.br',
        category: 'Folha de Ponto'
    },
    GREICE: {
        name: 'GREICE',
        phone: '48999851313',
        email: ['rct.sc@plansul.com.br', 'ferias.sc@plansul.com.br'],
        category: 'Férias e Rescisão'
    },
    CAMILA: {
        name: 'CAMILA',
        phone: '48991510032',
        email: 'beneficios.sc@plansul.com.br',
        category: 'Vale Alimentação e Vale Transporte'
    },
    BRUNO: {
        name: 'BRUNO',
        phone: '48984044848',
        email: 'admissao.sc@plansul.com.br',
        category: 'Admissão'
    },
    NATALIA: {
        name: 'NATALIA',
        phone: '48988081313',
        email: 'apoio@plansul.com.br',
        category: 'Uniforme e Apoio'
    }
};

/**
 * Mapeamento de categorias aos responsáveis
 */
const CATEGORY_STAFF_MAP = {
    // Folha Ponto
    CAT_FOLHA_PONTO: STAFF_CONTACTS.LETICIA,
    FP_ENVIO: STAFF_CONTACTS.LETICIA,
    FP_DUVIDAS: STAFF_CONTACTS.LETICIA,
    FP_MANUAL: STAFF_CONTACTS.LETICIA,
    fp_manual: STAFF_CONTACTS.LETICIA,

    // Contracheque
    CAT_CONTRACHEQUE: STAFF_CONTACTS.LETICIA,
    CC_ENVIO: STAFF_CONTACTS.LETICIA,
    CC_DUVIDAS: STAFF_CONTACTS.LETICIA,
    cc_envio: STAFF_CONTACTS.LETICIA,

    // Férias
    CAT_FERIAS: STAFF_CONTACTS.GREICE,
    FER_AVISO: STAFF_CONTACTS.GREICE,
    FER_RECIBO: STAFF_CONTACTS.GREICE,
    FER_DUVIDAS: STAFF_CONTACTS.GREICE,
    ferias_aviso: STAFF_CONTACTS.GREICE,
    ferias_recibo: STAFF_CONTACTS.GREICE,

    // Atestados Médicos
    CAT_ATESTADOS: STAFF_CONTACTS.LETICIA,
    AT_ENVIO: STAFF_CONTACTS.LETICIA,
    AT_DUVIDAS: STAFF_CONTACTS.LETICIA,
    atestados_envio: STAFF_CONTACTS.LETICIA,

    // Rescisão
    CAT_RESCISAO: STAFF_CONTACTS.GREICE,
    RESCISAO_1: STAFF_CONTACTS.GREICE,
    RESCISAO_2: STAFF_CONTACTS.GREICE,
    RESCISAO_3: STAFF_CONTACTS.GREICE,
    RESCISAO_4: STAFF_CONTACTS.GREICE,
    rescisao_aviso: STAFF_CONTACTS.GREICE,
    rescisao_rct: STAFF_CONTACTS.GREICE,

    // Vale Alimentação
    CAT_VALE_ALIMENTACAO: STAFF_CONTACTS.CAMILA,
    VA_PERDA: STAFF_CONTACTS.CAMILA,
    VA_COMPROVANTE: STAFF_CONTACTS.CAMILA,
    VA_DUVIDAS: STAFF_CONTACTS.CAMILA,
    va_comprovante: STAFF_CONTACTS.CAMILA,

    // Vale Transporte
    CAT_VALE_TRANSPORTE: STAFF_CONTACTS.CAMILA,
    VT_PERDA: STAFF_CONTACTS.CAMILA,
    VT_COMPROVANTE: STAFF_CONTACTS.CAMILA,
    VT_DUVIDAS: STAFF_CONTACTS.CAMILA,
    vt_comprovante: STAFF_CONTACTS.CAMILA,

    // Admissão
    CAT_ADMISSAO: STAFF_CONTACTS.BRUNO,
    ADM_CONTRATO: STAFF_CONTACTS.BRUNO,
    ADM_CRACHA: STAFF_CONTACTS.BRUNO,
    ADM_EXAME: STAFF_CONTACTS.BRUNO,
    ADM_DUVIDAS: STAFF_CONTACTS.BRUNO,
    admissao_contrato: STAFF_CONTACTS.BRUNO,
    admissao_cracha: STAFF_CONTACTS.BRUNO,

    // Uniforme
    CAT_UNIFORME: STAFF_CONTACTS.NATALIA,
    UNI_RECIBO: STAFF_CONTACTS.NATALIA,
    UNI_TROCA: STAFF_CONTACTS.NATALIA,
    uniforme_recibo: STAFF_CONTACTS.NATALIA
};

/**
 * Obtém informações de contato do responsável por categoria
 * @param {string} categoryId - ID da categoria
 * @returns {object|null} Dados do responsável ou null
 */
function getStaffForCategory(categoryId) {
    if (!categoryId) return null;
    return CATEGORY_STAFF_MAP[categoryId] || null;
}

/**
 * Formata mensagem com informações de contato do responsável
 * @param {object} staff - Objeto do responsável
 * @returns {string} Mensagem formatada
 */
function formatStaffContact(staff) {
    if (!staff) return '';
    
    let message = `\n📞 *Responsável:* ${staff.name}\n`;
    message += `📱 WhatsApp: ${formatPhoneNumber(staff.phone)}\n`;
    
    if (Array.isArray(staff.email)) {
        message += `📧 Email: ${staff.email.join(', ')}\n`;
    } else if (staff.email) {
        message += `📧 Email: ${staff.email}\n`;
    }
    
    return message;
}

/**
 * Formata número de telefone para exibição
 * @param {string} phone - Número sem formatação
 * @returns {string} Número formatado
 */
function formatPhoneNumber(phone) {
    const cleaned = String(phone || '').replace(/\D/g, '');
    if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
}

/**
 * Lista todos os responsáveis
 * @returns {array} Array com todos os responsáveis
 */
function getAllStaff() {
    return Object.values(STAFF_CONTACTS);
}

module.exports = {
    STAFF_CONTACTS,
    CATEGORY_STAFF_MAP,
    getStaffForCategory,
    formatStaffContact,
    formatPhoneNumber,
    getAllStaff
};
