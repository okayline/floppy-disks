// The install flow. 14 steps, each one bar long. Most are a pick of 1 of 2 (a question); the rest are free installs that need no pick and start by themselves.
// Everything is worked out from the saved state and the clock when someone taps (no scheduled job). Only the question picks are saved.
import { PAIRS } from "./pairs.js";

export const BAR_MS = 60 * 1000; // one bar. 1 MINUTE FOR TESTING: the real value is 6 hours (6 * 60 * 60 * 1000), to be set back

// The 14 steps in order: q = a question (pick 1 of 2), f = a free install. A question's bar starts at its pick; a free install's bar starts when the step before it ends.
export const STEPS = "qfqfqfqqfqfqfq";
// Names shown while a free install runs (placeholders), in the order the free steps come.
export const FREE = ["Windows 95", "Video drivers", "Sound drivers", "Modem drivers", "CD-ROM drivers", "Notepad"];
// Which questions (counting only questions, from 1) decide the machine. Each one is a bit, game = 1, the first the biggest: 4 of them give 16 endings (places 0 to 15).
// The other questions only decide what the disk has installed.
export const WEIGHTED = [1, 3, 5, 7];

const QSTEP = []; // step number (from 1) of question n+1
const FREE_AFTER = []; // free installs right after question n+1, before the next question
const FREE_AT = {}; // step number of a free install -> its place in FREE
{ let f = 0;
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i] === "q") { QSTEP.push(i + 1); FREE_AFTER.push(0); }
    else { FREE_AFTER[FREE_AFTER.length - 1]++; FREE_AT[i + 1] = f++; }
  } }
export const QUESTIONS = QSTEP.length;

// Where the disk is at time `now`: how many questions are picked, how many of the 14 steps have started (the parts shown follow it), and either
// done (all questions picked), open (the next question can be answered), or the bar that is running (a free install's name, or the pick's own: no `free`) with its time left.
export function plan(state, now) {
  const picks = (state.picks || []).length;
  if (!picks) return { picks, started: 0, open: 1 };
  if (picks >= QUESTIONS) return { picks, started: STEPS.length, done: true };
  const at = lastPick(state), free = FREE_AFTER[picks - 1], stage = Math.floor((now - at) / BAR_MS);
  if (stage > free) return { picks, started: QSTEP[picks - 1] + free, open: 1 };
  const step = QSTEP[picks - 1] + stage;
  return { picks, started: step, open: 0, free: stage ? FREE[FREE_AT[step]] : undefined, ms_left: at + (stage + 1) * BAR_MS - now };
}
const lastPick = (state) => Date.parse(state.picks[state.picks.length - 1].at);

const hash = async (text) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

// The disk's questions: 8 of the pool of pairs, drawn and ordered by the disk's number (the same every time for a disk, not the same for every disk).
async function drawn(secret, disk) {
  const keys = await Promise.all(PAIRS.map(async (_, i) => { const b = await hash(`${secret}-pool-${disk}-${i}`); return [(b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0, i]; }));
  return keys.sort((x, y) => x[0] - y[0] || x[1] - y[1]).slice(0, QUESTIONS).map((k) => k[1] + 1);
}

// Question n of a disk: the pair's number in the pool and its two choices, in an order fixed per disk and question (so a reload shows the same lines) but not the same for every question.
export async function choices(secret, disk, n) {
  const pair = (await drawn(secret, disk))[n - 1];
  const bytes = await hash(`${secret}-side-${disk}-${n}`);
  const [business, game] = PAIRS[pair - 1];
  const a = { name: business, side: "business" };
  const b = { name: game, side: "game" };
  return { pair, options: bytes[0] & 1 ? [b, a] : [a, b] };
}

// The machine: the weighted questions' answers read as a number, game = 1, the first the biggest (0 to 15).
export const machinePlace = (picks) => WEIGHTED.reduce((place, q) => place * 2 + (picks[q - 1]?.side === "game" ? 1 : 0), 0);

// The boot happens one bar after the last question's pick (the last step is a question). Never sent to the page.
export const bootAt = (state) => lastPick(state) + BAR_MS;
