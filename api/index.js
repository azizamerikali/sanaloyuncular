/**
 * Vercel Serverless Function entry point in CommonJS.
 * 
 * We use CommonJS (module.exports) to ensure maximum compatibility 
 * with the Vercel Node runtime and avoid ESM/tsc runtime conflicts.
 */

// Register ts-node to handle TypeScript imports from the server directory
require('ts-node/register');

module.exports = async (req, res) => {
  try {
    // 1. Lazy load the Express application (TS file)
    // For CommonJS, we use the .default property from the required TS module
    const app = require("../server/src/app").default;

    // 2. Handle routing fix for Vercel
    const matchedPath = req.headers["x-matched-path"];
    if (matchedPath && matchedPath.startsWith("/api")) {
      req.url = matchedPath;
    }

    // 3. Delegate to Express
    return app(req, res);
  } catch (error) {
    console.error("❌ CRITICAL BOOT ERROR:", error);
    res.status(500).json({
      error: "Critical Bootstrap Failure",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      hint: "CommonJS Entry Point loaded but failed to require the TS app."
    });
  }
};
