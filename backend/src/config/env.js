const dotenv = require("dotenv");

dotenv.config();

const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  skipDatabaseConnect: process.env.SKIP_DATABASE_CONNECT === "true",
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

module.exports = env;
