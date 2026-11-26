// The install flow: a pick of 1 of 2, one slot per bar. Everything is worked out from the saved state and the clock when someone taps (no scheduled job).
import { PAIRS } from "./pairs.js";

export const BAR_MS = 60 * 1000; // one bar. 1 MINUTE FOR TESTING: the real value is 6 hours (6 * 60 * 60 * 1000), to be set back

// The bar restarts at every pick: the next slot opens one bar after the last pick. The first slot is open from the start. One slot is open at a time.
const lastPick = (state) => Date.parse(state.picks[state.picks.length - 1].at);
export function slots(state, now) {
  const picks = (state.picks || []).length;
  if (picks >= PAIRS.length) return { picks, open: 0, done: true };
  if (!picks) return { picks, open: 1 };
  const next = lastPick(state) + BAR_MS;
  return now >= next ? { picks, open: 1 } : { picks, open: 0, next_unlock_at: new Date(next).toISOString() };
}

// The two choices of pair n, in an order that is fixed per disk and pair (so a reload shows the same lines) but not the same for every pair.
export async function choices(secret, disk, n) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}-side-${disk}-${n}`)));
  const [business, game] = PAIRS[n - 1];
  const a = { name: business, side: "business" };
  const b = { name: game, side: "game" };
  return bytes[0] & 1 ? [b, a] : [a, b];
}

// The boot happens one bar after the 14th pick. Never sent to the page.
export const bootAt = (state) => lastPick(state) + BAR_MS;
