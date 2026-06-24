const jwt = require("jsonwebtoken");
const env = require("../config/env");
const prisma = require("../database/client");
const AppError = require("../utils/AppError");

async function auth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Token ausente", 401, "TOKEN_MISSING"));
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { vinculos: true },
    });

    if (!user || user.status !== "ATIVO") {
      return next(new AppError("Token inválido", 401, "TOKEN_INVALID"));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Token inválido ou expirado", 401, "TOKEN_INVALID"));
  }
}

module.exports = auth;
