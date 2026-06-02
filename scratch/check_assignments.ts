import db from "../server/src/db";

async function run() {
  await db.ready();
  console.log("Database connection OK");

  try {
    const rows = await db.prepare("SELECT * FROM assignments").all();
    console.log("Assignments table rows:", rows.length);
    if (rows.length > 0) {
      console.log(rows);
    } else {
      console.log("Table is empty.");
    }
  } catch (err: any) {
    console.error("SQL Error fetching assignments:", err.message);
  }
}

run();
