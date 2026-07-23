const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const env = require("./config/env");
const swaggerSpec = require("./config/swagger");
const errorHandler = require("./middlewares/errorHandler");
const authRoutes = require("./modules/auth/auth.routes");
const clientsRoutes = require("./modules/clients/clients.routes");
const usersRoutes = require("./modules/users/users.routes");
const vinculosRoutes = require("./modules/vinculos/vinculos.routes");
const insuranceTypesRoutes = require("./modules/insuranceTypes/insuranceTypes.routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
 
// Rate limit geral pra API inteira (protege contra abuso/scraping básico)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);
 
// Rate limit mais restrito só pras rotas de autenticação (login, forgot-password, etc)
// Protege contra brute force de senha e spam de e-mail/whatsapp de reset
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Muitas tentativas. Tente novamente em alguns minutos.", code: "TOO_MANY_ATTEMPTS" } },
});
app.use("/auth", authLimiter);


app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     security: []
 *     responses:
 *       200:
 *         description: API online
 */
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/auth", authRoutes);
app.use("/clients", clientsRoutes);
app.use("/users", usersRoutes);
app.use("/vinculos", vinculosRoutes);
app.use("/insurance-types", insuranceTypesRoutes);

app.use((_req, _res, next) => {
  const AppError = require("./utils/AppError");
  next(new AppError("Rota não encontrada", 404, "ROUTE_NOT_FOUND"));
});

app.use(errorHandler);

module.exports = app;
