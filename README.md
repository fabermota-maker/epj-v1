# Estoque Journey (PWA)

Controle de estoque de produtos Journey, feito para celular: barra inferior, tela cheia e instalação como app.

Os dados ficam **neste aparelho** (localStorage). Atualizar a página não apaga o estoque. Não há servidor nem sincronização entre celulares.

## Rodar no computador

Precisa de Node.js 22+ e pnpm 10.

```bash
pnpm install
pnpm dev
```

Abre em http://localhost:8443/

## Instalar no celular

PWA só instala em **HTTPS** (ou `localhost`). No Wi‑Fi da casa, `http://192.168.x.x` **não** mostra “Adicionar à tela inicial”.

Caminho recomendado:

1. Faça o build (`pnpm build`) e hospede a pasta `dist` (GitHub Pages, Netlify, Cloudflare Pages).
2. Abra o site no Safari (iPhone) ou Chrome (Android).
3. **iPhone:** Compartilhar → Adicionar à Tela de Início.
4. **Android:** menu → Instalar app / Adicionar à tela inicial.

Offline: depois da primeira visita com internet, o app abre sem rede (estoque já salvo no aparelho).

## Build

```bash
pnpm build
pnpm preview
```

Para GitHub Pages em `usuario.github.io/nome-do-repo`, o workflow já define `BASE_PATH=/nome-do-repo/`.

## Subir no GitHub

```bash
git add .
git commit -m "Estoque Journey PWA"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git branch -M main
git push -u origin main
```

No repositório: Settings → Pages → Source = **GitHub Actions**. O workflow em `.github/workflows/pages.yml` publica o app.
