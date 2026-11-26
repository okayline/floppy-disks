// disk.88x31.app: what a tap on a floppy disk's tag opens. Smallest version: check the tap and show which disk and the tap count.
// It keeps one number per disk (the last tap number seen) in KV: no cookie, no log, nothing about people.
// Each disk's tag has its own key: the first 16 bytes of SHA-256("<TAG_SECRET>-k2-<seal number>"), set on the tag with NFC.cool Tools.
// A tap that checks out under a disk's key can only have come from that disk's tag, so a link edited to another disk's number is refused.
import { checkTap } from "./sun.js";
import { DISKS } from "./disks.js";

const page = (title, body, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:18px monospace;background:#008080;color:#000;display:grid;place-items:center;min-height:100vh;margin:0">` +
      `<div style="background:#c0c0c0;padding:24px;border:2px outset #fff;max-width:22em"><b>${title}</b><p>${body}</p></div>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

async function diskKey(secret, seal) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}-k2-${seal}`));
  return new Uint8Array(hash).slice(0, 16);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/disk\/(\d{1,3})$/);
    const disk = m ? Number(m[1]) : 0;
    if (!disk) return page("88x31 floppy disks", "Tap a disk with your phone.");
    const name = `FLOPPY-${String(disk).padStart(2, "0")}`;
    // Fail closed: without the secret every key would be guessable.
    if (!env.TAG_SECRET) return page("Not set up", "This page can't check taps right now.", 500);
    if (!DISKS[disk]) return page("Not that disk", `${name} isn't one of the disks.`, 400);
    const key = await diskKey(env.TAG_SECRET, DISKS[disk]);
    const tap = await checkTap(url.searchParams.get("picc_data") || "", url.searchParams.get("cmac") || "", key).catch(() => ({ ok: false }));
    if (!tap.ok) return page("Not a real tap", `This link didn't come from ${name}'s chip.`, 400);
    // A tap opens the page once: its number must be higher than the last one seen for this disk (a refresh, back, bookmark or copied link is refused).
    const last = Number((await env.TAPS.get(`disk:${disk}`)) ?? -1);
    if (tap.counter <= last) return page("Tap the disk again", `${name} opens from a fresh tap. Hold your phone to the disk.`, 403);
    await env.TAPS.put(`disk:${disk}`, String(tap.counter));
    return page(name, `Real tap. This disk's chip has been tapped ${tap.counter} time${tap.counter === 1 ? "" : "s"}.`);
  },
};
