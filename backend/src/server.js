const app = require("./app");
const env = require("./config/env");
const { connectDatabase, disconnectDatabase } = require("./database/connection");

async function startServer() {
  if (env.skipDatabaseConnect) {
    console.log("Database connection skipped");
  } else {
    await connectDatabase();
  }

  const server = app.listen(env.port, () => {
    console.log(`SeguraPro API listening on port ${env.port}`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      if (!env.skipDatabaseConnect) {
        await disconnectDatabase();
      }
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch(async (error) => {
  console.error("Failed to start server", error);
  if (!env.skipDatabaseConnect) {
    await disconnectDatabase();
  }
  process.exit(1);
});
