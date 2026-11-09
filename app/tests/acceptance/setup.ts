// Setup file — registers CJS mocks for native Expo modules and infrastructure
// modules BEFORE any step file is loaded. This prevents expo-sqlite and
// expo-crypto (native modules unavailable in Node) from being imported.
//
// cucumber.js lists this file first in the require array so it runs before
// step definitions.

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Mock expo-sqlite — prevents the real module (which needs native binaries)
// from loading. db/database.ts imports this.
// ---------------------------------------------------------------------------
const expoSqlitePath = require.resolve("expo-sqlite");
require.cache[expoSqlitePath] = {
  id: expoSqlitePath,
  filename: expoSqlitePath,
  loaded: true,
  children: [],
  path: "",
  paths: [],
  exports: {
    openDatabaseSync: () => null,
  },
} as any;

// Also mock sub-modules that expo-sqlite tries to load
const subModules = [
  "expo-sqlite/build/SQLiteDatabase",
  "expo-sqlite/build/SQLiteSession",
  "expo-sqlite/build/SQLiteStatement",
  "expo-sqlite/build/hooks",
];
for (const mod of subModules) {
  try {
    const modPath = require.resolve(mod);
    require.cache[modPath] = {
      id: modPath,
      filename: modPath,
      loaded: true,
      children: [],
      path: "",
      paths: [],
      exports: {},
    } as any;
  } catch {
    // Module may not be resolvable, skip
  }
}

// ---------------------------------------------------------------------------
// Mock expo-crypto — prevents the real module from loading.
// lib/uuid.ts imports this.
// ---------------------------------------------------------------------------
const expoCryptoPath = require.resolve("expo-crypto");
require.cache[expoCryptoPath] = {
  id: expoCryptoPath,
  filename: expoCryptoPath,
  loaded: true,
  children: [],
  path: "",
  paths: [],
  exports: {
    randomUUID: () => crypto.randomUUID(),
  },
} as any;

// ---------------------------------------------------------------------------
// Mock db/database — provides getDatabase() that reads from a global.
// Repositories import this module.
// ---------------------------------------------------------------------------
const dbPath = require.resolve("../../db/database");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  children: [],
  path: "",
  paths: [],
  exports: {
    getDatabase: () => (globalThis as any).__compound_test_db,
  },
} as any;

// ---------------------------------------------------------------------------
// Mock lib/uuid — provides uuid() using node:crypto.
// Repositories import this module.
// ---------------------------------------------------------------------------
const uuidPath = require.resolve("../../lib/uuid");
require.cache[uuidPath] = {
  id: uuidPath,
  filename: uuidPath,
  loaded: true,
  children: [],
  path: "",
  paths: [],
  exports: {
    uuid: () => crypto.randomUUID(),
  },
} as any;
