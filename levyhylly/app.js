const DATA_URL = "./albums.json";

// Turbo-mode: mobiilissa 2D-karuselli (maksimi suorituskyky)
const MOBILE_TURBO = true;

// Render window
const WINDOW_RADIUS_DESKTOP = 9; // max 19
const WINDOW_RADIUS_MOBILE = 4; // max 9

const $ = (sel) => document.querySelector(sel);
const stage = $("#stage");
const flow = $("#flow");

const q = $("#q"); // desktop search
const mq = $("#mq"); // mobile search
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

let pos = 0;
let target = 0;

let renderedCenter = -1;
let renderedStart = 0;
let renderedEnd = -1;

// Prefetch cache
const prefetchCache = new Map();
const PREFETCH_CACHE_MAX = 120;

// MUUTOS: pidetään kirjaa kuvista jotka on jo ladattu kerran,
// jotta ei tehdä "fade-in" joka kerta kun DOM rakennetaan uusiksi.
const loadedUrls = new Set();

// --- tuning ---
const SPRING = 0.16;
const STOP_EPS = 0.0006;

const FLICK_VELOCITY_MIN = 0.35;
const FLICK_GAIN = 0.015;
const MAX_FLICK_ALBUMS = 6;

const SNAP_WHEN_CLOSE = 0.06;
const SNAP_POS_CLOSE = 0.1;

const DRAG_START_PX = 6;
const ACTIVE_EPS = 0.08;

const WHEEL_SENSITIVITY = 240;
const WHEEL_SNAP_DELAY = 140;

let cssCache = {
  spacing: 120,
  curveDeg: 38,
  tiltDeg: 12,
  zActive: 180,
  zStep: 42,
};

function refreshCssCache() {
  const rootStyle = getComputedStyle(document.documentElement);
  cssCache.spacing = parseFloat(rootStyle.getPropertyValue("--spacing")) || 120;
  cssCache.curveDeg = parseFloat(rootStyle.getPropertyValue("--curve")) || 38;
  cssCache.tiltDeg = parseFloat(rootStyle.getPropertyValue("--tilt")) || 12;
  cssCache.zActive = parseFloat(rootStyle.getPropertyValue("--zActive")) || 180;
  cssCache.zStep = parseFloat(rootStyle.getPropertyValue("--zStep")) || 42;
}

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
  return isMobile() ? 3 : 3;
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
  refreshCssCache();

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
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="ui-sans-serif,system-ui" font-size="30" fill="#e5e7eb">
            DATA_URL ➜ albums.json
          </text>
        </svg>
      `),
      },
    ];
  }

  applyFilterAndSort(true);
  requestAnimationFrame(tick);
  prefetchNearby(true);
}

function getQueryValue() {
  if (mq && isMobile()) return mq.value || "";
  if (q) return q.value || "";
  return "";
}
function setBothQueries(val) {
  if (q && q.value !== val) q.value = val;
  if (mq && mq.value !== val) mq.value = val;
}

function applyFilterAndSort(reset = false) {
  const currentId = nearestAlbum()?.id;

  const term = getQueryValue().trim().toLowerCase();
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
    const newIdx = filtered.findIndex((a) => a.id === currentId);
    const keep = newIdx >= 0 ? newIdx : clamp(Math.round(target), 0, max);
    pos = clamp(pos, 0, max);
    target = clamp(keep, 0, max);
  }

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
  if ("requestIdleCallback" in window)
    window.requestIdleCallback(fn, { timeout: 800 });
  else setTimeout(fn, 60);
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

  // MUUTOS: rakennetaan fragmenttiin ja vaihdetaan kerralla (vähemmän "välitilaa")
  const frag = document.createDocumentFragment();

  for (let i = start; i <= end; i++) {
    const a = filtered[i];
    const btn = document.createElement("button");
    btn.className = "album";
    btn.type = "button";
    btn.dataset.i = String(i);

    // fade-in vain jos tätä URL:ia ei ole ennen nähty
    const needsFade = !loadedUrls.has(a.coverUrl);
    if (needsFade) btn.classList.add("fadeIn");

    btn.innerHTML = `
      <div class="cover">
        <img alt="" decoding="async" />
      </div>
    `;

    const img = btn.querySelector("img");
    img.loading = i === center ? "eager" : "lazy";
    if (i === center) img.fetchPriority = "high";

    const markLoaded = () => {
      btn.classList.add("loaded");
      loadedUrls.add(a.coverUrl);
      btn.classList.remove("fadeIn"); // ettei jää päälle
    };

    img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", markLoaded, { once: true });

    img.src = a.coverUrl;
    img.alt = `${a.artist} – ${a.title}`;

    // MUUTOS: jos kuva on jo cache:ssa ja "complete", merkitään heti loaded -> ei blinkkaa
    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
    } else if (!needsFade) {
      // jos ei fadea, varmistetaan ettei odotella load eventtiä näyttämiseen
      btn.classList.add("loaded");
    }

    btn.addEventListener("click", (ev) => {
      if (suppressClick) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      target = clamp(i, 0, filtered.length - 1);
      prefetchNearby();
    });

    frag.appendChild(btn);
  }

  flow.replaceChildren(frag);
}

function updateTransforms() {
  const children = flow.children;
  const mobile = isMobile();
  const turbo = mobile && MOBILE_TURBO;

  for (let k = 0; k < children.length; k++) {
    const el = children[k];
    const i = Number(el.dataset.i);
    if (!Number.isFinite(i)) continue;
    applyTransform(el, i, pos, mobile, turbo);
  }
}

function applyTransform(el, i, p, mobile, turbo) {
  const offset = i - p;
  const abs = Math.abs(offset);

  const { spacing, curveDeg, tiltDeg, zActive, zStep } = cssCache;
  const isActive = abs <= ACTIVE_EPS;

  const x = offset * spacing;
  const opacity = abs > 6 ? 0 : 1 - abs * 0.12;
  const zIndex = 1000 - Math.round(abs * 1000);

  el.style.zIndex = String(zIndex);
  el.style.opacity = String(opacity);
  el.style.filter = "";

  if (turbo) {
    const scale = isActive ? 1.0 : Math.max(0.78, 0.92 - abs * 0.08);
    const y = abs * 3;

    el.style.transform = `
      translate(-50%, -50%)
      translateX(${x}px)
      translateY(${y}px)
      scale(${scale})
    `;
    return;
  }

  const sign = offset === 0 ? 0 : offset > 0 ? 1 : -1;
  const rotateY = -sign * Math.min(68, abs * curveDeg);
  const z = isActive ? zActive : -abs * zStep;
  const y = abs * 6;
  const scale = isActive ? 1.0 : 0.86 - abs * 0.05;

  el.style.transform = `
    translate(-50%, -50%)
    translateX(${x}px)
    translateY(${y}px)
    translateZ(${z}px)
    rotateY(${rotateY}deg)
    rotateX(${isActive ? 0 : tiltDeg}deg)
    scale(${scale})
  `;
}

let lastMetaIndex = -1;
function tick() {
  const n = filtered.length;
  if (n) {
    const max = n - 1;
    target = clamp(target, 0, max);

    const diff = target - pos;
    pos += diff * SPRING;
    if (Math.abs(diff) < STOP_EPS) pos = target;

    if (!dragging) {
      const rounded = Math.round(target);
      if (
        Math.abs(target - rounded) < SNAP_WHEN_CLOSE &&
        Math.abs(pos - target) < SNAP_POS_CLOSE
      ) {
        target = clamp(rounded, 0, max);
      }
      if (Math.abs(pos - target) < 0.001) pos = target;
    }

    rebuildWindowIfNeeded();
    updateTransforms();

    const idx = nearestIndex();
    if (idx !== lastMetaIndex) {
      lastMetaIndex = idx;
      updateMetaUI();
      prefetchNearby();
    }
  } else {
    updateMetaUI();
  }

  requestAnimationFrame(tick);
}

/* ---------------------------
   Input handlers
---------------------------- */

btnPrev?.addEventListener("click", () => {
  if (!filtered.length) return;
  target = clamp(Math.round(target) - 1, 0, filtered.length - 1);
  prefetchNearby();
});
btnNext?.addEventListener("click", () => {
  if (!filtered.length) return;
  target = clamp(Math.round(target) + 1, 0, filtered.length - 1);
  prefetchNearby();
});
mPrev?.addEventListener("click", () => btnPrev?.click());
mNext?.addEventListener("click", () => btnNext?.click());

q?.addEventListener("input", () => {
  setBothQueries(q.value);
  applyFilterAndSort(false);
});
mq?.addEventListener("input", () => {
  setBothQueries(mq.value);
  applyFilterAndSort(false);
});

sortSel?.addEventListener("change", () => {
  applyFilterAndSort(false);
});

window.addEventListener("keydown", (e) => {
  if (!filtered.length) return;

  const tag =
    e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
  const isTyping =
    tag === "input" || tag === "textarea" || e.target?.isContentEditable;
  if (isTyping) return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    target = clamp(Math.round(target) - 1, 0, filtered.length - 1);
    prefetchNearby();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    target = clamp(Math.round(target) + 1, 0, filtered.length - 1);
    prefetchNearby();
  } else if (e.key === "Home") {
    e.preventDefault();
    target = 0;
    prefetchNearby();
  } else if (e.key === "End") {
    e.preventDefault();
    target = filtered.length - 1;
    prefetchNearby();
  }
});

// Wheel smooth + snap
let wheelAccum = 0;
let wheelRAF = 0;
let wheelSnapTimer = 0;

function armWheelSnap() {
  if (wheelSnapTimer) clearTimeout(wheelSnapTimer);
  wheelSnapTimer = setTimeout(() => {
    if (!filtered.length) return;
    if (dragging) return;
    target = clamp(Math.round(target), 0, filtered.length - 1);
    prefetchNearby();
  }, WHEEL_SNAP_DELAY);
}

stage.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    if (!filtered.length) return;

    wheelAccum += ev.deltaY;
    armWheelSnap();

    if (!wheelRAF) {
      wheelRAF = requestAnimationFrame(() => {
        wheelRAF = 0;
        const step = wheelAccum / WHEEL_SENSITIVITY;
        wheelAccum = 0;
        if (step !== 0) {
          target = clamp(target + step, 0, filtered.length - 1);
        }
      });
    }
  },
  { passive: false },
);

// Drag / swipe: inertia + snap
let dragging = false;
let dragStartX = 0;
let dragStartTarget = 0;

let lastX = 0;
let lastT = 0;
let v = 0;

let dragMoved = false;
let suppressClick = false;

function armSuppressClick() {
  suppressClick = true;
  setTimeout(() => {
    suppressClick = false;
  }, 250);
}

stage.addEventListener(
  "pointerdown",
  (ev) => {
    if (!filtered.length) return;

    dragging = true;
    dragMoved = false;

    dragStartX = ev.clientX;
    dragStartTarget = target;

    lastX = ev.clientX;
    lastT = performance.now();
    v = 0;

    stage.setPointerCapture?.(ev.pointerId);
  },
  { passive: true, capture: true },
);

stage.addEventListener(
  "pointermove",
  (ev) => {
    if (!dragging) return;

    const now = performance.now();
    const dxTotal = ev.clientX - dragStartX;

    if (!dragMoved && Math.abs(dxTotal) >= 6) {
      dragMoved = true;
      armSuppressClick();
    }

    const deltaIndex = dxTotal / cssCache.spacing;
    target = clamp(
      dragStartTarget - deltaIndex,
      0,
      Math.max(0, filtered.length - 1),
    );

    const dt = Math.max(1, now - lastT);
    const vx = (ev.clientX - lastX) / dt;
    v = v * 0.75 + vx * 0.25;

    lastX = ev.clientX;
    lastT = now;
  },
  { passive: true },
);

function endDrag() {
  if (!dragging) return;
  dragging = false;
  if (!filtered.length) return;

  const max = filtered.length - 1;

  const speed = Math.abs(v);
  if (speed >= FLICK_VELOCITY_MIN) {
    let fling = -v * (FLICK_GAIN * cssCache.spacing);
    fling = clamp(fling, -MAX_FLICK_ALBUMS, MAX_FLICK_ALBUMS);
    target = clamp(target + fling, 0, max);
    armSuppressClick();
  }

  target = clamp(Math.round(target), 0, max);
  prefetchNearby();
}

window.addEventListener("pointerup", endDrag, { passive: true });
window.addEventListener("pointercancel", endDrag, { passive: true });

window.addEventListener(
  "resize",
  () => {
    refreshCssCache();
    renderedCenter = -1;
    rebuildWindowIfNeeded();
    prefetchNearby();
  },
  { passive: true },
);

// Start
load();
