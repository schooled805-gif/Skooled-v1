import express, { type Express } from "express";
import cors from "cors";
import pinoHttpModule, { type Options } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { verifySupabaseJwt, stripClientUserHeaders } from "./middleware/auth";

const pinoHttp = pinoHttpModule as unknown as (
  opts?: Options,
) => express.RequestHandler;

const app: Express = express();

const pinoOptions: Options = {
  logger,
  serializers: {
    req(req: any) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },
    res(res: any) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
};

app.use(pinoHttp(pinoOptions));

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Public routes — strip client-supplied user headers but don't require a token
app.get("/api/health", stripClientUserHeaders);
app.get("/api/schools/:id", stripClientUserHeaders);
app.post("/api/profiles", stripClientUserHeaders);

// All other /api routes require a verified Supabase JWT
app.use("/api", (req, res, next) => {
  // Skip routes already handled above
  if (
    (req.method === "GET" && req.path === "/health") ||
    (req.method === "GET" && /^\/schools\/[^/]+$/.test(req.path)) ||
    (req.method === "POST" && req.path === "/profiles")
  ) {
    return next();
  }
  return verifySupabaseJwt(req, res, next);
});

app.use("/api", router);

export default app;
