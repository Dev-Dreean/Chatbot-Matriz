const messageTemplates = {
    MAIN_MENU: {
        header: 'Assistente Plansul',
        body: 'Ola {NAME}!\n\nAssistente Plansul por aqui.\nNo que posso te ajudar?\n\nEscolha uma opcao:\n1. Cadastros e Pagamentos\n2. Recrutamento e Selecao\n3. Atestados\n4. Ponto\n5. Uniformes\n6. Rescisao\n7. Ferias\n8. Falar com atendente',
        footer: 'Escolha uma opcao abaixo.',
        buttonText: 'Ver opcoes'
    },
    FOLHA_CONFIRM: {
        header: 'Substituir folha ponto',
        body: '{NAME}, voce ja enviou a folha de *{MES}*.\n\nQuer substituir pelo novo PDF?',
        footer: 'Escolha uma opcao:'
    },
    AGUARD_PDF: 'Perfeito, {NAME}. Pode enviar o PDF quando quiser.\n\nDigite *menu* para voltar',
    PDF_RECEBIDO: 'Perfeito, {NAME}.\n\nSeu documento foi recebido e sera analisado.\n\nDigite *menu* para voltar',
    FORMATO_INVALIDO: 'Formato invalido, {NAME}.\n\nSo aceito arquivos em PDF.\n\nDigite *menu* para voltar',
    TIPO_INVALIDO: 'Tipo de arquivo invalido, {NAME}.\n\nApenas PDF e aceito.\n\nDigite *menu* para voltar',
    NAO_ENTENDI: 'Nao entendi, {NAME}.\n\nUse os botoes para responder ou digite *menu* para voltar ao inicio.'
};

function getMessage(key, replacements = {}) {
    const template = messageTemplates[key];

    if (!template) {
        console.warn(`Template nao encontrado: ${key}`);
        return '';
    }

    if (typeof template === 'object' && !Array.isArray(template)) {
        const result = {};
        for (const [field, value] of Object.entries(template)) {
            result[field] = value;
            for (const [varKey, varValue] of Object.entries(replacements)) {
                result[field] = result[field].replace(new RegExp(`{${varKey}}`, 'g'), varValue);
            }
        }
        return result;
    }

    let result = template;
    for (const [varKey, varValue] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`{${varKey}}`, 'g'), varValue);
    }

    return result;
}

function getVariation(key, replacements = {}) {
    return getMessage(key, replacements);
}

module.exports = {
    getMessage,
    getVariation,
    messageTemplates
};
