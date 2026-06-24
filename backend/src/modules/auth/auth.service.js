const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const prisma = require("../../database/client");
const AppError = require("../../utils/AppError");
const { serializeUser } = require("../../utils/serializers");

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { vinculos: true },
  });

  if (!user || user.status !== "ATIVO") {
    throw new AppError("E-mail ou senha inválidos", 401, "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError("E-mail ou senha inválidos", 401, "INVALID_CREDENTIALS");
  }

  const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  return { accessToken, user: serializeUser(user) };
}

function me(user) {
  return serializeUser(user);
}

module.exports = { login, me };
