import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless Function entry point with Resilience Wrapper (TS version).
 * 
 * We use dynamic import() inside the handler to manage the ESM/TSC 
 * resolution and catch any boot-level crashes. This aligns with 
 * "type": "module" in package.json.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Lazy load the Express application
    // Using the default export from the compiled TS app
    const app = (await import("../server/src/app.ts")).default;

    // 2. Handle routing fix for Vercel
    const matchedPath = req.headers["x-matched-path"] as string | undefined;
    if (matchedPath && matchedPath.startsWith("/api")) {
      req.url = matchedPath;
    }

    // 3. Delegate to Express
    return app(req, res);
  } catch (error: any) {
    console.error("❌ CRITICAL BOOT ERROR:", error);
    res.status(500).json({
      error: "Critical Bootstrap Failure",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      hint: "The ESM environment failed to load the server module. Ensure all imports are compatible with type:module."
    });
  }
}
