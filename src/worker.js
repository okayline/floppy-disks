// disk.88x31.app: what a tap on a floppy disk's tag opens. Smallest version: check the tap and show which disk and the tap count.
// It keeps one number per disk (the last tap number seen) in KV: no cookie, no log, nothing about people. The key is the NTAG 424 factory key until the tags get their own.
// disks.js says which chip is which disk, so a link edited to another disk's number is refused.
import { checkTap } from "./sun.js";
import { DISKS } from "./disks.js";

const page = (title, body, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:18px monospace;background:#008080;color:#000;display:grid;place-items:center;min-height:100vh;margin:0">` +
      `<div style="background:#c0c0c0;padding:24px;border:2px outset #fff;max-width:22em"><b>${title}</b><p>${body}</p></div>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/disk\/(\d{1,3})$/);
    const disk = m ? Number(m[1]) : 0;
    if (!disk) return page("88x31 floppy disks", "Tap a disk with your phone.");
    const e = url.searchParams.get("e") || "";
    // The tag's link has leftover placeholders after the signature (?uid=...), so read c as its first 16 hex digits.
    const c = ((url.searchParams.get("c") || "").match(/^[0-9a-f]{16}/i) || [""])[0];
    const tap = await checkTap(e, c).catch(() => ({ ok: false }));
    if (!tap.ok) return page("Not a real tap", "This link didn't come from a disk's chip.", 400);
    const name = `FLOPPY-${String(disk).padStart(2, "0")}`;
    if (DISKS[disk] !== tap.uid) return page("Not that disk", `This chip isn't ${name}.`, 400);
    // A tap opens the page once: its number must be higher than the last one seen for this disk (a refresh, back, bookmark or copied link is refused).
    const last = Number((await env.TAPS.get(`disk:${disk}`)) ?? -1);
    if (tap.counter <= last) return page("Tap the disk again", `${name} opens from a fresh tap. Hold your phone to the disk.`, 403);
    await env.TAPS.put(`disk:${disk}`, String(tap.counter));
    return page(name, `Real tap. This disk's chip has been tapped ${tap.counter} time${tap.counter === 1 ? "" : "s"}.`);
  },
};
