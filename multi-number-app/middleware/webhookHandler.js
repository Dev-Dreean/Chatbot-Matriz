const { identifyPhoneNumber } = require('../config/whatsappConfig');
const whatsappSender = require('../services/whatsappSender');

const userStates = {};

async function handleIncomingMessage(req, res) {
  try {
    const body = req.body;

    const phoneNumberId = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message || !contact) {
      return res.status(200).send('EVENT_RECEIVED');
    }

    const whichNumber = identifyPhoneNumber(phoneNumberId);
    const userPhone = message.from;
    const userName = contact.profile?.name || 'Usuario';
    const messageText = message.text?.body || '';
    const messageId = message.id;

    console.log(`\n[${(whichNumber || 'desconhecido').toUpperCase()}] Nova mensagem recebida`);
    console.log(`De: ${userName} (${userPhone})`);
    console.log(`Texto: "${messageText}"`);

    if (phoneNumberId && messageId) {
      await whatsappSender.markAsRead(phoneNumberId, messageId);
    }

    const text = messageText.toLowerCase().trim();

    if (text === 'menu') {
      const menu = `Ola ${userName}!\n\nEscolha uma opcao:\n1 - Enviar Folha Ponto\n2 - Enviar Atestado\n3 - Falar com Atendente\n\nDigite "menu" para voltar`;
      await whatsappSender.replyFromSameNumber(phoneNumberId, userPhone, menu);

      userStates[userPhone] = {
        lastNumber: whichNumber,
        status: 'menu_shown'
      };
    } else if (text === '1') {
      const msg = `${userName}, envie seu PDF da folha ponto aqui!`;
      await whatsappSender.replyFromSameNumber(phoneNumberId, userPhone, msg);

      userStates[userPhone] = {
        lastNumber: whichNumber,
        status: 'awaiting_pdf'
      };
    } else if (text === '2') {
      const msg = `${userName}, envie seu atestado em PDF!`;
      await whatsappSender.replyFromSameNumber(phoneNumberId, userPhone, msg);

      userStates[userPhone] = {
        lastNumber: whichNumber,
        status: 'awaiting_attestado'
      };
    } else {
      const reply = `${userName}, nao entendi. Digite "menu" para ver as opcoes.`;
      await whatsappSender.replyFromSameNumber(phoneNumberId, userPhone, reply);
    }

    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Erro ao processar mensagem:', error.message);
    return res.status(500).send('Internal Server Error');
  }
}

async function handleWebhookVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const { WEBHOOK_CONFIG } = require('../config/whatsappConfig');

  if (mode === 'subscribe' && token === WEBHOOK_CONFIG.VERIFY_TOKEN) {
    console.log('Webhook verificado com sucesso.');
    return res.status(200).send(challenge);
  }

  console.error('Falha na verificacao do webhook');
  return res.status(403).send('Webhook verification failed');
}

module.exports = {
  handleIncomingMessage,
  handleWebhookVerification
};