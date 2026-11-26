// The install flow: a pick of 1 of 2, one slot per bar. Everything is worked out from the saved state and the clock when someone taps (no scheduled job).
import { PAIRS } from "./pairs.js";

export const BAR_MS = 6 * 60 * 1000; // one bar. 6 MINUTES FOR TESTING: the real value is 6 hours (6 * 60 * 60 * 1000), to be set back

// Slot k opens at first_pick_at + (k-1) * BAR_MS; the first slot is open before any pick. Open slots wait, with no cap.
export function slots(state, now) {
  const picks = (state.picks || []).length;
  if (picks >= PAIRS.length) return { picks, open: 0, done: true };
  if (!state.first_pick_at) return { picks, open: 1 };
  const start = Date.parse(state.first_pick_at);
  const open = Math.min(PAIRS.length, Math.floor((now - start) / BAR_MS) + 1) - picks;
  return { picks, open: Math.max(0, open), next_unlock_at: open > 0 ? null : new Date(start + picks * BAR_MS).toISOString() };
}

// The two choices of pair n, in an order that is fixed per disk and pair (so a reload shows the same lines) but not the same for every pair.
export async function choices(secret, disk, n) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}-side-${disk}-${n}`)));
  const [business, game] = PAIRS[n - 1];
  const a = { name: business, side: "business" };
  const b = { name: game, side: "game" };
  return bytes[0] & 1 ? [b, a] : [a, b];
}
