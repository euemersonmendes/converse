# Guia de Deploy em Produção — CONVERSE

## 1. Backend + Web (Docker / VPS / Cloud)

1. Copie `.env.example` para `.env` e gere um `JWT_SECRET` forte:
   ```bash
   cp .env.example .env
   openssl rand -hex 32
   ```
2. Configure `CORS_ORIGIN` com o domínio oficial do Converse Web (ex: `https://app.converse.com.br`).
3. Suba os containers:
   ```bash
   docker compose up -d --build
   ```
4. Coloque um proxy reverso com HTTPS/SSL na frente (Caddy, Nginx + Certbot ou Cloudflare) apontando para a porta `80` (Web + `/api` + `/socket.io`).

> Em `NODE_ENV=production`:
> - A API **recusa iniciar** se `JWT_SECRET` estiver vazio ou usando o segredo padrão de dev.
> - `/api/auth/demo-users` retorna `404` e `seedDatabase` não cria usuários demo.
> - O botão "Simular Celular" do Converse Web é ocultado automaticamente.

---

## 2. App Mobile (iOS App Store / TestFlight & Google Play)

1. Defina a URL HTTPS de produção antes do build:
   ```bash
   export EXPO_PUBLIC_API_URL=https://api.converse.com.br
   ```
2. **iOS (App Store / TestFlight)**:
   - Em `apps/mobile/ios/Converse/Info.plist`, defina `NSAllowsArbitraryLoads` como `false`.
   - Abra `apps/mobile/ios/Converse.xcworkspace` no Xcode.
   - Em **Signing & Capabilities**, selecione sua conta Apple (`euemersonmendes@gmail.com`) com **Automatically manage signing**.
   - Execute **Product > Archive > Distribute App**.
3. **Android (Google Play)**:
   - Instale o Android Studio / Android SDK (ou use `npx eas-cli build --platform android`).
   - Gere o `.aab` assinado para envio na Google Play Console.
