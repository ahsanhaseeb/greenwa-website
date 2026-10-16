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
    e.preventDefault(); goTo(el); nav.classList.remove("open");
  }));

  /* ---------- nav ---------- */
  const nav = $("#nav");
  $(".nav-burger").addEventListener("click", e => { const o = nav.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", o); });
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
    { cls: "slab-subgrade", h: .17, name: "Subgrade · compacted" },
    { cls: "slab-fabric",   h: .02, name: "Geotextile" },
    { cls: "slab-base",     h: .13, name: "Road base · 100 mm" },
    { cls: "slab-sand",     h: .055, name: "Bedding sand · 30 mm" },
    { cls: "slab-pavers",   h: .07, name: "Pavers · 60 mm" },
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
      s.innerHTML = `<div class="face top"></div><div class="face front"></div><div class="face side"></div>`;
      iso.appendChild(s); slabs.push(s);
      const lb = document.createElement("span"); lb.className = "label"; lb.textContent = L.name; labelBox.appendChild(lb); labels.push(lb);
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
    const now = performance.now() / 1000;
    tiltX += (tiltTX - tiltX) * 0.06; tiltY += (tiltTY - tiltY) * 0.06;
    const rx = lerp(66, 54, ease(p)) - tiltY * 10 + Math.sin(now * 0.7) * 1.2;
    const rz = lerp(-58, -30, ease(p)) + tiltX * 16 + Math.sin(now * 0.45) * 2.5;
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
      const spin = (1 - t) * (i % 2 ? -28 : 28), slide = (1 - t) * U * 0.25 * (i % 2 ? 1 : -1);
      const bob = (1 - combine) * t * Math.sin(now * 1.3 + i * 1.1) * U * 0.012;   // exploded layers float a little
      s.style.transform = `translate3d(${slide.toFixed(1)}px,0,${(zz + bob).toFixed(1)}px) rotateZ(${spin.toFixed(1)}deg)`;
      s.style.visibility = raw > 0.001 ? "visible" : "hidden";   // no opacity: it would flatten the 3D slab
      const lb = labels[i], show = t > 0.9 && combine < 0.3;
      lb.classList.toggle("on", show);
      if (show) {                       // pin the label to the slab's projected right corner
        const sr = $(".top", s).getBoundingClientRect(), pr = labelBox.getBoundingClientRect();
        lb.style.transform = `translate(${(sr.right - pr.left + 14).toFixed(0)}px,${(sr.top + sr.height * 0.42 - pr.top).toFixed(0)}px)`;
      }
    });
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
    track.style.transform = `translate3d(${(-dist * ease(seg(p, 0.05, 0.95))).toFixed(1)}px,0,0)`;
  };

  /* =========================================================
     RETAINING WALL — course by course
     ========================================================= */
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
  const wallG = $("#wallBlocks"), COURSES = 5, CH = (340 - 122) / COURSES, courses = [];
  for (let r = 0; r < COURSES; r++) {
    const g = mk("g", { class: "course" }, wallG), y = 340 - (r + 1) * CH, off = r % 2 ? 40 : 0;
    for (let x = 160 - off; x < 320; x += 80) {
      const x0 = Math.max(160, x), x1 = Math.min(320, x + 80);
      mk("rect", { x: x0 + 1.5, y: y + 1.5, width: x1 - x0 - 3, height: CH - 3, rx: 3, fill: (r + x / 80) % 2 ? "var(--limestone)" : "#DCCCA6" }, g);
      mk("line", { x1: x0 + 6, y1: y + CH * .35, x2: x1 - 10, y2: y + CH * .35, stroke: "#CDBB90", "stroke-width": 1.5, "stroke-linecap": "round" }, g);
    }
    courses.push({ g, y });
  }
  const wallGrass = $("#wallGrass");
  for (let i = 0; i < 70; i++) {
    const x = 160 + i * 6.3 + Math.random() * 3, h = 8 + Math.random() * 12;
    mk("path", { d: `M${x} 104 q${(Math.random() - .5) * 6} ${-h / 2} ${(Math.random() - .5) * 8} ${-h}`, stroke: i % 3 ? "var(--grass)" : "var(--grass-light)", "stroke-width": 2.2, fill: "none", "stroke-linecap": "round", class: "blade" }, wallGrass);
  }
  const wallFoot = $("#wallFooting"), agPipe = $("#agPipe"), wallCap = $("#wallCap"), wallGravel = $("#wallGravel"), wallSoil = $("#wallSoil"), wallTag = $("#wallTag");
  agPipe.style.strokeDasharray = 1;
  const wallScene = p => {
    const f = ease(seg(p, 0, 0.12));
    wallFoot.style.transform = `scaleX(${f})`; wallFoot.style.opacity = f;
    agPipe.style.strokeDashoffset = 1 - ease(seg(p, 0.12, 0.22));
    let topY = 342;
    courses.forEach((c, i) => {
      const t = ease(seg(p, 0.22 + i * 0.1, 0.3 + i * 0.1));
      c.g.style.transform = `translateY(${(1 - t) * -70}px)`; c.g.style.opacity = t;
      if (t > 0.5) topY = c.y;
    });
    const fill = Math.max(122, topY);
    wallGravel.setAttribute("y", fill); wallGravel.setAttribute("height", Math.max(0, 342 - fill));
    wallGravel.style.opacity = ease(seg(p, 0.16, 0.24));
    wallSoil.setAttribute("d", `M360 ${fill} L600 ${fill} L600 360 L360 360 Z`);
    const cap = ease(seg(p, 0.76, 0.84));
    wallCap.style.transform = `translateY(${(1 - cap) * -50}px)`; wallCap.style.opacity = cap;
    const gr = ease(seg(p, 0.84, 0.98));
    wallGrass.style.transform = `scaleY(${gr})`; wallGrass.style.opacity = gr;
    wallTag.textContent = p < .12 ? "Footing" : p < .22 ? "Ag pipe + gravel" : p < .76 ? `Course ${Math.min(5, Math.floor((p - .22) / .1) + 1)} of 5` : p < .84 ? "Capping" : "Done · backfilled";
  };

  /* =========================================================
     TURF — soil prep, roll out, grass grows
     ========================================================= */
  const blades = $("#blades"), seams = $("#turfSeams"), bladeEls = [];
  for (let i = 0; i < 190; i++) {
    const x = 42 + i * 2.74 + Math.random() * 2, h = 10 + Math.random() * 20, lean = (Math.random() - .5) * 10;
    bladeEls.push(mk("path", { d: `M${x} 250 q${lean / 2} ${-h / 2} ${lean} ${-h}`, stroke: ["var(--grass)", "var(--grass-light)", "var(--grass-dark)"][i % 3], "stroke-width": 2, fill: "none", "stroke-linecap": "round" }, blades));
  }
  [170, 300, 430].forEach((x, i) => mk("line", { x1: x + (i % 2 ? 30 : 0), y1: 250, x2: x + (i % 2 ? 30 : 0), y2: 282 }, seams));
  const turfClip = $("#turfClipRect"), roll = $("#turfRoll"), improver = $("#improver"), turfTag = $("#turfTag");
  const turfScene = p => {
    improver.style.opacity = ease(seg(p, 0, 0.18));
    const u = ease(seg(p, 0.2, 0.68)), x = 40 + 520 * u;
    turfClip.setAttribute("width", 520 * u); turfClip.setAttribute("y", 150); turfClip.setAttribute("height", 140);
    const r = lerp(1, 0.35, u);
    roll.setAttribute("transform", `translate(${x},${265 - 34 * r + 17}) rotate(${u * 900}) scale(${r})`);
    roll.style.opacity = 1 - seg(p, 0.66, 0.72);
    const g = ease(seg(p, 0.7, 0.98));
    blades.style.transform = `scaleY(${0.15 + g * 0.85})`;
    turfTag.textContent = p < .2 ? "Soil prep + improver" : p < .7 ? "Rolling out · joints staggered" : p < .98 ? "Watering in" : "Established";
  };

  /* =========================================================
     BRAND MARK — logo strokes draw, each reveals a service pointer
     ========================================================= */
  const markSec = $("#mark"), markSegs = $$("#mark .mk"), pins = $$("#mark .pin"), legend = $$("#mark .legend button");
  const SEG = [[0.04, 0.2], [0.24, 0.36], [0.4, 0.56], [0.6, 0.76]];
  const markScene = p => {
    markSegs.forEach((s, i) => { const t = ease(seg(p, ...SEG[i])); s.style.strokeDashoffset = 1 - t; s.style.opacity = t > 0.005 ? 1 : 0; });
    pins.forEach((pin, i) => pin.classList.toggle("show", p >= SEG[i][1] - 0.01));
    legend.forEach((l, i) => l.classList.toggle("show", p >= SEG[i][1] - 0.01));
    markSec.classList.toggle("filled", p > 0.82);
  };

  /* ---------- process line ---------- */
  const steps = $("#steps"), stepsLine = $("#stepsLine");

  /* ---------- parallax ---------- */
  const heroImg = $(".hero-media img"), gal = $$(".g[data-speed]");

  /* ---------- frame loop: all scroll-linked work in one rAF ---------- */
  const secProgress = el => {           // pinned sections: 0 at top hits top, 1 at bottom hits bottom
    const r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - vh));
  };
  const viewProgress = (el, a = 0.95, b = 0.25) => {   // element top travelling from a*vh to b*vh
    const r = el.getBoundingClientRect(); return clamp((a * vh - r.top) / ((a - b) * vh + r.height * 0.3));
  };
  const fab = $(".fab"), quote = $("#quote");
  const frame = () => {
    const y = scrollY;
    if (Math.abs(y - lastY) > 4) { nav.classList.toggle("hide", y > lastY && y > 400 && !nav.classList.contains("open")); lastY = y; }
    nav.classList.toggle("solid", y > 40);
    if (!reduce) {
      heroImg.style.transform = `translate3d(0,${y * 0.25}px,0) scale(${1 + y * 0.0002})`;
      gal.forEach(g => { const r = g.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) g.style.transform = `translate3d(0,${((r.top + r.height / 2 - vh / 2) * +g.dataset.speed).toFixed(1)}px,0)`; });
    }
    if (manWords.length) {
      const p = viewProgress(man, 0.85, 0.15) * 1.15;
      manWords.forEach((w, i) => w.classList.toggle("lit", i / manWords.length < p));
    }
    markScene(reduce ? 1 : secProgress(markSec));
    layersScene(reduce ? 1 : secProgress(layersSec));
    servicesScene(secProgress(svcSec));
    wallScene(reduce ? 1 : viewProgress($("#wallBuild"), 0.9, 0.2));
    turfScene(reduce ? 1 : viewProgress($("#turfBuild"), 0.9, 0.2));
    stepsLine.style.setProperty("--draw", 1 - viewProgress(steps, 0.85, 0.45));
    const qr = quote.getBoundingClientRect();
    fab.classList.toggle("show", y > vh * 0.9 && !(qr.top < vh && qr.bottom > 0));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  addEventListener("resize", () => {
    const w = innerWidth; vh = innerHeight;
    if (w !== vw) { vw = w; buildBricks(); buildIso(); }
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
})();
