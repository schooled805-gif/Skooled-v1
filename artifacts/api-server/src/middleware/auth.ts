import type { NextFunction, Request, Response } from "express";

/**
 * Additive middleware: converts a Supabase Bearer JWT to x-user-id / x-user-email headers.
 * Only fires when x-user-id is NOT already present (web app sets it directly).
 * No JWT signature verification needed — the payload's `sub` is the Supabase user UUID,
 * consistent with the web app's direct-header trust model.
 */
export function bearerToUserHeaders(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.headers["x-user-id"]) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) {
    return next();
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));

    if (typeof payload.sub === "string" && payload.sub) {
      req.headers["x-user-id"] = payload.sub;
    }
    if (typeof payload.email === "string" && payload.email) {
      req.headers["x-user-email"] = payload.email;
    }
  } catch {
    // Malformed JWT — continue without headers
  }

  next();
}
