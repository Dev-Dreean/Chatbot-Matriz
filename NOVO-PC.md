# Clonar em outro computador

## Repositorio

- URL: `https://github.com/Dev-Dreean/Chatbot-Matriz.git`
- Branch: `main`

## Passos

1. Clone o repositorio.
2. Rode `npm install`.
3. Crie `.env` a partir de `.env.example`.
4. Preencha:
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WEBHOOK_VERIFY_TOKEN`
   - `PORT`
   - `DATABASE_URL`, se usar banco
   - `LOCAL_DATABASE_ROOT`, se quiser mudar a pasta local padrao
5. Valide com `npm run config:check`.
6. Inicie com `start.bat` ou `npm run launch`.

## Numero oficial

Para o bot responder pelo numero oficial, o `.env` do outro computador precisa apontar para o `WHATSAPP_PHONE_NUMBER_ID` correto desse numero na Meta. O telefone isolado nao basta.

Numero esperado:

- `+55 48 99148-2618`

Observacao:

- No `.env`, use o `WHATSAPP_PHONE_NUMBER_ID` da Matriz no painel da Meta (nao usar o numero de telefone nesse campo).

## Estrutura local

O armazenamento local padrao agora fica em:

`C:\Sistemas\Chatbot-Matriz\Banco de dados`

Organizacao esperada:

- `ano\colaboradores\Nome - Telefone\documentos`
- `ano\colaboradores\Nome - Telefone\historico`
- `ano\colaboradores\Nome - Telefone\relatorios`
- `historico\por-telefone`

## Se quiser manter dados locais

Leve tambem estas pastas quando fizer sentido:

- `bot_data`
- `backup`
- `logs`
