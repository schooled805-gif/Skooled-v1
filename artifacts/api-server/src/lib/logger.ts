import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// pino-pretty runs in a worker thread (thread-stream) resolved by file path.
// On serverless platforms like Vercel that worker cannot be spawned from the
// bundled function, which crashes the whole function at startup
// (FUNCTION_INVOCATION_FAILED). Only enable the pretty transport for genuine
// local development — never on Vercel or in production.
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const usePretty = !isProduction && !isServerless;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(usePretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
