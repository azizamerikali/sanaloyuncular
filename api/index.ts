import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless Function — Express adapter
 *
 * Problem: Vercel's rewrite { source: "/api/(.*)", destination: "/api" }
 * rewrites the URL to just "/api" before calling this function.
 * The function receives req.url = "/" (Vercel strips the /api base path).
 * Express routes registered as /api/auth/google then fail to match → 404.
 *
 * Fix: Restore the original request path from the x-matched-path header,
 * which Vercel sets to the original path that matched the rewrite rule.
 *
 * Cold-start fix: await startupPromise so the DB is fully initialized
 * (WASM loaded + schema created) before handling any request.
 */
export default async function handler(req: any, res: any) {
    // Wait for DB initialization + schema creation to complete on cold starts
    await startupPromise;

    // x-matched-path = the original source path before the rewrite
    // e.g. for a request to /api/auth/google → x-matched-path = "/api/auth/google"
    const matchedPath = req.headers["x-matched-path"] as string | undefined;

    if (matchedPath && matchedPath.startsWith("/api")) {
        req.url = matchedPath;
        req.originalUrl = matchedPath;
    } else if (!req.url || req.url === "/" || !req.url.startsWith("/api")) {
        // Fallback: if Vercel did strip /api prefix, restore it
        req.url = "/api" + (req.url && req.url !== "/" ? req.url : "");
        req.originalUrl = req.url;
    }

    return app(req, res);
}
