// disk.88x31.app: what a tap on a floppy disk's tag opens. Checks the tap and shows what the tap itself carries: disk, seal, tap count, chip ID, signature and a fingerprint of this tap.
// It keeps, per disk, the last tap number seen and the disk's game state in D1 (database DB), plus short-lived visit tokens: no cookie, no log, nothing about people.
// A good tap opens a visit: the page holds a one-time token in memory only (never stored on the phone) and the server accepts it for a few minutes.
// Each disk's tag has its own key: the first 16 bytes of SHA-256("<TAG_SECRET>-k2-<seal number>"), set on the tag with NFC.cool Tools.
// A tap that checks out under a disk's key can only have come from that disk's tag, so a link edited to another disk's number is refused.
import { checkTap, toHex } from "./sun.js";
import { DISKS, COLOURS } from "./disks.js";
import { PAIRS } from "./pairs.js";
import { installed } from "./parts.js";
import { plan, choices, bootAt, machinePlace, fragMs, FRAG_CAP_MS, FRAG_RATE, STEPS, BAR_MS } from "./install.js";
import { floppyCss, floppyBox, floppyScript } from "./floppy.js";

const VISIT_MS = 10 * 60 * 1000;
const FOOTER_URL = "https://dungeon-items.ddddungeon.workers.dev/footer.js";
// A new tap tells the other disk pages open in this browser (a message between tabs, nothing stored) and they try to close themselves; browsers only allow it for some tabs.
const CLOSE_OLD = `if(window.BroadcastChannel){const c=new BroadcastChannel("disk-tabs");c.onmessage=()=>window.close();c.postMessage("new")}`;
const PM_STYLE = "flex:1;box-sizing:border-box;padding:8px;min-height:6em;text-align:center;font-size:.6em;min-width:0";
const FOOTER_VERSION = "v0.42";
const hex = (b) => toHex(new Uint8Array(b));
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

// A page is one or more separate panels stacked on the teal background.
const pages = (title, panels, status = 200, script = "") =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
      `<body style="font:18px monospace;background:#008080;color:#000;display:grid;place-items:center;min-height:100vh;margin:0;padding:8px;box-sizing:border-box">` +
      `<div style="width:min(22em,100%)">` +
      panels.map((x) => `<div style="background:#c0c0c0;padding:24px;border:2px outset #fff;overflow-wrap:anywhere;box-sizing:border-box;margin:12px 0">${x}</div>`).join("") +
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
    html: `<b id="${live ? "pt" : "t"}">${heading}</b><p>88x31 floppy disk<br>Colour: ${COLOURS[disk]}<br>Taps: ${taps || 0}<br>Status: <span id="${live ? "status" : "st"}">${state}</span></p>${note ? `<p>${note}</p>` : ""}`,
  };
};

// The public page: reads only, writes nothing.
const publicView = async (env, disk, note, status = 200) => {
  const row = await env.DB.prepare("SELECT state, last_tap FROM disks WHERE disk = ?1").bind(disk).first();
  const p = publicPanel(JSON.parse(row?.state || "{}"), disk, note, false, row?.last_tap);
  const st = JSON.parse(row?.state || "{}");
  return pages(p.heading, [floppyCss + floppyBox(false) + p.html], status, `<script>${floppyScript(COLOURS[disk], !!st.booted_at)}</script>`);
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
        // Defrag: only while a free install runs. It takes the built-up fragmentation (at most what is left of the schedule) off the bar and starts it again from zero.
        if (request.method !== "POST") return json({ error: "POST only" }, 405);
        if (!state.woke_at) return json({ error: "Wake the disk first" }, 409);
        const now = Date.now();
        const s = plan(state, now);
        if (!s.free) return json({ error: "Nothing to defragment right now" }, 409);
        const saved = Math.floor(Math.min(fragMs(state, now), s.end - now));
        if (saved < 1000) return json({ error: "Nothing to defragment yet" }, 409);
        const picks = state.picks.map((p, i) => (i === state.picks.length - 1 ? { ...p, saved: (p.saved || 0) + saved } : p));
        // Saves only if the disk's state is still the one this request read, so two quick presses can't both save.
        const done = await env.DB.prepare("UPDATE disks SET state = ?1 WHERE disk = ?2 AND state = ?3")
          .bind(JSON.stringify({ ...state, picks, defrag_at: new Date(now).toISOString() }), row.disk, d.state).run();
        if (!done.meta.changes) return json({ error: "Try again" }, 409);
        return json({ saved_ms: saved });
      }
      if (sm[2] === "install") {
        if (!state.woke_at) return json({ error: "Wake the disk first" }, 409);
        if (!env.TAG_SECRET) return json({ error: "Not set up" }, 500);
        const now = Date.now();
        const s = plan(state, now);
        const total = STEPS.length;
        if (request.method === "GET") {
          const parts = s.started >= 1 ? installed(s.started) : undefined;
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
            return json({ parts, picked: s.started, total, booted: true, machine: mc?.name || "unknown machine", name: label(st.name, row.disk, st.wake_no) });
          }
          if (s.open < 1) {
            // The bar running is a free install's, or the last pick's own.
            const last = state.picks[state.picks.length - 1];
            return json({ parts, picked: s.started, total, installing: s.free || PAIRS[last.pair - 1][last.side === "game" ? 1 : 0], ms_left: s.ms_left, ms_total: BAR_MS, frag: s.free ? Math.round((fragMs(state, now) / FRAG_CAP_MS) * 100) : undefined, frag_rate: s.free ? (FRAG_RATE * 100) / FRAG_CAP_MS : undefined });
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
    if (!disk) return page("88x31 floppy disks", "Tap a disk with your phone.");
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
    const wake = awake.woke_at ? "" : `<button id="b">Wake up</button>`;
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
        // The Disk panel: the floppy sits in the disk picture's box, the motherboard's box (parts list, small text) beside it.
        floppyCss + `<p><span id="wake">${wake}</span></p><div id="pics" style="display:flex;gap:8px;margin:8px 0"><div style="flex:1;box-sizing:border-box;min-width:0">${floppyBox(true)}</div><div id="pm" style="${PM_STYLE}"></div></div><span id="install"></span>`,
        `<b>Secured:</b> signature verified.<br><br><span style="font-size:.8em">` +
          `Seal: ${DISKS[disk]}<br>` +
          `Tap: ${tap.counter}<br>` +
          `Chip ID: ${tap.uid.toUpperCase()}<br>` +
          `Signature: ${sig}<br>` +
          `Tap fingerprint: ${fingerprint}</span>`,
      ],
      200,
      `<script>if(window.history)history.replaceState(null,"",location.pathname);${CLOSE_OLD}${floppyScript(COLOURS[disk], !!awake.booted_at)}window.visit="${visit}";` +
        `const n=${disk},w=document.getElementById("wake"),b=document.getElementById("b");` +
        `const lab=(x)=>x+"-"+String(n).padStart(2,"0"),I=document.getElementById("install"),H={"x-visit":window.visit};` +
        `let T,SW=0,NOTE="";const hms=(ms)=>{const s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+" hr "+m+" min":m?m+" min "+(s%60)+" s":s+" s"};const show=async()=>{clearInterval(T);clearInterval(SW);SW=0;const r=await fetch("/disk/"+n+"/install",{headers:H}),j=await r.json();I.textContent="";if(!r.ok){I.textContent=j.error;return}` +
        // The disk and the motherboard side by side (placeholders): the motherboard picture stays and the parts installed so far are listed on it.
        `const pm=document.getElementById("pm");pm.textContent="";pm.style.cssText="${PM_STYLE}";` +
        `if(j.parts){pm.style.cssText+=";border:2px inset #fff;background:#fff";pm.append("[motherboard]");j.parts.forEach(x=>{const q=document.createElement("div");q.textContent="["+x+"]";pm.append(q)})}` +
        `if(j.choices){I.append("Install which one?");` +
        `j.choices.forEach((x,i)=>{const c=document.createElement("button");c.textContent=(i+1)+". "+x;c.style.cssText="display:block;width:100%;box-sizing:border-box;padding:20px 8px;margin:12px 0;font:inherit;font-size:1.1em";` +
        `c.onclick=async()=>{const q=await fetch("/disk/"+n+"/install",{method:"POST",headers:H,body:JSON.stringify({pair:j.pair,choice:i+1})}),k=await q.json();if(q.ok)show();else I.textContent=k.error};` +
        `I.append(c)})}` +
        `else if(j.booted){["Starting disk...","Checking 14 installs... OK","Found "+j.machine,j.name+" is awake."].forEach(x=>{const q=document.createElement("div");q.textContent=x;I.append(q)});document.getElementById("pt").textContent=j.name;document.getElementById("status").textContent="built";if(window.floppyLive)window.floppyLive()}` +
        `else{const N=20,tx=document.createElement("div"),d=document.createElement("span"),box=document.createElement("div"),e=document.createElement("div"),bl=[];` +
        `tx.append((j.installing?"Installing "+j.installing:"Copying files"),d);d.style.cssText="display:inline-block;min-width:3ch";` +
        `box.style.cssText="display:flex;gap:2px;padding:2px;margin:8px 0;border:2px inset #fff;background:#c0c0c0";` +
        `for(let i=0;i<N;i++){const x=document.createElement("div");x.style.cssText="flex:1;height:18px";bl.push(x);box.append(x)}` +
        `e.style.cssText="font-size:.8em";I.append(tx,box,e);` +
        // Defrag is a timing game: the ^ sweeps right, bounces back left, then right again and off the end (3 legs); Stop inside the yellow zone is a hit and only then is the defrag asked for (a miss changes nothing).
        `let FU=null;if(j.frag!==undefined){const fl=document.createElement("div"),db=document.createElement("button"),mt=document.createElement("div");fl.style.cssText="font-size:.8em";fl.textContent="Fragmentation: "+j.frag+"%";const L0=Date.now();FU=()=>{fl.textContent="Fragmentation: "+Math.round(Math.min(100,j.frag+(Date.now()-L0)*(j.frag_rate||0)))+"%"};` +
        `db.textContent="Defrag";db.style.cssText="display:block;width:100%;box-sizing:border-box;padding:14px 8px;margin:12px 0;font:inherit;font-size:1.1em";` +
        `let t0=0;const ZW=12,ZL=45+Math.random()*35,SWEEP=1800;const pos=()=>{const u=(Date.now()-t0)/SWEEP;if(u>=3)return -1;const f=u%1;return(Math.floor(u)%2?1-f:f)*100};` +
        `const fin=async(hit)=>{clearInterval(SW);SW=0;if(!hit){NOTE="";show();return}` +
        `const q=await fetch("/disk/"+n+"/defrag",{method:"POST",headers:H}),k=await q.json();NOTE=q.ok?"Defragmenting... "+hms(k.saved_ms)+" saved":k.error;show()};` +
        `db.onclick=()=>{if(SW){const p=pos();fin(p>=ZL&&p<=ZL+ZW);return}` +
        `mt.textContent="";const tr=document.createElement("div"),zn=document.createElement("div"),cr=document.createElement("div");` +
        `tr.style.cssText="position:relative;height:22px;background:#d9b8f0;border:2px inset #fff;margin:12px 0 26px";` +
        `zn.style.cssText="position:absolute;top:0;bottom:0;background:#fff3a0";zn.style.left=ZL+"%";zn.style.width=ZW+"%";` +
        `cr.style.cssText="position:absolute;top:100%;margin:3px 0 0 -8px;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:12px solid #000";` +
        `tr.append(zn,cr);mt.append(tr);db.textContent="Stop";t0=Date.now();` +
        `SW=setInterval(()=>{const p=pos();if(p<0){fin(false);return}cr.style.left=p+"%"},16)};I.append(fl,mt,db)}` +
        `let k=0;const u=(v,w)=>v+" "+w+(v==1?"":"s");` +
        `const end=Date.now()+j.ms_left,tick=()=>{k++;d.textContent=".".repeat(Math.floor(k/2)%3+1);` +
        `if(FU)FU();const l=end-Date.now();if(l<=0){clearInterval(T);show();return}` +
        `bl.forEach((x,i)=>{x.style.background=i<Math.floor((1-l/j.ms_total)*N)?"#000080":"transparent"});` +
        `const s=Math.ceil(l/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);` +
        `e.textContent="Estimated time remaining: "+(h?u(h,"hour")+" "+u(m,"minute"):m?u(m,"minute")+" "+u(s%60,"second"):u(s,"second"))};` +
        `T=setInterval(tick,500);tick()}if(NOTE){const m=document.createElement("div");m.textContent=NOTE;NOTE="";I.append(m)}};` +
        `if(!b)show();` +
        `if(b)b.onclick=async()=>{const r=await fetch("/disk/"+n+"/names",{headers:{"x-visit":window.visit}}),j=await r.json();` +
        `if(!r.ok){w.textContent=j.error;return}w.textContent="Pick a name:";` +
        `j.names.forEach(x=>{const c=document.createElement("button");c.textContent=lab(x);` +
        `c.onclick=async()=>{const r=await fetch("/disk/"+n+"/wake",{method:"POST",headers:{"x-visit":window.visit},body:JSON.stringify({name:x})}),j=await r.json();` +
        `if(r.ok){document.getElementById("pt").textContent=lab(j.state.name);document.getElementById("status").textContent="building";w.textContent="";show()}else w.textContent=j.error};w.append(document.createElement("br"),c)})}</script>`
    );
  },
};
