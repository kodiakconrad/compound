// Custom Node.js loader that intercepts native Expo modules and
// infrastructure modules that need mocking in tests.
//
// - expo-sqlite / expo-crypto: not available in Node
// - db/database: uses expo-sqlite; replaced with a mock that reads from
//   the global __testDatabase variable (set by world.ts Before hook)
// - lib/uuid: uses expo-crypto; replaced with node:crypto

import { fileURLToPath } from "node:url";
import path from "node:path";

const NATIVE_MOCKS = new Set(["expo-sqlite", "expo-crypto"]);

// Resolve the absolute path to db/database.ts and lib/uuid.ts so we can
// intercept imports to those exact files.
const appRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");
const dbDatabasePath = path.join(appRoot, "db", "database.ts");
const libUuidPath = path.join(appRoot, "lib", "uuid.ts");

export async function resolve(specifier, context, nextResolve) {
  if (NATIVE_MOCKS.has(specifier)) {
    return { shortCircuit: true, url: `mock:${specifier}` };
  }

  // Let the chain resolve first, then check if the result matches our targets
  try {
    const result = await nextResolve(specifier, context);
    const resolvedPath = result.url.startsWith("file://")
      ? fileURLToPath(result.url)
      : null;

    if (resolvedPath === dbDatabasePath) {
      return { shortCircuit: true, url: "mock:db/database" };
    }
    if (resolvedPath === libUuidPath) {
      return { shortCircuit: true, url: "mock:lib/uuid" };
    }

    return result;
  } catch (err) {
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url === "mock:expo-sqlite") {
    return {
      shortCircuit: true,
      format: "module",
      source: `export function openDatabaseSync() { return null; }`,
    };
  }

  if (url === "mock:expo-crypto") {
    return {
      shortCircuit: true,
      format: "module",
      source: `export function randomUUID() { return ""; }`,
    };
  }

  if (url === "mock:db/database") {
    // The getDatabase function reads from a global set by the test world.
    return {
      shortCircuit: true,
      format: "module",
      source: `
        export function getDatabase() {
          return globalThis.__compound_test_db;
        }
      `,
    };
  }

  if (url === "mock:lib/uuid") {
    return {
      shortCircuit: true,
      format: "module",
      source: `
        import { randomUUID } from "node:crypto";
        export function uuid() { return randomUUID(); }
      `,
    };
  }

  return nextLoad(url, context);
}
