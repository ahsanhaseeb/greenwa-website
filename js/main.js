/* GreenWA — interactions, scroll scenes, project planner. Vanilla JS. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));           // 0..1 progress of p inside [a,b]
  const ease = t => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  let vh = innerHeight, vw = innerWidth;

  $("#yr").textContent = new Date().getFullYear();

  /* ---------- live season line (Perth seasons) ---------- */
  const m = new Date().getMonth();
  const season = [
    [[11, 0, 1], "Summer in Perth · alfresco & pool-surround season"],
    [[2, 3, 4], "Autumn in Perth · the sweet spot for walls & paving"],
    [[5, 6, 7], "Winter in Perth · lock in your spring build now"],
    [[8, 9, 10], "Spring in Perth · prime time for laying new turf"],
  ].find(([ms]) => ms.includes(m));
  $("#season-line").textContent = season[1];

  /* ---------- loader ---------- */
  const loader = $("#loader");
  const done = () => { document.body.classList.add("ready"); loader && loader.classList.add("gone"); };
  if (reduce) done(); else { addEventListener("load", () => setTimeout(done, 650)); setTimeout(done, 2600); }

  /* ---------- smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const goTo = el => lenis ? lenis.scrollTo(el, { offset: -20, duration: 1.4 }) : el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const t = a.getAttribute("href"); if (t.length < 2) return;
    const el = $(t); if (!el) return;
    e.preventDefault(); setMenu(false); goTo(el);
  }));

  /* ---------- nav ---------- */
  const nav = $("#nav");
  // mobile sidebar menu
  const drawer = $("#drawer"), burger = $(".nav-burger");
  function setMenu(open) {
    if (document.body.classList.contains("menu-open") === open) return;
    document.body.classList.toggle("menu-open", open);
    drawer.setAttribute("aria-hidden", !open); drawer.inert = !open; burger.setAttribute("aria-expanded", open);
    if (open) { lenis && lenis.stop(); document.documentElement.style.overflow = "hidden"; setTimeout(() => $(".drawer-links a", drawer).focus({ preventScroll: true }), 350); }
    else { lenis && lenis.start(); document.documentElement.style.overflow = ""; }
  }
  burger.addEventListener("click", () => setMenu(true));
  $$("[data-close-menu]").forEach(b => b.addEventListener("click", () => { setMenu(false); burger.focus({ preventScroll: true }); }));
  addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); burger.focus({ preventScroll: true }); } });
  addEventListener("resize", () => { if (innerWidth > 960) setMenu(false); });
  let lastY = 0;

  /* ---------- hero bricks ---------- */
  const hb = $("#heroBricks");
  const buildBricks = () => {
    hb.innerHTML = "";
    const w = vw < 560 ? 63 : 87, n = Math.ceil(vw / w) + 2;
    for (let r = 0; r < 2; r++) {
      const row = document.createElement("div"); row.className = "brick-row";
      for (let i = 0; i < n; i++) {
        const b = document.createElement("span"); b.className = "hb";
        b.style.animationDelay = (reduce ? 0 : 0.5 + (r ? n - i : i) * 0.04 + r * 0.2) + "s";
        row.appendChild(b);
      }
      hb.appendChild(row);
    }
  };
  buildBricks();

  /* ---------- split headings into words for reveal ---------- */
  $$("[data-split]").forEach(h => {
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          const o = document.createElement("span"); o.className = "w";
          const i = document.createElement("span"); i.textContent = w; o.appendChild(i); frag.appendChild(o);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
    walk(h);
    $$(".w > span", h).forEach((s, i) => s.style.transitionDelay = i * 0.05 + "s");
  });

  /* ---------- reveal on view ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal, [data-split], .step, .mask, .g").forEach(el => io.observe(el));

  /* ---------- manifesto words ---------- */
  const man = $("#manifesto"), manWords = [];
  if (man) {
    const txt = man.textContent.trim().split(/\s+/); man.textContent = "";
    txt.forEach((w, i) => {
      const s = document.createElement("span"); s.textContent = w;
      if (/^\*.*\*[.,]?$/.test(w)) { s.textContent = w.replace(/\*/g, ""); s.className = "hl"; }
      man.appendChild(s); if (i < txt.length - 1) man.appendChild(document.createTextNode(" "));
      manWords.push(s);
    });
  }

  /* =========================================================
     PAVING LAYERS — pinned 3D exploded view
     ========================================================= */
  const iso = $("#iso"), layersSec = $("#layers"), layerLis = $$("#layerList li"), stamp = $("#stamp"), bar = $("#layersBar");
  const LAYERS = [
    // in: when the layer flies in. edge = a concrete ring that drops AROUND the pavers; ww = whitewash sand that sinks into the joints
    { cls: "slab-subgrade", h: .16, name: "Soil · levelled", short: "Soil", in: [0.03, 0.11] },
    { cls: "slab-base",     h: .13, name: "Roadbase", short: "Roadbase", in: [0.11, 0.19] },
    { cls: "slab-dust",     h: .06, name: "Cracker dust", short: "Cracker dust", in: [0.19, 0.27] },
    { cls: "slab-pavers",   h: .07, name: "Pavers · stretcher", short: "Pavers", in: [0.27, 0.35] },
    { cls: "slab-edge",     h: .07, px: 7, name: "Concrete edging", short: "Edging", in: [0.5, 0.58] },
    { cls: "slab-ww",       h: 0, px: 2, name: "Whitewash sand · joints", mid: "Whitewash sand", short: "Whitewash", in: [0.58, 0.66] },
  ];
  let slabs = [], pavers = [], labels = [], U = 400;
  const labelBox = document.createElement("div"); labelBox.className = "labels"; iso.parentElement.appendChild(labelBox);
  const motes = document.createElement("div"); motes.className = "motes"; iso.parentElement.appendChild(motes);
  for (let i = 0; i < 26; i++) { const m = document.createElement("i"); m.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;--d:${(6 + Math.random() * 8).toFixed(1)}s;--dl:${(-Math.random() * 10).toFixed(1)}s;--s:${(2 + Math.random() * 4).toFixed(1)}px`; motes.appendChild(m); }
  let tiltX = 0, tiltY = 0, tiltTX = 0, tiltTY = 0;
  if (fine) addEventListener("pointermove", e => { tiltTX = e.clientX / vw - 0.5; tiltTY = e.clientY / vh - 0.5; });
  let shadow;
  const buildIso = () => {
    iso.innerHTML = ""; slabs = []; pavers = []; labelBox.innerHTML = ""; labels = [];
    U = iso.clientWidth;
    shadow = document.createElement("div"); shadow.className = "iso-shadow"; iso.appendChild(shadow);
    LAYERS.forEach((L, i) => {
      const s = document.createElement("div"); s.className = "slab " + L.cls;
      s.style.setProperty("--h", (L.h * U + (L.px || 0)).toFixed(1) + "px");
      const faces = (anc, x, y, w, d) => `<div class="beam" style="left:${x}%;top:${y}%;width:${w}%;height:${d}%"><div class="face top"></div><div class="face front">${anc ? '<i class="anc"></i>' : ""}</div><div class="face side"></div></div>`;
      if (L.cls === "slab-edge") {
        // hollow ring: four concrete beams, the pavers sit inside it
        const t = 4 / 1.08;
        s.innerHTML = faces(true, 0, 100 - t, 100, t) + faces(false, 0, 0, 100, t) + faces(false, 0, t, t, 100 - 2 * t) + faces(false, 100 - t, t, t, 100 - 2 * t);
      } else if (L.cls === "slab-ww") {
        // whitewash sand: only the joint lines of the stretcher bond, so it fills the gaps instead of covering the pavers
        s.innerHTML = `<div class="face top"><i class="anc"></i></div>`;
        const tp = s.firstChild, ROWS = 8, COLS = 5;
        for (let r = 0; r < ROWS; r++) {
          if (r) { const l = document.createElement("i"); l.className = "jl"; l.style.cssText = `left:0;width:100%;top:calc(${r / ROWS * 100}% - 1.5px);height:3px`; tp.appendChild(l); }
          const off = r % 2 ? -0.5 : 0;
          for (let c = 0; c <= COLS; c++) {
            const x = (c + off) / COLS; if (x <= 0.01 || x >= 0.99) continue;
            const l = document.createElement("i"); l.className = "jl"; l.style.cssText = `left:calc(${x * 100}% - 1.5px);width:3px;top:${r / ROWS * 100}%;height:${100 / ROWS}%`; tp.appendChild(l);
          }
        }
      } else s.innerHTML = `<div class="face top"></div><div class="face front"><i class="anc"></i></div><div class="face side"></div>`;
      iso.appendChild(s); slabs.push(s);
      const lb = document.createElement("span"); lb.className = "label"; lb.textContent = vw < 561 ? L.short : vw < 1280 ? (L.mid || L.name) : L.name; labelBox.appendChild(lb); labels.push(lb);
    });
    // stretcher-bond pavers on the top face of the last slab
    const top = $(".slab-pavers .top", iso), ROWS = 8, COLS = 5;
    for (let r = 0; r < ROWS; r++) {
      const off = r % 2 ? -0.5 : 0;
      for (let c = 0; c <= COLS; c++) {
        let x0 = (c + off) / COLS, x1 = (c + off + 1) / COLS;
        x0 = Math.max(0, x0); x1 = Math.min(1, x1); if (x1 - x0 < 0.01) continue;
        const p = document.createElement("i"); p.className = "pv t" + (1 + ((r * 7 + c * 3) % 3)); p.innerHTML = "<b class=\"f\"></b><b class=\"s\"></b><b class=\"k\"></b><b class=\"l\"></b><b class=\"u\"></b>";   // all sides + underside: a solid brick
        p.style.cssText = `left:calc(${x0 * 100}% + 1.5px);width:calc(${(x1 - x0) * 100}% - 3px);top:calc(${r / ROWS * 100}% + 1.5px);height:calc(${100 / ROWS}% - 3px)`;
        p.dataset.k = Math.random() * 0.55 + (r / ROWS) * 0.45;   // drop order: back to front, a little random
        top.appendChild(p); pavers.push(p);
      }
    }
  };
  buildIso();

  const back = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };   // overshoot ease
  const bounce = t => t < 0.7 ? Math.pow(t / 0.7, 2) : 1 - Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.18 * (1 - t);   // fall, hop, rest
  const layersScene = p => {
    const GAP = U * 0.11;
    let current = -1;
    const combine = ease(seg(p, 0.7, 0.84));
    const squash = Math.sin(seg(p, 0.82, 0.89) * Math.PI) * 0.09;   // the stack "thuds" as it locks
    const sink = ease(seg(p, 0.84, 0.9));                             // whitewash sand brushed down into the joints
    // compact (locked) and exploded heights: the edging shares the pavers' level, the whitewash sits on the paver tops
    const zc = [0], H = LAYERS.map(L => L.h * U + (L.px || 0));
    for (let i = 1; i < 4; i++) zc[i] = zc[i - 1] + H[i - 1];
    const pTop = zc[3] + H[3] + 7;
    zc[4] = zc[3]; zc[5] = lerp(pTop + U * 0.03, pTop - 3, sink);
    const ex = [0, 1, 2, 3].map(i => zc[i] + i * GAP);
    ex[4] = pTop + 3.6 * GAP; ex[5] = ex[4] + H[4] + 0.8 * GAP;
    // camera: slow orbit across the scroll + idle sway + pointer tilt
    const rx = lerp(66, 54, ease(p)) - tiltY * 10;
    const rz = lerp(-58, -30, ease(p)) + tiltX * 16;
    iso.style.transform = reduce ? "" : `rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
    motes.style.opacity = clamp(seg(p, 0.02, 0.1)) * (1 - seg(p, 0.88, 0.97));
    shadow.style.opacity = (0.35 + 0.45 * clamp(seg(p, 0.03, 0.13))).toFixed(2);
    shadow.style.transform = `translateZ(-1px) scale(${(1.08 + squash * 1.5 + (1 - combine) * 0.08).toFixed(3)})`;
    slabs.forEach((s, i) => {
      const L = LAYERS[i], compact = zc[i], exploded = ex[i];
      const raw = seg(p, ...L.in), t = ease(raw), tb = back(raw);
      if (t > 0.02) current = i;
      const rest = lerp(exploded, compact, combine) * (1 - squash);
      const zz = lerp(rest + U * 1.1, rest, tb);
      // phones: the stack sits near the left edge, so layers fly in from the right with a gentler spin (no clipping)
      const narrow = vw < 561, spin = (1 - t) * (narrow ? 12 : 28) * (i % 2 ? -1 : 1), slide = (1 - t) * U * 0.25 * (narrow || i % 2 ? 1 : -1);
      s.style.transform = `translate3d(${slide.toFixed(1)}px,0,${zz.toFixed(1)}px) rotateZ(${spin.toFixed(1)}deg)`;
      s.style.visibility = raw > 0.001 ? "visible" : "hidden";   // no opacity: it would flatten the 3D slab
      labels[i].classList.toggle("on", t > 0.9);
    });
    // labels stay on after the stack locks; when the slabs close up, labels fan out so they never overlap,
    // and each leader line angles back to the exact point on its slab
    const pr = labelBox.getBoundingClientRect(), on = [];
    slabs.forEach((s, i) => { if (labels[i].classList.contains("on")) { const ar = $(".anc", s).getBoundingClientRect(); on.push({ lb: labels[i], x: ar.left - pr.left, y: ar.top - pr.top }); } });
    if (on.length) {
      const gap = parseFloat(getComputedStyle(on[0].lb).getPropertyValue("--gap")) || 30, H = on[0].lb.offsetHeight + 5;
      on.sort((a, b) => a.y - b.y);
      let prev = -1e9;
      on.forEach(o => {
        const ly = Math.max(o.y, prev + H); prev = ly;
        const dy = o.y - ly, len = Math.hypot(gap, dy);
        o.lb.style.transform = `translate(${(o.x + gap).toFixed(1)}px,${(ly - o.lb.offsetHeight / 2).toFixed(1)}px)`;
        o.lb.style.setProperty("--dy", dy.toFixed(1) + "px"); o.lb.style.setProperty("--len", len.toFixed(1) + "px");
        o.lb.style.setProperty("--ang", Math.atan2(-dy, gap).toFixed(4) + "rad");
      });
    }
    // pavers drop one by one once the paver slab is placed
    const pp = seg(p, 0.35, 0.5);
    pavers.forEach(el => {
      const k = +el.dataset.k, raw = seg(pp, k * 0.8, k * 0.8 + 0.2), t = bounce(raw);
      el.style.setProperty("--z", ((1 - t) * U * 0.5).toFixed(1) + "px");
      el.style.setProperty("--r", ((1 - raw) * 40 * (k > 0.5 ? 1 : -1)).toFixed(1) + "deg");
      el.style.visibility = raw > 0 ? "visible" : "hidden";   // no opacity fade: it would flatten the solid 3D paver
    });
    layerLis.forEach((li, i) => {
      li.classList.toggle("on", i <= current || combine > 0.5);
      li.classList.toggle("now", combine < 0.5 ? i === current : false);
    });
    stamp.classList.toggle("show", p > 0.92);
    bar.style.transform = `scaleX(${p})`;
  };

  /* =========================================================
     SERVICES — horizontal pinned track
     ========================================================= */
  const svcSec = $("#services"), track = $("#hTrack");
  const servicesScene = p => {
    const dist = Math.max(0, track.scrollWidth - vw);
    track.style.transform = `translate3d(${(-dist * seg(p, 0.04, 0.96)).toFixed(1)}px,0,0)`;
  };
  // pin length = exactly the sideways distance (1px scroll = 1px slide) plus a short hold, so the last card does not linger
  const sizeServices = () => { svcSec.style.height = Math.round(Math.max(0, track.scrollWidth - innerWidth) * 1.08 + innerHeight) + "px"; };
  sizeServices(); addEventListener("load", sizeServices);

  /* ---------- material textures: painted once, reused as images (cheap to render) ---------- */
  const tex = (name, base, draw) => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    if (base) { g.fillStyle = base; g.fillRect(0, 0, 128, 128); } draw(g);
    document.documentElement.style.setProperty("--tx-" + name, `url(${c.toDataURL()})`);
  };
  const R = Math.random, dots = (g, n, cols, r0, r1) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const x = R() * 128, y = R() * 128, r = r0 + R() * (r1 - r0); for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [-128, 0], [0, -128]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } } };
  tex("soil", "#7A5A3E", g => dots(g, 260, ["#5A3F2A", "#8C6A4B", "#6A4C33", "#9A7A58"], 0.8, 2.2));
  tex("gravel", "#8C887E", g => dots(g, 170, ["#A9A59B", "#6E6A61", "#C9C4B6", "#7D796F", "#B8B3A6"], 2, 4.6));
  tex("concrete", "#B7B6AE", g => dots(g, 420, ["rgba(0,0,0,.12)", "rgba(255,255,255,.35)"], 0.5, 1.2));
  tex("lime", "#E6D9B6", g => {
    dots(g, 160, ["rgba(150,125,80,.26)", "rgba(255,255,255,.45)", "rgba(120,100,60,.16)"], 0.6, 1.8);
    dots(g, 46, ["rgba(95,75,40,.42)", "rgba(110,88,52,.32)"], 0.9, 2.1);   // the open pores real limestone has
    dots(g, 14, ["rgba(85,66,36,.5)"], 1.8, 3);
  });
  tex("sand", "#E4D2A2", g => dots(g, 320, ["rgba(170,140,80,.3)", "rgba(255,255,255,.45)", "rgba(140,110,60,.2)"], 0.5, 1.3));
  tex("dust", "#BCB7AC", g => dots(g, 460, ["rgba(0,0,0,.13)", "rgba(255,255,255,.4)", "#A8A397"], 0.4, 1));
  tex("topsoil", "#4B3524", g => dots(g, 320, ["#33241A", "#6A4C33", "#5A4030", "#7D6046"], 0.6, 1.7));
  // angular crushed stones: random 5–7 sided chips with a lit top-left edge and a shadowed bottom-right
  const stones = (g, n, cols, r0, r1) => { for (let i = 0; i < n; i++) {
    const x = R() * 128, y = R() * 128, r = r0 + R() * (r1 - r0), k = 5 + (R() * 3 | 0), a0 = R() * 6.3, pts = [];
    for (let j = 0; j < k; j++) { const a = a0 + j / k * 6.283 + (R() - 0.5) * 0.6, rr = r * (0.65 + R() * 0.45); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    const col = cols[i % cols.length];
    for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [-128, 0], [0, -128]]) {
      g.beginPath(); pts.forEach(([px, py], j) => j ? g.lineTo(x + dx + px, y + dy + py) : g.moveTo(x + dx + px, y + dy + py)); g.closePath();
      g.fillStyle = "rgba(0,0,0,.28)"; g.save(); g.translate(0.9, 0.9); g.fill(); g.restore();   // contact shadow
      g.fillStyle = col; g.fill();
      g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 0.6; g.stroke();
    }
  } };
  // levelled soil: compacted brown Perth soil with sand grains, grit and the odd root
  tex("lsoil", "#866244", g => {
    dots(g, 700, ["#6E4F35", "#9C7A56", "#7A5A3E", "#B08E66", "#5E4430"], 0.4, 1.1);
    stones(g, 26, ["#A88B66", "#7E654A", "#C2A782"], 0.8, 1.8);
    for (let i = 0; i < 6; i++) { const x = R() * 128, y = R() * 128; g.strokeStyle = "rgba(60,40,24,.5)"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + (R() - 0.5) * 8, x + 10 + R() * 6, y + (R() - 0.5) * 6); g.stroke(); }
  });
  // roadbase: crushed rock in mixed sizes packed in grey-tan fines
  tex("rbase", "#8E897E", g => {
    dots(g, 900, ["#7A766C", "#A39E92", "#6B675E", "#B6B1A4"], 0.3, 0.9);
    stones(g, 70, ["#B3AEA2", "#8A857A", "#C9C3B4", "#77736A", "#A49A86", "#9C978C"], 2.2, 4.6);
    stones(g, 90, ["#A8A397", "#6F6B62", "#BDB7A9", "#8E897E"], 1, 2.2);
  });
  // cracker dust: very fine crushed-rock grit, light grey
  tex("cdust", "#B8B3A8", g => {
    dots(g, 1800, ["rgba(0,0,0,.14)", "rgba(255,255,255,.42)", "#A39E92", "#C8C3B8", "rgba(80,75,65,.2)"], 0.3, 0.75);
    stones(g, 30, ["#9E998D", "#CFCABE"], 0.6, 1.2);
  });
  tex("syn", "#4FA83A", g => {
    for (let i = 0; i < 1400; i++) {
      const x = R() * 128, y = R() * 128, l = 2 + R() * 3, a = -Math.PI / 2 + (R() - 0.5) * 0.5;
      g.strokeStyle = ["#3E9A2D", "#62BE45", "#88A64A", "#4FAE38"][i % 4]; g.lineWidth = 1;
      for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [-128, 0], [0, -128]]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); }
    }
  });
  tex("improver", "#3F2C1C", g => dots(g, 300, ["#2A1D12", "#6B4E31", "#57402A"], 0.8, 2));
  // wrap-around helper so strokes and blobs tile seamlessly
  const wrap = (f) => { for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [-128, 0], [0, -128], [128, 128], [-128, -128], [128, -128], [-128, 128]]) f(dx, dy); };
  tex("grass", "#3E962C", g => {
    // soil-dark gaps and old thatch at the base of the sward
    for (let i = 0; i < 260; i++) { const x = R() * 128, y = R() * 128, l = 1.5 + R() * 3, a = R() * 6.3;
      g.strokeStyle = ["rgba(40,60,20,.55)", "rgba(120,110,55,.35)", "rgba(30,45,15,.5)"][i % 3]; g.lineWidth = 1;
      wrap((dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); }); }
    // blades: dark at the base, lighter towards the tip, leaning roughly one way like a mown lawn
    for (let i = 0; i < 2600; i++) {
      const x = R() * 128, y = R() * 128, l = 2.5 + R() * 5, a = -Math.PI / 2 + 0.25 + (R() - 0.5) * 1.1, w = 0.7 + R() * 0.7;
      const base = ["#2A6F1E", "#347F24", "#2F7521", "#3D8A2A"][i % 4], tip = ["#5DB83F", "#78C84E", "#8FD460", "#6DBF47", "#A4DB6E"][i % 5];
      const mx = Math.cos(a) * l * 0.55, my = Math.sin(a) * l * 0.55, ex = Math.cos(a) * l, ey = Math.sin(a) * l;
      g.lineWidth = w;
      wrap((dx, dy) => {
        g.strokeStyle = base; g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + mx, y + dy + my); g.stroke();
        g.strokeStyle = tip; g.beginPath(); g.moveTo(x + dx + mx, y + dy + my); g.lineTo(x + dx + ex, y + dy + ey); g.stroke();
      });
    }
  });
  // big soft light/dark patches laid over the grass at a larger scale, so the repeat never shows
  tex("gpatch", null, g => {
    for (let i = 0; i < 26; i++) { const x = R() * 128, y = R() * 128, r = 10 + R() * 26, lt = i % 2;
      wrap((dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, lt ? "rgba(190,235,120,.16)" : "rgba(10,45,5,.2)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); }); }
  });

  /* =========================================================
     BUILD SCENES — shared 3D box helper
     ========================================================= */
  const box = (parent, x, y, w, d, h, cls) => {
    const e = document.createElement("div"); e.className = "bx " + cls;
    e.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${d.toFixed(1)}px;--h:${h.toFixed(1)}px`;
    e.innerHTML = '<b class="t"></b><b class="fr"></b><b class="sd"></b>';
    parent.appendChild(e); return e;
  };
  const tufts = (bx, n, s = 1) => { const t = bx.firstChild; for (let i = 0; i < n; i++) { const f = document.createElement("span"); f.className = "tuft"; f.style.cssText = `left:${(4 + Math.random() * 92).toFixed(1)}%;top:${(8 + Math.random() * 88).toFixed(1)}%;--s:${(s * (0.7 + Math.random() * 0.6)).toFixed(2)}`; f.innerHTML = "<i></i><i></i>"; t.appendChild(f); } };
  const camera = (el, p, rx0, rx1, rz0, rz1, ph) => {
    const rx = lerp(rx0, rx1, ease(p)) - tiltY * 8;
    const rz = lerp(rz0, rz1, ease(p)) + tiltX * 12;
    el.style.transform = reduce ? `rotateX(${rx1}deg) rotateZ(${rz1}deg)` : `rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
  };
  // scene pointers: an anchor inside a 3D face + a flat label on the stage that follows it
  const pointer = (stage, host, txt, x, y) => {
    const a = document.createElement("i"); a.className = "anc"; a.style.cssText = `left:${x}%;top:${y}%`; host.appendChild(a);
    const l = document.createElement("span"); l.className = "wl"; l.textContent = txt; stage.appendChild(l);
    return { a, l };
  };
  const placePointers = (stage, list, on) => {
    const sr = stage.getBoundingClientRect();
    list.forEach((pt, i) => {
      const show = on[i]; pt.l.classList.toggle("on", show);
      if (show) { const r = pt.a.getBoundingClientRect(); pt.l.style.transform = `translate(${(r.left - sr.left).toFixed(1)}px,${(r.top - sr.top).toFixed(1)}px)`; }
    });
  };
  const shadowEl = (sc, z) => { const e = document.createElement("div"); e.className = "scene-shadow"; e.style.transform = `translateZ(${z}px)`; sc.appendChild(e); };

  /* =========================================================
     RETAINING WALL — footing, courses, backfill, cap, lawn
     ========================================================= */
  const wallSc = $("#wallScene"), wallTag = $("#wallTag"), wallBar = $("#wallBar");
  let W = {};
  const buildWall = () => {
    wallSc.innerHTML = "";
    const U = wallSc.clientWidth, Dp = U * 0.8, CH = U * 0.068, BASE = U * 0.04, L = U * 0.84;
    shadowEl(wallSc, -U * 0.1 - 2);
    const front = box(wallSc, 0, Dp * 0.62, U, Dp * 0.38, U * 0.1, "m-grass m-strata wall-shade"); front.style.transform = `translateZ(${-U * 0.1}px)`; 
    const back = box(wallSc, 0, 0, U, Dp * 0.62, U * 0.1, "m-soil m-strata"); back.style.transform = `translateZ(${-U * 0.1}px)`;
    const soil = box(wallSc, U * 0.02, 0, U * 0.96, Dp * 0.42, U * 0.04, "m-backfill");   // clean sand backfill, compacted in lifts
    soil.style.setProperty("--lift", CH.toFixed(1) + "px");
    const footing = box(wallSc, U * 0.05, Dp * 0.38, U * 0.9, Dp * 0.26, BASE, "m-concrete");
    footing.style.transformOrigin = "50% 50%";
    const blocks = [], bl = L / 4;
    for (let r = 0; r < 5; r++) {
      const off = r % 2 ? bl / 2 : 0;
      for (let x = -off, j = 0; x < L - 1; x += bl, j++) {
        const x0 = Math.max(0, x), x1 = Math.min(L, x + bl);
        const e = box(wallSc, U * 0.08 + x0 + 1, Dp * 0.42, x1 - x0 - 2, Dp * 0.18, CH - 2, "m-lime v" + ((r * 3 + j) % 3));
        [...e.children].forEach(f => f.style.backgroundPosition = `${(Math.random() * 64).toFixed(0)}px ${(Math.random() * 64).toFixed(0)}px`);   // no two blocks share a face
        blocks.push({ e, r, j, z: BASE + r * CH });
      }
    }
    const TOP = BASE + 5 * CH;
    // capping laid in four pieces with a joint between each, overhanging the face a little
    const cw = U * 0.87 / 4, cap = [0, 1, 2, 3].map(k => box(wallSc, U * 0.065 + k * cw + 1, Dp * 0.4, cw - 2, Dp * 0.225, U * 0.03, "m-cap"));
    const lawn = box(wallSc, U * 0.02, 0, U * 0.96, Dp * 0.42, U * 0.018, "m-grass");
    // ground-level tags: dot sits on each lawn, label floats above it
    const stage = wallSc.parentNode; stage.querySelectorAll(".wl").forEach(e => e.remove());
    const tags = [pointer(stage, lawn.firstChild, "Raised level", 22, 45), pointer(stage, front.firstChild, "Original ground", 72, 55)];
    W = { U, CH, BASE, TOP, soil, footing, blocks, cap, lawn, tags, stage };
  };
  const wallScene = p => {
    if (!W.U) return;
    const { U, CH, BASE, TOP, soil, footing, blocks, cap, lawn, tags, stage } = W;
    camera(wallSc, p, 63, 55, -50, -30, 0);
    const f = ease(seg(p, 0.02, 0.1));
    footing.style.transform = `scaleX(${Math.max(0.001, f).toFixed(3)})`; footing.style.visibility = f > 0.001 ? "visible" : "hidden";
    let placed = 0;
    blocks.forEach(b => {
      const a0 = 0.12 + b.r * 0.115 + b.j * 0.012, raw = seg(p, a0, a0 + 0.06), t = ease(raw);
      b.e.style.visibility = raw > 0.001 ? "visible" : "hidden";
      b.e.style.transform = `translate3d(0,${((1 - t) * -U * 0.08).toFixed(1)}px,${(b.z + (1 - t) * U * 0.45).toFixed(1)}px) rotateZ(${((1 - t) * (b.j % 2 ? 9 : -9)).toFixed(2)}deg)`;
    });
    for (let r = 0; r < 5; r++) placed += ease(seg(p, 0.19 + r * 0.115, 0.23 + r * 0.115));
    const fillZ = BASE + CH * placed - (placed > 4.99 ? U * 0.012 : 0);
    soil.style.setProperty("--h", Math.max(U * 0.04, fillZ).toFixed(1) + "px");
    cap.forEach((e, k) => {
      const ck = ease(seg(p, 0.74 + k * 0.018, 0.79 + k * 0.018));
      e.style.visibility = ck > 0.001 ? "visible" : "hidden";
      e.style.transform = `translateZ(${(TOP + (1 - ck) * U * 0.3).toFixed(1)}px)`;
    });
    const g = ease(seg(p, 0.84, 0.97));
    lawn.style.visibility = g > 0.001 ? "visible" : "hidden";
    lawn.style.transform = `translateZ(${(fillZ - U * 0.018 * (1 - g)).toFixed(1)}px)`;
    lawn.style.setProperty("--dry", (1 - g).toFixed(3));
    placePointers(stage, tags, [g > 0.6, g > 0.6]);
    wallTag.textContent = p < 0.1 ? "Concrete footing" : p < 0.72 ? `Course ${Math.min(5, Math.max(1, Math.floor((p - 0.12) / 0.115) + 1))} of 5 · backfilled` : p < 0.84 ? "Capping" : "Done · lawn on top";
    wallBar.style.transform = `scaleX(${p.toFixed(4)})`;
  };

  /* =========================================================
     GRASS — tabbed builds: artificial (10 steps) / natural (4 steps), scroll-driven
     ========================================================= */
  const grassPin = $("#grass"), grassBar = $("#grassBar"), grassSc = $("#grassScene"), grassCap = $("#grassCap");
  const gTabs = $$("#grass [role=tab]"), gPanels = { art: $("#panelArt"), nat: $("#panelNat") };
  const gOpt = { edge: "steel", pile: 30 }, EDGE_NAME = { steel: "Steel", timber: "Timber", alu: "Aluminium" };
  let gMode = "art", GS = {};
  const buildGrass = () => {
    grassSc.innerHTML = "";
    const U = grassSc.clientWidth, Dp = U * 0.8, X0 = U * 0.04, IW = U * 0.92, Y0 = Dp * 0.05, ID = Dp * 0.9;
    shadowEl(grassSc, -U * 0.12 - 2);
    const ground = box(grassSc, 0, 0, U, Dp, U * 0.12, "m-ground"); ground.style.transform = `translateZ(${-U * 0.12}px)`;
    const stage = grassSc.parentNode; stage.querySelectorAll(".wl").forEach(e => e.remove());
    const strips = (n, cls, H) => Array.from({ length: n }, (_, k) => {
      const e = box(grassSc, X0, Y0 + ID / n * k, IW, ID / n - 2, H, cls); e.style.transformOrigin = "0 50%"; return e;
    });
    const rollOf = (y0, d, cls) => {
      const r = document.createElement("div"); r.className = "roll " + cls; r.style.cssText = `top:${y0.toFixed(1)}px;height:${d.toFixed(1)}px`;
      r.innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="--a:${(i * 20).toFixed(2)}deg"></i>`).join("") + "<b></b>";   // 18 snug facets = a smooth cylinder
      grassSc.appendChild(r); return r;
    };
    if (gMode === "art") {
      const DH = U * 0.03, PH = U * (0.006 + gOpt.pile / 45 * 0.018), ET = U * (gOpt.edge === "timber" ? 0.02 : 0.01);
      const mound = strips(5, "m-sand", 1).map((e, k) => ({ e, hi: U * [0.07, 0.1, 0.06, 0.09, 0.05][k], lo: U * [0.012, 0.022, 0.006, 0.018, 0.01][k] }));
      const dust = box(grassSc, X0, Y0, IW, ID, DH, "m-dust"); dust.style.transformOrigin = "0 50%";
      const bar = box(grassSc, X0 - U * 0.02, 0, IW + U * 0.04, U * 0.014, U * 0.014, "m-alu");
      const EH = DH + PH + U * 0.004, ec = "m-edge m-" + gOpt.edge;
      const edges = [box(grassSc, X0 - ET, Y0 - ET, IW + 2 * ET, ET, EH, ec), box(grassSc, X0 - ET, Y0 + ID, IW + 2 * ET, ET, EH, ec),
                     box(grassSc, X0 - ET, Y0, ET, ID, EH, ec), box(grassSc, X0 + IW, Y0, ET, ID, EH, ec)];
      const syn = [0, 1].map(k => {
        const y0 = Y0 + ID / 2 * k, d = ID / 2 - 1.5, e = box(grassSc, X0, y0, IW, d, PH, "m-syn");
        return { e, roll: rollOf(y0, d, "syn") };
      });
      const pegs = [];
      for (let k = 0; k < 12; k++) {
        const x = X0 + IW * (0.06 + (k % 6) * 0.176), y = k < 6 ? Y0 + ID * 0.5 : (k % 2 ? Y0 + ID * 0.04 : Y0 + ID * 0.94);
        pegs.push(box(grassSc, x, y - U * 0.006, U * 0.012, U * 0.012, U * 0.006, "m-peg"));
      }
      const broom = box(grassSc, X0 - U * 0.03, 0, U * 0.16, U * 0.1, U * 0.05, "m-broom");
      const tags = [pointer(stage, dust.children[1], "Cracker dust", 70, 50), pointer(stage, edges[3].children[0], EDGE_NAME[gOpt.edge] + " edging", 50, 60),
                    pointer(stage, syn[1].e.firstChild, gOpt.pile + " mm artificial grass", 40, 50)];
      GS = { mode: "art", U, Dp, X0, IW, Y0, ID, DH, PH, EH, mound, dust, bar, edges, syn, pegs, broom, tags, stage };
    } else {
      const old = box(grassSc, X0, Y0, IW, ID, U * 0.03, "m-grass"); old.style.setProperty("--dry", 0.55);
      const TH = U * 0.032, top = strips(4, "m-topsoil", TH).map((e, k) => ({ e, lo: TH * [1.5, 0.7, 1.35, 0.8][k] }));
      const JX = [0.38, 0.68, 0.5], turf = JX.map((jx, k) => {
        const y0 = Y0 + ID / 3 * k, d = ID / 3 - 2, e = box(grassSc, X0, y0, IW, d, U * 0.02, "m-turf");
        e.style.setProperty("--jx", (IW * jx).toFixed(0) + "px"); e.style.setProperty("--stripe", (IW / 8).toFixed(0) + "px");
        return { e, roll: rollOf(y0, d, "") };
      });
      const tags = [pointer(stage, old.firstChild, "Old lawn out", 50, 50), pointer(stage, top[3].e.children[1], "Topsoil over sand", 60, 50),
                    pointer(stage, turf[1].e.firstChild, "Fresh roll-on turf", JX[1] * 100, 50)];
      GS = { mode: "nat", U, Dp, X0, IW, Y0, ID, TH, old, top, turf, tags, stage };
    }
    grassCap.textContent = "Section · " + (gMode === "art" ? "artificial" : "natural") + " grass";
  };
  // a roll that unrolls a strip from left to right
  const unroll = (s, u, X0, IW, Z0, r0, r1) => {
    const w = IW * u;
    s.e.style.width = Math.max(0.5, w).toFixed(1) + "px";
    s.e.style.visibility = u > 0.002 ? "visible" : "hidden";
    s.e.style.transform = `translateZ(${Z0.toFixed(1)}px)`;
    const r = lerp(r0, r1, u), spin = (w / ((r0 + r1) / 2)) * 57.3;
    s.roll.style.setProperty("--r", r.toFixed(1) + "px");
    s.roll.style.visibility = u > 0.002 && u < 0.995 ? "visible" : "hidden";
    s.roll.style.transform = `translate3d(${(X0 + w).toFixed(1)}px,0,${(Z0 + r).toFixed(1)}px) rotateY(${spin.toFixed(1)}deg)`;
    // light the facets from above-left as the roll turns, so it reads as round, not striped
    if (s.roll.style.visibility === "visible") s.roll.querySelectorAll("i").forEach((f, i) => {
      const c = Math.cos((i * 20 + spin + 25) / 57.3);
      f.style.setProperty("--sh", (c > 0 ? 0.3 - c * 0.3 : 0.3 - c * 0.25).toFixed(3));
      f.style.setProperty("--hl", Math.max(0, c - 0.75).toFixed(3));
    });
  };
  const vis = (el, on) => { el.style.visibility = on ? "visible" : "hidden"; };
  const grassScene = p => {
    if (!GS.U) return;
    const { U, X0, IW, Y0, ID, tags, stage } = GS;
    camera(grassSc, p, 62, 56, -26, -40, 0);
    if (GS.mode === "art") {
      const { DH, PH, EH, mound, dust, bar, edges, syn, pegs, broom } = GS;
      // 1–2: excess sand dug out, then levelled flat
      const e1 = ease(seg(p, 0, 0.1)), e2 = ease(seg(p, 0.1, 0.18));
      mound.forEach(m => { const h = lerp(lerp(m.hi, m.lo, e1), 0, e2); m.e.style.setProperty("--h", Math.max(0, h).toFixed(1) + "px"); vis(m.e, h > 0.6); });
      // 3–4: cracker dust spread, then compacted down
      const d = ease(seg(p, 0.18, 0.3)), c = ease(seg(p, 0.3, 0.37));
      vis(dust, d > 0.001); dust.style.transform = `scaleX(${Math.max(0.001, d).toFixed(3)})`;
      const thud = Math.sin(seg(p, 0.3, 0.37) * Math.PI * 3) * U * 0.002 * (1 - c);
      dust.style.setProperty("--h", (lerp(DH * 1.4, DH, c) - thud).toFixed(1) + "px");
      // 5: screed bar drawn across
      const sc = seg(p, 0.37, 0.45);
      vis(bar, sc > 0 && sc < 1); bar.style.transform = `translate3d(0,${(Y0 + ID * ease(sc) - U * 0.007).toFixed(1)}px,${DH.toFixed(1)}px)`;
      dust.classList.toggle("screeded", sc > 0.5);
      // 6: edging drops in around the outside
      edges.forEach((e, k) => { const t = ease(seg(p, 0.45 + k * 0.016, 0.5 + k * 0.016)); vis(e, t > 0.001); e.style.transform = `translateZ(${((1 - t) * U * 0.35).toFixed(1)}px)`; });
      // 7: grass unrolled in two widths
      syn.forEach((s, k) => unroll(s, ease(seg(p, 0.53 + k * 0.07, 0.62 + k * 0.06)), X0, IW, DH, U * 0.075, U * 0.03));
      // 8: pegs pinned along the join and edges
      pegs.forEach((g, k) => { const t = ease(seg(p, 0.68 + k * 0.005, 0.71 + k * 0.005)); vis(g, t > 0.001); g.style.transform = `translateZ(${(DH + PH + (1 - t) * U * 0.2).toFixed(1)}px)`; });
      // 9–10: whitewash sand spread in, then power broomed into the pile
      const ww = seg(p, 0.76, 0.86), br = seg(p, 0.86, 0.97);
      grassSc.style.setProperty("--ww", (ww * (1 - br * 0.7)).toFixed(3));
      grassSc.style.setProperty("--fl", br.toFixed(3));
      vis(broom, br > 0 && br < 1);
      broom.style.transform = `translate3d(${(IW * 0.78 * ((br * 3) % 1 < 0.5 ? (br * 3 % 1) * 2 : 2 - (br * 3 % 1) * 2)).toFixed(1)}px,${(Y0 + ID * ease(br) - U * 0.05).toFixed(1)}px,${(DH + PH).toFixed(1)}px)`;
      placePointers(stage, tags, [p > 0.2 && p < 0.5, p > 0.5 && p < 0.7, p > 0.66]);
    } else {
      const { TH, old, top, turf } = GS;
      // 1: old lawn and soil lifted out and carted away
      const o = ease(seg(p, 0.02, 0.22));
      vis(old, o < 0.999); old.style.transform = `translate3d(${(o * U * 0.3).toFixed(1)}px,${(-o * U * 0.2).toFixed(1)}px,${(o * U * 0.7).toFixed(1)}px) rotateZ(${(o * 14).toFixed(1)}deg)`;
      // 2: topsoil tipped in, strip by strip (uneven) — 3: levelled flat
      const lv = ease(seg(p, 0.46, 0.6));
      top.forEach((s, k) => {
        const t = ease(seg(p, 0.24 + k * 0.045, 0.33 + k * 0.045));
        vis(s.e, t > 0.001); s.e.style.transform = `scaleX(${Math.max(0.001, t).toFixed(3)})`;
        s.e.style.setProperty("--h", lerp(s.lo, TH, lv).toFixed(1) + "px");
      });
      // 4: fresh rolls laid, joints staggered, then they green up
      turf.forEach((s, k) => unroll(s, ease(seg(p, 0.6 + k * 0.1, 0.74 + k * 0.1)), X0, IW, TH, U * 0.085, U * 0.032));
      grassSc.style.setProperty("--dry", (1 - seg(p, 0.85, 1)).toFixed(3));
      grassSc.style.setProperty("--seam", (1 - seg(p, 0.88, 1)).toFixed(3));
      placePointers(stage, tags, [p > 0.02 && p < 0.16, p > 0.3 && p < 0.62, p > 0.78]);
    }
    const lis = $$(".g-steps li", gPanels[GS.mode]); let now = -1;
    lis.forEach((li, i) => { const on = p >= +li.dataset.at; li.classList.toggle("on", on); if (on) now = i; });
    lis.forEach((li, i) => li.classList.toggle("now", i === now));
    grassBar.style.transform = `scaleX(${p.toFixed(4)})`;
  };
  const setTab = (mode, focus) => {
    gMode = mode;
    gTabs.forEach(t => { const on = t.dataset.g === mode; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    Object.entries(gPanels).forEach(([k, el]) => el.hidden = k !== mode);
    buildGrass(); memo.delete(grassScene);
  };
  gTabs.forEach((t, i) => {
    t.addEventListener("click", () => { if (t.dataset.g !== gMode) setTab(t.dataset.g); });
    t.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setTab(gTabs[(i + 1) % 2].dataset.g, true); } });
  });
  $$("#grass .g-chips").forEach(group => group.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    group.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
    gOpt[group.dataset.opt] = group.dataset.opt === "pile" ? +b.dataset.v : b.dataset.v;
    buildGrass(); memo.delete(grassScene);   // keeps the current point in the build, so a finished lawn just swaps its edging / thickness
  }));
  const buildScenes = () => { buildWall(); buildGrass(); };
  buildScenes();

  /* =========================================================
     BRAND MARK — logo strokes draw, each reveals a service pointer
     ========================================================= */
  const markSec = $("#mark"), markG = $("#mark .mk-g"), markJ = $("#mark .mk-j"), eraseG = $("#mark .mke-g"), eraseJ = $("#mark .mke-j"), pins = $$("#mark .pin"), legend = $$("#mark .legend button");
  const SEG = [[0.04, 0.2], [0.24, 0.36], [0.4, 0.56], [0.6, 0.76]];
  const markScene = p => {
    const t = SEG.map(w => ease(seg(p, ...w)));
    const green = 0.524 * t[0] + 0.219 * t[1] + 0.257 * t[2];   // roof, wall, floor as fractions of the green path
    markG.style.strokeDashoffset = 1 - green; markG.style.opacity = green > 0.002 ? 1 : 0;
    eraseG.style.strokeDashoffset = 1 - green; eraseJ.style.strokeDashoffset = 1 - t[3];
    markJ.style.strokeDashoffset = 1 - t[3]; markJ.style.opacity = t[3] > 0.005 ? 1 : 0;
    pins.forEach((pin, i) => pin.classList.toggle("show", p >= SEG[i][1] - 0.01));
    legend.forEach((l, i) => l.classList.toggle("show", p >= SEG[i][1] - 0.01));
    markSec.classList.toggle("filled", p > 0.82);
  };

  /* ---------- process line ---------- */
  const steps = $("#steps"), stepsLine = $("#stepsLine"), stepEls = $$("#steps .step"), procSec = $("#process");

  /* ---------- parallax ---------- */
  const heroImg = $(".hero-media img"), gal = $$(".g img");

  /* ---------- frame loop: all scroll-linked work in one rAF ---------- */
  const secProgress = el => {           // pinned sections: 0 at top hits top, 1 at bottom hits bottom
    const r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - vh));
  };
  const viewProgress = (el, a = 0.95, b = 0.25) => {   // element top travelling from a*vh to b*vh
    const r = el.getBoundingClientRect(); return clamp((a * vh - r.top) / ((a - b) * vh + r.height * 0.3));
  };
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > -50 && r.top < vh + 50; };
  const memo = new Map();
  const drive = (fn, el, p) => {          // run a scene only if on screen and its progress or the pointer tilt moved
    if (!onScreen(el)) return;
    const k = p.toFixed(4) + "|" + tiltX.toFixed(3) + "|" + tiltY.toFixed(3) + "|" + vw;
    if (memo.get(fn) === k) return; memo.set(fn, k); fn(p);
  };
  const fab = $(".fab"), quote = $("#quote"), wallPin = $("#wallBuild");

  /* ---------- back to top: every build shows finished while the page rewinds ---------- */
  const totop = $(".totop"), totopLabel = $(".totop-label", totop);
  const phone = matchMedia("(max-width: 560px)");
  let rewinding = false, rewindTimer = 0;
  const endRewind = () => {
    if (!rewinding) return;
    rewinding = false; clearTimeout(rewindTimer);
    totop.classList.remove("going"); totopLabel.textContent = "Back to top";
  };
  totop.addEventListener("click", () => {
    if (rewinding) return;
    const dur = phone.matches ? clamp(scrollY / vh * 0.03, 0.6, 1.1) : clamp(scrollY / vh * 0.12, 1.1, 2.4);   // phones: the page is many screens tall, so go faster
    rewinding = true; totop.classList.add("going"); totopLabel.textContent = "Going up…";
    rewindTimer = setTimeout(endRewind, dur * 1000 + 800);   // safety net if the scroll is cut short
    if (lenis) lenis.scrollTo(0, { duration: dur, easing: t => 1 - Math.pow(1 - t, 4), lock: true, force: true, onComplete: endRewind });
    else scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    const first = $("#nav a"); first && first.focus({ preventScroll: true });   // keyboard users land back at the top too
  });
  // pinned scenes read this: a finished model while rewinding, otherwise the live scroll position
  const scene = el => reduce || rewinding ? 1 : secProgress(el);

  const frame = () => {
    const y = scrollY;
    if (Math.abs(y - lastY) > 4) { nav.classList.toggle("hide", y > lastY && y > 400 && !nav.classList.contains("open")); lastY = y; }
    nav.classList.toggle("solid", y > 40);
    if (!reduce) {
      heroImg.style.transform = `translate3d(0,${y * 0.25}px,0) scale(${1 + y * 0.0002})`;
      gal.forEach(im => { const r = im.parentElement.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) im.style.setProperty("--py", (clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1) * -22).toFixed(1) + "px"); });
    }
    if (manWords.length) {
      const p = viewProgress(man, 0.85, 0.15) * 1.15;
      manWords.forEach((w, i) => w.classList.toggle("lit", i / manWords.length < p));
    }
    // only animate scenes that are actually on screen
    tiltX += (tiltTX - tiltX) * 0.08; tiltY += (tiltTY - tiltY) * 0.08;
    if (Math.abs(tiltTX - tiltX) < 0.001) tiltX = tiltTX; if (Math.abs(tiltTY - tiltY) < 0.001) tiltY = tiltTY;
    drive(markScene, markSec, scene(markSec));
    drive(layersScene, layersSec, scene(layersSec));
    drive(servicesScene, svcSec, secProgress(svcSec));
    drive(wallScene, wallPin, scene(wallPin));
    drive(grassScene, grassPin, scene(grassPin));
    if (vw > 960) {                    // pinned: the line runs left to right and lights each step as it arrives
      const d = reduce || rewinding ? 1 : ease(seg(secProgress(procSec), 0.06, 0.8)), sw = steps.clientWidth;
      stepsLine.style.transform = `scaleX(${d.toFixed(4)})`;
      stepEls.forEach(s => s.classList.toggle("on", d >= s.offsetLeft / sw - 0.002));
    }
    const qr = quote.getBoundingClientRect();
    const fabOn = y > vh * 0.9 && !(qr.top < vh && qr.bottom > 0);
    fab.classList.toggle("show", fabOn);
    totop.classList.toggle("show", y > vh * 0.9 || rewinding);
    totop.classList.toggle("solo", !fabOn);
    const max = document.documentElement.scrollHeight - vh;
    totop.style.setProperty("--p", max > 0 ? clamp(y / max).toFixed(3) : 0);
    if (rewinding && y < 2) endRewind();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  addEventListener("resize", () => {
    const w = innerWidth; vh = innerHeight;
    if (w !== vw) { vw = w; buildBricks(); buildIso(); buildScenes(); sizeServices(); }
  });

  /* ---------- custom cursor + magnetic buttons ---------- */
  if (fine && !reduce) {
    const cur = $("#cursor"); let cx = vw / 2, cy = vh / 2, tx = cx, ty = cy;
    document.body.classList.add("has-cursor");
    addEventListener("pointermove", e => { tx = e.clientX; ty = e.clientY; cur.classList.add("on"); });
    document.addEventListener("pointerleave", () => cur.classList.remove("on"));
    const loop = () => { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); };
    loop();
    document.addEventListener("pointerover", e => {
      const t = e.target.closest("a, button, summary, .g, .svc, input");
      cur.classList.toggle("big", !!t);
      cur.dataset.label = t ? (t.matches(".g") ? "View" : t.matches(".svc") && !e.target.closest("button") ? "Ask" : "") : "";
    });
    $$(".btn").forEach(b => {
      b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px,${(e.clientY - r.top - r.height / 2) * 0.3}px)`; });
      b.addEventListener("pointerleave", () => b.style.transform = "");
    });
  }

  /* =========================================================
     CTA grass canvas — sways, parts around the pointer
     ========================================================= */
  const cv = $("#grassCanvas"), ctx = cv.getContext("2d");
  let G = [], mx = -999, cw = 0, chh = 0, ctaVisible = false;
  const sizeGrass = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    cw = cv.clientWidth; chh = cv.clientHeight; cv.width = cw * dpr; cv.height = chh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G = Array.from({ length: Math.floor(cw / 3.2) }, () => ({ x: Math.random() * cw, h: chh * (0.35 + Math.random() * 0.65), w: 1.5 + Math.random() * 2.5, ph: Math.random() * 6.28, c: ["#2B8A2A", "#3FA535", "#2BB02A", "#57C43F", "#1F7A22"][Math.floor(Math.random() * 5)], b: 0 }))
      .sort((a, b) => b.h - a.h);
  };
  sizeGrass(); addEventListener("resize", sizeGrass);
  cv.parentElement.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; });
  cv.parentElement.addEventListener("pointerleave", () => mx = -999);
  new IntersectionObserver(([e]) => ctaVisible = e.isIntersecting).observe(cv);
  const drawGrass = t => {
    if (ctaVisible) {
      ctx.clearRect(0, 0, cw, chh);
      G.forEach(g => {
        const d = g.x - mx, push = Math.abs(d) < 90 ? Math.sign(d) * (90 - Math.abs(d)) * 0.5 : 0;
        g.b += (push - g.b) * 0.08;
        const sway = reduce ? 0 : Math.sin(t / 1100 + g.ph + g.x * 0.004) * g.h * 0.06 + g.b;
        ctx.beginPath(); ctx.moveTo(g.x - g.w, chh);
        ctx.quadraticCurveTo(g.x + sway * 0.3, chh - g.h * 0.55, g.x + sway, chh - g.h);
        ctx.quadraticCurveTo(g.x + sway * 0.3 + g.w * 0.4, chh - g.h * 0.55, g.x + g.w, chh);
        ctx.fillStyle = g.c; ctx.fill();
      });
    }
    requestAnimationFrame(drawGrass);
  };
  requestAnimationFrame(drawGrass);

  /* =========================================================
     PROJECT PLANNER — a step-by-step conversation that builds a brief
     (back / edit / resume, validated contact details, emailed via FormSubmit)
     ========================================================= */
  const log = $("#chatLog"), form = $("#chatForm"), input = $("#chatText"), send = $("#chatSend");
  const estCard = $("#estimateCard"), estVal = $("#estimateVal");
  const ENDPOINT = "https://formsubmit.co/ajax/dd06b79f53bf7f0e0f28f17b8fab3ee6";   // FormSubmit alias for the GreenWA inbox
  const CC = ["wagreen0466", "gmail.com"].join("@");                         // team copy of every brief
  const INBOX = ["havanor.node.3", "gmail.com"].join("@");                     // only for the email-app fallback; split so scrapers miss it
  const STORE = "gwa-planner-v3";
  const SUBURBS = ["Joondalup", "Hillarys", "Scarborough", "Ellenbrook", "Midland", "Cottesloe", "Applecross", "Canning Vale", "Armadale", "Rockingham", "Baldivis", "Fremantle", "Subiaco", "Wanneroo", "Clarkson", "Kalamunda", "Morley", "Byford", "Duncraig", "Karrinyup", "Mount Lawley", "Victoria Park", "Willetton", "Bateman", "Secret Harbour", "Butler", "Alkimos", "Yanchep", "Piara Waters", "Harrisdale", "Success", "Cockburn", "Atwell", "Ocean Reef", "Mindarie", "Nedlands", "Claremont", "Como", "South Perth", "Perth"];
  const FOLLOW = {
    "Paving": { q: "Where's the paving going?", o: ["Driveway", "Alfresco / patio", "Pool surround", "Paths", "Not sure yet"], size: "area" },
    "Retaining walls": { q: "Roughly how tall will the wall be?", o: ["Under 500 mm", "500 mm – 1 m", "Over 1 m", "Not sure"], size: "length" },
    "Artificial & natural grass": { q: "Artificial or natural grass?", o: ["Artificial grass", "Natural grass", "Help me choose"], size: "area" },
    "Side access & backyards": { q: "Which part needs work?", o: ["Side access", "Backyard", "Both"], size: "area" },
    "Landscaping": { q: "Which part of the property?", o: ["Front yard", "Backyard", "Both", "Courtyard / side"], size: "area" },
  };
  // indicative Perth ranges (AUD) — for a ballpark only
  const RATE = {
    "Paving": () => [95, 165],
    "Artificial & natural grass": a => a === "Artificial grass" ? [75, 120] : [28, 48],
    "Side access & backyards": () => [80, 170],
    "Landscaping": () => [85, 210],
    "Retaining walls": a => a === "Over 1 m" ? [1100, 1900] : a === "500 mm – 1 m" ? [600, 1050] : [320, 600],
  };
  const unitOf = s => FOLLOW[s].size === "length" ? "m" : "m²";
  const BACK = "\u0000back", SKIP = "\u0000skip";
  let S, busy = false, waitText = null, GEN = 0;

  // progress bar + inline error line, built once
  const chatBar = document.createElement("div"); chatBar.className = "chat-progress"; chatBar.setAttribute("role", "progressbar"); chatBar.setAttribute("aria-label", "Brief progress"); chatBar.innerHTML = "<i></i>";
  $(".chat-top", $("#chat")).after(chatBar);
  const stepTxt = $(".chat-top small", $("#chat"));
  const errEl = document.createElement("p"); errEl.className = "chat-err"; errEl.id = "chatErr"; errEl.setAttribute("role", "alert");
  form.before(errEl); input.setAttribute("aria-describedby", "chatErr");
  const dl = document.createElement("datalist"); dl.id = "suburbList"; dl.innerHTML = SUBURBS.map(s => `<option value="${s}">`).join(""); form.appendChild(dl);
  const showErr = m => { errEl.textContent = m || ""; form.classList.toggle("bad", !!m); input.setAttribute("aria-invalid", m ? "true" : "false"); if (m) { form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); } };
  input.addEventListener("input", () => errEl.textContent && showErr(""));

  const scrollLog = () => log.scrollTop = log.scrollHeight;
  const bubble = (html, who = "bot") => { const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = html; log.appendChild(d); scrollLog(); return d; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const say = (lines) => new Promise(res => {
    busy = true; lines = [].concat(lines); const g = GEN;
    const next = () => {
      if (g !== GEN) return;                       // a newer conversation replaced this one
      if (!lines.length) { busy = false; return res(); }
      const t = document.createElement("div"); t.className = "msg bot typing"; t.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(t); scrollLog();
      const line = lines.shift();
      setTimeout(() => { t.remove(); if (g !== GEN) return; bubble(line); setTimeout(next, 160); }, reduce ? 50 : Math.min(1000, 300 + line.length * 10));
    };
    next();
  });

  // tap-to-answer chips; resolves with the picked values, or BACK
  const options = (list, { multi = false, optional = false, back = false, sel = [], doneLabel = "Done ✓" } = {}) => {
    const wrap = document.createElement("div"); wrap.className = "opts"; const picked = new Set(sel.filter(o => list.includes(o)));
    let doneBtn;
    const p = new Promise(res => {
      const finish = vals => { wrap.remove(); bubble(esc(vals.length ? vals.join(", ") : "Just that, thanks"), "me"); res(vals); };
      list.forEach(o => {
        const b = document.createElement("button"); b.type = "button"; b.className = "opt" + (picked.has(o) ? " sel" : ""); b.textContent = o;
        if (multi) b.setAttribute("aria-pressed", picked.has(o));
        b.addEventListener("click", () => {
          if (!multi) return finish([o]);
          picked.has(o) ? picked.delete(o) : picked.add(o); b.classList.toggle("sel"); b.setAttribute("aria-pressed", picked.has(o)); doneBtn.disabled = !optional && !picked.size;
        });
        wrap.appendChild(b);
      });
      if (multi) {
        doneBtn = document.createElement("button"); doneBtn.type = "button"; doneBtn.className = "opt opt-done"; doneBtn.textContent = doneLabel; doneBtn.disabled = !optional && !picked.size;
        doneBtn.addEventListener("click", () => finish(list.filter(o => picked.has(o)))); wrap.appendChild(doneBtn);
      }
      if (back) wrap.appendChild(backBtn(() => { wrap.remove(); res(BACK); }));
    });
    p.drop = () => wrap.remove();
    log.appendChild(wrap); scrollLog();
    return p;
  };
  const backBtn = fn => { const b = document.createElement("button"); b.type = "button"; b.className = "opt opt-back"; b.textContent = "← Back"; b.addEventListener("click", () => { bubble("<small>← Back</small>", "me back"); fn(); }); return b; };

  const slider = ({ min, max, step, val, unit, hint, back }) => new Promise(res => {
    const w = document.createElement("div"); w.className = "range-wrap";
    w.innerHTML = `<div class="row"><output>${val} ${unit}</output><button type="button" class="opt opt-done">Use this</button></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="Size in ${unit}"><small class="muted">${hint}</small>
      <div class="opts"><button type="button" class="opt opt-ghost">Not sure, use a typical size</button></div>`;
    const r = $("input", w), o = $("output", w);
    r.addEventListener("input", () => o.textContent = `${r.value} ${unit}`);
    $(".opt-done", w).addEventListener("click", () => { w.remove(); bubble(`About ${r.value} ${unit}`, "me"); res({ v: +r.value, sure: true }); });
    $(".opt-ghost", w).addEventListener("click", () => { w.remove(); bubble("Not sure yet", "me"); res({ v: val, sure: false }); });
    if (back) $(".opts", w).appendChild(backBtn(() => { w.remove(); res(BACK); }));
    log.appendChild(w); scrollLog();
  });

  // free-text answer; check(v) returns [errorMessage] or [null, cleanValue, shownValue]
  const ask = ({ ph, type = "text", mode = "text", ac = "off", max = 60, list = null, val = "", check, back = false, skip = null }) => new Promise(res => {
    let chips = null;
    const close = () => { chips && chips.remove(); input.disabled = send.disabled = true; input.placeholder = "Pick an option above…"; input.value = ""; input.removeAttribute("list"); showErr(""); waitText = null; };
    if (back || skip) {
      chips = document.createElement("div"); chips.className = "opts";
      if (skip) { const b = document.createElement("button"); b.type = "button"; b.className = "opt opt-ghost"; b.textContent = skip; b.addEventListener("click", () => { close(); bubble(esc(skip), "me"); res(SKIP); }); chips.appendChild(b); }
      if (back) chips.appendChild(backBtn(() => { close(); res(BACK); }));
      log.appendChild(chips); scrollLog();
    }
    Object.assign(input, { type, inputMode: mode, autocomplete: ac, maxLength: max, placeholder: ph, value: val });
    list ? input.setAttribute("list", list) : input.removeAttribute("list");
    input.disabled = send.disabled = false; showErr(""); input.focus({ preventScroll: true });
    waitText = v => {
      if (!v) return showErr("Please type an answer, or use the buttons above.");
      const [err, clean = v, shown = clean] = check ? check(v) : [null];
      if (err) { showErr(err); input.focus({ preventScroll: true }); return; }
      close(); bubble(esc(shown), "me"); res(clean);
    };
  });
  form.addEventListener("submit", e => {
    e.preventDefault(); if (!waitText || busy) return; waitText(input.value.trim());
  });

  /* ---------- validators ---------- */
  const titleCase = s => (s === s.toUpperCase() || s === s.toLowerCase() ? s.toLowerCase() : s).replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const checkName = v => {
    v = v.replace(/\s+/g, " ");
    if (/\d/.test(v)) return ["Names can't contain numbers. Please type your name."];
    if (/[@/\\_#$%&*+=<>{}[\]|~^!?;:,"]/.test(v)) return ["Please use letters only (hyphens and apostrophes are fine)."];
    const letters = (v.match(/\p{L}/gu) || []).length;
    if (letters < 2) return ["That's a bit short. Please type at least 2 letters."];
    if (v.length > 40) return ["That's too long for a name. Please keep it under 40 characters."];
    if (!/^\p{L}[\p{L}' .-]*\p{L}\.?$/u.test(v)) return ["Please start and end your name with a letter."];
    // gibberish: tripled letters, keyboard runs, long words with no vowels ("Ddsfds"), 5+ consonants in a row
    if (/(\p{L})\1\1/iu.test(v) || /asdf|qwer|zxcv|sdfg|dfgh|fghj|ghjk|hjkl|jkl;/i.test(v)
      || v.split(/[\s'-]+/).some(w => /^[a-z]{4,}$/i.test(w) && !/[aeiouy]/i.test(w)) || /[bcdfghjklmnpqrstvwxz]{5,}/i.test(v)) return ["That doesn't look like a real name. Could you check it?"];
    const n = titleCase(v); return [null, n];
  };
  const checkPhone = v => {
    if (/[a-z]/i.test(v)) return ["Phone numbers can only contain digits (spaces, + and brackets are fine)."];
    if (/[^\d\s()+.-]/.test(v)) return ["That has characters a phone number can't have. Try e.g. 0412 345 678."];
    let d = v.replace(/[^\d+]/g, "");
    if (d.slice(1).includes("+")) return ["The + can only go at the start, e.g. +61 412 345 678."];
    d = d.replace(/^\+?61/, "0").replace(/^00/, "0");
    if (/^[0-9]{8}$/.test(d) && /^[689]/.test(d)) d = "08" + d;          // Perth landline typed without the area code
    if (/^(\d)\1+$/.test(d) || /^0?(0123456789|1234567890|0412345678)$/.test(d)) return ["That number doesn't look real. Please type your actual number."];
    if (d.length < 10) return [`That's only ${d.length} digit${d.length === 1 ? "" : "s"}. Australian numbers have 10, e.g. 0412 345 678.`];
    if (d.length > 10) return [`That's ${d.length} digits, which is too many. Australian numbers have 10, e.g. 0412 345 678.`];
    if (/^04\d{8}$/.test(d)) { const f = `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`; return [null, f]; }
    if (/^0[2378]\d{8}$/.test(d)) { const f = `(${d.slice(0, 2)}) ${d.slice(2, 6)} ${d.slice(6)}`; return [null, f]; }
    return ["Please enter an Australian mobile (04…) or landline (08…) number."];
  };
  const TYPO = { "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmal.com": "gmail.com", "gnail.com": "gmail.com", "gmaill.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmail.comm": "gmail.com", "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com", "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.con": "yahoo.com", "yahoo.com.a": "yahoo.com.au", "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.con": "outlook.com", "iclod.com": "icloud.com", "icloud.co": "icloud.com", "icoud.com": "icloud.com", "bigpond.con": "bigpond.com", "bigpond.com.a": "bigpond.com", "bigpnd.com": "bigpond.com", "live.con": "live.com", "live.com.a": "live.com.au" };
  const fixDomain = d => TYPO[d] || d.replace(/\.(con|cmo|cpm|vom|comm)$/, ".com").replace(/\.comau$/, ".com.au").replace(/\.com\.a$/, ".com.au").replace(/\.au\.com$/, ".com.au");
  const checkEmail = v => {
    v = v.trim().toLowerCase();
    if (/\s/.test(v)) return ["Email addresses can't contain spaces."];
    const at = v.split("@").length - 1;
    if (!at) return ["That's missing the @. It should look like name@example.com."];
    if (at > 1) return ["An email can only have one @."];
    const [user, dom] = v.split("@");
    if (!user) return ["Something needs to go before the @, like name@example.com."];
    if (!dom) return ["Something needs to go after the @, like name@example.com."];
    if (!dom.includes(".")) return [`That's missing the ending after ${dom}, like .com or .com.au.`];
    if (/^\.|\.$|\.\./.test(user) || /^[.-]|[.-]$|\.\./.test(dom)) return ["That email has a misplaced dot. Could you check it?"];
    if (!/^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]+$/.test(user) || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(dom)) return ["That doesn't look like a valid email. Check for typos, e.g. name@example.com."];
    return [null, v];
  };
  const lev = (a, b) => { const m = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = m[0]; m[0] = i; for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return m[b.length]; };
  const checkSuburb = v => {
    v = v.replace(/\s+/g, " ").trim();
    if (/^\d+$/.test(v)) {
      if (v.length !== 4) return ["Postcodes have 4 digits, e.g. 6035. Or type the suburb name."];
      if (+v < 6000 || +v > 6999) return ["That's not a WA postcode (they run 6000–6999)."];
      if (+v > 6199) return ["Sorry, we only work in the Perth metro area (postcodes 6000–6199)."];
      return [null, v, `Postcode ${v}`];
    }
    if (/\d/.test(v)) return ["Please type just the suburb name or just the postcode, e.g. Yanchep or 6035."];
    if (!/^\p{L}[\p{L}' .-]*$/u.test(v)) return ["Please use letters only for the suburb name."];
    if (v.length < 3) return ["That's too short. Please type the full suburb name."];
    if (v.length > 30) return ["That's too long for a suburb name."];
    return [null, titleCase(v)];
  };

  /* ---------- state, estimate, progress, resume ---------- */
  const fresh = () => ({ services: [], kind: {}, size: {}, sure: {} });
  const ballpark = () => {
    let lo = 0, hi = 0;
    S.services.forEach(s => { if (S.kind[s] == null || S.size[s] == null) return; const [a, b] = RATE[s](S.kind[s]); lo += a * S.size[s]; hi += b * S.size[s]; });
    return hi ? [lo, hi] : null;
  };
  const r100 = n => "$" + (Math.round(n / 100) * 100).toLocaleString("en-AU");
  const showEstimate = () => { const b = ballpark(); estCard.hidden = !b; if (b) estVal.textContent = `${r100(b[0])} – ${r100(b[1])}`; };
  const order = () => ["services", ...S.services.flatMap(s => ["kind:" + s, "size:" + s]), "suburb", "when", "access", "notes", "name", "phone", "email", "method", ...(S.method === "Phone call" ? ["time"] : []), "review"];
  const has = id => {
    const [k, s] = id.split(":");
    if (k === "services") return S.services.length > 0;
    if (k === "review") return false;
    return s ? S[k][s] != null : S[k] != null;
  };
  const setProgress = id => {
    const o = order(), i = Math.max(0, o.indexOf(id)), pct = id === "done" ? 100 : Math.round(i / (o.length - 1) * 100);
    $("i", chatBar).style.width = pct + "%"; chatBar.setAttribute("aria-valuenow", pct);
    stepTxt.innerHTML = id === "done" ? `<span class="dot"></span>Brief sent` : id === "review" ? `<span class="dot"></span>Review your brief` : `<span class="dot"></span>Step ${i + 1} of ${o.length - 1}`;
  };
  const save = id => { try { localStorage.setItem(STORE, JSON.stringify({ S, id, t: Date.now() })); } catch (e) {} };
  const load = () => { try { const d = JSON.parse(localStorage.getItem(STORE)); return d && d.S && d.S.services.length && Date.now() - d.t < 7 * 864e5 ? d : null; } catch (e) { return null; } };
  const forget = () => { try { localStorage.removeItem(STORE); } catch (e) {} };

  /* ---------- the steps ---------- */
  const STEP = {
    services: async (_, back, first) => {
      await say(first ? "First up: what are we building? Pick as many as you like." : "What are we building? Pick as many as you like.");
      const v = await options(Object.keys(FOLLOW), { multi: true, sel: S.services, back }); if (v === BACK) return BACK;
      S.services = v;
      Object.keys(S.kind).forEach(s => { if (!v.includes(s)) { delete S.kind[s]; delete S.size[s]; delete S.sure[s]; } });
      showEstimate();
      if (v.length > 1) await say("Nice combo. Doing it all in one job usually saves time and money.");
    },
    kind: async (svc, back) => {
      const f = FOLLOW[svc]; await say(`<b>${svc}.</b> ${f.q}`);
      const v = await options(f.o, { back }); if (v === BACK) return BACK;
      S.kind[svc] = v[0];
    },
    size: async (svc, back) => {
      const len = FOLLOW[svc].size === "length";
      await say(len ? "And roughly how long, end to end?" : "Roughly how big is the area?");
      const v = await slider(len ? { min: 2, max: 60, step: 1, val: S.size[svc] || 12, unit: "m", hint: "A standard suburban side boundary is about 30 m.", back }
        : { min: 5, max: 300, step: 5, val: S.size[svc] || 40, unit: "m²", hint: "For scale, a double garage is about 36 m².", back });
      if (v === BACK) return BACK;
      S.size[svc] = v.v; S.sure[svc] = v.sure; showEstimate();
    },
    suburb: async (_, back) => {
      await say("Which suburb is the property in? (Or the postcode.)");
      const v = await ask({ ph: "e.g. Yanchep or 6035", ac: "address-level2", max: 30, list: "suburbList", val: S.suburb || "", check: checkSuburb, back });
      if (v === BACK) return BACK;
      if (/^\d+$/.test(v)) { S.suburb = v; return say(`Postcode ${v}, got it. We'll confirm the exact spot when we call.`); }
      const known = SUBURBS.find(s => s.toLowerCase() === v.toLowerCase());
      const near = !known && SUBURBS.map(s => [s, lev(s.toLowerCase(), v.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
      if (near && near[1] <= 2) {
        await say(`Did you mean <b>${near[0]}</b>?`);
        const [c] = await options([`Yes, ${near[0]}`, `No, it's ${v}`]);
        S.suburb = c.startsWith("Yes") ? near[0] : v;
      } else S.suburb = known || v;
      await say(SUBURBS.includes(S.suburb) ? `${S.suburb}, great. That's within our Perth service area.` : `Thanks. We cover the whole Perth metro area, and we'll confirm ${esc(S.suburb)} when we call.`);
    },
    when: async (_, back) => {
      await say("When are you hoping to get started?");
      const v = await options(["As soon as possible", "In 1–3 months", "In 3–6 months", "Just planning for now"], { back }); if (v === BACK) return BACK;
      S.when = v[0];
    },
    access: async (_, back) => {
      await say("How easy is it to get machinery to the work area?");
      const v = await options(["Wide side access (bobcat fits)", "Narrow, walk-through only", "Only through the house", "Not sure"], { back }); if (v === BACK) return BACK;
      S.access = v[0];
    },
    notes: async (_, back) => {
      await say("Anything else we should know? Slopes, old paving to remove, pets, a deadline…");
      const v = await ask({ ph: "Tell us anything (optional)…", max: 500, val: S.notes || "", back, skip: "Nothing else",
        check: v => v.length < 3 ? ["Could you add a little more detail? Or tap “Nothing else”."] : [null, v] });
      if (v === BACK) return BACK;
      S.notes = v === SKIP ? "" : v;
    },
    name: async (_, back) => {
      await say("Almost done. What's your name?");
      const v = await ask({ ph: "Your name", ac: "name", max: 40, val: S.name || "", check: checkName, back }); if (v === BACK) return BACK;
      S.name = v;
    },
    phone: async (_, back) => {
      await say(`Thanks, ${esc(S.name.split(" ")[0])}. What's the best phone number for you?`);
      const v = await ask({ ph: "e.g. 0412 345 678", type: "tel", mode: "tel", ac: "tel", max: 20, val: S.phone || "", check: checkPhone, back }); if (v === BACK) return BACK;
      S.phone = v;
    },
    email: async (_, back) => {
      await say("And your email, so we can send the written quote?");
      for (;;) {
        const v = await ask({ ph: "name@example.com", type: "email", mode: "email", ac: "email", max: 80, val: S.email || "", check: checkEmail, back }); if (v === BACK) return BACK;
        const [u, d] = v.split("@"), fix = fixDomain(d);
        if (fix === d) { S.email = v; return; }
        await say(`Did you mean <b>${esc(u + "@" + fix)}</b>?`);
        const [c] = await options([`Yes, use @${fix}`, `No, @${d} is right`, "Let me retype it"]);
        if (c.startsWith("Yes")) { S.email = u + "@" + fix; return; }
        if (c.startsWith("No")) { S.email = v; return; }
        S.email = null;
      }
    },
    method: async (_, back) => {
      await say("How would you prefer we get in touch?");
      const v = await options(["Phone call", "Text message", "Email"], { back }); if (v === BACK) return BACK;
      S.method = v[0]; if (S.method !== "Phone call") S.time = null;
    },
    time: async (_, back) => {
      await say("When's the best time to call?");
      const v = await options(["Morning", "Afternoon", "After 5 pm", "Any time"], { back }); if (v === BACK) return BACK;
      S.time = v[0];
    },
    review: async () => {
      const b = ballpark(); showEstimate();
      const row = (k, v, edit) => `<dt>${k}</dt><dd><span>${v}</span><button type="button" class="sum-edit" data-edit="${edit}" aria-label="Edit ${k.replace(/<[^>]+>/g, "")}">Edit</button></dd>`;
      const rows = S.services.map(s => row(esc(s), `${esc(S.kind[s])} · ${S.sure[s] ? "~" : "size TBC, ~"}${S.size[s]} ${unitOf(s)}`, "kind:" + s)).join("")
        + row("Suburb", esc(S.suburb), "suburb") + row("Start", esc(S.when), "when") + row("Access", esc(S.access), "access")
        + (S.notes ? row("Notes", esc(S.notes), "notes") : "")
        + row("Name", esc(S.name), "name") + row("Phone", esc(S.phone), "phone") + row("Email", esc(S.email), "email")
        + row("Contact by", esc(S.method + (S.time ? ` · ${S.time}` : "")), "method");
      await say("Here's your project brief. Tap <b>Edit</b> on anything that needs changing.");
      const sum = document.createElement("div"); sum.className = "summary";
      sum.innerHTML = `<dl>${rows}<dt>Ballpark</dt><dd><b>${b ? `${r100(b[0])} – ${r100(b[1])}` : "TBC"}</b></dd></dl>`;
      log.appendChild(sum); scrollLog();
      await say("The ballpark uses typical Perth rates. Your exact price comes after a free site visit. Ready to send this to the team?");
      const pick = options(["Send my brief", "Add another service", "Start over"]);
      const editing = new Promise(res => sum.addEventListener("click", e => { const t = e.target.closest("[data-edit]"); if (t) { pick.drop(); bubble(`Edit ${esc(t.getAttribute("aria-label").slice(5))}`, "me"); res({ edit: t.dataset.edit }); } }));
      const r = await Promise.race([pick, editing]);
      sum.classList.add("locked");
      if (r.edit) return r;
      if (r[0] === "Start over") { forget(); return { restart: true }; }
      if (r[0] === "Add another service") return { edit: "services" };
      return { send: true };
    },
  };
  const runStep = (id, back, first) => { const [k, s] = id.split(":"); return STEP[k](s, back, first); };

  /* ---------- sending ---------- */
  const brief = ref => {
    const b = ballpark();
    const where = /^\d+$/.test(S.suburb) ? `postcode ${S.suburb}` : S.suburb;
    const data = {
      _subject: `New quote request: ${S.services.join(" + ")} in ${where} (${S.name})`, _template: "box", _captcha: "false", _replyto: S.email, _cc: CC,
      "Customer": S.name, "Phone": S.phone, "Email": S.email,
      "Contact by": S.method + (S.time ? `, ${S.time.toLowerCase()}` : ""),
      "Location": /^\d+$/.test(S.suburb) ? `Postcode ${S.suburb}` : S.suburb,
    };
    // one line per service, e.g. "Driveway, about 40 m²"
    S.services.forEach(s => { data[s] = `${S.kind[s]}, about ${S.size[s]} ${unitOf(s)}${S.sure[s] ? "" : " (customer unsure of size)"}`; });
    Object.assign(data, { "Start": S.when, "Site access": S.access });
    if (S.notes) data["Notes"] = S.notes;
    Object.assign(data, {
      "Ballpark shown": b ? `${r100(b[0])} – ${r100(b[1])}` : "Not calculated",
      "Reference": ref,
      "Received": new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) + " (Perth time)",
    });
    return data;
  };
  const mailtoLink = data => `mailto:${INBOX}?subject=${encodeURIComponent(data._subject)}&body=${encodeURIComponent(Object.entries(data).filter(([k]) => k[0] !== "_").map(([k, v]) => `${k}: ${v}`).join("\n"))}`;
  const sendBrief = async () => {
    const g = GEN, ref = "GW-" + Date.now().toString(36).slice(-5).toUpperCase(), data = brief(ref);
    for (;;) {
      setProgress("review");
      const t = bubble(`<span class="sending"><i></i>Sending your brief…</span>`);
      let ok = false;
      try {
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
        const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data), signal: ctl.signal });
        clearTimeout(timer);
        const j = await r.json().catch(() => ({}));
        ok = r.ok && String(j.success) === "true";
        if (!ok && /activat/i.test(j.message || "")) console.warn("FormSubmit: the form needs activating from the inbox email.");
      } catch (e) { ok = false; }
      t.remove(); if (g !== GEN) return;
      if (ok) {
        forget(); setProgress("done");
        await say([`Sent! 🎉 Thanks, ${esc(S.name.split(" ")[0])}.`, `Your reference is <b class="ref">${ref}</b>. A GreenWA team member will ${S.method === "Email" ? "email you" : S.method === "Text message" ? "text you" : "call you"} within one business day to book your free site visit.`]);
        const [again] = await options(["Plan another project"]); if (again) run(null, true);
        return;
      }
      await say(navigator.onLine === false ? "Looks like you're offline, so the brief didn't send. Nothing is lost." : "Sorry, the brief didn't go through. Nothing is lost.");
      const [c] = await options(["Try again", "Send it by email instead"]);
      if (c === "Try again") continue;
      const link = mailtoLink(data);
      await say(`I've opened your email app with the brief filled in. If nothing opened, <a href="${esc(link)}">tap here</a> or email us at <a href="mailto:${INBOX}">${INBOX}</a>.`);
      location.href = link;
      return;
    }
  };

  /* ---------- the engine: walks the steps, supports back, edit and resume ---------- */
  const flow = async (id, trail = [], editing = false) => {
    const g = GEN;
    while (g === GEN) {
      setProgress(id); save(id);
      const r = await runStep(id, trail.length > 0, trail.length === 0);
      if (g !== GEN) return;
      if (r === BACK) { id = editing ? "review" : (trail.pop() || id); editing = false; continue; }
      if (r && r.restart) return run(null, true);
      if (r && r.send) return sendBrief();
      if (r && r.edit) { trail.push(id); id = r.edit; editing = true; continue; }
      trail.push(id);
      const o = order();
      // after an edit, jump straight back to the review (asking anything new first)
      id = editing ? (id.startsWith("kind:") ? "size:" + id.slice(5) : o.find(x => !has(x)) || "review") : o[o.indexOf(id) + 1];
      if (id === "review") editing = false;
    }
  };

  const run = async (preset, skipResume, kind) => {
    GEN++; busy = false; waitText = null; input.disabled = send.disabled = true; showErr("");
    log.innerHTML = ""; estCard.hidden = true; S = fresh();
    const saved = !preset && !skipResume && load();
    if (saved) {
      await say(["Welcome back! 👋", "You were part-way through a project brief. Want to pick up where you left off?"]);
      const [c] = await options(["Continue my brief", "Start fresh"]);
      if (c.startsWith("Continue")) { S = Object.assign(fresh(), saved.S); showEstimate(); return flow(saved.id in STEP || saved.id.includes(":") ? saved.id : "services", ["services"]); }
      forget(); log.innerHTML = "";
    }
    if (preset) {
      await say([`Hi! Let's plan your <b>${esc(kind ? kind.toLowerCase() : preset)}</b> project. 👋`, "A few quick questions and I'll put together your brief, plus a ballpark price."]);
      await say("Anything else to add to the same job? Tap any extras, or just tap Done.");
      const extra = await options(Object.keys(FOLLOW).filter(s => s !== preset), { multi: true, optional: true });
      S.services = [preset, ...extra];
      if (kind) { S.kind[preset] = kind; return flow("size:" + preset, ["services"]); }
      return flow("kind:" + preset, ["services"]);
    }
    await say(["Hi! I'm the GreenWA project planner. 👋", "Answer a few quick questions and I'll put together your brief, plus a ballpark price. You can go back or edit anything before it's sent."]);
    flow("services");
  };

  let started = false;
  const start = () => { if (!started) { started = true; run(); } };
  new IntersectionObserver(([e]) => e.isIntersecting && start(), { threshold: 0.35 }).observe($("#chat"));
  $("#chatReset").addEventListener("click", () => { started = true; forget(); run(null, true); });
  $$("[data-ask]").forEach(b => b.addEventListener("click", () => {
    goTo(quote); started = true; run(b.dataset.ask, false, b.dataset.kind);
  }));
  $$(".svc[data-svc]").forEach(c => c.addEventListener("click", e => { if (!e.target.closest("button")) $("[data-ask]", c).click(); }));

  /* ---------- gallery lightbox: the photo grows out of its tile and shrinks back into it ---------- */
  const lbox = $("#lightbox"), lbImg = $(".lb-fig img", lbox), lbCap = $(".lb-cap", lbox), lbCount = $(".lb-count", lbox), figs = $$("#gallery .g");
  let lbAt = 0, lbFrom = null, lbBusy = false;
  const big = src => src.replace(/w=\d+/, "w=2000").replace(/q=\d+/, "q=80");
  const FLY = "transform .62s cubic-bezier(.2,.8,.2,1), clip-path .62s cubic-bezier(.2,.8,.2,1), border-radius .62s";
  // transform + crop that makes the full photo sit exactly where (and how) the cover-cropped tile shows it
  const tileGeom = f => {
    const R = f.getBoundingClientRect(), F = lbImg.getBoundingClientRect();
    const s = Math.max(R.width / F.width, R.height / F.height);
    const ix = Math.max(0, (F.width - R.width / s) / 2), iy = Math.max(0, (F.height - R.height / s) / 2);
    return {
      t: `translate(${(R.left + R.width / 2 - (F.left + F.width / 2)).toFixed(1)}px,${(R.top + R.height / 2 - (F.top + F.height / 2)).toFixed(1)}px) scale(${s.toFixed(4)})`,
      c: `inset(${iy.toFixed(1)}px ${ix.toFixed(1)}px round ${(2 / s).toFixed(1)}px)`
    };
  };
  const setInfo = () => { const f = figs[lbAt]; lbCap.textContent = $("figcaption", f).textContent; lbCount.textContent = `${lbAt + 1} / ${figs.length}`; };
  const loadBig = f => { const im = $("img", f), hi = new Image(); hi.onload = () => { if (figs[lbAt] === f) lbImg.src = hi.src; }; hi.src = big(im.src); };
  const setSrc = f => { const im = $("img", f); lbImg.src = im.src; lbImg.alt = im.alt; return lbImg.decode().catch(() => {}); };
  const showTile = (f, on) => { $("img", f).style.visibility = on ? "" : "hidden"; };

  const lbOpen = async i => {
    if (lbBusy) return; lbBusy = true;
    lbAt = i; lbFrom = document.activeElement;
    const f = figs[i];
    lbImg.style.transition = "none"; lbImg.style.opacity = "0";
    lbox.hidden = false; setInfo();
    await setSrc(f);
    if (reduce) { lbImg.style.opacity = ""; lbImg.style.transform = lbImg.style.clipPath = ""; }
    else {
      const g = tileGeom(f);
      lbImg.style.transform = g.t; lbImg.style.clipPath = g.c; lbImg.style.opacity = "";
      showTile(f, false);
      lbImg.getBoundingClientRect();                    // commit the start pose
      lbImg.style.transition = FLY; lbImg.style.transform = "none"; lbImg.style.clipPath = "inset(0px round 4px)";
    }
    lbox.classList.add("open");
    lenis && lenis.stop(); document.documentElement.style.overflow = "hidden";
    $(".lb-close", lbox).focus({ preventScroll: true });
    loadBig(f);
    setTimeout(() => { lbBusy = false; }, reduce ? 0 : 620);
  };

  const lbClose = () => {
    if (lbBusy || lbox.hidden) return; lbBusy = true;
    const f = figs[lbAt], r = f.getBoundingClientRect(), visible = r.bottom > 0 && r.top < innerHeight;
    lbox.classList.remove("open");
    if (!reduce && visible) {
      const g = tileGeom(f);
      lbImg.style.transition = FLY; lbImg.style.transform = g.t; lbImg.style.clipPath = g.c;
    } else { lbImg.style.transition = "opacity .3s"; lbImg.style.opacity = "0"; }
    const done = () => {
      figs.forEach(x => showTile(x, true));
      lbox.hidden = true; lbImg.style.cssText = ""; lbBusy = false;
      lenis && lenis.start(); document.documentElement.style.overflow = "";
      lbFrom && lbFrom.focus({ preventScroll: true });
    };
    setTimeout(done, reduce ? 0 : visible ? 620 : 300);
  };

  // next / previous: quick slide-and-fade between photos
  const lbStep = async dir => {
    if (lbBusy || lbox.hidden) return; lbBusy = true;
    showTile(figs[lbAt], true);
    lbImg.style.transition = "opacity .18s, transform .18s"; lbImg.style.clipPath = "inset(0px round 4px)";
    lbImg.style.opacity = "0"; lbImg.style.transform = `translateX(${-dir * 40}px)`;
    await new Promise(r => setTimeout(r, reduce ? 0 : 180));
    lbAt = (lbAt + dir + figs.length) % figs.length;
    const f = figs[lbAt]; setInfo(); showTile(f, false);
    await setSrc(f);
    lbImg.style.transition = "none"; lbImg.style.transform = `translateX(${dir * 40}px)`; lbImg.getBoundingClientRect();
    lbImg.style.transition = "opacity .28s, transform .38s cubic-bezier(.2,.8,.2,1)"; lbImg.style.opacity = ""; lbImg.style.transform = "none";
    loadBig(f);
    setTimeout(() => { lbBusy = false; }, reduce ? 0 : 300);
  };

  figs.forEach((f, i) => {
    f.addEventListener("click", () => lbOpen(i));
    f.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lbOpen(i); } });
  });
  $(".lb-close", lbox).addEventListener("click", lbClose);
  $(".lb-prev", lbox).addEventListener("click", () => lbStep(-1));
  $(".lb-next", lbox).addEventListener("click", () => lbStep(1));
  lbox.addEventListener("click", e => { if (e.target === lbox || e.target === $(".lb-fig", lbox)) lbClose(); });
  addEventListener("keydown", e => {
    if (lbox.hidden) return;
    if (e.key === "Escape") lbClose(); else if (e.key === "ArrowRight") lbStep(1); else if (e.key === "ArrowLeft") lbStep(-1);
  });
  let sx = null;
  lbox.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  lbox.addEventListener("touchend", e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1); sx = null; });
})();
