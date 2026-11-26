// disk.88x31.app: what a tap on a floppy disk's tag opens. Checks the tap and shows what the tap itself carries: disk, seal, tap count, chip ID, signature and a fingerprint of this tap.
// It keeps, per disk, the last tap number seen and the disk's game state in D1 (database DB), plus short-lived visit tokens: no cookie, no log, nothing about people.
// A good tap opens a visit: the page holds a one-time token in memory only (never stored on the phone) and the server accepts it for a few minutes.
// Each disk's tag has its own key: the first 16 bytes of SHA-256("<TAG_SECRET>-k2-<seal number>"), set on the tag with NFC.cool Tools.
// A tap that checks out under a disk's key can only have come from that disk's tag, so a link edited to another disk's number is refused.
import { checkTap, toHex } from "./sun.js";
import { DISKS, COLOURS } from "./disks.js";

const VISIT_MS = 10 * 60 * 1000;
const hex = (b) => toHex(new Uint8Array(b));
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

const page = (title, body, status = 200, script = "") =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:18px monospace;background:#008080;color:#000;display:grid;place-items:center;min-height:100vh;margin:0">` +
      `<div style="background:#c0c0c0;padding:24px;border:2px outset #fff;max-width:22em;word-break:break-all"><b>${title}</b><p>${body}</p></div>${script}`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

// The name words a disk can be woken with (generated choices only, nothing typed). The disk number is added when shown, e.g. PINK-DISK-03.
const nameWords = (disk) => {
  const c = COLOURS[disk]?.toUpperCase();
  return c ? [`${c}-DISK`, "FLOPPY", "BOOTDISK", `NEON-${c}`] : null;
};
const label = (word, disk) => `${word}-${String(disk).padStart(2, "0")}\u00b7--`; // the wake number comes at the first boot

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function diskKey(secret, seal) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}-k2-${seal}`));
  return new Uint8Array(hash).slice(0, 16);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const sm = url.pathname.match(/^\/disk\/(\d{1,3})\/(state|names|wake)$/);
    if (sm) {
      // The visit token (header x-visit) must be live and belong to this disk. It proves a good tap opened this visit.
      const token = request.headers.get("x-visit") || "";
      const row = /^[0-9a-f]{32}$/.test(token)
        ? await env.DB.prepare("SELECT disk FROM visits WHERE token_hash = ?1 AND expires > ?2").bind(await sha256(token), Date.now()).first()
        : null;
      if (!row || row.disk !== Number(sm[1])) return json({ error: "Tap the disk again" }, 403);
      const d = await env.DB.prepare("SELECT state FROM disks WHERE disk = ?1").bind(row.disk).first();
      const state = JSON.parse(d?.state || "{}");
      if (sm[2] === "state") return json({ disk: row.disk, state });
      const words = nameWords(row.disk);
      if (!words) return json({ error: "Not set up" }, 500);
      if (sm[2] === "names") {
        if (state.woke_at) return json({ error: "Already awake" }, 409);
        // The disk's colour name, plus two of the others in random order.
        const rest = words.slice(1).sort(() => crypto.getRandomValues(new Uint8Array(1))[0] - 128).slice(0, 2);
        return json({ names: [words[0], ...rest] });
      }
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      const body = await request.json().catch(() => ({}));
      if (!words.includes(body.name)) return json({ error: "Pick one of the names" }, 400);
      const at = new Date().toISOString();
      const woke = { name: body.name, woke_at: at, step: 1, history: [{ event: "wake", at }] };
      // Only a sleeping disk wakes, and only once: the statement fails if woke_at is already there.
      const saved = await env.DB.prepare("UPDATE disks SET state = ?1 WHERE disk = ?2 AND json_extract(state, '$.woke_at') IS NULL")
        .bind(JSON.stringify(woke), row.disk).run();
      if (!saved.meta.changes) return json({ error: "Already awake" }, 409);
      return json({ disk: row.disk, state: woke });
    }
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
    // One statement does the check and the save, so two quick requests with the same tap can't both pass.
    const saved = await env.DB.prepare(
      "INSERT INTO disks (disk, last_tap) VALUES (?1, ?2) ON CONFLICT(disk) DO UPDATE SET last_tap = ?2 WHERE ?2 > disks.last_tap"
    ).bind(disk, tap.counter).run();
    if (!saved.meta.changes) return page("Tap the disk again", `${name} opens from a fresh tap. Hold your phone to the disk.`, 403);
    // The tap opens a visit: a random token, kept here only as its hash, good for VISIT_MS.
    const visit = hex(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.prepare("DELETE FROM visits WHERE expires < ?1").bind(Date.now()).run();
    await env.DB.prepare("INSERT INTO visits (token_hash, disk, expires) VALUES (?1, ?2, ?3)").bind(await sha256(visit), disk, Date.now() + VISIT_MS).run();
    const cur = await env.DB.prepare("SELECT state FROM disks WHERE disk = ?1").bind(disk).first();
    const awake = JSON.parse(cur?.state || "{}");
    // A sleeping disk shows one button; the page's script (tokens stay in page memory) asks for the names and wakes it.
    const wake = awake.woke_at ? `Name: ${label(awake.name, disk)}` : `<button id="b">Wake up</button>`;
    // Everything shown comes from the tap or the disk list. Nothing derived from the key is shown.
    const sig = (url.searchParams.get("cmac") || "").toUpperCase();
    const fingerprint = (await sha256(`${url.searchParams.get("picc_data")}${url.searchParams.get("cmac")}`.toUpperCase())).slice(0, 16).toUpperCase();
    return page(
      name,
      `<b>Secured:</b> signature verified.<br><br>` +
        `Seal: ${DISKS[disk]}<br>` +
        `Tap: ${tap.counter}<br>` +
        `Chip ID: ${tap.uid.toUpperCase()}<br>` +
        `Signature: ${sig}<br>` +
        `Tap fingerprint: ${fingerprint}<br><br>` +
        `<span id="wake">${wake}</span>`,
      200,
      `<script>window.visit="${visit}";` +
        `const n=${disk},w=document.getElementById("wake"),b=document.getElementById("b"),` +
        `lab=(x)=>x+"-"+String(n).padStart(2,"0")+"\u00b7--";` +
        `if(b)b.onclick=async()=>{const r=await fetch("/disk/"+n+"/names",{headers:{"x-visit":window.visit}}),j=await r.json();` +
        `if(!r.ok){w.textContent=j.error;return}w.textContent="Pick a name:";` +
        `j.names.forEach(x=>{const c=document.createElement("button");c.textContent=lab(x);` +
        `c.onclick=async()=>{const r=await fetch("/disk/"+n+"/wake",{method:"POST",headers:{"x-visit":window.visit},body:JSON.stringify({name:x})}),j=await r.json();` +
        `w.textContent=r.ok?"Name: "+lab(j.state.name):j.error};w.append(document.createElement("br"),c)})}</script>`
    );
  },
};
