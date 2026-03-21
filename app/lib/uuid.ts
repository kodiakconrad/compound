import * as Crypto from "expo-crypto";

/** Generate a v4 UUID using expo-crypto (works in Hermes / React Native). */
export function uuid(): string {
  return Crypto.randomUUID();
}
