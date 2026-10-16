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
    { cls: "slab-subgrade", h: .17, name: "Subgrade · compacted", short: "Subgrade" },
    { cls: "slab-fabric",   h: .02, name: "Geotextile", short: "Geotextile" },
    { cls: "slab-base",     h: .13, name: "Road base · 100 mm", short: "Road base" },
    { cls: "slab-sand",     h: .055, name: "Bedding sand · 30 mm", short: "Bedding sand" },
    { cls: "slab-pavers",   h: .07, name: "Pavers · 60 mm", short: "Pavers" },
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
      s.style.setProperty("--h", (L.h * U).toFixed(1) + "px");
      s.innerHTML = `<div class="face top"></div><div class="face front"><i class="anc"></i></div><div class="face side"></div>`;
      iso.appendChild(s); slabs.push(s);
      const lb = document.createElement("span"); lb.className = "label"; lb.textContent = vw < 561 ? L.short : L.name; labelBox.appendChild(lb); labels.push(lb);
    });
    // stretcher-bond pavers on the top face of the last slab
    const top = $(".slab-pavers .top", iso), ROWS = 8, COLS = 5;
    for (let r = 0; r < ROWS; r++) {
      const off = r % 2 ? -0.5 : 0;
      for (let c = 0; c <= COLS; c++) {
        let x0 = (c + off) / COLS, x1 = (c + off + 1) / COLS;
        x0 = Math.max(0, x0); x1 = Math.min(1, x1); if (x1 - x0 < 0.01) continue;
        const p = document.createElement("i"); p.className = "pv t" + (1 + ((r * 7 + c * 3) % 3)); p.innerHTML = "<b></b><b></b>";
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
    const GAP = U * 0.13;
    let z = 0, current = -1;
    const combine = ease(seg(p, 0.74, 0.88));
    const squash = Math.sin(seg(p, 0.86, 0.93) * Math.PI) * 0.09;   // the stack "thuds" as it locks
    // camera: slow orbit across the scroll + idle sway + pointer tilt
    const rx = lerp(66, 54, ease(p)) - tiltY * 10;
    const rz = lerp(-58, -30, ease(p)) + tiltX * 16;
    iso.style.transform = reduce ? "" : `rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
    motes.style.opacity = clamp(seg(p, 0.02, 0.1)) * (1 - seg(p, 0.86, 0.96));
    shadow.style.opacity = (0.35 + 0.45 * clamp(seg(p, 0.03, 0.13))).toFixed(2);
    shadow.style.transform = `translateZ(-1px) scale(${(1.08 + squash * 1.5 + (1 - combine) * 0.08).toFixed(3)})`;
    slabs.forEach((s, i) => {
      const L = LAYERS[i];
      const compact = z, exploded = z + i * GAP;
      z += L.h * U;
      const raw = seg(p, 0.03 + i * 0.12, 0.13 + i * 0.12), t = ease(raw), tb = back(raw);
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
    const pp = seg(p, 0.55, 0.72);
    pavers.forEach(el => {
      const k = +el.dataset.k, raw = seg(pp, k * 0.8, k * 0.8 + 0.2), t = bounce(raw);
      el.style.setProperty("--z", ((1 - t) * U * 0.5).toFixed(1) + "px");
      el.style.setProperty("--r", ((1 - raw) * 40 * (k > 0.5 ? 1 : -1)).toFixed(1) + "deg");
      el.style.setProperty("--o", clamp(raw * 4));
    });
    layerLis.forEach((li, i) => {
      li.classList.toggle("on", i <= current || combine > 0.5);
      li.classList.toggle("now", combine < 0.5 ? i === current : false);
    });
    stamp.classList.toggle("show", p > 0.9);
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
    g.fillStyle = base; g.fillRect(0, 0, 128, 128); draw(g);
    document.documentElement.style.setProperty("--tx-" + name, `url(${c.toDataURL()})`);
  };
  const R = Math.random, dots = (g, n, cols, r0, r1) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const x = R() * 128, y = R() * 128, r = r0 + R() * (r1 - r0); for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [-128, 0], [0, -128]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } } };
  tex("soil", "#7A5A3E", g => dots(g, 260, ["#5A3F2A", "#8C6A4B", "#6A4C33", "#9A7A58"], 0.8, 2.2));
  tex("gravel", "#8C887E", g => dots(g, 170, ["#A9A59B", "#6E6A61", "#C9C4B6", "#7D796F", "#B8B3A6"], 2, 4.6));
  tex("concrete", "#B7B6AE", g => dots(g, 420, ["rgba(0,0,0,.12)", "rgba(255,255,255,.35)"], 0.5, 1.2));
  tex("lime", "#E6D9B6", g => { dots(g, 140, ["rgba(150,125,80,.28)", "rgba(255,255,255,.4)", "rgba(120,100,60,.18)"], 0.6, 1.8); });
  tex("improver", "#3F2C1C", g => dots(g, 300, ["#2A1D12", "#6B4E31", "#57402A"], 0.8, 2));
  tex("grass", "#48A333", g => {
    for (let i = 0; i < 900; i++) {
      const x = R() * 128, y = R() * 128, l = 3 + R() * 6, a = -Math.PI / 2 + (R() - 0.5) * 0.9;
      g.strokeStyle = ["#2E7F22", "#5DB83F", "#7FD05A", "#3B9128", "#9BE070"][i % 5]; g.lineWidth = 1 + R() * 0.8;
      for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [-128, 0], [0, -128]]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); }
    }
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
     RETAINING WALL — footing, ag pipe, courses, backfill, cap, lawn
     ========================================================= */
  const wallSc = $("#wallScene"), wallTag = $("#wallTag"), wallBar = $("#wallBar");
  let W = {};
  const buildWall = () => {
    wallSc.innerHTML = "";
    const U = wallSc.clientWidth, Dp = U * 0.8, CH = U * 0.068, BASE = U * 0.04, L = U * 0.84;
    shadowEl(wallSc, -U * 0.1 - 2);
    const front = box(wallSc, 0, Dp * 0.62, U, Dp * 0.38, U * 0.1, "m-grass"); front.style.transform = `translateZ(${-U * 0.1}px)`; 
    const back = box(wallSc, 0, 0, U, Dp * 0.62, U * 0.1, "m-soil"); back.style.transform = `translateZ(${-U * 0.1}px)`;
    const soil = box(wallSc, U * 0.02, 0, U * 0.96, Dp * 0.24, U * 0.04, "m-soil");
    const gravel = box(wallSc, U * 0.08, Dp * 0.24, L, Dp * 0.18, 1, "m-gravel");
    const footing = box(wallSc, U * 0.05, Dp * 0.38, U * 0.9, Dp * 0.26, BASE, "m-concrete");
    const pipe = box(wallSc, U * 0.1, Dp * 0.3, L - U * 0.04, Dp * 0.06, U * 0.035, "m-pipe");
    footing.style.transformOrigin = "50% 50%"; pipe.style.transformOrigin = "0 50%";
    const blocks = [], bl = L / 4;
    for (let r = 0; r < 5; r++) {
      const off = r % 2 ? bl / 2 : 0;
      for (let x = -off, j = 0; x < L - 1; x += bl, j++) {
        const x0 = Math.max(0, x), x1 = Math.min(L, x + bl);
        const e = box(wallSc, U * 0.08 + x0 + 1, Dp * 0.42, x1 - x0 - 2, Dp * 0.18, CH - 2, "m-lime v" + ((r * 3 + j) % 3));
        blocks.push({ e, r, j, z: BASE + r * CH });
      }
    }
    const TOP = BASE + 5 * CH;
    const cap = box(wallSc, U * 0.065, Dp * 0.405, U * 0.87, Dp * 0.21, U * 0.03, "m-cap");
    const lawn = box(wallSc, U * 0.02, 0, U * 0.96, Dp * 0.42, U * 0.018, "m-grass");
    // ground-level tags: dot sits on each lawn, label floats above it
    const stage = wallSc.parentNode; stage.querySelectorAll(".wl").forEach(e => e.remove());
    const tags = [pointer(stage, lawn.firstChild, "Raised level", 22, 45), pointer(stage, front.firstChild, "Original ground", 72, 55)];
    W = { U, CH, BASE, TOP, soil, gravel, footing, pipe, blocks, cap, lawn, tags, stage };
  };
  const wallScene = p => {
    if (!W.U) return;
    const { U, CH, BASE, TOP, soil, gravel, footing, pipe, blocks, cap, lawn, tags, stage } = W;
    camera(wallSc, p, 63, 55, -50, -30, 0);
    const f = ease(seg(p, 0.02, 0.1));
    footing.style.transform = `scaleX(${Math.max(0.001, f).toFixed(3)})`; footing.style.visibility = f > 0.001 ? "visible" : "hidden";
    const q = ease(seg(p, 0.1, 0.18));
    pipe.style.transform = `translateZ(${BASE}px) scaleX(${Math.max(0.001, q).toFixed(3)})`; pipe.style.visibility = q > 0.001 ? "visible" : "hidden";
    let placed = 0;
    blocks.forEach(b => {
      const a0 = 0.2 + b.r * 0.1 + b.j * 0.012, raw = seg(p, a0, a0 + 0.06), t = ease(raw);
      b.e.style.visibility = raw > 0.001 ? "visible" : "hidden";
      b.e.style.transform = `translate3d(0,${((1 - t) * -U * 0.08).toFixed(1)}px,${(b.z + (1 - t) * U * 0.45).toFixed(1)}px) rotateZ(${((1 - t) * (b.j % 2 ? 9 : -9)).toFixed(2)}deg)`;
    });
    for (let r = 0; r < 5; r++) placed += ease(seg(p, 0.27 + r * 0.1, 0.31 + r * 0.1));
    const fillZ = BASE + CH * placed - (placed > 4.99 ? U * 0.012 : 0);
    const gh = Math.max(U * 0.045 * ease(seg(p, 0.15, 0.2)), fillZ - BASE);
    gravel.style.setProperty("--h", gh.toFixed(1) + "px"); gravel.style.transform = `translateZ(${BASE}px)`; gravel.style.visibility = gh > 0.5 ? "visible" : "hidden";
    soil.style.setProperty("--h", Math.max(U * 0.04, fillZ).toFixed(1) + "px");
    const c = ease(seg(p, 0.74, 0.82));
    cap.style.visibility = c > 0.001 ? "visible" : "hidden";
    cap.style.transform = `translateZ(${(TOP + (1 - c) * U * 0.3).toFixed(1)}px)`;
    const g = ease(seg(p, 0.84, 0.97));
    lawn.style.visibility = g > 0.001 ? "visible" : "hidden";
    lawn.style.transform = `translateZ(${(fillZ - U * 0.018 * (1 - g)).toFixed(1)}px)`;
    lawn.style.setProperty("--dry", (1 - g).toFixed(3));
    placePointers(stage, tags, [g > 0.6, g > 0.6]);
    wallTag.textContent = p < 0.1 ? "Footing" : p < 0.2 ? "Ag pipe + gravel" : p < 0.72 ? `Course ${Math.min(5, Math.floor((p - 0.2) / 0.1) + 1)} of 5 · backfilled` : p < 0.84 ? "Capping" : "Done · lawn on top";
    wallBar.style.transform = `scaleX(${p.toFixed(4)})`;
  };

  /* =========================================================
     TURF — improver, laser level, rolls unroll, watered, grows in
     ========================================================= */
  const turfSc = $("#turfScene"), turfTag = $("#turfTag"), turfBar = $("#turfBar"), drops = $("#turfDrops");
  for (let i = 0; i < 46; i++) { const d = document.createElement("i"); d.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;--d:${(0.7 + Math.random() * 0.6).toFixed(2)}s;--dl:${(-Math.random()).toFixed(2)}s;--fall:${(180 + Math.random() * 140).toFixed(0)}px`; drops.appendChild(d); }
  let T = {};
  const buildTurf = () => {
    turfSc.innerHTML = "";
    const U = turfSc.clientWidth, Dp = U * 0.8;
    shadowEl(turfSc, -U * 0.12 - 2);
    const ground = box(turfSc, 0, 0, U, Dp, U * 0.12, "m-ground"); ground.style.transform = `translateZ(${-U * 0.12}px)`;
    const imp = box(turfSc, U * 0.04, Dp * 0.05, U * 0.92, Dp * 0.9, U * 0.016, "m-improver"); imp.style.transformOrigin = "0 50%";
    const laser = document.createElement("div"); laser.className = "laser"; laser.style.cssText = `left:${U * 0.04}px;width:${U * 0.92}px`; turfSc.appendChild(laser);
    const strips = [], JX = [0.38, 0.68, 0.5];
    for (let k = 0; k < 3; k++) {
      const y0 = Dp * (0.05 + k * 0.3), d = Dp * 0.3 - 3;
      const e = box(turfSc, U * 0.04, y0, U * 0.92, d, U * 0.022, "m-turf");
      e.style.setProperty("--jx", (U * 0.92 * JX[k]).toFixed(0) + "px"); e.style.setProperty("--stripe", (U * 0.92 / 8).toFixed(0) + "px");
      const roll = document.createElement("div"); roll.className = "roll"; roll.style.cssText = `top:${y0.toFixed(1)}px;height:${d.toFixed(1)}px`;
      roll.innerHTML = Array.from({ length: 10 }, (_, i) => `<i style="--a:${(i * 36).toFixed(2)}deg"></i>`).join("") + "<b></b>";
      turfSc.appendChild(roll);
      strips.push({ e, roll });
    }
    const stage = turfSc.parentNode; stage.querySelectorAll(".wl").forEach(e => e.remove());
    const tags = [
      pointer(stage, imp.children[1], "Soil improver", 82, 50),
      pointer(stage, ground.children[1], "Levelled sand base", 30, 70),
      pointer(stage, strips[1].e.firstChild, "Staggered joints", JX[1] * 100, 50),
      ...strips.map(s => { const a = document.createElement("u"); a.className = "anc"; a.style.cssText = "left:0;top:100%"; s.roll.appendChild(a); return a; })
    ];
    const rollTag = document.createElement("span"); rollTag.className = "wl"; rollTag.textContent = "Fresh-cut roll"; stage.appendChild(rollTag);
    T = { U, Dp, imp, laser, strips, stage, tags: tags.slice(0, 3), rollAnc: tags.slice(3), rollTag };
  };
  const turfScene = p => {
    if (!T.U) return;
    const { U, Dp, imp, laser, strips, stage, tags, rollAnc, rollTag } = T;
    camera(turfSc, p, 62, 56, -24, -42, 1.7);
    const im = ease(seg(p, 0.02, 0.15));
    imp.style.visibility = im > 0.001 ? "visible" : "hidden";
    imp.style.transform = `scaleX(${Math.max(0.001, im).toFixed(3)})`;
    const lz = seg(p, 0.16, 0.24);
    laser.style.visibility = lz > 0 && lz < 1 ? "visible" : "hidden";
    laser.style.transform = `translate3d(0,${(Dp * (0.05 + 0.9 * lz)).toFixed(1)}px,${(U * 0.016 + 2).toFixed(1)}px)`;
    const full = U * 0.92, Z0 = U * 0.016;
    strips.forEach((s, k) => {
      const u = ease(seg(p, 0.25 + k * 0.15, 0.47 + k * 0.15)), w = full * u;
      s.e.style.width = Math.max(0.5, w).toFixed(1) + "px";
      s.e.style.visibility = u > 0.002 ? "visible" : "hidden";
      s.e.style.transform = `translateZ(${Z0}px)`;
      const r = lerp(U * 0.085, U * 0.032, u), spin = (w / ((U * 0.085 + U * 0.032) / 2)) * 57.3;
      s.roll.style.setProperty("--r", r.toFixed(1) + "px");
      s.roll.style.visibility = u < 0.995 ? "visible" : "hidden";
      s.roll.style.transform = `translate3d(${(U * 0.04 + w).toFixed(1)}px,0,${(Z0 + r).toFixed(1)}px) rotateY(${spin.toFixed(1)}deg)`;
    });
    const k = Math.min(2, Math.max(0, Math.floor((p - 0.25) / 0.15))), rolling = p > 0.27 && p < 0.74;
    placePointers(stage, [...tags, { a: rollAnc[k], l: rollTag }], [p > 0.12 && p < 0.3, p > 0.18, p > 0.5, rolling]);
    const wet = seg(p, 0.76, 0.9);
    drops.style.opacity = (Math.sin(wet * Math.PI) * 0.9).toFixed(2);
    turfSc.style.setProperty("--g", (0.3 + 0.7 * ease(seg(p, 0.84, 0.98))).toFixed(3));
    turfSc.style.setProperty("--seam", (1 - seg(p, 0.84, 0.96)).toFixed(3));
    turfSc.style.setProperty("--dry", (1 - seg(p, 0.76, 0.95)).toFixed(3));
    turfTag.textContent = p < 0.16 ? "Soil prep + improver" : p < 0.25 ? "Laser levelled" : p < 0.76 ? "Rolling out · joints staggered" : p < 0.9 ? "Watering in" : "Established";
    turfBar.style.transform = `scaleX(${p.toFixed(4)})`;
  };
  const buildScenes = () => { buildWall(); buildTurf(); };
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
  const fab = $(".fab"), quote = $("#quote"), wallPin = $("#wallBuild"), turfPin = $("#turfBuild");
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
    drive(markScene, markSec, reduce ? 1 : secProgress(markSec));
    drive(layersScene, layersSec, reduce ? 1 : secProgress(layersSec));
    drive(servicesScene, svcSec, secProgress(svcSec));
    drive(wallScene, wallPin, reduce ? 1 : secProgress(wallPin));
    drive(turfScene, turfPin, reduce ? 1 : secProgress(turfPin));
    if (vw > 960) {                    // pinned: the line runs left to right and lights each step as it arrives
      const d = reduce ? 1 : ease(seg(secProgress(procSec), 0.06, 0.8)), sw = steps.clientWidth;
      stepsLine.style.transform = `scaleX(${d.toFixed(4)})`;
      stepEls.forEach(s => s.classList.toggle("on", d >= s.offsetLeft / sw - 0.002));
    }
    const qr = quote.getBoundingClientRect();
    fab.classList.toggle("show", y > vh * 0.9 && !(qr.top < vh && qr.bottom > 0));
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
     PROJECT PLANNER — a short conversation that builds a brief
     ========================================================= */
  const log = $("#chatLog"), form = $("#chatForm"), input = $("#chatText"), send = $("#chatSend");
  const estCard = $("#estimateCard"), estVal = $("#estimateVal");
  const SUBURBS = ["Joondalup", "Hillarys", "Scarborough", "Ellenbrook", "Midland", "Cottesloe", "Applecross", "Canning Vale", "Armadale", "Rockingham", "Baldivis", "Mandurah", "Fremantle", "Subiaco", "Wanneroo", "Clarkson", "Kalamunda", "Morley", "Bunbury", "Byford", "Duncraig", "Karrinyup", "Mount Lawley", "Victoria Park", "Willetton", "Bateman", "Secret Harbour", "Butler", "Alkimos", "Yanchep", "Piara Waters", "Harrisdale", "Success", "Cockburn", "Atwell", "Ocean Reef", "Mindarie", "Nedlands", "Claremont", "Como", "South Perth", "Perth"];
  const FOLLOW = {
    "Paving": { q: "Where's the paving going?", o: ["Driveway", "Alfresco / patio", "Pool surround", "Paths", "Not sure yet"], size: "area" },
    "Retaining walls": { q: "Roughly how tall will the wall be?", o: ["Under 500 mm", "500 mm – 1 m", "Over 1 m", "Not sure"], size: "length" },
    "Turf & lawns": { q: "Real turf or synthetic?", o: ["Real turf", "Synthetic", "Help me choose"], size: "area" },
    "Landscaping": { q: "Which part of the property?", o: ["Front yard", "Backyard", "Both", "Courtyard / side"], size: "area" },
  };
  // indicative Perth ranges (AUD) — for a ballpark only
  const RATE = {
    "Paving": () => [95, 165],
    "Turf & lawns": a => a === "Synthetic" ? [75, 120] : [28, 48],
    "Landscaping": () => [85, 210],
    "Retaining walls": a => a === "Over 1 m" ? [1100, 1900] : a === "500 mm – 1 m" ? [600, 1050] : [320, 600],
  };
  let S, busy = false, waitText = null, GEN = 0;

  const scrollLog = () => log.scrollTop = log.scrollHeight;
  const bubble = (html, who = "bot") => { const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = html; log.appendChild(d); scrollLog(); return d; };
  const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const say = (lines) => new Promise(res => {
    busy = true; lines = [].concat(lines); const g = GEN;
    const next = () => {
      if (g !== GEN) return;                       // a newer conversation replaced this one
      if (!lines.length) { busy = false; return res(); }
      const t = document.createElement("div"); t.className = "msg bot typing"; t.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(t); scrollLog();
      const line = lines.shift();
      setTimeout(() => { t.remove(); if (g !== GEN) return; bubble(line); setTimeout(next, 180); }, reduce ? 50 : Math.min(1200, 350 + line.length * 12));
    };
    next();
  });
  const options = (list, { multi = false, optional = false } = {}) => new Promise(res => {
    const wrap = document.createElement("div"); wrap.className = "opts"; const picked = new Set();
    const finish = vals => { wrap.remove(); bubble(esc(vals.length ? vals.join(", ") : "Just that, thanks"), "me"); res(vals); };
    list.forEach(o => {
      const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = o;
      b.addEventListener("click", () => {
        if (!multi) return finish([o]);
        picked.has(o) ? picked.delete(o) : picked.add(o); b.classList.toggle("sel"); doneBtn.disabled = !optional && !picked.size;
      });
      wrap.appendChild(b);
    });
    let doneBtn;
    if (multi) {
      doneBtn = document.createElement("button"); doneBtn.type = "button"; doneBtn.className = "opt opt-done"; doneBtn.textContent = "Done ✓"; doneBtn.disabled = !optional;
      doneBtn.addEventListener("click", () => finish([...picked])); wrap.appendChild(doneBtn);
    }
    log.appendChild(wrap); scrollLog();
  });
  const slider = ({ min, max, step, val, unit, hint }) => new Promise(res => {
    const w = document.createElement("div"); w.className = "range-wrap";
    w.innerHTML = `<div class="row"><output>${val} ${unit}</output><button type="button" class="opt opt-done">Use this</button></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="Size in ${unit}"><small class="muted">${hint}</small>`;
    const r = $("input", w), o = $("output", w);
    r.addEventListener("input", () => o.textContent = `${r.value} ${unit}`);
    $("button", w).addEventListener("click", () => { w.remove(); bubble(`About ${r.value} ${unit}`, "me"); res(+r.value); });
    log.appendChild(w); scrollLog();
  });
  const ask = (placeholder, validate) => new Promise(res => {
    input.disabled = send.disabled = false; input.placeholder = placeholder; input.value = ""; input.focus({ preventScroll: true });
    waitText = async v => {
      const err = validate && validate(v);
      if (err) { await say(err); input.disabled = send.disabled = false; input.focus({ preventScroll: true }); return; }
      input.disabled = send.disabled = true; input.placeholder = "Pick an option above…"; waitText = null; res(v);
    };
  });
  form.addEventListener("submit", e => {
    e.preventDefault(); const v = input.value.trim(); if (!v || !waitText || busy) return;
    bubble(esc(v), "me"); input.value = ""; input.disabled = send.disabled = true; waitText(v);
  });

  const run = async preset => {
    GEN++; busy = false; waitText = null; input.disabled = send.disabled = true;
    S = { services: [], details: {} };
    log.innerHTML = ""; estCard.hidden = true;
    if (preset) {
      await say([`Hi! Let's plan your <b>${esc(preset)}</b> project. 👋`, "A few quick questions and I'll put together your brief, plus a ballpark price."]);
      await say("Anything else to add to the same job? Tap any extras, or just tap Done.");
      S.services = [preset, ...await options(Object.keys(FOLLOW).filter(s => s !== preset), { multi: true, optional: true })];
    } else {
      await say(["Hi! I'm the GreenWA project planner. 👋", "Answer a few quick questions and I'll put together your brief, plus a ballpark price.", "First up: what are we building? Pick as many as you like."]);
      S.services = await options(Object.keys(FOLLOW), { multi: true });
    }
    if (S.services.length > 1) await say("Nice combo. Doing it all in one job usually saves time and money.");
    for (const svc of S.services) {
      const f = FOLLOW[svc];
      await say(`<b>${svc}.</b> ${f.q}`);
      const [a] = await options(f.o);
      let size;
      if (f.size === "length") {
        await say("And roughly how long, end to end?");
        size = await slider({ min: 2, max: 60, step: 1, val: 12, unit: "m", hint: "A standard suburban side boundary is about 30 m." });
      } else {
        await say("Roughly how big is the area?");
        size = await slider({ min: 5, max: 300, step: 5, val: 40, unit: "m²", hint: "For scale, a double garage is about 36 m²." });
      }
      S.details[svc] = { a, size };
    }
    await say("Which suburb is the property in?");
    S.suburb = await ask("e.g. Joondalup", v => v.length < 2 ? "Could you type the suburb name?" : null);
    const known = SUBURBS.find(s => s.toLowerCase() === S.suburb.toLowerCase());
    await say(known ? `${known}, great. That's within our Perth service area.` : `Thanks. We cover the whole Perth metro area, and we'll confirm ${esc(S.suburb)} when we call.`);
    await say("When are you hoping to get started?");
    [S.when] = await options(["As soon as possible", "In 1–3 months", "In 3–6 months", "Just planning for now"]);
    await say("Anything we should know? Slopes, tight access, pets, a deadline like a party… (or type “no”)");
    S.notes = await ask("Tell us anything…");
    await say("Almost done. What's your first name?");
    S.name = await ask("First name", v => v.length < 2 ? "Just your first name is fine." : null);
    await say(`Thanks, ${esc(S.name)}. What's the best phone or email to reach you?`);
    S.contact = await ask("Phone or email", v => /\S+@\S+\.\S+/.test(v) || v.replace(/\D/g, "").length >= 8 ? null : "That doesn't look like a phone number or email. Could you check it?");

    // ballpark
    let lo = 0, hi = 0;
    S.services.forEach(s => { const d = S.details[s], [a, b] = RATE[s](d.a); lo += a * d.size; hi += b * d.size; });
    const r100 = n => "$" + (Math.round(n / 100) * 100).toLocaleString("en-AU");
    estVal.textContent = `${r100(lo)} – ${r100(hi)}`; estCard.hidden = false;

    const rows = S.services.map(s => `<dt>${esc(s)}</dt><dd>${esc(S.details[s].a)} · ~${S.details[s].size} ${s === "Retaining walls" ? "m" : "m²"}</dd>`).join("");
    await say(["Here's your project brief:"]);
    const sum = document.createElement("div"); sum.className = "summary";
    sum.innerHTML = `<dl>${rows}<dt>Suburb</dt><dd>${esc(S.suburb)}</dd><dt>Start</dt><dd>${esc(S.when)}</dd>${/^no\.?$/i.test(S.notes) ? "" : `<dt>Notes</dt><dd>${esc(S.notes)}</dd>`}<dt>Contact</dt><dd>${esc(S.name)} · ${esc(S.contact)}</dd><dt>Ballpark</dt><dd><b>${r100(lo)} – ${r100(hi)}</b></dd></dl>`;
    log.appendChild(sum); scrollLog();
    await say("That ballpark is based on typical Perth rates. Your exact price comes after a free site visit. Shall I send this brief to the team?");
    const [ok] = await options(["Yes, send it", "Start over"]);
    if (ok === "Start over") return run();
    await say([`Done, ${esc(S.name)}! 🎉 A GreenWA team member will be in touch within one business day to book your site visit.`, "<small class='muted'>(Demo site: on the live site this brief goes straight to the GreenWA inbox.)</small>"]);
    const [again] = await options(["Plan another project"]); if (again) run();
  };

  let started = false;
  const start = () => { if (!started) { started = true; run(); } };
  new IntersectionObserver(([e]) => e.isIntersecting && start(), { threshold: 0.35 }).observe($("#chat"));
  $("#chatReset").addEventListener("click", () => { started = true; run(); });
  $$("[data-ask]").forEach(b => b.addEventListener("click", () => {
    goTo(quote); started = true; run(b.dataset.ask);
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
