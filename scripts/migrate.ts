import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, getDbClient } from "../src/lib/db/client";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  getDbClient().close();
  console.log("Database migrations applied.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
