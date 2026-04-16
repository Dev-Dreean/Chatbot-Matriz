# Bot Folha Ponto Matriz - iniciar rapido

Numero oficial desta instancia:

- +55 48 99148-2618

## Antes de subir

1. Confirme que existe um arquivo `.env`.
2. Se ainda nao existir, use `.env.example` como base.
3. Valide a configuracao com:

```powershell
npm run config:check
```

Esse comando precisa encontrar:

- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WEBHOOK_VERIFY_TOKEN`

## Formas de iniciar

Opcao 1:

```powershell
start.bat
```

Opcao 2:

```powershell
npm run launch
```

Opcao 3:

```powershell
npm run ngrok:start
npm run dev
```

## Depois de iniciar

1. Copie a URL do ngrok.
2. Configure no painel da Meta:
   - Callback URL: `https://seu-ngrok.ngrok.io/webhook`
   - Verify Token: o mesmo valor de `WEBHOOK_VERIFY_TOKEN`
3. Teste enviando uma mensagem para o numero oficial da Matriz.

## Pasta local

Os arquivos locais do bot ficam em:

`C:\Sistemas\Chatbot-Matriz\Banco de dados`

Estrutura principal:

- `ano\colaboradores\Nome - Telefone\documentos`
- `ano\colaboradores\Nome - Telefone\historico`
- `ano\colaboradores\Nome - Telefone\relatorios`
- `historico\por-telefone`

## Observacao importante

O numero oficial nao fica definido no codigo. O que controla o envio e o `WHATSAPP_PHONE_NUMBER_ID` configurado no `.env`.

Observacao: `WHATSAPP_PHONE_NUMBER_ID` nao e o telefone `+55 48 99148-2618`; ele e obtido no painel da Meta para esse numero.
