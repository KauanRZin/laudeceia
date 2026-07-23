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
