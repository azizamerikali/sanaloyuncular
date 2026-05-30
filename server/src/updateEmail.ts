import db from "./db";

async function updateEmail() {
  await db.ready();
  const info = await db.prepare("UPDATE users SET email = 'azizakal@gmail.com' WHERE id = 'admin1'").run();
  console.log("Updated rows: " + info.changes);
  console.log("Admin1 email successfully matched with azizakal@gmail.com");
}

updateEmail().catch(console.error);
