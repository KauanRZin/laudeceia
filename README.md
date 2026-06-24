# SeguraPro

Projeto separado por responsabilidade:

- `backend/`: API Express + Prisma/PostgreSQL, Docker e configuração para Render.
- `frontend/`: aplicação React + Vite + TypeScript + Tailwind + Axios.

## Desenvolvimento local

Backend:

```bash
cd backend
npm install
SKIP_DATABASE_CONNECT=true npm run dev
```

Use `SKIP_DATABASE_CONNECT=true` apenas para validar health/docs/CORS sem PostgreSQL local.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Render

Backend:

- Root Directory: `backend`
- Runtime: Docker ou Node
- Dockerfile: `backend/Dockerfile`
- Start Command se usar Node: `npm run start:migrate`
- Variáveis: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `NODE_ENV=production`

Frontend:

- Tipo: Static Site
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Variável: `VITE_API_URL=https://<url-do-backend-render>`

Não configure `SKIP_DATABASE_CONNECT` no Render.
