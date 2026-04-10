// ─── Storage Polyfill ───────────────────────────────────────
// In Claude artifacts, window.storage is a built-in API.
// This polyfill uses localStorage so the app works in a normal browser.
// Replace this with a real database (Firebase, Supabase, etc.) for production.

if (!window.storage) {
  window.storage = {
    async get(key) {
      const val = localStorage.getItem("sk_" + key);
      if (val === null) throw new Error("Key not found");
      return { key, value: val, shared: false };
    },
    async set(key, value) {
      localStorage.setItem("sk_" + key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem("sk_" + key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith("sk_" + prefix)) {
          keys.push(k.replace("sk_", ""));
        }
      }
      return { keys, prefix, shared: false };
    },
  };
}
