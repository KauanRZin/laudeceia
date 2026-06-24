const prisma = require("./client");

async function connectDatabase() {
  await prisma.$connect();
  console.log("Database connection established");
}

async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log("Database connection closed");
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
