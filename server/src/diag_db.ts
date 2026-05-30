import db from "./db";

async function diag() {
    await db.ready();
    console.log("Database Ready.");
    
    try {
        const userCols = await db.prepare(
            "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
        ).all();
        console.log("Users Columns:", userCols.map((c: any) => c.name).join(", "));
        
        const mediaCols = await db.prepare(
            "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'media' ORDER BY ordinal_position"
        ).all();
        console.log("Media Columns:", mediaCols.map((c: any) => c.name).join(", "));

        const verifyCols = await db.prepare(
            "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'verification_codes' ORDER BY ordinal_position"
        ).all();
        console.log("Verify Columns:", verifyCols.map((c: any) => c.name).join(", "));
    } catch (e: any) {
        console.error("Diag Error:", e.message);
    }
}

diag();
