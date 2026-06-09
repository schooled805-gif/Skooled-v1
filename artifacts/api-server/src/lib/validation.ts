import type { Request, Response } from "express";

/**
 * Convert a thrown error into an HTTP response. Zod parse errors are duck-typed
 * by their `issues` array (so we don't depend on a specific zod instance) and
 * become a 400 with a human-readable message naming the offending field — so
 * the client can tell the user exactly what to fix (e.g. an invalid date or a
 * missing required field). Everything else is logged and returned as a 500.
 */
export function handleRouteError(req: Request, res: Response, err: unknown): void {
  const anyErr = err as { issues?: Array<{ path?: unknown[]; message?: string }> };
  if (anyErr && Array.isArray(anyErr.issues)) {
    const msg = anyErr.issues
      .map((i) => {
        const path = Array.isArray(i.path) ? i.path.filter(Boolean).join(".") : "";
        return path ? `${path}: ${i.message ?? "invalid"}` : i.message ?? "invalid";
      })
      .join("; ");
    res.status(400).json({ error: msg || "Invalid request" });
    return;
  }
  req.log.error(err);
  res.status(500).json({ error: "Internal server error" });
}
