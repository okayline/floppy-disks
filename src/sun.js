// Checks a tap from an NTAG 424 DNA with Secure Dynamic Messaging (the `e` and `c` on the link).
// WebCrypto has AES-CBC but no AES-ECB and no CMAC, so both are built from CBC with a zero IV.

const ZERO16 = new Uint8Array(16);

export const fromHex = (h) => Uint8Array.from(h.match(/../g) || [], (b) => parseInt(b, 16));
export const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

const importKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-CBC", false, ["encrypt", "decrypt"]);

// One block through AES, forwards: CBC-encrypt with a zero IV and keep the first 16 bytes.
async function encryptBlock(key, block) {
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv: ZERO16 }, key, block));
  return out.slice(0, 16);
}

// One block backwards (what ECB decrypt would give). WebCrypto insists on valid padding, so a second block is added that
// decrypts to exactly the padding: C2 = E(padding XOR C1). The first plaintext block is the answer.
async function decryptBlock(key, block) {
  const pad = block.map((b) => b ^ 0x10);
  const c2 = await encryptBlock(key, pad);
  const both = new Uint8Array(32);
  both.set(block, 0);
  both.set(c2, 16);
  const out = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv: ZERO16 }, key, both));
  return out.slice(0, 16);
}

// Doubling in GF(2^128), for the CMAC sub-keys.
function double(b) {
  const out = new Uint8Array(16);
  for (let i = 0; i < 15; i++) out[i] = ((b[i] << 1) | (b[i + 1] >> 7)) & 0xff;
  out[15] = (b[15] << 1) & 0xff;
  if (b[0] & 0x80) out[15] ^= 0x87;
  return out;
}

// AES-CMAC (RFC 4493), 16 bytes.
export async function cmac(keyBytes, message) {
  const key = await importKey(keyBytes);
  const k1 = double(await encryptBlock(key, ZERO16));
  const k2 = double(k1);
  const n = Math.max(1, Math.ceil(message.length / 16));
  const whole = message.length > 0 && message.length % 16 === 0;
  const m = new Uint8Array(n * 16);
  m.set(message);
  if (!whole) m[message.length] = 0x80;
  const k = whole ? k1 : k2;
  for (let i = 0; i < 16; i++) m[(n - 1) * 16 + i] ^= k[i];
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv: ZERO16 }, key, m));
  return out.slice((n - 1) * 16, n * 16);
}

// e: 32 hex, c: 16 hex. keyBytes: the tag's AES key (the factory key is 16 zero bytes). Returns { ok, uid, counter } or { ok: false }.
export async function checkTap(e, c, keyBytes = new Uint8Array(16)) {
  if (!/^[0-9a-f]{32}$/i.test(e) || !/^[0-9a-f]{16}$/i.test(c)) return { ok: false };
  const pd = await decryptBlock(await importKey(keyBytes), fromHex(e));
  if (pd[0] !== 0xc7) return { ok: false }; // not "ID and tap counter mirrored, 7-byte ID"
  const uid = pd.slice(1, 8);
  const ctr = pd.slice(8, 11); // little-endian
  const sv2 = new Uint8Array([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80, ...uid, ...ctr]);
  const session = await cmac(keyBytes, sv2);
  const full = await cmac(session, new Uint8Array(0)); // empty MAC input: the MAC offset equals the MAC input offset
  const sig = new Uint8Array(8);
  for (let i = 0; i < 8; i++) sig[i] = full[2 * i + 1];
  const want = fromHex(c);
  let diff = 0;
  for (let i = 0; i < 8; i++) diff |= sig[i] ^ want[i];
  if (diff) return { ok: false };
  return { ok: true, uid: toHex(uid), counter: ctr[0] | (ctr[1] << 8) | (ctr[2] << 16) };
}
