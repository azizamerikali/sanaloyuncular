import db from "./db";

async function diag() {
    await db.ready();
    console.log("Database Ready.");
    
    try {
        const columns = db.prepare("PRAGMA table_info(users)").all();
        console.log("Users Columns:", columns.map((c: any) => c.name).join(", "));
        
        const mediaCols = db.prepare("PRAGMA table_info(media)").all();
        console.log("Media Columns:", mediaCols.map((c: any) => c.name).join(", "));

        const verifyCols = db.prepare("PRAGMA table_info(verification_codes)").all();
        console.log("Verify Columns:", verifyCols.map((c: any) => c.name).join(", "));
    } catch (e: any) {
        console.error("Diag Error:", e.message);
    }
}

diag();
