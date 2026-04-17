import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless Function entry point (Industry Standard Fix).
 * 
 * We use standard ESM syntax here, but since tsconfig.json is now 
 * set to "module": "CommonJS", the Vercel builder will compile 
 * this to a pure CommonJS bundle that Node.js can execute.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Import the Express application and wait for DB + schema to be ready.
    // This prevents FUNCTION_INVOCATION_FAILED on cold starts where the first
    // request arrives before the async DB initialization completes.
    const { default: app, startupPromise } = await import("../server/src/app");
    await startupPromise;

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
      hint: "Aligned tsconfig to CommonJS. If you still see ESM errors, check sub-dependencies."
    });
  }
}
