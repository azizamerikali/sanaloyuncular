import { Request, Response, NextFunction } from "express";
import db from "../db";

/**
 * Middleware that ensures the database is initialized and not in the middle
 * of a restore operation before allowing any API request to proceed.
 * 
 * If the DB is busy, it waits until it's ready.
 */
export const dbReadyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This waits for initPromise and isRestoring flag
    await db.ready();
    next();
  } catch (error: any) {
    console.error("❌ DB Ready Middleware Error:", error.message);
    res.status(503).json({ 
      error: "Database Service Unavailable", 
      message: "The database is currently initializing or being restored. Please try again in a few seconds." 
    });
  }
};
