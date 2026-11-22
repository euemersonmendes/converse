# CONVERSE — App de Relacionamento, Stories & Bate-Papo (Mobile + Web)

Plataforma completa de comunicação em tempo real e relacionamentos inspirada nas melhores práticas do **WhatsApp** e **Instagram** (Meta), construída em **TypeScript Monorepo** com:

- **`apps/api`**: Backend Node.js 24 + Express 5 + Socket.IO + SQLite (`node:sqlite`) + JWT + Zod + Helmet + Rate Limiting.
- **`apps/web`**: Cliente Web (estilo **WhatsApp Web** + **Instagram Web**) em React 19 + Vite + Tailwind CSS v4 + `qrcode.react`.
- **`apps/mobile`**: Aplicativo Mobile nativo em **React Native + Expo** (iOS / Android) com câmera QR Scanner para parear o Converse Web.
- **`packages/shared`**: Tipos, eventos Socket.IO e constantes compartilhadas.

---

## Principais Recursos

1. **Pareamento Mobile ↔ Web (Estilo WhatsApp Web)**
   - O **Converse Web** gera uma sessão temporária com **QR Code** e **código de 8 dígitos**.
   - O **App Mobile** escaneia o QR Code via câmera (`expo-camera`) ou digita o código em **Perfil & Web**.
   - Sincronização instantânea via WebSocket (`pairing:approved`), gerenciamento de **Dispositivos Conectados** e **revogação remota imediata**.
2. **Mensageria em Tempo Real (Estilo WhatsApp)**
   - Conversas 1-a-1 e Grupos.
   - Idempotência de envio (`clientMessageId`), recibos de entrega e leitura (`✓`, `✓✓` cinza, `✓✓` azul).
   - Indicador de digitação ao vivo, respostas com citação (*Reply-to*), reações com emojis, notas de voz e envio de imagens.
3. **Stories, Feed & Conexões / Match (Estilo Instagram + Relacionamento)**
   - **Stories (24h)** com barra de gradiente e resposta direta para o chat (DM).
   - **Momentos (Feed)** com curtidas (double-tap), comentários e botão de DM.
   - **Conexões & Match** com cálculo de compatibilidade por interesses em comum, *Like*, *Super Spark*, e criação automática de conversa no Match mútuo.

---

## Como Executar

### 1. Instalar dependências
```bash
npm install
```

### 2. Iniciar Backend + Web (em terminais separados)
```bash
# Terminal 1: API & WebSocket (porta 3001)
npm run dev:api

# Terminal 2: Converse Web (porta 5173)
npm run dev:web
```
Acesse **http://localhost:5173**. Você verá a tela de QR Code do Converse Web (e pode usar o **Simulador de Celular** integrado para testar em 1 clique ou escanear com o app mobile!).

### 3. Iniciar App Mobile (Expo)
```bash
npm run dev:mobile
```
> **Dica para celular físico**: defina `EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:3001` antes de rodar `npm run dev:mobile`.

### 4. Rodar Testes Automatizados da API
```bash
npm run test:api
```
