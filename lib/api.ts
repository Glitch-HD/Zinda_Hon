import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";
import { recordError } from "./monitor";

/** Wraps a route handler with consistent JSON errors, so bad input never crashes the server. */
export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
      console.error("[api] unexpected error", err);
      const req = args[0] as Request | undefined;
      let route: string | null = null;
      try { route = req?.url ? `${req.method} ${new URL(req.url).pathname}` : null; } catch { /* ignore */ }
      await recordError({ source: "server", route, error: err });
      return NextResponse.json({ error: "Something went wrong. Your progress is saved; please try again." }, { status: 500 });
    }
  };
}
