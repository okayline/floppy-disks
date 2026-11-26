// disk.88x31.app: what a tap on a floppy disk's tag opens. Checks the tap and shows what the tap itself carries: disk, seal, tap count, chip ID, signature and a fingerprint of this tap.
// It keeps, per disk, the last tap number seen and the disk's game state in D1 (database DB), plus short-lived visit tokens: no cookie, no log, nothing about people.
// A good tap opens a visit: the page holds a one-time token in memory only (never stored on the phone) and the server accepts it for a few minutes.
// Each disk's tag has its own key: the first 16 bytes of SHA-256("<TAG_SECRET>-k2-<seal number>"), set on the tag with NFC.cool Tools.
// A tap that checks out under a disk's key can only have come from that disk's tag, so a link edited to another disk's number is refused.
import { checkTap, toHex } from "./sun.js";
import { DISKS, COLOURS } from "./disks.js";
import { PAIRS } from "./pairs.js";
import { installed, PARTS } from "./parts.js";
import { plan, choices, bootAt, machinePlace, fragMs, FRAG_CAP_MS, FRAG_RATE, FRAG_STEP, STEPS, BAR_MS } from "./install.js";
import { floppyCss, floppyBox, floppyScript } from "./floppy.js";

const VISIT_MS = 10 * 60 * 1000;
const FOOTER_URL = "https://dungeon-items.ddddungeon.workers.dev/footer.js";
// A new tap tells the other disk pages open in this browser (a message between tabs, nothing stored) and they try to close themselves; browsers only allow it for some tabs.
const CLOSE_OLD = `if(window.BroadcastChannel){const c=new BroadcastChannel("disk-tabs");c.onmessage=()=>window.close();c.postMessage("new")}`;
const FB_STYLE = "flex:1;box-sizing:border-box;min-width:0;background:#d4d4d4;border-radius:12px;padding:12px";
const PM_STYLE = "flex:1;box-sizing:border-box;padding:8px;min-height:6em;text-align:center;font-size:.6em;min-width:0";
const FOOTER_VERSION = "v0.61";
const hex = (b) => toHex(new Uint8Array(b));
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

// A page is one or more separate panels stacked on the teal background.
const pages = (title, panels, status = 200, script = "") =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
      `<body style="font:18px ui-monospace,'SF Mono',Menlo,Consolas,monospace;background:#0f9a96;color:#000;display:grid;place-items:center;min-height:100vh;margin:0;padding:8px;box-sizing:border-box;overflow-x:hidden">` +
      `<style>button{font:inherit;border:1px solid #808080;border-radius:12px;background:#f2f2f2;color:#000;cursor:pointer}</style>` +
      // Two soft colour shapes behind the panels (decoration only).
      `<div aria-hidden="true" style="position:fixed;left:-70px;top:150px;width:260px;height:260px;border-radius:50%;background:#ffb0d5;opacity:.32;filter:blur(60px);pointer-events:none"></div><div aria-hidden="true" style="position:fixed;right:-80px;top:520px;width:280px;height:280px;border-radius:50%;background:#9ff3e8;opacity:.28;filter:blur(70px);pointer-events:none"></div>` +
      `<div style="position:relative;width:min(22em,100%)">` +
      panels.map((x) => `<div style="background:#c0c0c0;padding:20px;border:1px solid rgba(255,255,255,.75);border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow-wrap:anywhere;box-sizing:border-box;margin:14px 0">${x}</div>`).join("") +
      // The shared footer (dungeon-items' footer.js) draws into the spot under the last panel; data-version is the number it shows.
      `<div id="ddfoot"></div></div><script src="${FOOTER_URL}" data-version="${FOOTER_VERSION}"></script>${script}`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } }
  );
const page = (title, body, status = 200) => pages(title, [`<b id="t">${title}</b><p>${body}</p>`], status);

// The names a disk can be woken with (generated choices only, nothing typed). Shown as they are: no number until the first boot gives the disk its wake number.
const nameWords = (disk) => {
  const c = COLOURS[disk]?.toUpperCase();
  return c ? [`${c}-DISK`, "FLOPPY", "BOOTDISK", `NEON-${c}`] : null;
};

// How a name is shown: the word, the disk number, and after the first boot the wake number (PINK-DISK-0307). The saved name is the word only.
const label = (word, disk, wake) => `${word}-${String(disk).padStart(2, "0")}${wake ? String(wake).padStart(2, "0") : ""}`;

// The public panel: what anyone can see. The number of taps is the last tap number the server has seen for the disk; no chip, signature, installs or machine.
// Status: asleep (not woken), building (woken, not booted), built (booted). The tapper's copy has ids so the page's script can update it.
const publicPanel = (st, disk, note, live, taps) => {
  const heading = st.woke_at ? label(st.name, disk, st.wake_no) : `FLOPPY-${String(disk).padStart(2, "0")}`;
  const state = st.booted_at ? "built" : st.woke_at ? "building" : "asleep";
  return {
    heading,
    html: `<b id="${live ? "pt" : "t"}" style="display:block;font:700 28px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:-.01em;margin-bottom:10px">[${heading}]</b><p style="margin:0;font-size:14px;line-height:1.75">88x31 floppy disk<br>Colour: ${COLOURS[disk]}<br>Taps: ${taps || 0}<br>Status: <span id="${live ? "status" : "st"}" style="display:inline-block;background:#e8e8e8;border:1px solid #808080;border-radius:999px;padding:0 12px">${state}</span></p>${note ? `<p style="font-size:14px">${note}</p>` : ""}`,
  };
};

// The How to play panel, shown on the public page only (the tapped page has How it works instead). Plain text, kura's wording.
const HOW_TO_PLAY = `<b style="font:700 20px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif">How to play</b><ol style="margin:10px 0 0;padding-left:1.4em;font-size:14px;line-height:1.7"><li>Get a disk!</li><li>Tap it with your phone</li><li>Wake it up</li><li>Choose what to install</li><li>Defrag!</li></ol><p style="margin:10px 0 0;font-size:14px;line-height:1.6">After installing all the components, find out which PC you built 🖥️</p>`;

// The How it works panel, the last panel on the tapped page only. A closed <details> (a lot of text), no script. Agreed wording; it makes privacy claims, so keep it true when the tap check or the storage changes.
const HOW_IT_WORKS = `<details><summary style="cursor:pointer;font:700 20px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif">How it works</summary><p style="margin:10px 0 0;font-size:14px;line-height:1.6">Each disk has an NFC tag (an NTAG 424 DNA chip). Every tap, it writes a fresh link carrying an encrypted block (the chip's ID and a tap counter) and a signature made with a key only that disk's tag and our server have. The server checks the signature, so a link edited to another disk's number is refused.</p><p style="margin:10px 0 0;font-size:14px;line-height:1.6">You tap to open the page every time. A link works once: the server refuses any tap it has already seen, so a copied, bookmarked or reloaded link won't work. A good tap opens a 10-minute window for your page to talk to the server. To prove the tap was real, the server gives your page a random token. Your page keeps it only while it's open, and the server saves just a fingerprint of it.</p><p style="margin:10px 0 0;font-size:14px;line-height:1.6">We store nothing on your phone: no cookies, no local storage, no accounts. The server keeps the last tap number per disk, the disk's progress (its name, when it woke, its picks and when they happened), and the fingerprinted tokens, which stop working after 10 minutes and are cleared on the next tap. The page shows the tap's disk, tap number, chip ID and signature, but the chip ID isn't saved.</p></details>`;

// The Privacy panel, on the main page (no disk). Plain text; keep it true when the tap check or the storage changes.
const PRIVACY = `<b style="font:700 20px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif">Privacy</b><p style="margin:10px 0 0;font-size:14px;line-height:1.6">We store nothing on your phone: no cookies, no local storage, no accounts. We don't ask for or save your name, email, phone number or location.</p><p style="margin:10px 0 0;font-size:14px;line-height:1.6">When you tap, the disk sends us its chip ID, a tap number and a signature. We use the signature to check the tap is real, and the tap number so each link works once. The chip ID identifies the disk, not you, and we don't save it.</p><p style="margin:10px 0 0;font-size:14px;line-height:1.6">Our database keeps only the last tap number for each disk, your disk's progress (its name, when it woke, your picks and when you made them), and short-lived tokens, saved only as fingerprints. Our code doesn't read or save your IP address. The site runs on Cloudflare, which handles requests like any website host.</p>`;

// The public page: reads only, writes nothing.
const publicView = async (env, disk, note, status = 200) => {
  const row = await env.DB.prepare("SELECT state, last_tap FROM disks WHERE disk = ?1").bind(disk).first();
  const p = publicPanel(JSON.parse(row?.state || "{}"), disk, note, false, row?.last_tap);
  const st = JSON.parse(row?.state || "{}");
  return pages(p.heading, [floppyCss + floppyBox(false) + p.html, HOW_TO_PLAY], status, `<script>${floppyScript(COLOURS[disk], !!st.booted_at)}</script>`);
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function diskKey(secret, seal) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}-k2-${seal}`));
  return new Uint8Array(hash).slice(0, 16);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const sm = url.pathname.match(/^\/disk\/(\d{1,3})\/(state|names|wake|install|defrag)$/);
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
      if (sm[2] === "defrag") {
        // Defrag: only while a free install runs. It takes a twentieth of the cap (or what is built up, if less; at most what is left of the schedule) off the bar; fragmentation then keeps building from what is left.
        if (request.method !== "POST") return json({ error: "POST only" }, 405);
        if (!state.woke_at) return json({ error: "Wake the disk first" }, 409);
        const now = Date.now();
        const s = plan(state, now);
        if (!s.free) return json({ error: "Nothing to defragment right now" }, 409);
        const frag = fragMs(state, now), saved = Math.floor(Math.min(frag, FRAG_STEP * FRAG_CAP_MS, s.end - now));
        if (saved < 1000) return json({ error: "Nothing to defragment yet" }, 409);
        const picks = state.picks.map((p, i) => (i === state.picks.length - 1 ? { ...p, saved: (p.saved || 0) + saved } : p));
        // Saves only if the disk's state is still the one this request read, so two quick presses can't both save.
        const done = await env.DB.prepare("UPDATE disks SET state = ?1 WHERE disk = ?2 AND state = ?3")
          .bind(JSON.stringify({ ...state, picks, defrag_at: new Date(Math.round(now - (frag - saved) / FRAG_RATE)).toISOString() }), row.disk, d.state).run();
        if (!done.meta.changes) return json({ error: "Try again" }, 409);
        return json({ saved_ms: saved, saved_pct: Math.max(0.1, Math.round((saved / FRAG_CAP_MS) * 1000) / 10) });
      }
      if (sm[2] === "install") {
        if (!state.woke_at) return json({ error: "Wake the disk first" }, 409);
        if (!env.TAG_SECRET) return json({ error: "Not set up" }, 500);
        const now = Date.now();
        const s = plan(state, now);
        const total = STEPS.length;
        if (request.method === "GET") {
          let parts = s.started >= 1 ? installed(s.started) : undefined;
          if (s.done) {
            let st = state;
            if (!st.booted_at && now >= bootAt(st)) {
              // The boot: the machine is picked by the weighted questions' answers. The wake number is the next free one across all disks.
              // One statement does the numbering and the save, and only for a disk that has not booted, so two requests can't boot it twice or take the same number.
              const place = machinePlace(st.picks);
              const at = new Date(now).toISOString();
              const booted = { ...st, booted_at: at, machine: place, history: [...(st.history || []), { event: "boot", machine: place, at }] };
              await env.DB.prepare(
                "UPDATE disks SET state = json_set(?1, '$.wake_no', (SELECT COALESCE(MAX(json_extract(state, '$.wake_no')), 0) + 1 FROM disks)) WHERE disk = ?2 AND json_extract(state, '$.booted_at') IS NULL"
              ).bind(JSON.stringify(booted), row.disk).run();
              st = JSON.parse((await env.DB.prepare("SELECT state FROM disks WHERE disk = ?1").bind(row.disk).first()).state);
            }
            // The wait for the boot shows like the others: a bar and the time left (kura asked for it; it does show when the end is).
            if (!st.booted_at) return json({ parts, picked: s.started, total, ms_left: bootAt(st) - now, ms_total: BAR_MS });
            const mc = await env.DB.prepare("SELECT name FROM machines WHERE place = ?1").bind(st.machine).first();
            // The machine's own part names show only now, at the end; until the boot the list has the plain names. A missing row (or no table) keeps the plain name.
            try {
              const rows = await env.DB.prepare("SELECT part, name FROM machine_parts WHERE place = ?1").bind(st.machine).all();
              const own = Object.fromEntries((rows.results || []).map((r) => [r.part, r.name]));
              parts = parts.map((x) => own[x] || x);
            } catch {}
            return json({ parts, picked: s.started, total, booted: true, machine: mc?.name || "unknown machine", name: label(st.name, row.disk, st.wake_no) });
          }
          if (s.open < 1) {
            // The bar running is a free install's, or the last pick's own; both show the fragmentation line, only a free install offers Defrag.
            const last = state.picks[state.picks.length - 1];
            return json({ parts, picked: s.started, total, installing: s.free || "Installing " + PAIRS[last.pair - 1][last.side === "game" ? 1 : 0], ms_left: s.ms_left, ms_total: BAR_MS, frag: Math.round((fragMs(state, now) / FRAG_CAP_MS) * 1000) / 10, frag_rate: (FRAG_RATE * 100) / FRAG_CAP_MS, can_defrag: !!s.free });
          }
          const ch = await choices(env.TAG_SECRET, row.disk, s.picks + 1);
          return json({ parts, picked: s.started, total, pair: s.picks + 1, choices: ch.options.map((c) => c.name) });
        }
        if (request.method !== "POST") return json({ error: "GET or POST only" }, 405);
        const body = await request.json().catch(() => ({}));
        if (s.done || s.open < 1) return json({ error: "No install is open" }, 409);
        if (body.pair !== s.picks + 1 || (body.choice !== 1 && body.choice !== 2)) return json({ error: "Pick one of the two" }, 400);
        const ch = await choices(env.TAG_SECRET, row.disk, body.pair);
        const picked = ch.options[body.choice - 1];
        const at = new Date(now).toISOString();
        const next = {
          ...state,
          picks: [...(state.picks || []), { pair: ch.pair, side: picked.side, at }],
          history: [...(state.history || []), { event: "install", pair: ch.pair, side: picked.side, at }],
        };
        // Saves only if the number of picks is still what this request saw, so two phones can't take the same slot.
        const saved = await env.DB.prepare("UPDATE disks SET state = ?1 WHERE disk = ?2 AND COALESCE(json_array_length(state, '$.picks'), 0) = ?3")
          .bind(JSON.stringify(next), row.disk, s.picks).run();
        if (!saved.meta.changes) return json({ error: "Already picked" }, 409);
        return json({ picked: s.picks + 1, total, name: picked.name });
      }
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
      const woke = { name: body.name, woke_at: at, picks: [], history: [{ event: "wake", at }] };
      // Only a sleeping disk wakes, and only once: the statement fails if woke_at is already there.
      const saved = await env.DB.prepare("UPDATE disks SET state = ?1 WHERE disk = ?2 AND json_extract(state, '$.woke_at') IS NULL")
        .bind(JSON.stringify(woke), row.disk).run();
      if (!saved.meta.changes) return json({ error: "Already awake" }, 409);
      return json({ disk: row.disk, state: woke });
    }
    const m = url.pathname.match(/^\/disk\/(\d{1,3})$/);
    const disk = m ? Number(m[1]) : 0;
    if (!disk) return pages("88x31 floppy disks", [floppyCss + `<div style="text-align:center;font:700 20px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;margin:0 0 6px">~*~88x31~*~ cLuB fLoPPy DiSk</div>` + floppyBox(false), HOW_TO_PLAY, PRIVACY], 200, `<script>${floppyScript(COLOURS[1], false)}</script>`);
    const name = `FLOPPY-${String(disk).padStart(2, "0")}`;
    // Fail closed: without the secret every key would be guessable.
    if (!env.TAG_SECRET) return page("Not set up", "This page can't check taps right now.", 500);
    if (!DISKS[disk]) return page("Not that disk", `${name} isn't one of the disks.`, 400);
    // No tap in the link: the public panel only.
    if (!url.searchParams.get("picc_data") && !url.searchParams.get("cmac")) return publicView(env, disk, "");
    const key = await diskKey(env.TAG_SECRET, DISKS[disk]);
    const tap = await checkTap(url.searchParams.get("picc_data") || "", url.searchParams.get("cmac") || "", key).catch(() => ({ ok: false }));
    if (!tap.ok) return publicView(env, disk, `This link didn't come from ${name}'s chip.`, 400);
    // A tap opens the page once: its number must be higher than the last one seen for this disk (a refresh, back, bookmark or copied link is refused).
    // One statement does the check and the save, so two quick requests with the same tap can't both pass.
    const saved = await env.DB.prepare(
      "INSERT INTO disks (disk, last_tap) VALUES (?1, ?2) ON CONFLICT(disk) DO UPDATE SET last_tap = ?2 WHERE ?2 > disks.last_tap"
    ).bind(disk, tap.counter).run();
    if (!saved.meta.changes) return publicView(env, disk, "This link opens from a fresh tap. Hold your phone to the disk.", 403);
    // The tap opens a visit: a random token, kept here only as its hash, good for VISIT_MS.
    const visit = hex(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.prepare("DELETE FROM visits WHERE expires < ?1").bind(Date.now()).run();
    await env.DB.prepare("INSERT INTO visits (token_hash, disk, expires) VALUES (?1, ?2, ?3)").bind(await sha256(visit), disk, Date.now() + VISIT_MS).run();
    const cur = await env.DB.prepare("SELECT state FROM disks WHERE disk = ?1").bind(disk).first();
    const awake = JSON.parse(cur?.state || "{}");
    // A sleeping disk shows one button; the page's script (tokens stay in page memory) asks for the names and wakes it.
    const wake = awake.woke_at ? "" : `<style>#b{font:inherit;font-size:1.5em;padding:14px 32px;margin:12px 0}</style><button id="b">Wake up</button>`;
    // Everything shown comes from the tap or the disk list. Nothing derived from the key is shown.
    const sig = (url.searchParams.get("cmac") || "").toUpperCase();
    const fingerprint = (await sha256(`${url.searchParams.get("picc_data")}${url.searchParams.get("cmac")}`.toUpperCase())).slice(0, 16).toUpperCase();
    // The script first swaps the address bar to the short /disk/NN (the long tap link isn't needed after load; a reload then opens the public page). Three panels for the tapper: the public panel on top (with the floppy), the Disk panel (the game) and the Info panel (what the tap carries).
    const heading = awake.woke_at ? label(awake.name, disk, awake.wake_no) : name;
    return pages(
      heading,
      [
        // The public panel first, with the floppy: the same as anyone sees, kept current by the page's script.
        publicPanel(awake, disk, "", true, tap.counter).html,
        // The Disk panel (sized to its contents; the page's fit() keeps each kind of screen at the tallest it has been, so the panel does not wobble with small text changes; the floppy is centered over the Wake up button while asleep): the floppy sits in the disk picture's box, the motherboard's box (parts list, small text) beside it.
        `<div id="W">` + floppyCss + `<div id="pics" style="display:flex;gap:8px;margin:8px 0"><div id="fb" style="${awake.woke_at ? FB_STYLE : "width:50%;margin:0 auto;box-sizing:border-box;min-width:0;background:#d4d4d4;border-radius:12px;padding:12px"}">${floppyBox(true)}</div><div id="pm" style="${awake.woke_at ? PM_STYLE : "display:none"}"></div></div><div id="wake" style="text-align:center">${wake}</div><span id="install"></span></div>`,
        `<b>Secured:</b> signature verified.<br><br><span style="font-size:.8em;color:#222">` +
          `Seal: ${DISKS[disk]}<br>` +
          `Tap: ${tap.counter}<br>` +
          `Chip ID: ${tap.uid.toUpperCase()}<br>` +
          `Signature: ${sig}<br>` +
          `Tap fingerprint: ${fingerprint}</span>`,
        HOW_IT_WORKS,
      ],
      200,
      `<script>if(window.history)history.replaceState(null,"",location.pathname);${CLOSE_OLD}${floppyScript(COLOURS[disk], !!awake.booted_at)}window.visit="${visit}";` +
        `const n=${disk},w=document.getElementById("wake"),b=document.getElementById("b"),W=document.getElementById("W"),HW={},fit=(k)=>{if(!W||!W.offsetHeight)return;W.style.minHeight="0";HW[k]=Math.max(HW[k]||0,W.offsetHeight);W.style.minHeight=HW[k]+"px"};` +
        `const lab=(x)=>x+"-"+String(n).padStart(2,"0"),I=document.getElementById("install"),H={"x-visit":window.visit};` +
        `let T,SW=0,NOTE="",BS=0,HITS=0;const hms=(ms)=>{const s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+" hr "+m+" min":m?m+" min "+(s%60)+" s":s+" s"};const show=async(live)=>{clearInterval(T);clearInterval(SW);SW=0;const r=await fetch("/disk/"+n+"/install",{headers:H}),j=await r.json();I.textContent="";if(!r.ok){I.textContent=j.error;return}` +
        // The disk and the floppy drive side by side (placeholders): the floppy drive picture stays and the parts installed so far are listed on it.
        `const pm=document.getElementById("pm");pm.textContent="";pm.style.cssText="${PM_STYLE}";` +
        `if(j.parts){pm.style.cssText+=";background:#fff;border-radius:12px";pm.append(${JSON.stringify("["+PARTS[0]+"]")});j.parts.forEach(x=>{const q=document.createElement("div");q.textContent="["+x+"]";pm.append(q)})}` +
        `if(j.choices){I.append("Install which one?");` +
        `j.choices.forEach((x,i)=>{const c=document.createElement("button");c.textContent=(i+1)+". "+x;c.style.cssText="display:block;width:100%;box-sizing:border-box;padding:20px 8px;margin:12px 0;font:inherit;font-size:1.1em";` +
        `c.onclick=async()=>{const q=await fetch("/disk/"+n+"/install",{method:"POST",headers:H,body:JSON.stringify({pair:j.pair,choice:i+1})}),k=await q.json();if(q.ok)show();else I.textContent=k.error};` +
        `I.append(c)})}` +
        `else if(j.booted){const mkl=(t)=>{const q=document.createElement("div");q.textContent=t;I.append(q);return q};`+
        `if(!live){mkl("Booting disk...");mkl("Checking 14 installs... OK");mkl("Built "+j.machine);mkl(j.name+" is awake.")}`+
        `else{const my=++BS,sl=(ms)=>new Promise(r=>setTimeout(r,ms)),dots=async(q,t)=>{for(let i=0;i<6;i++){if(my!==BS)return false;q.textContent=t+".".repeat(i%3+1);await sl(400)}return my===BS};`+
        // All four lines are put in hidden first (so the panel is already its final height) and revealed one by one.
        `const L=["Booting disk...","Checking 14 installs... OK","Built "+j.machine,j.name+" is awake."].map(t=>{const q=mkl(t);q.style.visibility="hidden";return q}),vis=(q)=>{q.style.visibility="visible"};`+
        `(async()=>{const[a,c,d,z]=L;vis(a);if(!await dots(a,"Booting disk"))return;await sl(600);if(my!==BS)return;vis(c);if(!await dots(c,"Checking 14 installs"))return;await sl(600);if(my!==BS)return;c.textContent="Checking 14 installs... OK";await sl(600);if(my!==BS)return;vis(d);await sl(800);if(my!==BS)return;vis(z)})()}`+
        `document.getElementById("pt").textContent="["+j.name+"]";document.getElementById("status").textContent="built";if(window.floppyLive)window.floppyLive()}` +
        `else{const N=20,tx=document.createElement("div"),d=document.createElement("span"),box=document.createElement("div"),e=document.createElement("div"),bl=[];` +
        `tx.style.fontWeight="700";tx.append((j.installing||"Copying files"),d);d.style.cssText="display:inline-block;min-width:3ch";` +
        `box.style.cssText="display:flex;gap:2px;padding:2px;margin:8px 0;border:2px inset #fff;background:#c0c0c0";` +
        `for(let i=0;i<N;i++){const x=document.createElement("div");x.style.cssText="flex:1;height:18px";bl.push(x);box.append(x)}` +
        `e.style.cssText="font-size:.8em";I.append(tx,box,e);` +
        // Defrag is a timing game (every hit makes it harder in this page load: the zone 1.5 points narrower down to 4, the sweep 15 percent faster down to 700 ms, both back at the next tap; a hit shows -N% fragmentation in the reserved space): the ^ sweeps right, bounces back left, then right again and off the end (3 legs); Stop inside the yellow zone is a hit and only then is the defrag asked for (a miss changes nothing).
        `let FU=null;if(j.frag!==undefined){const fl=document.createElement("div"),db=document.createElement("button"),mt=document.createElement("div");fl.style.cssText="font-size:.8em";mt.style.cssText="display:flow-root;min-height:64px";if(NOTE){const nn=document.createElement("div");nn.textContent=NOTE;NOTE="";nn.style.cssText="text-align:center;font-weight:bold;padding:8px 0";mt.append(nn)}fl.textContent="Fragmentation: "+j.frag.toFixed(1)+"%";const L0=Date.now();let SH=j.frag,NX=L0+600+Math.random()*3150;FU=()=>{const t=Date.now();if(t>=NX){SH=Math.min(100,j.frag+(t-L0)*(j.frag_rate||0));NX=t+600+Math.random()*3150}fl.textContent="Fragmentation: "+SH.toFixed(1)+"%"};if(!j.can_defrag)I.append(fl);else{` +
        `db.textContent="Defrag";db.style.cssText="display:block;width:100%;box-sizing:border-box;padding:14px 8px;margin:12px 0;font:inherit;font-size:1.1em";` +
        `let t0=0;const ZW=Math.max(4,12-1.5*HITS),ZL=45+Math.random()*35,SWEEP=Math.max(700,1800*Math.pow(.85,HITS));const pos=()=>{const u=(Date.now()-t0)/SWEEP;if(u>=3)return -1;const f=u%1;return(Math.floor(u)%2?1-f:f)*100};` +
        `const fin=async(hit)=>{clearInterval(SW);SW=0;if(!hit){NOTE="";show();return}` +
        `const q=await fetch("/disk/"+n+"/defrag",{method:"POST",headers:H}),k=await q.json();if(q.ok)HITS++;NOTE=q.ok?"-"+k.saved_pct.toFixed(1)+"% fragmentation":k.error;show()};` +
        `db.onclick=()=>{if(SW){const p=pos();fin(p>=ZL&&p<=ZL+ZW);return}` +
        `mt.textContent="";const tr=document.createElement("div"),zn=document.createElement("div"),cr=document.createElement("div");` +
        `tr.style.cssText="position:relative;height:22px;background:#d9b8f0;border:2px inset #fff;margin:12px 0 26px";` +
        `zn.style.cssText="position:absolute;top:0;bottom:0;background:#fff3a0";zn.style.left=ZL+"%";zn.style.width=ZW+"%";` +
        `cr.style.cssText="position:absolute;top:100%;margin:3px 0 0 -8px;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:12px solid #000";` +
        `tr.append(zn,cr);mt.append(tr);db.textContent="Stop";t0=Date.now();` +
        `SW=setInterval(()=>{const p=pos();if(p<0){fin(false);return}cr.style.left=p+"%"},16)};I.append(fl,mt,db)}}` +
        `let k=0;const u=(v,w)=>v+" "+w+(v==1?"":"s");` +
        `const end=Date.now()+j.ms_left,tick=()=>{k++;d.textContent=".".repeat(Math.floor(k/2)%3+1);` +
        `if(FU)FU();const l=end-Date.now();if(l<=0){clearInterval(T);show(true);return}` +
        `bl.forEach((x,i)=>{x.style.background=i<Math.floor((1-l/j.ms_total)*N)?"#000080":"transparent"});` +
        `const s=Math.max(0,Math.ceil(l/1000)-1),h=Math.floor(s/3600),m=Math.floor(s%3600/60);` +
        `e.textContent="Estimated time remaining: "+(h?u(h,"hour")+" "+u(m,"minute"):m?u(m,"minute")+" "+u(s%60,"second"):u(s,"second"));fit(j.can_defrag?"f":"i")};` +
        `T=setInterval(tick,500);tick()}if(NOTE){const m=document.createElement("div");m.textContent=NOTE;NOTE="";I.append(m)}fit(j.choices?"q":j.booted?"b":j.can_defrag?"f":"i")};` +
        `if(!b)show();` +
        `if(b)b.onclick=async()=>{const r=await fetch("/disk/"+n+"/names",{headers:{"x-visit":window.visit}}),j=await r.json();` +
        `if(!r.ok){w.textContent=j.error;return}w.textContent="Pick a name:";` +
        `j.names.forEach(x=>{const c=document.createElement("button");c.textContent=lab(x);c.style.cssText="font:inherit;font-size:1.2em;padding:10px 20px;margin:6px 0";` +
        `c.onclick=async()=>{const r=await fetch("/disk/"+n+"/wake",{method:"POST",headers:{"x-visit":window.visit},body:JSON.stringify({name:x})}),j=await r.json();` +
        `if(r.ok){document.getElementById("fb").style.cssText="${FB_STYLE}";document.getElementById("pt").textContent="["+lab(j.state.name)+"]";document.getElementById("status").textContent="building";w.textContent="";show()}else w.textContent=j.error};w.append(document.createElement("br"),c)})}</script>`
    );
  },
};
