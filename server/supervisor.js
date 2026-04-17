/**
 * Simple supervisor: restarts ts-node on any exit (clean or crash).
 * Used so that a database restore (process.exit) auto-recovers without manual intervention.
 */
const { spawn } = require("child_process");
const path = require("path");

function start() {
  console.log("[Supervisor] Starting server...");
  const proc = spawn(
    process.execPath,
    ["-r", "ts-node/register", path.join(__dirname, "src", "app.ts")],
    { stdio: "inherit", env: process.env, cwd: __dirname }
  );

  proc.on("close", (code) => {
    console.log(`\n[Supervisor] Server exited (code ${code}), restarting in 1.5s...`);
    setTimeout(start, 1500);
  });
}

start();
