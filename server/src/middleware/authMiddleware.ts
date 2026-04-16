import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export function protect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Yetkisiz erişim: Token bulunamadı. Lütfen giriş yapın." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string, role: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Yetkisiz erişim: Token geçersiz veya süresi dolmuş." });
  }
}
