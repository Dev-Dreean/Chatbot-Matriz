# 🔍 Monitor de Estado dos Usuários

## ✨ O que foi melhorado?

O bot agora rastreia **exatamente** em qual passo cada usuário está usando o **`UserStateManager`**:

✅ **Persiste em arquivo** (`logs/user-states.json`)  
✅ **Recupera estado ao reiniciar bot**  
✅ **Evita mensagens duplicadas** (triplicação resolvida!)  
✅ **Rastreia timestamp de última atividade**  
✅ **Marcar boas-vindas como "enviadas" antes de enviar** (evita race condition)  

---

## 📊 Como Monitorar os Estados dos Usuários?

### **Opção 1: Acessar o Endpoint de Debug**

Abra no navegador enquanto o bot está rodando:
```
http://localhost:3001/status-debug
```

Vai mostrar:
```json
{
  "status": "online",
  "timestamp": "08/04/2026 14:30:45",
  "userStats": {
    "total": 5,
    "active": 3,
    "inactive": 2
  },
  "activeUsers": [
    {
      "userId": "5531723123248@s.whatsapp.net",
      "step": "waiting_for_input",
      "welcomeSent": true,
      "updatedAt": "08/04/2026 14:30:42"
    }
  ]
}
```

---

### **Opção 2: Verificar Arquivo de Estado**

Os estados são salvos em:
```
logs/user-states.json
```

Cada usuário tem um registro como:
```json
{
  "5531723123248@s.whatsapp.net": {
    "step": "waiting_for_input",
    "userName": "Andre",
    "welcomeSent": true,
    "welcomeSentAt": 1712604642000,
    "updatedAt": 1712604642000,
    "userId": "5531723123248@s.whatsapp.net"
  }
}
```

---

## 🎯 Estados Possíveis de Um Usuário

| Step | Significado |
|------|------------|
| `initial` | Primeiro contato, ainda não recebeu boas-vindas |
| `waiting_for_input` | Recebeu boas-vindas, aguardando ação do usuário |
| `await_name` | Aguardando nome do usuário (cadastro) |
| `await_pdf` | Aguardando envio de PDF (folha ponto) |
| `confirm_replace` | Perguntando se deseja substituir PDF anterior |
| `await_termo_pdf` | Aguardando envio de termo assinado |
| `ponto_submenu` | Aguardando escolha: enviar folha, eletrônico ou manual |

---

## 🔧 Como Usar o StateManager no Código?

### **Obter o estado de um usuário:**
```javascript
const state = stateManager.getState(userId);
console.log(state.step); // Qual step ele está?
console.log(state.welcomeSent); // Já recebeu boas-vindas?
```

### **Definir novo estado:**
```javascript
stateManager.setState(userId, {
    step: 'await_pdf',
    name: 'João Silva',
    month: 'ABRIL'
});
```

### **Marcar que boas-vindas foram enviadas:**
```javascript
stateManager.setWelcomeSent(userId);
// Marca: welcomeSent = true, step = 'waiting_for_input'
```

### **Verificar se usuário já recebeu boas-vindas:**
```javascript
if (stateManager.hasReceivedWelcome(userId)) {
    // Já recebeu, enviar menu direto
}
```

### **Limpar estado de um usuário:**
```javascript
stateManager.clearState(userId);
// Remove do rastreamento
```

### **Ver estatísticas de usuários:**
```javascript
const stats = stateManager.getStats();
// { total: 5, active: 3, inactive: 2 }
```

### **Listar todos os usuários ativos:**
```javascript
const users = stateManager.listActiveUsers();
users.forEach(u => console.log(u));
```

---

## 🐛 Debug de Um Usuário Específico

Se um usuário está com problema, você pode debugar:

```javascript
// No terminal do bot, adicione:
stateManager.debugUser('5531723123248@s.whatsapp.net');
```

Vai mostrar o estado completo:
```
[StateManager] 🔍 DEBUG 5531723123248@s.whatsapp.net:
{
  "step": "waiting_for_input",
  "welcomeSent": true,
  "updatedAt": 1712604642000,
  "userId": "5531723123248@s.whatsapp.net"
}
```

---

## ✅ Problema Resolvido!

### **Antes:** mensagem triplicada
```
Escolha uma das opções:
Escolha uma das opções:
Escolha uma das opções:
```

### **Agora:** Apenas uma vez
- ✅ `sendWelcomeWithButton` marca como enviado **ANTES** de enviar
- ✅ Se chamada novamente, verifica `hasReceivedWelcome()` e pula para menu
- ✅ Estado recuperado ao reiniciar bot

---

## 📁 Arquivos Relacionados

- `lib/user-state-manager.js` - Gerenciador de estado
- `logs/user-states.json` - Arquivo de persistência
- `http://localhost:3001/status-debug` - Endpoint de monitoramento

---

## 💡 Dicas

1. **Limpar estados automática** após 7 dias:
   ```javascript
   stateManager.cleanOldStates(7); // Remove usuários inativos há 7+ dias
   ```

2. **Resetar tudo se precisar** (cuidado!):
   ```javascript
   stateManager.clearAllStates();
   ```

3. **Logs detalhados** estão em `logs/user-states.json` sempre sincronizados!

---

Pronto! Seu bot agora rastreia corretamente o estado de cada usuário! 🎉
