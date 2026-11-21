import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";
import { recordError } from "./monitor";

/** Wraps a route handler with consistent JSON errors, so bad input never crashes the server. */
export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      const r = args[0] as Request | undefined;
      // Cross-site request forgery: a browser sends the page's Origin on every POST. If another website
      // tries to make her logged-in browser approve, stop or change something, the origins differ.
      // (The bank API uses API keys, not cookies, so it is not affected.)
      if (r instanceof Request && !["GET", "HEAD", "OPTIONS"].includes(r.method)) {
        const origin = r.headers.get("origin");
        if (origin && origin !== "null") {
          let sameSite = false;
          try { sameSite = new URL(origin).host === (r.headers.get("x-forwarded-host") ?? r.headers.get("host")); } catch { /* bad origin */ }
          if (!sameSite && !new URL(r.url).pathname.startsWith("/api/v1/")) return NextResponse.json({ error: "Request from another website refused" }, { status: 403 });
        } else if (origin === "null") {
          return NextResponse.json({ error: "Request from another website refused" }, { status: 403 });
        }
      }
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
