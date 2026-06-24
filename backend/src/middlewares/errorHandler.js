const { Prisma } = require("@prisma/client");
const AppError = require("../utils/AppError");
const env = require("../config/env");

function errorHandler(err, _req, res, _next) {
  let error = err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta && err.meta.target) ? err.meta.target.join(", ") : "registro";
      error = new AppError("Registro já cadastrado", 409, "UNIQUE_CONSTRAINT", { target });
    } else if (err.code === "P2025") {
      error = new AppError("Recurso não encontrado", 404, "NOT_FOUND");
    }
  }

  if (!(error instanceof AppError)) {
    error = new AppError(
      env.nodeEnv === "production" ? "Erro inesperado" : err.message || "Erro inesperado",
      err.statusCode || 500,
      err.code || "INTERNAL_ERROR",
      env.nodeEnv === "production" ? {} : { stack: err.stack }
    );
  }

  res.status(error.statusCode).json({
    error: {
      message: error.message,
      code: error.code,
      details: error.details || {},
    },
  });
}

module.exports = errorHandler;
