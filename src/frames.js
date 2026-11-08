// ==============================================================================
// 3D CINEMATIC VIDEO FRAMES MANAGER (HIGH PERFORMANCE WEBP BITMAP ENGINE)
// Capped at 1920x1080 max (ignoring DPR > 1), scaled with CSS object-fit cover.
// alpha: false 2D context. Zero neighbour-frame blending (draws exactly one frame).
// Draws ONLY when rounded integer frame index changes. Pauses when tab is hidden.
// Preloads as ImageBitmap in a sliding window (20 frames buffer), drops outside (close()).
// Desktop uses 95 frames (every 2nd of original); mobile uses every 4th of original.
// Query string ?perf=1 activates lightweight top-left FPS and draw-time monitor.
// Strict Rule: No hash symbols anywhere in this codebase.
// Plain comment above every function.
// ==============================================================================

const TOTAL_FRAMES = 95;
const bitmapCache = new Map();
const pendingLoads = new Set();

let lastDrawnFrame = -1;
let isTabHidden = false;
let isVideoLoopActive = true;
let isPerfActive = false;
let perfOverlay = null;

// Performance metrics for ?perf=1
let perfFrameCount = 0;
let perfLastTime = performance.now();
let perfDrawTimes = [];

/**
 * Checks if device is mobile viewport.
 */
export function isMobileDevice() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

/**
 * Returns the clean file path for any 1-based frame index.
 */
export function getFramePath(index) {
  const paddedIndex = String(index).padStart(3, '0');
  return `/frames-web/frame_${paddedIndex}.webp`;
}

/**
 * Returns total available frames for desktop.
 */
export function getTotalFrames() {
  return TOTAL_FRAMES;
}

/**
 * Fetches and decodes a single frame as ImageBitmap.
 */
async function loadBitmapForIndex(slotIndex) {
  if (slotIndex < 0 || slotIndex >= TOTAL_FRAMES) return null;
  if (bitmapCache.has(slotIndex)) return bitmapCache.get(slotIndex);
  if (pendingLoads.has(slotIndex)) return null;

  pendingLoads.add(slotIndex);

  try {
    const url = getFramePath(slotIndex + 1);
    const response = await fetch(url);
    if (!response.ok) {
      pendingLoads.delete(slotIndex);
      return null;
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    bitmapCache.set(slotIndex, bitmap);
    pendingLoads.delete(slotIndex);
    return bitmap;
  } catch (err) {
    pendingLoads.delete(slotIndex);
    return null;
  }
}

/**
 * Preloads remaining frames in background batches during idle time without dropping decoded frames.
 */
function preloadRemainingFramesBatch(startIndex) {
  if (startIndex >= TOTAL_FRAMES) return;
  const batchSize = 16;
  const endIndex = Math.min(TOTAL_FRAMES, startIndex + batchSize);
  const promises = [];
  for (let i = startIndex; i < endIndex; i++) {
    promises.push(loadBitmapForIndex(i));
  }
  Promise.all(promises).then(() => {
    if (endIndex < TOTAL_FRAMES) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => preloadRemainingFramesBatch(endIndex));
      } else {
        setTimeout(() => preloadRemainingFramesBatch(endIndex), 40);
      }
    }
  });
}

/**
 * Ensures frames around current index are prioritized and decoded.
 * Keeps all 95 frames cached in memory to prevent blank render gaps.
 */
export function updateSlidingWindow(centerIndex) {
  const step = isMobileDevice() ? 2 : 1;
  const bufferAhead = 20;
  const bufferBehind = 20;

  const minKeep = Math.max(0, centerIndex - bufferBehind);
  const maxKeep = Math.min(TOTAL_FRAMES - 1, centerIndex + bufferAhead);

  // Request frames within window
  for (let i = minKeep; i <= maxKeep; i += step) {
    if (!bitmapCache.has(i) && !pendingLoads.has(i)) {
      loadBitmapForIndex(i);
    }
  }
}

/**
 * Preloads the first 12 frames immediately, then decodes remaining frames in idle batches.
 */
export function startSilentPreload(onFirstFrameReady) {
  // Check ?perf=1 flag
  if (typeof window !== 'undefined' && window.location.search.includes('perf=1')) {
    initPerfMonitor();
  }

  // Handle tab visibility changes to pause draw loops when tab is hidden
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      isTabHidden = document.hidden;
    });
  }

  // Load first frame immediately
  loadBitmapForIndex(0).then((firstBmp) => {
    if (firstBmp && onFirstFrameReady) {
      onFirstFrameReady(firstBmp);
    }

    // Load next 11 frames immediately
    const firstTwelve = [];
    for (let i = 1; i < Math.min(12, TOTAL_FRAMES); i++) {
      firstTwelve.push(loadBitmapForIndex(i));
    }

    Promise.all(firstTwelve).then(() => {
      // Decode all remaining frames in batches
      preloadRemainingFramesBatch(12);
    });
  });
}

/**
 * Checks whether the video loop is currently active.
 */
export function isVideoFrameLoopActive() {
  return isVideoLoopActive;
}

/**
 * Releases all decoded ImageBitmaps from GPU and RAM memory to free resources.
 */
export function releaseVideoBitmaps() {
  for (const bitmap of bitmapCache.values()) {
    if (bitmap && typeof bitmap.close === 'function') {
      try {
        bitmap.close();
      } catch (err) {}
    }
  }
  bitmapCache.clear();
  pendingLoads.clear();
  lastDrawnFrame = -1;
}

/**
 * Hides the video canvas wrapper, releases all ImageBitmaps, and stops the draw loop.
 */
export function hideFrameCanvas() {
  isVideoLoopActive = false;
  const wrapper = document.querySelector('.cinematic-canvas-wrapper');
  if (wrapper) {
    wrapper.style.display = 'none';
  }
  releaseVideoBitmaps();
}

/**
 * Shows the video canvas wrapper and rebuilds the sliding ImageBitmap cache.
 */
export function showFrameCanvas() {
  isVideoLoopActive = true;
  const wrapper = document.querySelector('.cinematic-canvas-wrapper');
  if (wrapper) {
    wrapper.style.display = 'block';
  }
  startSilentPreload();
}

/**
 * Draws exactly one frame onto the canvas.
 * Draws ONLY when the rounded integer frame changes.
 * Avoids any neighbour-frame blending.
 */
export function renderSmoothFrame(canvas, context, floatIndex) {
  if (!canvas || !context || isTabHidden || !isVideoLoopActive) return;

  const maxIndex = TOTAL_FRAMES - 1;
  const safeFloat = Math.max(0, Math.min(maxIndex, floatIndex));
  let intIndex = Math.round(safeFloat);

  // If mobile, snap to nearest even frame (sampling every 4th of original)
  if (isMobileDevice()) {
    intIndex = Math.round(intIndex / 2) * 2;
    intIndex = Math.max(0, Math.min(maxIndex, intIndex));
  }

  // Return early if frame has not changed
  if (intIndex === lastDrawnFrame) {
    return;
  }

  // Trigger sliding window preloading around the current index
  updateSlidingWindow(intIndex);

  // Find exact bitmap or closest loaded fallback
  let bitmap = bitmapCache.get(intIndex);
  if (!bitmap) {
    // Search outwards for closest loaded bitmap
    for (let offset = 1; offset < 20; offset++) {
      if (bitmapCache.has(intIndex - offset)) {
        bitmap = bitmapCache.get(intIndex - offset);
        break;
      }
      if (bitmapCache.has(intIndex + offset)) {
        bitmap = bitmapCache.get(intIndex + offset);
        break;
      }
    }
  }

  if (!bitmap) {
    return;
  }

  const tStart = performance.now();

  const cWidth = canvas.width;
  const cHeight = canvas.height;
  const bWidth = bitmap.width;
  const bHeight = bitmap.height;

  // Cover calculation inside internal canvas buffer
  const ratio = Math.max(cWidth / bWidth, cHeight / bHeight);
  const rWidth = Math.ceil(bWidth * ratio);
  const rHeight = Math.ceil(bHeight * ratio);
  const offsetX = Math.floor((cWidth - rWidth) / 2);
  const offsetY = Math.floor((cHeight - rHeight) / 2);

  // Draw single frame with alpha false context
  context.drawImage(bitmap, offsetX, offsetY, rWidth, rHeight);
  lastDrawnFrame = intIndex;

  const tDraw = performance.now() - tStart;
  if (isPerfActive) {
    perfDrawTimes.push(tDraw);
    if (perfDrawTimes.length > 60) perfDrawTimes.shift();
  }
}

/**
 * Resizes the full-screen canvas capping internal buffer at 1920x1080 (ignoring DPR > 1).
 * CSS object-fit: cover handles display presentation.
 */
export function resizeFullScreenCanvas(canvas, context, currentFloatIndex = 0) {
  if (!canvas || !context) return;

  // Cap internal resolution to 1920x1080 max to protect GPU memory on Retina displays
  const maxInternalWidth = 1920;
  const maxInternalHeight = 1080;

  const clientWidth = window.innerWidth;
  const clientHeight = window.innerHeight;

  const cappedWidth = Math.min(maxInternalWidth, clientWidth);
  const cappedHeight = Math.min(maxInternalHeight, clientHeight);

  if (canvas.width !== cappedWidth || canvas.height !== cappedHeight) {
    canvas.width = cappedWidth;
    canvas.height = cappedHeight;
  }

  canvas.style.width = '100vw';
  canvas.style.height = '100dvh';
  canvas.style.objectFit = 'cover';

  lastDrawnFrame = -1;
  renderSmoothFrame(canvas, context, currentFloatIndex);
}

/**
 * Initializes the lightweight ?perf=1 monitor.
 */
function initPerfMonitor() {
  if (perfOverlay || typeof document === 'undefined') return;
  isPerfActive = true;

  perfOverlay = document.createElement('div');
  perfOverlay.className = 'perf-monitor-box';
  perfOverlay.style.position = 'fixed';
  perfOverlay.style.top = '10px';
  perfOverlay.style.left = '10px';
  perfOverlay.style.zIndex = '999999';
  perfOverlay.style.padding = '6px 10px';
  perfOverlay.style.backgroundColor = 'rgb(11, 11, 15)';
  perfOverlay.style.color = 'rgb(168, 230, 46)';
  perfOverlay.style.border = '1px solid rgb(168, 230, 46)';
  perfOverlay.style.fontFamily = 'monospace';
  perfOverlay.style.fontSize = '11px';
  perfOverlay.style.pointerEvents = 'none';
  perfOverlay.style.display = 'flex';
  perfOverlay.style.flexDirection = 'column';
  perfOverlay.style.gap = '2px';

  document.body.appendChild(perfOverlay);

  function updatePerfTick() {
    perfFrameCount++;
    const now = performance.now();
    const elapsed = now - perfLastTime;

    if (elapsed >= 500) {
      const fps = Math.round((perfFrameCount * 1000) / elapsed);
      const avgDraw = perfDrawTimes.length > 0
        ? (perfDrawTimes.reduce((a, b) => a + b, 0) / perfDrawTimes.length).toFixed(2)
        : '0.00';

      perfOverlay.innerHTML = `<span>FPS: ${fps}</span><span>DRAW: ${avgDraw}ms</span><span>BITMAPS: ${bitmapCache.size}</span>`;
      console.log(`[PERF] FPS: ${fps} | Avg Draw: ${avgDraw}ms | Decoded Bitmaps: ${bitmapCache.size}`);

      perfFrameCount = 0;
      perfLastTime = now;
    }

    requestAnimationFrame(updatePerfTick);
  }

  requestAnimationFrame(updatePerfTick);
}
