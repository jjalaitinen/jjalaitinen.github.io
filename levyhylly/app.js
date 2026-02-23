const DATA_URL = "./albums.json";

// Adaptive virtualisointi
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

// Smooth position (float)
let pos = 0;
let target = 0;

// Render window bookkeeping
let renderedCenter = -1;
let renderedStart = 0;
let renderedEnd = -1;

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

  applyFilterAndSort(true);
  // start animation loop
  requestAnimationFrame(tick);
  prefetchNearby(true);
}

function applyFilterAndSort(reset = false) {
  const currentId = nearestAlbum()?.id;

  const term = (q?.value || "").trim().toLowerCase();
  const base = !term
    ? all
    : all.filter((a) =>
        `${a.artist} ${a.title} ${a.year}`.toLowerCase().includes(term),
      );

  filtered = applySort(base);

  const max = Math.max(0, filtered.length - 1);

  if (reset || !currentId) {
    pos = clamp(pos, 0, max);
    target = clamp(target, 0, max);
  } else {
    // keep current album if possible
    const newIdx = filtered.findIndex((a) => a.id === currentId);
    const keep = newIdx >= 0 ? newIdx : clamp(Math.round(target), 0, max);
    pos = clamp(pos, 0, max);
    target = clamp(keep, 0, max);
  }

  // force rebuild
  renderedCenter = -1;
  rebuildWindowIfNeeded();
  updateMetaUI();
}

function nearestIndex() {
  if (!filtered.length) return 0;
  return clamp(Math.round(pos), 0, filtered.length - 1);
}

function nearestAlbum() {
  return filtered[nearestIndex()];
}

function jump(delta) {
  if (!filtered.length) return;
  const max = filtered.length - 1;
  target = clamp(target + delta, 0, max);
  // snap a bit quicker for button presses
  prefetchNearby();
}

function setTargetIndex(i) {
  if (!filtered.length) return;
  const max = filtered.length - 1;
  target = clamp(i, 0, max);
  prefetchNearby();
}

function updateMetaUI() {
  const n = filtered.length;
  const idx = n ? nearestIndex() : 0;
  const active = filtered[idx];

  elCount.textContent = `${n} levyä`;
  elPos.textContent = `${n ? idx + 1 : 0}/${n}`;

  if (active) {
    elTitle.textContent = active.year
      ? `${active.title} (${active.year})`
      : active.title;
    elArtist.textContent = active.artist;
  } else {
    elTitle.textContent = "—";
    elArtist.textContent = "—";
  }

  btnPrev && (btnPrev.disabled = idx <= 0);
  btnNext && (btnNext.disabled = idx >= n - 1);
  mPrev && (mPrev.disabled = idx <= 0);
  mNext && (mNext.disabled = idx >= n - 1);
}

function scheduleIdle(fn) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout: 800 });
  } else {
    setTimeout(fn, 60);
  }
}

function prefetchNearby(initial = false) {
  const n = filtered.length;
  if (!n) return;

  const radius = prefetchRadius();
  const center = clamp(Math.round(target), 0, n - 1);
  const start = clamp(center - radius, 0, n - 1);
  const end = clamp(center + radius, 0, n - 1);

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

function rebuildWindowIfNeeded() {
  const n = filtered.length;
  if (!n) {
    flow.innerHTML = "";
    renderedCenter = -1;
    renderedStart = 0;
    renderedEnd = -1;
    return;
  }

  const center = clamp(Math.round(pos), 0, n - 1);
  const R = windowRadius();
  const start = clamp(center - R, 0, n - 1);
  const end = clamp(center + R, 0, n - 1);

  if (
    center === renderedCenter &&
    start === renderedStart &&
    end === renderedEnd
  )
    return;

  renderedCenter = center;
  renderedStart = start;
  renderedEnd = end;

  flow.innerHTML = "";

  for (let i = start; i <= end; i++) {
    const a = filtered[i];
    const btn = document.createElement("button");
    btn.className = "album";
    btn.type = "button";
    btn.dataset.i = String(i);

    // reflection uses CSS background
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

    // load priority for nearest to target
    img.loading = i === center ? "eager" : "lazy";
    if (i === center) img.fetchPriority = "high";

    const markLoaded = () => btn.classList.add("loaded");
    img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", markLoaded, { once: true });

    img.src = a.coverUrl;
    img.alt = `${a.artist} – ${a.title}`;

    btn.addEventListener("click", () => setTargetIndex(i));

    flow.appendChild(btn);
  }
}

function updateTransforms() {
  const children = flow.children;
  for (let k = 0; k < children.length; k++) {
    const el = children[k];
    const i = Number(el.dataset.i);
    if (!Number.isFinite(i)) continue;
    applyTransform(el, i, pos);
  }
}

function applyTransform(el, i, p) {
  const offset = i - p; // <-- float = smooth
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
  const z = abs < 0.0001 ? zActive : -abs * zStep;
  const y = abs * 6;
  const scale = abs < 0.0001 ? 1.0 : 0.86 - abs * 0.05;
  const opacity = abs > 6 ? 0 : 1 - abs * 0.12;
  const blur = abs > 0.0001 ? Math.min(6, abs * 1.1) : 0;
  const zIndex = 1000 - Math.round(abs * 1000); // stable ordering while animating

  el.style.zIndex = String(zIndex);
  el.style.opacity = String(opacity);
  el.style.filter = `blur(${blur}px)`;
  el.style.transform = `
    translate(-50%, -50%)
    translateX(${x}px)
    translateY(${y}px)
    translateZ(${z}px)
    rotateY(${rotateY}deg)
    rotateX(${abs < 0.0001 ? 0 : tiltDeg}deg)
    scale(${scale})
  `;

  const r = el.querySelector(".reflection");
  if (r) r.style.opacity = abs < 0.6 ? ".22" : ".14";
}

// Animation loop (spring-ish)
let lastMetaIndex = -1;
function tick() {
  const n = filtered.length;
  if (n) {
    const max = n - 1;
    target = clamp(target, 0, max);

    // Smoothly move pos -> target
    const diff = target - pos;
    // damping/speed: tweak to taste
    pos += diff * 0.14;

    // stop micro-jitter
    if (Math.abs(diff) < 0.0005) pos = target;

    rebuildWindowIfNeeded();
    updateTransforms();

    const idx = nearestIndex();
    if (idx !== lastMetaIndex) {
      lastMetaIndex = idx;
      updateMetaUI();
      prefetchNearby(); // keep near current target warm
    }
  } else {
    updateMetaUI();
  }

  requestAnimationFrame(tick);
}

/* ---------------------------
   Input handlers
---------------------------- */

// Desktop wheel: smooth
let wheelAccum = 0;
let wheelRAF = 0;

stage.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    if (!filtered.length) return;

    // Normalize delta: trackpads have small deltas, mouse wheels bigger
    const dy = ev.deltaY;
    wheelAccum += dy;

    if (!wheelRAF) {
      wheelRAF = requestAnimationFrame(() => {
        wheelRAF = 0;
        // Convert pixels -> index fraction
        // Higher divisor = slower movement
        const step = wheelAccum / 240; // tune
        wheelAccum = 0;

        if (step !== 0) {
          target = clamp(target + step, 0, filtered.length - 1);
        }
      });
    }
  },
  { passive: false },
);

// Buttons
btnPrev?.addEventListener("click", () => jump(-1));
btnNext?.addEventListener("click", () => jump(1));
mPrev?.addEventListener("click", () => jump(-1));
mNext?.addEventListener("click", () => jump(1));

// Keyboard
window.addEventListener("keydown", (e) => {
  if (!filtered.length) return;
  if (e.key === "ArrowLeft") jump(-1);
  if (e.key === "ArrowRight") jump(1);
  if (e.key === "Home") setTargetIndex(0);
  if (e.key === "End") setTargetIndex(filtered.length - 1);
});

// Search / sort
q?.addEventListener("input", () => {
  applyFilterAndSort(false);
});
sortSel?.addEventListener("change", () => {
  applyFilterAndSort(false);
});

// Drag / swipe: continuous
let dragging = false;
let dragStartX = 0;
let dragStartTarget = 0;

function getSpacingPx() {
  const rootStyle = getComputedStyle(document.documentElement);
  return parseFloat(rootStyle.getPropertyValue("--spacing")) || 120;
}

stage.addEventListener(
  "pointerdown",
  (ev) => {
    if (!filtered.length) return;
    dragging = true;
    dragStartX = ev.clientX;
    dragStartTarget = target;
    stage.setPointerCapture?.(ev.pointerId);
  },
  { passive: true },
);

stage.addEventListener(
  "pointermove",
  (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - dragStartX;

    // dx pixels -> index fraction
    const spacing = getSpacingPx();
    const deltaIndex = dx / spacing;

    // dragging right should move to previous album (like old logic),
    // hence minus:
    target = clamp(
      dragStartTarget - deltaIndex,
      0,
      Math.max(0, filtered.length - 1),
    );
  },
  { passive: true },
);

function endDrag() {
  if (!dragging) return;
  dragging = false;
  if (!filtered.length) return;

  // snap to nearest album when released
  target = clamp(Math.round(target), 0, filtered.length - 1);
  prefetchNearby();
}

window.addEventListener("pointerup", endDrag, { passive: true });
window.addEventListener("pointercancel", endDrag, { passive: true });

// Desktop: click side of active to next/prev (kept)
function isDesktopPointer() {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
}
stage.addEventListener("click", (ev) => {
  if (!isDesktopPointer()) return;
  if (!filtered.length) return;

  const albumEl = ev.target.closest?.(".album");
  if (albumEl) {
    const i = Number(albumEl.dataset.i);
    if (Number.isFinite(i) && i !== nearestIndex()) {
      setTargetIndex(i);
      return;
    }
  }

  const rect = stage.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const dx = ev.clientX - cx;
  const dead = Math.max(32, rect.width * 0.06);

  if (dx > dead) jump(1);
  else if (dx < -dead) jump(-1);
});

// Responsive changes
window.addEventListener(
  "resize",
  () => {
    renderedCenter = -1; // force rebuild with new radius/spacing
    rebuildWindowIfNeeded();
    prefetchNearby();
  },
  { passive: true },
);

// Start
load();
