import "./config/env.js";
import app from "./app.js";
import prisma from "./config/prisma.js";
import { logError } from "./utils/logger.js";

const PORT = process.env.PORT || 8000;

process.on("uncaughtException", (error) => {
  logError("uncaughtException", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const error =
    reason instanceof Error ? reason : new Error(String(reason ?? "Unknown"));
  logError("unhandledRejection", error);
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database connected");

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log("Database disconnected");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    logError("startup", error);
    process.exit(1);
  }
}

startServer();
