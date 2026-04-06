// Re-export the platform-appropriate SQLite adapter.
//
// On native (iOS/Android) Metro resolves ./sqlite to ./sqlite.ts (expo-sqlite).
// On web Metro resolves to ./sqlite.web.ts (sql.js WASM fallback) because
// expo-sqlite has no web build in SDK 52.
//
// TypeScript's tsc doesn't know about Metro platform extensions, so it
// follows ./sqlite → sqlite.ts and type-checks against that. sqlite.web.ts
// must keep its Db interface structurally compatible.

export { openDb, uuid, now } from './sqlite';
