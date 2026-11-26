// disk.88x31.app: what a tap on a floppy disk's tag opens. Checks the tap and shows what the tap itself carries: disk, seal, tap count, chip ID, signature and a fingerprint of this tap.
// It keeps, per disk, the last tap number seen and the disk's game state in D1 (database DB), plus short-lived visit tokens: no cookie, no log, nothing about people.
// A good tap opens a visit: the page holds a one-time token in memory only (never stored on the phone) and the server accepts it for a few minutes.
// Each disk's tag has its own key: the first 16 bytes of SHA-256("<TAG_SECRET>-k2-<seal number>"), set on the tag with NFC.cool Tools.
// A tap that checks out under a disk's key can only have come from that disk's tag, so a link edited to another disk's number is refused.
import { checkTap, toHex } from "./sun.js";
import { DISKS, COLOURS } from "./disks.js";
import { PAIRS } from "./pairs.js";
import { slots, choices, bootAt, BAR_MS } from "./install.js";

const VISIT_MS = 10 * 60 * 1000;
const hex = (b) => toHex(new Uint8Array(b));
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

const page = (title, body, status = 200, script = "") =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:18px monospace;background:#008080;color:#000;display:grid;place-items:center;min-height:100vh;margin:0">` +
      `<div style="background:#c0c0c0;padding:24px;border:2px outset #fff;max-width:22em;word-break:break-all"><b id="t">${title}</b><p>${body}</p></div>${script}`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

// The names a disk can be woken with (generated choices only, nothing typed). Shown as they are: no number until the first boot gives the disk its wake number.
const nameWords = (disk) => {
  const c = COLOURS[disk]?.toUpperCase();
  return c ? [`${c}-DISK`, "FLOPPY", "BOOTDISK", `NEON-${c}`] : null;
};

// How a name is shown: the word, the disk number, and after the first boot the wake number (PINK-DISK-0307). The saved name is the word only.
const label = (word, disk, wake) => `${word}-${String(disk).padStart(2, "0")}${wake ? String(wake).padStart(2, "0") : ""}`;

// What to call a disk on a page: its picked name once woken, else FLOPPY-NN. Only used after a tap has checked out.
const shownName = async (env, disk, fallback) => {
  const row = await env.DB.prepare("SELECT state FROM disks WHERE disk = ?1").bind(disk).first();
  const st = JSON.parse(row?.state || "{}");
  return st.woke_at ? label(st.name, disk, st.wake_no) : fallback;
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
    const sm = url.pathname.match(/^\/disk\/(\d{1,3})\/(state|names|wake|install)$/);
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
      if (sm[2] === "install") {
        if (!state.woke_at) return json({ error: "Wake the disk first" }, 409);
        if (!env.TAG_SECRET) return json({ error: "Not set up" }, 500);
        const now = Date.now();
        const s = slots(state, now);
        const total = PAIRS.length;
        if (request.method === "GET") {
          // No time is given once every pick is made: the player is never told when the end is.
          if (s.done) {
            let st = state;
            if (!st.booted_at && now >= bootAt(st)) {
              // The boot: the machine is picked by how many games are among the picks. The wake number is the next free one across all disks.
              // One statement does the numbering and the save, and only for a disk that has not booted, so two requests can't boot it twice or take the same number.
              const games = st.picks.filter((p) => p.side === "game").length;
              const at = new Date(now).toISOString();
              const booted = { ...st, booted_at: at, machine: games, history: [...(st.history || []), { event: "boot", machine: games, at }] };
              await env.DB.prepare(
                "UPDATE disks SET state = json_set(?1, '$.wake_no', (SELECT COALESCE(MAX(json_extract(state, '$.wake_no')), 0) + 1 FROM disks)) WHERE disk = ?2 AND json_extract(state, '$.booted_at') IS NULL"
              ).bind(JSON.stringify(booted), row.disk).run();
              st = JSON.parse((await env.DB.prepare("SELECT state FROM disks WHERE disk = ?1").bind(row.disk).first()).state);
            }
            if (!st.booted_at) return json({ picked: s.picks, total });
            const mc = await env.DB.prepare("SELECT name FROM machines WHERE place = ?1").bind(st.machine).first();
            return json({ picked: s.picks, total, booted: true, machine: mc?.name || "unknown machine", name: label(st.name, row.disk, st.wake_no) });
          }
          if (s.open < 1) {
            // The pick being installed is the last one; the bar runs from the slot before the next one to the next one.
            const last = state.picks[state.picks.length - 1];
            return json({ picked: s.picks, total, installing: PAIRS[last.pair - 1][last.side === "game" ? 1 : 0], ms_left: Date.parse(s.next_unlock_at) - now, ms_total: BAR_MS });
          }
          const ch = await choices(env.TAG_SECRET, row.disk, s.picks + 1);
          return json({ picked: s.picks, total, pair: s.picks + 1, open: s.open, choices: ch.map((c) => c.name) });
        }
        if (request.method !== "POST") return json({ error: "GET or POST only" }, 405);
        const body = await request.json().catch(() => ({}));
        if (s.done || s.open < 1) return json({ error: "No install is open" }, 409);
        if (body.pair !== s.picks + 1 || (body.choice !== 1 && body.choice !== 2)) return json({ error: "Pick one of the two" }, 400);
        const picked = (await choices(env.TAG_SECRET, row.disk, body.pair))[body.choice - 1];
        const at = new Date(now).toISOString();
        const next = {
          ...state,
          first_pick_at: state.first_pick_at || at,
          picks: [...(state.picks || []), { pair: body.pair, side: picked.side, at }],
          history: [...(state.history || []), { event: "install", pair: body.pair, side: picked.side, at }],
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
      const woke = { name: body.name, woke_at: at, picks: [], first_pick_at: null, history: [{ event: "wake", at }] };
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
    if (!saved.meta.changes) return page("Tap the disk again", `${await shownName(env, disk, name)} opens from a fresh tap. Hold your phone to the disk.`, 403);
    // The tap opens a visit: a random token, kept here only as its hash, good for VISIT_MS.
    const visit = hex(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.prepare("DELETE FROM visits WHERE expires < ?1").bind(Date.now()).run();
    await env.DB.prepare("INSERT INTO visits (token_hash, disk, expires) VALUES (?1, ?2, ?3)").bind(await sha256(visit), disk, Date.now() + VISIT_MS).run();
    const cur = await env.DB.prepare("SELECT state FROM disks WHERE disk = ?1").bind(disk).first();
    const awake = JSON.parse(cur?.state || "{}");
    // A sleeping disk shows one button; the page's script (tokens stay in page memory) asks for the names and wakes it.
    const wake = awake.woke_at ? "" : `<button id="b">Wake up</button>`;
    // Everything shown comes from the tap or the disk list. Nothing derived from the key is shown.
    const sig = (url.searchParams.get("cmac") || "").toUpperCase();
    const fingerprint = (await sha256(`${url.searchParams.get("picc_data")}${url.searchParams.get("cmac")}`.toUpperCase())).slice(0, 16).toUpperCase();
    return page(
      awake.woke_at ? label(awake.name, disk, awake.wake_no) : name,
      `<b>Secured:</b> signature verified.<br><br>` +
        `Seal: ${DISKS[disk]}<br>` +
        `Tap: ${tap.counter}<br>` +
        `Chip ID: ${tap.uid.toUpperCase()}<br>` +
        `Signature: ${sig}<br>` +
        `Tap fingerprint: ${fingerprint}<br><br>` +
        `<span id="wake">${wake}</span><span id="install"></span>`,
      200,
      `<script>window.visit="${visit}";` +
        `const n=${disk},w=document.getElementById("wake"),b=document.getElementById("b");` +
        `const lab=(x)=>x+"-"+String(n).padStart(2,"0"),I=document.getElementById("install"),H={"x-visit":window.visit};` +
        `let T;const show=async()=>{clearInterval(T);const r=await fetch("/disk/"+n+"/install",{headers:H}),j=await r.json();I.textContent="";if(!r.ok){I.textContent=j.error;return}` +
        `if(j.choices){I.append("Install which one?");` +
        `j.choices.forEach((x,i)=>{const c=document.createElement("button");c.textContent=(i+1)+". "+x;` +
        `c.onclick=async()=>{const q=await fetch("/disk/"+n+"/install",{method:"POST",headers:H,body:JSON.stringify({pair:j.pair,choice:i+1})}),k=await q.json();if(q.ok)show();else I.textContent=k.error};` +
        `I.append(document.createElement("br"),c)})}` +
        `else if(j.booted){["Starting disk...","Checking 14 installs... OK","Found "+j.machine,j.name+" is awake."].forEach(x=>{const q=document.createElement("div");q.textContent=x;I.append(q)});document.getElementById("t").textContent=j.name}` +
        `else{const N=20,tx=document.createElement("div"),d=document.createElement("span"),box=document.createElement("div"),e=document.createElement("div"),bl=[];` +
        `tx.append((j.installing?"Installing "+j.installing:"Copying files"),d);d.style.cssText="display:inline-block;min-width:3ch";` +
        `box.style.cssText="display:flex;gap:2px;padding:2px;margin:8px 0;border:2px inset #fff;background:#c0c0c0";` +
        `for(let i=0;i<N;i++){const x=document.createElement("div");x.style.cssText="flex:1;height:18px";bl.push(x);box.append(x)}` +
        `I.append(tx,box,e);let k=0;const u=(v,w)=>v+" "+w+(v==1?"":"s");` +
        // After the last pick there is no end time to show, so the bar only slides (3 blocks going round) and there is no estimate.
        `const end=Date.now()+(j.ms_left||0),tick=()=>{k++;d.textContent=".".repeat(k%3+1);if(!j.installing&&k%200==0){show();return}` +
        `if(!j.installing){bl.forEach((x,i)=>{x.style.background=(i-k%N+N)%N<3?"#000080":"transparent"});return}` +
        `const l=end-Date.now();if(l<=0){clearInterval(T);show();return}` +
        `bl.forEach((x,i)=>{x.style.background=i<Math.floor((1-l/j.ms_total)*N)?"#000080":"transparent"});` +
        `const s=Math.ceil(l/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);` +
        `e.textContent="Estimated time remaining: "+(h?u(h,"hour")+" "+u(m,"minute"):m?u(m,"minute")+" "+u(s%60,"second"):u(s,"second"))};` +
        `T=setInterval(tick,j.installing?500:300);tick()}};` +
        `if(!b)show();` +
        `if(b)b.onclick=async()=>{const r=await fetch("/disk/"+n+"/names",{headers:{"x-visit":window.visit}}),j=await r.json();` +
        `if(!r.ok){w.textContent=j.error;return}w.textContent="Pick a name:";` +
        `j.names.forEach(x=>{const c=document.createElement("button");c.textContent=lab(x);` +
        `c.onclick=async()=>{const r=await fetch("/disk/"+n+"/wake",{method:"POST",headers:{"x-visit":window.visit},body:JSON.stringify({name:x})}),j=await r.json();` +
        `if(r.ok){document.getElementById("t").textContent=lab(j.state.name);w.textContent="";show()}else w.textContent=j.error};w.append(document.createElement("br"),c)})}</script>`
    );
  },
};
