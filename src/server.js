import "./config/env.js";

import app from "./app.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT || 3000; // Use PORT from env or default 3000

let server;

const startServer = async () => {
  try {
    // await connectDB();
    // logger.info("✅ Database connected");

    server = app.listen(PORT, () => {
      logger.info(`Server running at http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
      logger.error("Server error: " + error.message);
      process.exit(1);
    });

    // Flag to prevent multiple shutdown attempts
    let isShuttingDown = false;

    // Function to gracefully shutdown the server
    const gracefulShutdown = () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.warn("Shutdown initiated");
      server?.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
  } catch (error) {
    logger.error("Startup error: " + error.message);
    process.exit(1);
  }
};

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection: " + err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception: " + err.message);
  process.exit(1);
});

// Start the server initialization
startServer();
