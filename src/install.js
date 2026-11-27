// The install flow. 8 installs, each one bar long. Each starts at a pick of 1 of 2 (a question); most go on to a free hardware install in the second half of the same bar (14 steps in all).
// Everything is worked out from the saved state and the clock when someone taps (no scheduled job). Only the question picks (and the time Defrag took off each) are saved.
import { PAIRS } from "./pairs.js";

export const BAR_MS = 60 * 1000; // one install's whole bar. 1 MINUTE FOR TESTING: the real value is 1 hour (60 * 60 * 1000), to be set back

// The 14 steps in order: q = a question (pick 1 of 2), f = a free install. A question and the free installs after it share one bar, split in equal parts; the bar starts at the pick.
export const STEPS = "qfqfqfqqfqfqfq";
// What the screen says while a free install runs, by step number: the part that step adds (see parts.js), most of them "Installing <part>".
export const FREE_LINE = { 2: "Installing Power Supply", 4: "Installing Keyboard Cable", 6: "Installing CD-ROM", 9: "Installing CPU", 11: "Installing and testing out Graphics Card", 13: "Backwards-engineering custom drivers for Sound Card" };
// Which questions (counting only questions, from 1) decide the machine. Each one is a bit, game = 1, the first the biggest: 4 of them give 16 endings (places 0 to 15).
// The other questions only decide what the disk has installed.
export const WEIGHTED = [1, 2, 3, 4];

const QSTEP = []; // step number (from 1) of question n+1
const FREE_AFTER = []; // free installs right after question n+1, before the next question
for (let i = 0; i < STEPS.length; i++) {
  if (STEPS[i] === "q") { QSTEP.push(i + 1); FREE_AFTER.push(0); }
  else FREE_AFTER[FREE_AFTER.length - 1]++;
}
export const QUESTIONS = QSTEP.length;

// Fragmentation builds only during an install, from a quarter of its bar to the end (it holds still before that and between installs) and carries over to the next. Each install adds 7/60 of the cap
// (a third of a bar: 20 minutes of 60), so eight installs with no Defrag end at 93 percent. A successful press takes a hundredth of the cap (what is built up, if less) off the running bar
// (12 seconds at the real pace, 200 ms at the 1-minute test pace; it moves the rest of the schedule earlier).
export const FRAG_FROM = 0.25;
export const FRAG_RATE = 7 / 135; // per millisecond of bar progress past FRAG_FROM: 7/60 of the cap over three quarters of a bar
export const FRAG_CAP_MS = BAR_MS / 3;
// One successful Defrag takes this fraction of the cap off (not everything), the same every time.
export const FRAG_STEP = 0.01;
// What is built up: what every install so far has added (by its progress, Defrag time counted) less all that Defrag has taken off.
export const fragMs = (state, now) => {
  let grown = 0, cleared = 0;
  for (const p of state.picks || []) {
    const progress = Math.min(BAR_MS, now - Date.parse(p.at) + (p.saved || 0));
    grown += Math.max(0, progress - FRAG_FROM * BAR_MS) * FRAG_RATE;
    cleared += p.saved || 0;
  }
  return Math.min(FRAG_CAP_MS, Math.max(0, grown - cleared));
};

// Where the disk is at time `now`: how many questions are picked, how many of the 14 steps have started (the parts shown follow it), and whether all questions are picked (done) or the next can be answered (open).
// While a bar runs (the last question's too) it also gives: the free install's name if one is on (no `free`: the pick's own part of the bar), the time left, the end, the time until the next part
// of the bar starts (if there is one) and until fragmentation starts to build.
export function plan(state, now) {
  const picks = (state.picks || []).length;
  if (!picks) return { picks, started: 0, open: 1 };
  const at = lastPick(state), free = FREE_AFTER[picks - 1], end = at + BAR_MS, done = picks >= QUESTIONS;
  if (now >= end) return { picks, started: QSTEP[picks - 1] + free, open: done ? 0 : 1, done };
  const part = BAR_MS / (free + 1), stage = Math.max(0, Math.floor((now - at) / part)), step = QSTEP[picks - 1] + stage;
  return { picks, started: step, open: 0, done, free: stage ? FREE_LINE[step] : undefined, ms_left: end - now, end,
    ms_next: stage < free ? at + (stage + 1) * part - now : undefined, grow_in: Math.max(0, at + FRAG_FROM * BAR_MS - now) };
}
// When the last pick's bar started, moved earlier by what Defrag has taken off since that pick.
const lastPick = (state) => { const p = state.picks[state.picks.length - 1]; return Date.parse(p.at) - (p.saved || 0); };

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
