import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless Function entry point with Resilience Wrapper.
 * 
 * We use dynamic import() inside the handler to prevent the Lambda from 
 * crashing during the module-loading phase. This allows us to catch 
 * any top-level errors (like database init or missing env vars) and 
 * report them as a clear JSON response.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Lazy load the Express application
    const app = (await import("../server/src/app")).default;

    // 2. Handle routing fix for Vercel
    // x-matched-path = the original source path before the rewrite
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
      hint: "The server failed during the module import phase. Check database paths or environment variables."
    });
  }
}
