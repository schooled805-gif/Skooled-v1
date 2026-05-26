import express, { type Express } from "express";
import cors from "cors";
import pinoHttpModule, { type Options } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";

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

const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/api/uploads", express.static(uploadsDir));
app.use("/api", router);

export default app;