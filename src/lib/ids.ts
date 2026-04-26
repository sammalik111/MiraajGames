// Short, URL-safe random ids. Replaces nanoid for our limited needs —
// 12 chars from a 36-char alphabet = ~62 bits of entropy, fine for user
// and message ids at our scale.
export function makeId(len = 12): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  // crypto.getRandomValues is available in Node 19+ and all modern browsers.
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
