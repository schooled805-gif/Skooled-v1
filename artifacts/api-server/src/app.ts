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
app.use(express.json({
  limit: "5mb",
  // Capture the raw body so payment webhooks can verify HMAC signatures.
  verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Public routes — strip client-supplied user headers but don't require a token.
// These are called during signup before a verified session exists.
const PUBLIC_ROUTES: Array<{ method: string; test: (path: string) => boolean }> = [
  { method: "GET",  test: p => p === "/health" || p === "/healthz" },
  { method: "GET",  test: p => /^\/schools(\/[^/]+)?$/.test(p) },
  { method: "GET",  test: p => p === "/students/lookup" },
  { method: "GET",  test: p => p === "/profiles/email-exists" },
  { method: "POST", test: p => p === "/profiles" },
  { method: "POST", test: p => p === "/schools" },
  { method: "POST", test: p => p === "/parent-student-links" },
  // Payment provider webhooks — no bearer token; authenticity is verified
  // inside the handler via provider signature/hash.
  { method: "POST", test: p => p === "/fees/webhook/paystack" },
  { method: "POST", test: p => p === "/fees/webhook/ozow" },
];

app.use("/api", (req, res, next) => {
  const isPublic = PUBLIC_ROUTES.some(
    r => r.method === req.method && r.test(req.path),
  );
  if (isPublic) {
    // Strip any spoofed identity headers but don't require a token
    delete req.headers["x-user-id"];
    delete req.headers["x-user-email"];
    return next();
  }
  return verifySupabaseJwt(req, res, next);
});

app.use("/api", router);

export default app;
