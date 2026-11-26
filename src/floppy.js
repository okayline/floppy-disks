// The 3D floppy at the top of a disk page: pure CSS 3D, no library, drawn in the disk's own colour. Asleep disks sit still; once woken it turns slowly and can be dragged.
// The drawing code is one self-contained function, sent to the page as text. Sizes are on a 90 x 94 grid (about a 3.5" disk in millimetres); the pictures are by eye from photos.
export const floppyCss = `<style>
  .fs { perspective: 900px; height: 300px; display: grid; place-items: center; cursor: default; user-select: none; position: relative; margin: 0 0 12px; overflow: hidden; --u: 2.1px; --W: calc(var(--u) * 90); --H: calc(var(--u) * 94); --T: calc(var(--u) * 6); }
  .fs.live:active { cursor: grabbing; }
  .shadow { position: absolute; bottom: 22px; left: 50%; width: calc(var(--W) * .8); height: 16px; margin-left: calc(var(--W) * -.4); background: radial-gradient(closest-side, rgba(0,0,0,.28), transparent); pointer-events: none; }
  .disk { position: relative; width: var(--W); height: var(--H); transform-style: preserve-3d; }
  .disk > * { position: absolute; }
  .disk svg { width: 100%; height: 100%; display: block; overflow: visible; }

  /* thin see-through layers stacked in depth, and translucent walls around them */
  .layer { inset: 0; }
  .rim { position: absolute; background: linear-gradient(90deg, rgba(245,245,248,.92), rgba(200,200,210,.92)); }
  .shut { background: linear-gradient(90deg, #202020, #050505 50%, #262626); border: 0; }
  .groove { background: linear-gradient(90deg, var(--g1), var(--g2)); border: 1px solid rgba(255,255,255,.3); box-sizing: border-box; }
  .tab { position: absolute; background: linear-gradient(135deg, #2a2a2a, #050505); }
  .tube { background: linear-gradient(90deg, var(--t1), var(--t2)); box-sizing: border-box; border: 1px solid rgba(255,255,255,.3); }
  .wall { background: linear-gradient(90deg, var(--w1), var(--w2) 50%, var(--w3)); border: 1px solid rgba(255,255,255,.55); box-sizing: border-box; }
  .fs.live { touch-action: none; cursor: grab; }
</style>`;

export const floppyBox = `<div class="fs" id="fs"><div class="shadow"></div><div class="disk" id="fd"></div></div>`;

function client(colour, live) {
  const d = document.getElementById("fd");
  if (!d) return;
  const scene = d.parentElement;
  const SHELL = "M2.5 0H83L90 7V91.5Q90 94 87.5 94H2.5Q0 94 0 91.5V2.5Q0 0 2.5 0Z";
  const HOLES = "M5 84h4.5v4.5h-4.5zM80.5 84h4.5v4.5h-4.5z"; // two square holes near the bottom corners, cut right through
  let n = 0;
  // Colours. Pink is exactly as it was. The others are built from a hue (and a lightness shift) in the same pattern.
  const gen = (h, dl) => { const c = (hh, ss, l, a) => `hsla(${hh},${ss}%,${Math.max(6, Math.min(94, l + dl))}%,${a})`; return {
    p1: c(h, 100, 73, 1), p2: c(h + 4, 85, 57, 1), p3: c(h + 2, 82, 45, 1),
    w1: c(h, 100, 77, .42), w2: c(h, 80, 59, .34), w3: c(h, 100, 83, .42),
    t1: c(h, 76, 33, .75), t2: c(h, 89, 19, .75), g1: c(h, 85, 26, .7), g2: c(h, 100, 16, .7),
    dk: (a) => c(h, 100, 22, a), engr: c(h, 100, 21, .6), hub: c(h, 100, 91, .92), win: c(h, 100, 80, .55) }; };
  const PALETTES = {
    pink: { p1: "rgb(255,120,195)", p2: "rgb(238,50,140)", p3: "rgb(205,20,115)", w1: "rgba(255,140,200,.42)", w2: "rgba(235,60,150,.34)", w3: "rgba(255,170,215,.42)",
      t1: "rgba(150,20,90,.75)", t2: "rgba(90,5,50,.75)", g1: "rgba(120,10,70,.7)", g2: "rgba(80,0,45,.7)", dk: (a) => `rgba(110,0,65,${a})`, engr: "rgba(105,0,58,.6)", hub: "rgba(255,210,232,.92)", win: "rgba(255,150,205,.55)" },
    purple: gen(272, -4), orange: Object.assign(gen(26, -6), { p1: 'hsl(32,100%,73%)', p2: 'hsl(27,100%,63%)', p3: 'hsl(22,100%,55%)', w1: 'hsla(32,100%,77%,.42)', w2: 'hsla(27,100%,65%,.34)', w3: 'hsla(34,100%,83%,.42)', hub: 'hsla(32,100%,86%,.92)' }), green: gen(64, 0), blue: gen(226, -12),
  };
  
  const PAL = PALETTES[colour] || PALETTES.pink;
  const svg = (body) => `<svg viewBox="0 0 90 94" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const defs = (id) => `<defs>
    <linearGradient id="p${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PAL.p1}" stop-opacity=".5"/><stop offset=".55" stop-color="${PAL.p2}" stop-opacity=".4"/><stop offset="1" stop-color="${PAL.p3}" stop-opacity=".5"/></linearGradient>
    <radialGradient id="h${id}" cx=".28" cy=".18" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="m${id}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#bfc3c8"/><stop offset="1" stop-color="#7d838b"/></radialGradient>
  </defs>`;
  const track = () => `<rect x="8" y="0" width="61" height="37" rx="1.5" fill="${PAL.dk(.26)}" stroke="rgba(255,255,255,.45)" stroke-width=".5"/>`;
  const slot = () => `<path d="M4.2 79.6h6.1v9.7h-6.1zM5 84h4.5v4.5h-4.5z" fill-rule="evenodd" fill="${PAL.dk(.3)}" stroke="rgba(255,255,255,.45)" stroke-width=".5"/>`;
  const shutter = () => track() + `<rect x="21" y="0" width="48" height="37" rx="1.5" fill="#141414"/><rect x="50" y="11" width="11.5" height="24" rx="1" fill="${PAL.win}" stroke="#000" stroke-width=".8"/><rect x="23" y="33" width="22" height="2" fill="#2a2a2a"/>`;
  const engrave = (shape) => `<g transform="translate(.25 .25)" fill="rgba(255,255,255,.75)">${shape}</g><g fill="${PAL.engr}">${shape}</g>`;
  const arrow = () => engrave(`<path d="M4 7L6.4 10.8H4.9V14.5H3.1V10.8H1.6Z"/>`); // the up arrow, engraved
  const plate = (id) => `<path d="${SHELL}${HOLES}" fill-rule="evenodd" fill="url(#p${id})" stroke="rgba(255,255,255,.55)" stroke-width=".7"/>`;
  const gloss = (id) => `<path d="${SHELL}${HOLES}" fill-rule="evenodd" fill="url(#h${id})"/>`;
  const front = () => { const id = ++n; return svg(defs(id) + plate(id) + slot() + shutter() + arrow() + gloss(id)); };
  const back = () => { const id = ++n; return svg(defs(id) + plate(id) + slot() + shutter() + gloss(id)); };
  // The disk inside is white on both faces. Front face (from the photo of the pink one): a thick black ring round a pink hub, and one black box in the middle.
  const discBase = `<circle cx="45" cy="50" r="42" fill="rgba(255,255,255,.93)" stroke="rgba(150,150,160,.6)" stroke-width=".6"/>`;
  const discFront = () => svg(discBase + `<circle cx="45" cy="50" r="16.5" fill="#1b1b1b"/><circle cx="45" cy="50" r="13.4" fill="${PAL.hub}"/><rect x="42" y="46.2" width="6" height="7.6" fill="#111" transform="rotate(-12 45 50)"/>`);
  // Back face (from the photo of the orange one): a grey ring round a silver hub with the black box and, below it, a rectangle hole.
  const discBack = () => { const id = ++n; return svg(defs(id) + discBase + `<circle cx="45" cy="50" r="18.2" fill="#6b6659" stroke="#4d493f" stroke-width=".5"/><circle cx="45" cy="50" r="13.4" fill="url(#m${id})" stroke="#666" stroke-width=".6"/><rect x="42.7" y="46.4" width="4.6" height="4.6" rx=".6" fill="#161616" transform="rotate(-8 45 48.7)"/><rect x="41.85" y="55.7" width="8.7" height="5.4" rx=".8" fill="#262626" stroke="rgba(0,0,0,.6)" stroke-width=".4" transform="rotate(-12 46.2 58.4)"/><path d="M42.6 61.4H49.6" stroke="rgba(255,255,255,.45)" stroke-width=".4" transform="rotate(-12 46.2 58.4)"/>`); };
  
  const el = (cls, html, parent) => { const d = document.createElement("div"); d.className = cls; if (html) d.innerHTML = html; parent.appendChild(d); return d; };
  
  
  function build() {
    for (const k of ["g1","g2","t1","t2","w1","w2","w3"]) d.style.setProperty("--" + k, PAL[k]);
    const u = parseFloat(getComputedStyle(scene).getPropertyValue("--u"));
    const T = 4.5; // thickness of the disk in grid units (was 6)
    const px = (v) => (v * u).toFixed(2) + "px";
    const z = (units) => `translateZ(${px(units)})`;
    el("layer", front(), d).style.transform = z(T / 2);
    // The disc between the plates: two round faces and a round edge made of flat strips, so it is a real round disk with thickness (1.4 units).
    el("layer", discFront(), d).style.transform = z(0.7);
    el("layer", discBack(), d).style.transform = z(-0.7);
    const R = 42, N = 72, strip = (2 * Math.PI * R / N) * 1.05;
    for (let i = 0; i < N; i++) {
      const w = el("rim", "", d);
      Object.assign(w.style, { left: "50%", top: "50%", width: px(1.4), height: px(strip), marginLeft: px(-0.7), marginTop: px(-strip / 2), transform: `translate3d(0,${px(3)},0) rotateZ(${(i * 360 / N).toFixed(2)}deg) translateX(${px(R)}) rotateY(90deg)` });
    }
    el("layer", back(), d).style.transform = z(-T / 2);
    // wall: length, position of its centre from the disk centre (grid units), and how it is turned
    const wall = (len, dx, dy, turn, vertical, cls = "wall", D = T) => {
      const w = el(cls, "", d);
      const [ww, hh] = vertical ? [D, len] : [len, D];
      Object.assign(w.style, { left: "50%", top: "50%", width: px(ww), height: px(hh), marginLeft: px(-ww / 2), marginTop: px(-hh / 2), transform: `translate3d(${px(dx)},${px(dy)},0) ${turn}` });
    };
    wall(83, -3.5, -47, "rotateX(90deg)", false);          // top (stops where the corner is cut)
    wall(87, 45, 3.5, "rotateY(90deg)", true);             // right (starts below the cut corner)
    wall(90, 0, 47, "rotateX(90deg)", false);              // bottom
    wall(94, -45, 0, "rotateY(90deg)", true);              // left
    wall(9.9, 41.5, -43.5, "rotateZ(45deg) rotateX(90deg)", false); // the cut corner
    wall(48, 0, -47.15, "rotateX(90deg)", false, "shut");   // the black shutter wraps over the top edge, joining its front and back
    wall(13, -30.5, -47.1, "rotateX(90deg)", false, "groove"); // the shutter's track on the top edge, running left of the shutter (grid x 8 to 21)
    // the write-protect tab: a small black box closed over the bottom-left hole (writable), a little thicker than the shell
    { const D = T + 0.6, tw = 4.7, th = 4.7, tx = -37.75, ty = 39.25;
      for (const sgn of [1, -1]) { const f = el("tab", "", d); Object.assign(f.style, { left: "50%", top: "50%", width: px(tw), height: px(th), marginLeft: px(-tw / 2), marginTop: px(-th / 2), transform: `translate3d(${px(tx)},${px(ty)},${px(sgn * D / 2)})` }); }
      wall(tw, tx, ty - th / 2, "rotateX(90deg)", false, "shut", D); wall(tw, tx, ty + th / 2, "rotateX(90deg)", false, "shut", D);
      wall(th, tx - tw / 2, ty, "rotateY(90deg)", true, "shut", D); wall(th, tx + tw / 2, ty, "rotateY(90deg)", true, "shut", D); }
    // the two holes: four small walls each, a square tunnel from the front plate to the back plate (4.5 units wide)
    for (const cx of [-37.75, 37.75]) {
      wall(4.5, cx, 39.25 - 2.25, "rotateX(90deg)", false, "tube");
      wall(4.5, cx, 39.25 + 2.25, "rotateX(90deg)", false, "tube");
      wall(4.5, cx - 2.25, 39.25, "rotateY(90deg)", true, "tube");
      wall(4.5, cx + 2.25, 39.25, "rotateY(90deg)", true, "tube");
    }
  }
  
  
  build();
  function spin(disk) {
    const scene = disk.parentElement;
    let rx = -14, ry = -30, vx = 0, vy = 0, drag = false, lx = 0, ly = 0;
    const apply = () => { disk.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; };
    scene.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; ly = e.clientY; scene.setPointerCapture(e.pointerId); });
    scene.addEventListener("pointermove", (e) => { if (!drag) return; vy = (e.clientX - lx) * 0.4; vx = -(e.clientY - ly) * 0.4; ry += vy; rx += vx; lx = e.clientX; ly = e.clientY; apply(); });
    const up = () => { drag = false; };
    scene.addEventListener("pointerup", up); scene.addEventListener("pointercancel", up);
    (function tick() {
      if (!drag) { vy *= 0.9; vx *= 0.9; ry += vy + 0.07; rx += vx + (-14 - rx) * 0.01; }
      rx = Math.max(-85, Math.min(85, rx)); apply(); requestAnimationFrame(tick);
    })();
  }
  
  // The pose it rests in while asleep; waking starts the turn and the drag.
  let go = false, rx = -14, ry = -30;
  d.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  window.floppyLive = () => { if (go) return; go = true; scene.classList.add("live"); spin(d); };
  if (live) window.floppyLive();
}

export const floppyScript = (colour, live) => `(${client.toString()})(${JSON.stringify(colour)},${live ? "true" : "false"});`;
