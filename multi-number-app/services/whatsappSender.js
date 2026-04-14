const axios = require('axios');
const { WHATSAPP_CONFIG } = require('../config/whatsappConfig');

class WhatsAppSender {
  constructor() {
    this.API_BASE = `${WHATSAPP_CONFIG.GRAPH_URL}/${WHATSAPP_CONFIG.API_VERSION}`;
    this.TOKEN = WHATSAPP_CONFIG.TOKEN;
    this.PHONE_NUMBER_ID = WHATSAPP_CONFIG.PHONE_NUMBER_ID;
  }

  async sendMessage(recipientPhone, message) {
    try {
      const response = await axios.post(
        `${this.API_BASE}/${this.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.TOKEN}`
          }
        }
      );

      console.log(`Mensagem enviada para ${recipientPhone}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao enviar de ${phoneNumber}:`, error.response?.data?.error || error.message);
      throw error;
    }
  }

  async replyFromSameNumber(phoneNumberId, recipientPhone, message) {
    try {
      const response = await axios.post(
        `${this.API_BASE}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${META_CONFIG.ACCESS_TOKEN}`
          }
        }
      );

      console.log(`Resposta enviada via ${phoneNumberId}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao responder:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async sendTemplate(phoneNumber, recipientPhone, templateName, parameters = []) {
    try {
      const config = PHONE_NUMBERS[phoneNumber];

      const response = await axios.post(
        `${this.API_BASE}/${config.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'pt_BR' },
            components: [
              {
                type: 'body',
                parameters: parameters.map(p => ({ type: 'text', text: p }))
              }
            ]
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${META_CONFIG.ACCESS_TOKEN}`
          }
        }
      );

      console.log(`Template enviado de ${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar template:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async markAsRead(phoneNumberId, messageId) {
    try {
      await axios.post(
        `${this.API_BASE}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${META_CONFIG.ACCESS_TOKEN}`
          }
        }
      );
    } catch (error) {
      console.error('Nao foi possivel marcar como lida');
    }
  }
}

module.exports = new WhatsAppSender();