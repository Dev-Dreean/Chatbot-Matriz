const express = require('express');
const webhookRouter = require('./routes/webhook');
const { WEBHOOK_CONFIG, validateConfig } = require('./config/whatsappConfig');

validateConfig();

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'whatsapp-cloud-api-multi' });
});

app.use('/', webhookRouter);

app.listen(WEBHOOK_CONFIG.PORT, () => {
  console.log(`Servidor rodando na porta ${WEBHOOK_CONFIG.PORT}`);
  if (WEBHOOK_CONFIG.BASE_URL) {
    console.log(`Webhook: ${WEBHOOK_CONFIG.BASE_URL}/webhook`);
  } else {
    console.log(`Webhook: http://localhost:${WEBHOOK_CONFIG.PORT}/webhook`);
  }
});