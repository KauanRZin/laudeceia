# SeguraPro Frontend

Aplicação React + Vite + TypeScript + Tailwind.

## Local

```bash
npm install
npm run dev
```

Configure `.env`:

```text
VITE_API_URL=http://localhost:3000
```

Sem banco/API completa, o login usa fallback de protótipo para:

- `gerente@seguradora.com` / `123456`
- `ana@seguradora.com` / `123456`

## Render Static Site

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variable: `VITE_API_URL=https://<backend-render-url>`
