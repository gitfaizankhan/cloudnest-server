import "../config/env.js";
import pino from "pino";

const env = process.env.NODE_ENV?.trim() || "production";

const logger = pino({
  transport:
    env === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

export default logger;
