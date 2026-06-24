# SeguraPro Backend

API Node.js + Express + Prisma/PostgreSQL para o SeguraPro.

## Local

1. Copie `.env.example` para `.env`.
2. Ajuste `DATABASE_URL` e `JWT_SECRET`.
3. Instale dependências:

```bash
npm install
```

4. Rode migrations e seed:

```bash
npx prisma migrate dev
npm run prisma:seed
```

5. Inicie a API:

```bash
npm run dev
```

Endpoints úteis:

- `GET /health`
- `GET /api-docs`

Sem PostgreSQL local, é possível validar apenas health/docs/CORS com:

```bash
SKIP_DATABASE_CONNECT=true npm run dev
```

Não use `SKIP_DATABASE_CONNECT=true` em produção.

Usuários locais do seed:

- `admin@seguradora.com` / `123456`
- `gerente@seguradora.com` / `123456`
- `ana@seguradora.com` / `123456`

## Docker local

```bash
docker compose up --build
```

O compose sobe PostgreSQL e API em `http://localhost:3000`.

## Deploy no Render

1. Crie um PostgreSQL gerenciado no Render.
2. Copie a `DATABASE_URL` gerada pelo Render.
3. Crie um Web Service para o backend.
4. Configure as variáveis:

```text
DATABASE_URL=<url do Postgres Render>
JWT_SECRET=<segredo forte>
JWT_EXPIRES_IN=1d
CORS_ORIGIN=<domínio do front>
NODE_ENV=production
```

Não configure `SKIP_DATABASE_CONNECT` no Render.

5. Configure o Build Command:

```bash
npm install && npx prisma generate
```

6. Configure o Start Command:

```bash
npm run start:migrate
```

O Render injeta `PORT`; a aplicação usa essa variável automaticamente.

## Decisões

- `Client` possui relação N:N com `Vinculo`, validada na service layer com máximo de dois vínculos.
- A API retorna `vinculos: string[]` e também mantém `vinculo: string` como compatibilidade temporária com o protótipo.
- `Seguro de Vida` (`tipoId = 1`) sempre persiste `fimVigencia` como `null`.
- O usuário `SuperAdmin` é criado apenas pelo seed e não pode ser criado, editado ou inativado via API.
