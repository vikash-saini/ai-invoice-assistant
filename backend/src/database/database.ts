
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

const databasePath = path.resolve(
    process.cwd(),
    env.databasePath
);

console.log("SQLite database path:", databasePath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);

// Enforce foreign-key constraints.
db.pragma("foreign_keys = ON");

// Wait briefly if another operation holds a database lock.
db.pragma("busy_timeout = 5000");

export default db;
