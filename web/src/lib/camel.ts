// Port of the app's src/lib/api.js toCamel, kept byte-for-byte in behaviour so the
// web and the app see the same field names. The important part is `_id` -> `id`:
// server responses mix explicit `id` fields with raw `.lean()` documents, and every
// consumer on both clients reads `.id`.
export function toCamel<T>(input: unknown): T {
  return convert(input) as T;
}

function convert(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convert);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        const key = k === '_id' ? 'id' : k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
        return [key, convert(v)];
      })
    );
  }
  return value;
}
