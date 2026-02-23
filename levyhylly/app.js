const DATA_URL = "./albums.json";

// Adaptive virtualisointi: mobiilissa vähemmän kansia kerralla
const WINDOW_RADIUS_DESKTOP = 9; // max 19
const WINDOW_RADIUS_MOBILE = 5; // max 11

const $ = (sel) => document.querySelector(sel);
const stage = $("#stage");
const flow = $("#flow");

const q = $("#q");
const sortSel = $("#sort");
const btnPrev = $("#prev");
const btnNext = $("#next");

const mPrev = $("#mPrev");
const mNext = $("#mNext");

const elCount = $("#count");
const elPos = $("#pos");
const elTitle = $("#title");
const elArtist = $("#artist");

let all = [];
let filtered = [];
let index = 0;

// preload cache
const prefetchCache = new Map();
const PREFETCH_CACHE_MAX = 120;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function isMobile() {
  return window.matchMedia?.("(max-width: 640px)")?.matches;
}
function windowRadius() {
  return isMobile() ? WINDOW_RADIUS_MOBILE : WINDOW_RADIUS_DESKTOP;
}

function prefetchRadius() {
  // jos kuvat on pieniä, ei kannata ylisuuresti prefetchailla mobiilissa
  return isMobile() ? 4 : 3;
}

function normalizeAlbum(a, i) {
  return {
    id: a.id ?? `${a.artist}-${a.title}-${a.year}-${i}`,
    artist: String(a.artist ?? ""),
    title: String(a.title ?? ""),
    year:
      a.year === undefined || a.year === null || a.year === ""
        ? ""
        : Number(a.year),
    coverUrl: String(a.coverUrl ?? ""),
  };
}

function compareText(a, b) {
  return String(a).localeCompare(String(b), "fi", { sensitivity: "base" });
}

function applySort(list) {
  const mode = sortSel?.value || "artist_asc";
  const arr = [...list];

  arr.sort((a, b) => {
    if (mode === "artist_asc") {
      const c = compareText(a.artist, b.artist);
      if (c) return c;

      const ya = a.year === "" ? 999999 : a.year;
      const yb = b.year === "" ? 999999 : b.year;
      if (ya !== yb) return ya - yb;

      return compareText(a.title, b.title);
    }

    if (mode === "year_asc" || mode === "year_desc") {
      const ya = a.year === "" ? 999999 : a.year;
      const yb = b.year === "" ? 999999 : b.year;
      const d = ya - yb;
      if (d !== 0) return mode === "year_desc" ? -d : d;

      const c = compareText(a.artist, b.artist);
      if (c) return c;
      return compareText(a.title, b.title);
    }

    const c = compareText(a.title, b.title);
    if (c) return c;
    return compareText(a.artist, b.artist);
  });

  return arr;
}

async function load() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data.albums)
        ? data.albums
        : [];

    all = arr.map(normalizeAlbum).filter((a) => a.coverUrl);
  } catch (err) {
    console.warn("JSON-lataus epäonnistui:", err);
    all = [
      {
        id: "demo",
        artist: "Demo",
        title: "Laita albums.json DATA_URLiin",
        year: 0,
        coverUrl:
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#0b1220"/>
          </linearGradient></defs>
          <rect width="800" height="800" fill="url(#g)"/>
          <rect x="70" y="70" width="660" height="660" rx="54" fill="none" stroke="#334155" stroke-width="10"/>
          <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle"
            font-family="ui-sans-serif,system-ui" font-size="34" fill="#e5e7eb">
            DATA_URL ➜ albums.json
          </text>
          <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle"
            font-family="ui-sans-serif,system-ui" font-size="20" fill="#94a3b8">
            (tai suora URL + CORS)
          </text>
        </svg>
      `),
      },
    ];
  }

  applyFilterAndSort();
  render();
  prefetchNearby(true);
}

function applyFilterAndSort() {
  const activeIdBefore = filtered[index]?.id;

  const term = (q?.value || "").trim().toLowerCase();
  const base = !term
    ? all
    : all.filter((a) =>
        `${a.artist} ${a.title} ${a.year}`.toLowerCase().includes(term),
      );

  filtered = applySort(base);

  if (activeIdBefore) {
    const newIdx = filtered.findIndex((a) => a.id === activeIdBefore);
    index =
      newIdx >= 0 ? newIdx : clamp(index, 0, Math.max(0, filtered.length - 1));
  } else {
    index = clamp(index, 0, Math.max(0, filtered.length - 1));
  }
}

function jump(delta) {
  index = clamp(index + delta, 0, Math.max(0, filtered.length - 1));
  render();
  prefetchNearby();
}

function setActive(i) {
  index = clamp(i, 0, Math.max(0, filtered.length - 1));
  render();
  prefetchNearby();
}

function render() {
  const active = filtered[index];

  elCount.textContent = `${filtered.length} levyä`;
  elPos.textContent = `${filtered.length ? index + 1 : 0}/${filtered.length}`;

  if (active) {
    elTitle.textContent = active.year
      ? `${active.title} (${active.year})`
      : active.title;
    elArtist.textContent = active.artist;
  } else {
    elTitle.textContent = "—";
    elArtist.textContent = "—";
  }

  btnPrev && (btnPrev.disabled = index <= 0);
  btnNext && (btnNext.disabled = index >= filtered.length - 1);
  mPrev && (mPrev.disabled = index <= 0);
  mNext && (mNext.disabled = index >= filtered.length - 1);

  const R = windowRadius();
  const start = clamp(index - R, 0, Math.max(0, filtered.length - 1));
  const end = clamp(index + R, 0, Math.max(0, filtered.length - 1));

  flow.innerHTML = "";

  for (let i = start; i <= end; i++) {
    const a = filtered[i];
    const btn = document.createElement("button");
    btn.className = "album";
    btn.type = "button";
    btn.dataset.i = String(i);

    // Aseta sama URL CSS-muuttujaan heijastusta varten (ei toista img:tä)
    btn.style.setProperty("--cover-bg", `url("${a.coverUrl}")`);

    btn.innerHTML = `
      <div class="cover">
        <img alt="" decoding="async" />
        <div class="gloss"></div>
      </div>
      <div class="reflection" aria-hidden="true">
        <div class="refBg"></div>
        <div class="fade"></div>
      </div>
    `;

    const img = btn.querySelector("img");

    // Aktiivinen kiireellisenä
    img.loading = i === index ? "eager" : "lazy";
    if (i === index) img.fetchPriority = "high";

    const markLoaded = () => btn.classList.add("loaded");
    img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", markLoaded, { once: true });

    img.src = a.coverUrl;
    img.alt = `${a.artist} – ${a.title}`;

    btn.addEventListener("click", () => setActive(i));

    flow.appendChild(btn);
    applyTransform(btn, i, index);
  }
}

function applyTransform(el, i, activeIndex) {
  const offset = i - activeIndex;
  const abs = Math.abs(offset);
  const sign = offset === 0 ? 0 : offset > 0 ? 1 : -1;

  const rootStyle = getComputedStyle(document.documentElement);
  const spacing = parseFloat(rootStyle.getPropertyValue("--spacing")) || 120;
  const curveDeg = parseFloat(rootStyle.getPropertyValue("--curve")) || 38;
  const tiltDeg = parseFloat(rootStyle.getPropertyValue("--tilt")) || 12;
  const zActive = parseFloat(rootStyle.getPropertyValue("--zActive")) || 180;
  const zStep = parseFloat(rootStyle.getPropertyValue("--zStep")) || 42;

  const x = offset * spacing;
  const rotateY = -sign * Math.min(68, abs * curveDeg);
  const z = offset === 0 ? zActive : -abs * zStep;
  const y = abs * 6;
  const scale = offset === 0 ? 1.0 : 0.86 - abs * 0.05;
  const opacity = abs > 6 ? 0 : 1 - abs * 0.12;
  const blur = abs > 0 ? Math.min(6, abs * 1.1) : 0;
  const zIndex = 1000 - abs;

  el.style.zIndex = String(zIndex);
  el.style.opacity = String(opacity);
  el.style.filter = `blur(${blur}px)`;
  el.style.transform = `
    translate(-50%, -50%)
    translateX(${x}px)
    translateY(${y}px)
    translateZ(${z}px)
    rotateY(${rotateY}deg)
    rotateX(${offset === 0 ? 0 : tiltDeg}deg)
    scale(${scale})
  `;

  const r = el.querySelector(".reflection");
  if (r) r.style.opacity = offset === 0 ? ".22" : ".14";
}

function scheduleIdle(fn) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout: 800 });
  } else {
    setTimeout(fn, 60);
  }
}

function prefetchNearby(initial = false) {
  const radius = prefetchRadius();
  const start = clamp(index - radius, 0, Math.max(0, filtered.length - 1));
  const end = clamp(index + radius, 0, Math.max(0, filtered.length - 1));

  const run = () => {
    for (let i = start; i <= end; i++) {
      const url = filtered[i]?.coverUrl;
      if (!url) continue;
      if (prefetchCache.has(url)) continue;

      const im = new Image();
      im.decoding = "async";
      im.src = url;
      prefetchCache.set(url, im);

      if (prefetchCache.size > PREFETCH_CACHE_MAX) {
        const firstKey = prefetchCache.keys().next().value;
        prefetchCache.delete(firstKey);
      }
    }
  };

  if (initial) run();
  else scheduleIdle(run);
}

/* Desktop: klikkaa myös next/prev aktiivisesta */
function isDesktopPointer() {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
}

stage.addEventListener("click", (ev) => {
  if (!isDesktopPointer()) return;
  if (!filtered.length) return;

  const albumEl = ev.target.closest?.(".album");
  const rect = stage.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const dx = ev.clientX - cx;
  const dead = Math.max(32, rect.width * 0.06);

  if (albumEl) {
    const i = Number(albumEl.dataset.i);
    if (Number.isFinite(i) && i !== index) {
      setActive(i);
      return;
    }
    if (dx > dead) jump(1);
    else if (dx < -dead) jump(-1);
    return;
  }

  if (dx > dead) jump(1);
  else if (dx < -dead) jump(-1);
});

/* Swipe (jätetään, mutta et ole riippuvainen siitä) */
function swipeThresholdPx() {
  const w = Math.max(
    320,
    Math.min(900, stage.clientWidth || window.innerWidth),
  );
  return clamp(Math.round(w * 0.06), 26, 56);
}

let down = false;
let startX = 0;
let accum = 0;

stage.addEventListener(
  "pointerdown",
  (ev) => {
    down = true;
    startX = ev.clientX;
    accum = 0;
    stage.setPointerCapture?.(ev.pointerId);
  },
  { passive: true },
);

stage.addEventListener(
  "pointermove",
  (ev) => {
    if (!down) return;
    const dx = ev.clientX - startX;
    startX = ev.clientX;
    accum += dx;

    const threshold = swipeThresholdPx();
    if (Math.abs(accum) >= threshold) {
      const steps = Math.trunc(accum / threshold);
      jump(-steps);
      accum -= steps * threshold;
    }
  },
  { passive: true },
);

window.addEventListener(
  "pointerup",
  () => {
    down = false;
  },
  { passive: true },
);

/* Wheel desktop */
let wheelLock = false;
stage.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    if (wheelLock) return;
    jump(ev.deltaY > 0 ? 1 : -1);
    wheelLock = true;
    setTimeout(() => (wheelLock = false), 120);
  },
  { passive: false },
);

/* UI */
q?.addEventListener("input", () => {
  applyFilterAndSort();
  render();
  prefetchNearby();
});
sortSel?.addEventListener("change", () => {
  applyFilterAndSort();
  render();
  prefetchNearby();
});
btnPrev?.addEventListener("click", () => jump(-1));
btnNext?.addEventListener("click", () => jump(1));
mPrev?.addEventListener("click", () => jump(-1));
mNext?.addEventListener("click", () => jump(1));

/* Keyboard */
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") jump(-1);
  if (e.key === "ArrowRight") jump(1);
  if (e.key === "Home") {
    index = 0;
    render();
    prefetchNearby();
  }
  if (e.key === "End") {
    index = Math.max(0, filtered.length - 1);
    render();
    prefetchNearby();
  }
});

/* Breakpoint-vaihto -> ikkuna muuttuu */
window.addEventListener(
  "resize",
  () => {
    render();
    prefetchNearby();
  },
  { passive: true },
);

load();
