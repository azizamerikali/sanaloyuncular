/**
 * Vercel Serverless Function entry point: COMMONJS REDEMPTION
 * 
 * We use the proven CommonJS require pattern to avoid all ESM/module 
 * resolution issues that have plagued the previous iterations.
 */

// 1. Register ts-node to handle our TypeScript server files
require('ts-node/register');

// 2. Export the handler using CommonJS
module.exports = async (req, res) => {
  try {
    // Lazy load the Express application (which is authored in TS)
    const app = require("../server/src/app").default;

    // Handle routing adjustments for Vercel
    const matchedPath = req.headers["x-matched-path"];
    if (matchedPath && matchedPath.startsWith("/api")) {
      req.url = matchedPath;
    }

    // Delegate to Express
    return app(req, res);
  } catch (error) {
    console.error("❌ CRITICAL BOOT ERROR:", error);
    res.status(500).json({
      error: "Critical Bootstrap Failure",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      hint: "CommonJS Entry Point failed to bridge to the TS backend. Check server/src/app.ts."
    });
  }
};
