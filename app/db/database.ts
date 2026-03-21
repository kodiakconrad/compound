import * as SQLite from "expo-sqlite";

// Single database instance shared across the app.
// Expo SQLite's openDatabaseSync returns the same handle for the same name,
// so this is effectively a singleton.
let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("compound.db");

    // Foreign key enforcement must be enabled on every connection.
    // SQLite defaults to OFF for backwards compatibility.
    db.execSync("PRAGMA foreign_keys = ON;");

    // WAL mode for better concurrent read performance.
    db.execSync("PRAGMA journal_mode = WAL;");
  }
  return db;
}
