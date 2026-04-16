import { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    message: "Direct Routing Test: Success",
    time: new Date().toISOString(),
    env: "vercel",
    tips: "If you see this, the routing issue is solved. We can now re-enable the server safely."
  });
}
