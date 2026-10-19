/**
 * API HTTP helpers
 *
 * Shared plumbing for the /api/v1 route handlers used by the mobile app:
 * a handler wrapper that turns thrown errors into JSON error responses,
 * body parsing/validation helpers and the ApiError type.
 *
 * Exports: api, ApiError, readJson, str, oneOf
 * Notes: error bodies are always `{ error: { code, message } }`.
 */
import type { NextRequest } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/db/authz";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export const notFound = () => new ApiError(404, "not_found");
export const badRequest = (message: string) => new ApiError(400, "bad_request", message);

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** Wraps a route handler: plain return values become JSON, known errors
 * become 4xx JSON, anything else a logged 500. */
export function api<Ctx = unknown>(fn: (req: NextRequest, ctx: Ctx) => Promise<unknown>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return out === undefined ? new Response(null, { status: 204 }) : Response.json(out);
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.status, e.code, e.message);
      if (e instanceof UnauthorizedError) return errorResponse(401, "unauthorized", e.message);
      if (e instanceof ForbiddenError) return errorResponse(403, "forbidden", e.message);
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return errorResponse(500, "server_error", "Something went wrong");
    }
  };
}

/** Parses a JSON object body or throws 400. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Expected a JSON object body");
  return body as Record<string, unknown>;
}

/** A trimmed, non-empty string field (max length enforced), or 400. */
export function str(body: Record<string, unknown>, key: string, max = 200): string {
  const v = body[key];
  if (typeof v !== "string" || !v.trim()) throw badRequest(`"${key}" is required`);
  return v.trim().slice(0, max);
}

/** A value from a fixed set, or 400. */
export function oneOf<T extends string>(body: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const v = body[key];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) throw badRequest(`"${key}" must be one of ${allowed.join(", ")}`);
  return v as T;
}
