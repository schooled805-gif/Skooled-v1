import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

/**
 * Verifies the Supabase Bearer JWT from the Authorization header.
 * On success, sets x-user-id and x-user-email headers internally.
 * Any x-user-id header sent by the client is stripped before verification
 * so it cannot be used to impersonate another user.
 */
export async function verifySupabaseJwt(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Strip any client-supplied x-user-id — never trust it directly
  delete req.headers["x-user-id"];
  delete req.headers["x-user-email"];

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.headers["x-user-id"] = data.user.id;
  if (data.user.email) {
    req.headers["x-user-email"] = data.user.email;
  }

  next();
}

/**
 * Public-route passthrough: strips x-user-id from clients but does NOT
 * require a valid JWT. Use on endpoints that are accessible without login
 * (e.g. school branding, health check).
 */
export function stripClientUserHeaders(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  delete req.headers["x-user-id"];
  delete req.headers["x-user-email"];
  next();
}
