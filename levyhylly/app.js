const DATA_URL = "./albums.json";

// Virtualisointi
const WINDOW_RADIUS = 9; // max 19 kantta DOMissa
const PREFETCH_RADIUS = 3;

const $ = (sel) => document.querySelector(sel);
const stage = $("#stage");
const flow = $("#flow");
const q = $("#q");
const sortSel = $("#sort");
const btnPrev = $("#prev");
const btnNext = $("#next");

const elCount = $("#count");
const elPos = $("#pos");
const elTitle = $("#title");
const elArtist = $("#artist");

let all = [];
let filtered = [];
let index = 0;

// preload cache
const prefetchCache = new Map();
const PREFETCH_CACHE_MAX = 80;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
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
  // Mobiilissa halutaan “ei ylimääräistä” => oletus artist_asc, eikä pakoteta UI:ta
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
  prefetchNearby();
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

  if (btnPrev) btnPrev.disabled = index <= 0;
  if (btnNext) btnNext.disabled = index >= filtered.length - 1;

  const start = clamp(
    index - WINDOW_RADIUS,
    0,
    Math.max(0, filtered.length - 1),
  );
  const end = clamp(index + WINDOW_RADIUS, 0, Math.max(0, filtered.length - 1));

  flow.innerHTML = "";

  for (let i = start; i <= end; i++) {
    const a = filtered[i];
    const btn = document.createElement("button");
    btn.className = "album";
    btn.type = "button";
    btn.dataset.i = String(i);

    btn.innerHTML = `
      <div class="cover">
        <img alt="" decoding="async" />
        <div class="gloss"></div>
      </div>
      <div class="reflection" aria-hidden="true">
        <div class="cover"><img alt="" decoding="async" /><div class="gloss"></div></div>
        <div class="fade"></div>
      </div>
    `;

    const imgs = btn.querySelectorAll("img");
    imgs[0].src = a.coverUrl;
    imgs[0].alt = `${a.artist} – ${a.title}`;
    imgs[1].src = a.coverUrl;

    imgs[0].loading = i === index ? "eager" : "lazy";
    imgs[1].loading = i === index ? "eager" : "lazy";

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

  const refl = el.querySelector(".reflection");
  if (refl) refl.style.opacity = offset === 0 ? ".22" : ".14";
}

function scheduleIdle(fn) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout: 800 });
  } else {
    setTimeout(fn, 80);
  }
}

function prefetchNearby() {
  const start = clamp(
    index - PREFETCH_RADIUS,
    0,
    Math.max(0, filtered.length - 1),
  );
  const end = clamp(
    index + PREFETCH_RADIUS,
    0,
    Math.max(0, filtered.length - 1),
  );

  scheduleIdle(() => {
    for (let i = start; i <= end; i++) {
      const url = filtered[i]?.coverUrl;
      if (!url) continue;
      if (prefetchCache.has(url)) continue;

      const img = new Image();
      img.decoding = "async";
      img.src = url;
      prefetchCache.set(url, img);

      if (prefetchCache.size > PREFETCH_CACHE_MAX) {
        const firstKey = prefetchCache.keys().next().value;
        prefetchCache.delete(firstKey);
      }
    }
  });
}

/* Desktop: klikkaa myös seuraava/edellinen aktiivisesta */
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

/* Swipe / drag: tärkein mobiilissa */
function swipeThresholdPx() {
  const w = Math.max(
    320,
    Math.min(900, stage.clientWidth || window.innerWidth),
  );
  return clamp(Math.round(w * 0.05), 20, 44);
}

let down = false;
let startX = 0;
let lastX = 0;
let lastT = 0;
let accum = 0;
let vel = 0;

stage.addEventListener(
  "pointerdown",
  (ev) => {
    down = true;
    startX = ev.clientX;
    lastX = ev.clientX;
    lastT = performance.now();
    accum = 0;
    vel = 0;
    stage.setPointerCapture?.(ev.pointerId);
  },
  { passive: true },
);

stage.addEventListener(
  "pointermove",
  (ev) => {
    if (!down) return;

    const now = performance.now();
    const dx = ev.clientX - lastX;
    const dt = Math.max(1, now - lastT);
    vel = dx / dt;

    lastX = ev.clientX;
    lastT = now;

    accum += ev.clientX - startX;
    startX = ev.clientX;

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
    if (!down) return;
    down = false;

    const speed = Math.abs(vel);
    let extra = 0;
    if (speed > 0.6) extra = 1;
    if (speed > 0.9) extra = 2;

    if (extra > 0) {
      const dir = vel > 0 ? -1 : 1;
      jump(dir * extra);
    }
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

/* UI (desktop) */
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

load();
