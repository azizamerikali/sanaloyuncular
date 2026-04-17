const fs = require('fs');
const path = require('path');

const files = [
  'server/src/routes/assignments.ts',
  'server/src/routes/auth.ts',
  'server/src/routes/consents.ts',
  'server/src/routes/favorites.ts',
  'server/src/routes/media.ts',
  'server/src/routes/payments.ts',
  'server/src/routes/projects.ts',
  'server/src/routes/users.ts',
  'server/src/routes/verify.ts',
  'server/src/routes/system.ts',
  'server/src/app.ts'
];

files.forEach(f => {
  const fullPath = path.resolve(f);
  if (!fs.existsSync(fullPath)) return;
  
  let c = fs.readFileSync(fullPath, 'utf8');
  
  // 1. Convert handlers to async (router.xxx or app.xxx)
  // Replaced previous regex with one that handles app. and router.
  c = c.replace(/(router|app)\.(get|post|put|delete)\(((['"].+?['"])),\s*(((?!async).+?,\s*)*)(\((req:?.*?,\s*res:?.*?)\)\s*=>)/g, (match, prefix, method, path, q, middleware, lastMid, params, inner) => {
     return `${prefix}.${method}(${path}, ${middleware || ''}async ${params}`;
  });

  // Specifically fix health-db in app.ts if missed
  if (f.includes('app.ts')) {
     c = c.replace(/app\.get\("\/api\/health-db",\s*\(/g, 'app.get("/api/health-db", async (');
  }

  // 2. Ensure ALL db calls are awaited
  // prepare().all(), prepare().get(), prepare().run()
  c = c.replace(/(?<!await\s+)db\.prepare\(.+?\)\.(all|get|run)\(/g, 'await $&');
  
  // Fix specifically what the log showed: await db.prepare (WRONG) vs db.prepare (CORRECT)
  // Actually, await (db.prepare().get()) is correct.
  // But await db.prepare().get() is also correct in JS.

  fs.writeFileSync(fullPath, c);
  console.log(`Fixed ${f}`);
});
