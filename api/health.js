module.exports = (req, res) => {
  res.status(200).json({
    message: "Pure JS Isolation Test: Success",
    time: new Date().toISOString(),
    env: "vercel",
    tips: "If you see this, the environment is FIXED. The issue was TypeScript compilation or Lockfile corruption."
  });
};
