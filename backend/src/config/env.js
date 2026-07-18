const dotenv = require("dotenv");

dotenv.config();

const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ,
  corsOrigin: process.env.CORS_ORIGIN ,
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ,
  defaultPwd: process.env.DEFAULTPW,
  superAdminEmail : process.env.SUPERADMIN_EMAIL,
  managerEmail : process.env.MANAGER_EMAIL,
  employeeEmail : process.env.EMPLOYEE_EMAIL
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

module.exports = env;
