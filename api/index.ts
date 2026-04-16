import { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    message: "Isolation Test: Success",
    time: new Date().toISOString(),
    env: process.env.VERCEL ? "vercel" : "local",
    tips: "If you see this, the Vercel Lambda infrastructure is working. The issue is in the server imports."
  });
}
