// api/store.js
// Exports a simple in-memory store that persists across warm invocations (via globalThis).
// This imitates PropertiesService + Spreadsheet rows from Apps Script.
// IMPORTANT: serverless functions can be recycled; use a real DB for persistence later.

if (!globalThis.__MOCK_CHAT_DB) {
  globalThis.__MOCK_CHAT_DB = {
    conversations: {}, // key -> { key, trainer, associate, startTime, ended, endTime, messages: [..] }
    typing: {} // key -> { userName: timestamp }
  };
}

export const DB = globalThis.__MOCK_CHAT_DB;

// helper to generate conv key (6 uppercase letters/numbers)
export function generateConvKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";
  for (let i = 0; i < 6; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}
