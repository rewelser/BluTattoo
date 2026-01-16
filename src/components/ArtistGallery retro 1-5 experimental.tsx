import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

interface ArtistImage {
  src: string;
  alt?: string;
}

interface ArtistGalleryProps {
  images?: ArtistImage[];
}

const DRAG_CLOSE_THRESHOLD = 120;
const DRAG_LOCK_THRESHOLD = 10;
const RESET_DURATION = 150;
const BACKDROP_FADE_DURATION = 200;

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const MAX_TOUCH_POINTS = 2;

// Scroll-snap carousel config (natural horizontal scroll)
const SCROLL_EPS = 20; // how close to "centered" we consider a slide
const CLONES_DEFAULT = 2; // mirrors your second example; will clamp by images.length below

const LightboxPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === "undefined") return null; // SSR guard
  return ReactDOM.createPortal(children, document.body);
};

/**
 * Cache only the pointer fields we actually need (primitives + HTMLElement ref).
 */
type CachedPointer = {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  targetEl: HTMLElement | null;
};

const toCachedPointer = (e: React.PointerEvent): CachedPointer => ({
  pointerId: e.pointerId,
  pointerType: e.pointerType,
  clientX: e.clientX,
  clientY: e.clientY,
  targetEl: e.target instanceof HTMLElement ? e.target : null,
});

const upsertCachedPointer = (cache: CachedPointer[], e: React.PointerEvent) => {
  const next = toCachedPointer(e);
  const idx = cache.findIndex((p) => p.pointerId === next.pointerId);
  if (idx === -1) cache.push(next);
  else cache[idx] = next;
};

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export const ArtistGallery: React.FC<ArtistGalleryProps> = ({ images = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // In the original file, currentIndex drove the JS swipe track.
  // In this version, currentIndex is the REAL index (0..N-1) derived from scroll position.
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  // Vertical drag-to-close still exists (natural horizontal scroll replaces swipeX).
  const [swipeY, setSwipeY] = useState(0);

  // Pan for zoomed image (same as original)
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const panXStartRef = useRef(0);
  const panYStartRef = useRef(0);

  // IMPORTANT CHANGE:
  // containerRef now points to the horizontal scroll container (snap carousel),
  // not the entire overlay.
  const containerRef = useRef<HTMLDivElement | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  // current image refs
  const imageRef = useRef<HTMLImageElement | null>(null);
  const currentImgContainerRef = useRef<HTMLDivElement | null>(null);

  const baseImgWRef = useRef<number | null>(null);
  const baseImgHRef = useRef<number | null>(null);

  const [exitScale, setExitScale] = useState(1);
  const [backdropOpacity, setBackdropOpacity] = useState(1);
  const [imageOpacity, setImageOpacity] = useState(1);
  const [zoomScale, setZoomScale] = useState(1);

  const pinchingRef = useRef(false);
  const noLongerPinchingRef = useRef(false);

  const nextPanUnclampedForClampedZoom = useRef<{ x: number; y: number } | null>(null);

  // In the original file, swipeAxisRef decided between x-swipe and y-close.
  // Here, x-swipe is handled by native horizontal scroll, but we KEEP swipeAxisRef
  // to lock in to vertical-close and to avoid fighting with scroll once the user is clearly dragging vertically.
  const swipeAxisRef = useRef<"x" | "y" | null>(null);

  // NOTE: swipeSnapBackRef used to animate JS-driven swipe snapback.
  // With natural scroll, snapback is handled by CSS scroll-snap, so this is effectively obsolete.
  // We keep it to preserve the "no transition while dragging vertically" behavior for swipeY.
  const swipeSnapBackRef = useRef(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const evCacheRef = useRef<CachedPointer[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const pinchPrevDistanceRef = useRef<number | null>(null);
  const pinchPrevCenterRef = useRef<{ x: number; y: number } | null>(null);

  const resetInFlightRef = useRef<Promise<void> | null>(null);

  // --- Scroll carousel state/metrics ----------------------------------------

  const N = images?.length ?? 0;
  const CLONES = Math.min(CLONES_DEFAULT, N);

  // Virtual slides: [last CLONES] + [real] + [first CLONES]
  const virtualImages = useMemo(() => {
    if (!images || images.length === 0) return [];
    if (CLONES === 0) return [...images];
    const head = images.slice(N - CLONES);
    const tail = images.slice(0, CLONES);
    return [...head, ...images, ...tail];
  }, [images, N, CLONES]);

  // slide width measurement (assumes slides are 100% width of the scroll container)
  const slideWidthRef = useRef(0);

  // gate normalization work so we only react once per "center lock"
  const lastCenteredVirtualRef = useRef<number | null>(null);

  // Programmatic scroll targeting for next/prev (buttons/keyboard)
  const scrollToVirtualIndex = (virtualIndex: number, behavior: ScrollBehavior) => {
    const el = containerRef.current;
    const w = slideWidthRef.current;
    if (!el || !w) return;
    el.scrollTo({ left: virtualIndex * w, behavior });
  };

  const jumpWithoutSnap = (el: HTMLDivElement, left: number) => {
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
    el.scrollTo({ left, behavior: "auto" });
    requestAnimationFrame(() => {
      el.style.scrollSnapType = prevSnap || "";
    });
  };

  const getPositionInfo = () => {
    const el = containerRef.current;
    const w = slideWidthRef.current;
    if (!el || !w || N === 0) return null;

    const firstRealVirtual = CLONES;
    const lastRealVirtual = CLONES + (N - 1);

    // Match your second version: compute based on viewport midpoint.
    const viewportMid = el.scrollLeft + el.clientWidth / 2;
    const virtualIndex = Math.round((viewportMid - w / 2) / w);

    const slideMid = virtualIndex * w + w / 2;
    const distToCenter = Math.abs(viewportMid - slideMid);
    const isCentered = distToCenter <= SCROLL_EPS;

    const inLeftClone = virtualIndex < firstRealVirtual;
    const inRightClone = virtualIndex > lastRealVirtual;

    const realIndex = mod(virtualIndex - CLONES, N);
    const targetVirtualIfNormalized = inLeftClone || inRightClone ? CLONES + realIndex : null;

    return {
      el,
      w,
      virtualIndex,
      realIndex,
      isCentered,
      inLeftClone,
      inRightClone,
      targetVirtualIfNormalized,
    };
  };

  const normalizeIfNeeded = (ctx?: ReturnType<typeof getPositionInfo>) => {
    const info = ctx ?? getPositionInfo();
    if (!info) return;
    const { el, w, targetVirtualIfNormalized } = info;
    if (targetVirtualIfNormalized == null) return;

    jumpWithoutSnap(el, targetVirtualIfNormalized * w);
  };

  const handleScroll = () => {
    const info = getPositionInfo();
    if (!info) return;

    // Only do "commit" work when centered (like your second version)
    if (info.isCentered) {
      if (lastCenteredVirtualRef.current !== info.virtualIndex) {
        lastCenteredVirtualRef.current = info.virtualIndex;

        // Commit currentIndex from scroll (REAL index)
        setCurrentIndex(info.realIndex);

        // Normalize if we landed on a clone (infinite illusion)
        if (info.inLeftClone || info.inRightClone) {
          normalizeIfNeeded(info);
        }
      }
    } else {
      // reset gate so it can trigger again once centered
      if (lastCenteredVirtualRef.current === info.virtualIndex) {
        lastCenteredVirtualRef.current = null;
      }
    }
  };

  // --- Icons ---------------------------------------------------------------

  const ZoomInIcon = () => (
    <svg viewBox="0 -960 960 960" className="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Zm-40-60v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Z" />
    </svg>
  );

  const ZoomOutIcon = () => (
    <svg viewBox="0 -960 960 960" className="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400ZM280-540v-80h200v80H280Z" />
    </svg>
  );

  // --- RAF batching (same as original) -------------------------------------

  const pendingRef = useRef({
    panX: 0,
    panY: 0,
    swipeY: 0,
    zoomScale: 1,
    exitScale: 1,
    backdropOpacity: 1,
    imageOpacity: 1,
  });

  const scheduleFlush = () => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const p = pendingRef.current;
      setPanX(p.panX);
      setPanY(p.panY);
      setSwipeY(p.swipeY);
      setExitScale(p.exitScale);
      setZoomScale(p.zoomScale);
      setBackdropOpacity(p.backdropOpacity);
      setImageOpacity(p.imageOpacity);
    });
  };

  const regulatePanAndZoom = () => {
    const nextZoomUnclamped = pendingRef.current.zoomScale;
    const nextZoomClamped = clamp(nextZoomUnclamped, MIN_ZOOM, MAX_ZOOM);
    const zoomWasClamped = nextZoomClamped !== nextZoomUnclamped;

    pendingRef.current.zoomScale = nextZoomClamped;

    const container = overlayRef.current; // NOTE: bounds should be overlay viewport
    const baseW = baseImgWRef.current;
    const baseH = baseImgHRef.current;

    let minPanX = 0,
      maxPanX = 0,
      minPanY = 0,
      maxPanY = 0;

    if (container && baseW && baseH && nextZoomClamped > 1) {
      const { width: viewportW, height: viewportH } = container.getBoundingClientRect();
      const scaledW = baseW * nextZoomClamped;
      const scaledH = baseH * nextZoomClamped;

      const extraW = Math.max(0, scaledW - viewportW);
      const extraH = Math.max(0, scaledH - viewportH);

      maxPanX = extraW / 2;
      minPanX = -maxPanX;
      maxPanY = extraH / 2;
      minPanY = -maxPanY;
    }

    let desiredPanX: number;
    let desiredPanY: number;

    if (nextZoomClamped <= 1) {
      desiredPanX = 0;
      desiredPanY = 0;
      nextPanUnclampedForClampedZoom.current = null;
    } else if (zoomWasClamped && nextPanUnclampedForClampedZoom.current) {
      desiredPanX = nextPanUnclampedForClampedZoom.current.x;
      desiredPanY = nextPanUnclampedForClampedZoom.current.y;
      nextPanUnclampedForClampedZoom.current = null;
    } else {
      desiredPanX = pendingRef.current.panX;
      desiredPanY = pendingRef.current.panY;
    }

    pendingRef.current.panX = clamp(desiredPanX, minPanX, maxPanX);
    pendingRef.current.panY = clamp(desiredPanY, minPanY, maxPanY);
    scheduleFlush();
  };

  // --- Open/close ----------------------------------------------------------

  if (!images || images.length === 0) return null;

  const openAt = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
    setIsClosing(false);

    pendingRef.current.swipeY = 0;
    pendingRef.current.exitScale = 1;
    pendingRef.current.zoomScale = 1;
    pendingRef.current.backdropOpacity = 1;
    pendingRef.current.imageOpacity = 1;

    scheduleFlush();
    document.body.style.overflow = "hidden"; // lock scroll when open
  };

  const close = () => {
    if (!isOpen || isClosing) return;

    setIsClosing(true);

    const vh =
      typeof window !== "undefined"
        ? window.innerHeight || document.documentElement.clientHeight || 0
        : 0;

    pendingRef.current.swipeY = Math.sign(pendingRef.current.swipeY) * vh;
    pendingRef.current.exitScale = 2;
    pendingRef.current.backdropOpacity = 0;
    pendingRef.current.imageOpacity = 0;
    scheduleFlush();

    window.setTimeout(() => {
      setIsOpen(false);
      setCurrentIndex(null);
      setIsClosing(false);

      pendingRef.current.swipeY = 0;
      pendingRef.current.exitScale = 1;
      pendingRef.current.zoomScale = 1;
      pendingRef.current.backdropOpacity = 1;
      pendingRef.current.imageOpacity = 1;

      scheduleFlush();
      document.body.style.overflow = ""; // restore scroll
    }, BACKDROP_FADE_DURATION);
  };

  const zoom = () => {
    if (pendingRef.current.zoomScale > 1) {
      pendingRef.current.zoomScale = MIN_ZOOM;
    } else {
      pendingRef.current.zoomScale = MAX_ZOOM;
    }
    scheduleFlush();
    regulatePanAndZoom();
  };

  const resetViewImmediate = () => {
    pendingRef.current.zoomScale = 1;
    pendingRef.current.panX = 0;
    pendingRef.current.panY = 0;
    pendingRef.current.swipeY = 0;
    nextPanUnclampedForClampedZoom.current = null;
  };

  const resetViewAnimated = () => {
    if (resetInFlightRef.current) return resetInFlightRef.current;

    const alreadyReset =
      pendingRef.current.zoomScale === 1 &&
      pendingRef.current.panX === 0 &&
      pendingRef.current.panY === 0;

    if (alreadyReset) return Promise.resolve();

    resetInFlightRef.current = new Promise<void>((resolve) => {
      const imgContainer = currentImgContainerRef.current;
      const img = imageRef.current;

      if (!imgContainer || !img) {
        resetViewImmediate();
        scheduleFlush();
        resetInFlightRef.current = null;
        resolve();
        return;
      }

      let doneCount = 0;
      const done = () => {
        doneCount++;
        if (doneCount >= 2) {
          cleanup();
          resetInFlightRef.current = null;
          resolve();
        }
      };

      const onImgContainerEnd = (e: TransitionEvent) => {
        if (e.propertyName === "transform") done();
      };
      const onImgEnd = (e: TransitionEvent) => {
        if (e.propertyName === "transform") done();
      };

      const cleanup = () => {
        imgContainer.removeEventListener("transitionend", onImgContainerEnd);
        img.removeEventListener("transitionend", onImgEnd);
        clearTimeout(timer);
      };

      const timer = window.setTimeout(() => {
        cleanup();
        resetInFlightRef.current = null;
        resolve();
      }, RESET_DURATION + 80);

      imgContainer.addEventListener("transitionend", onImgContainerEnd);
      img.addEventListener("transitionend", onImgEnd);

      resetViewImmediate();
      scheduleFlush();
    });

    return resetInFlightRef.current;
  };

  // --- Natural scroll: measure + initial positioning ------------------------

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      slideWidthRef.current = el.clientWidth || 0;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    const w = slideWidthRef.current;
    if (!el || !w) return;

    // When opening, snap to the correct REAL slide location (accounting for clones)
    const idx = currentIndex ?? 0;
    const initialVirtual = CLONES + idx;

    el.scrollTo({ left: initialVirtual * w, behavior: "auto" });

    // Ensure currentIndex is set (for caption etc.)
    setCurrentIndex(idx);

    // reset "center gate" so the next scroll settles cleanly
    lastCenteredVirtualRef.current = null;
  }, [isOpen, currentIndex, CLONES]);

  // --- Trackpad pinch zoom (wheel + ctrlKey) --------------------------------
  // Same behavior as original, except we reference overlayRef for viewport center bounds.
  useEffect(() => {
    if (!isOpen || isClosing) return;

    const el = overlayRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();

        const img = imageRef.current;
        if (!img) return;

        const centerX = e.clientX;
        const centerY = e.clientY;

        const imgRect = img.getBoundingClientRect();
        const originX = imgRect.left + imgRect.width / 2;
        const originY = imgRect.top + imgRect.height / 2;

        const sensitivity = 0.015;
        const factor = Math.exp(-e.deltaY * sensitivity);

        const baseZoom = pendingRef.current.zoomScale;
        const nextZoomUnclamped = baseZoom * factor;
        const nextZoom = clamp(nextZoomUnclamped, MIN_ZOOM, MAX_ZOOM);

        const anchorX = (centerX - originX) / baseZoom;
        const anchorY = (centerY - originY) / baseZoom;

        const originNextX = centerX - nextZoom * anchorX;
        const originNextY = centerY - nextZoom * anchorY;

        const originDeltaX = originNextX - originX;
        const originDeltaY = originNextY - originY;

        pendingRef.current.zoomScale = nextZoom;
        pendingRef.current.panX += originDeltaX;
        pendingRef.current.panY += originDeltaY;

        scheduleFlush();
        regulatePanAndZoom();
        return;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as any);
  }, [isOpen, isClosing]);

  // --- Pointer logic ---------------------------------------------------------
  // Key change:
  // - Horizontal swipe is now native scroll, so we DO NOT set swipeX transforms.
  // - We preserve:
  //   * pinch-to-zoom
  //   * pan when zoomed in
  //   * vertical drag-to-close when not zoomed
  //
  // We also avoid calling preventDefault on pointerdown unless needed,
  // so horizontal scrolling remains "natural".

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isClosing) return;

    const evCache = evCacheRef.current;
    evCache.push(toCachedPointer(e));

    const isPinching =
      evCache.length === 2 && evCache.every((ev) => ev.pointerType === "touch");

    if (evCache.length > MAX_TOUCH_POINTS) {
      evCache.length = 0;
      pinchingRef.current = false;
      swipeAxisRef.current = null;
      noLongerPinchingRef.current = false;
      return;
    }

    // Capture pointer so moves outside still report
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    noLongerPinchingRef.current = false;
    swipeAxisRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;

    // If zoomed, we will pan -> we should prevent default-ish behavior early.
    // (But note: React pointer events aren't "passive"; still, we avoid blanket preventDefault
    // so native horizontal scroll remains fluid when NOT zoomed.)
    if (pendingRef.current.zoomScale > 1) {
      e.preventDefault();
      panXStartRef.current = pendingRef.current.panX;
      panYStartRef.current = pendingRef.current.panY;
    }

    if (isPinching) {
      // pinch needs default suppression to avoid browser page-zoom / scroll interference
      e.preventDefault();
      pinchingRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isClosing || evCacheRef.current.length === 0) return;

    const evCache = evCacheRef.current;
    upsertCachedPointer(evCache, e);

    const isPinching = pinchingRef.current;
    const isZoomedIn = pendingRef.current.zoomScale > 1;

    if (noLongerPinchingRef.current) {
      return;
    }

    if (!isPinching && isZoomedIn) {
      // Panning a zoomed image (same as original)
      e.preventDefault();

      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;

      pendingRef.current.panX = panXStartRef.current + deltaX;
      pendingRef.current.panY = panYStartRef.current + deltaY;

      scheduleFlush();
      return;
    }

    if (!isPinching && !isZoomedIn) {
      // NATURAL SCROLL REPLACES horizontal swipe.
      // We only intervene if the user is clearly dragging vertically for close.
      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (swipeAxisRef.current === null) {
        const maxDelta = Math.max(absX, absY);
        if (maxDelta < DRAG_LOCK_THRESHOLD) return;

        swipeAxisRef.current = absX > absY ? "x" : "y";
      }

      if (swipeAxisRef.current === "y") {
        // Vertical drag-to-close (same spirit as original)
        e.preventDefault();
        pendingRef.current.swipeY = deltaY;
        scheduleFlush();
      } else {
        // "x": do nothing; allow native horizontal scroll.
        // (This block is intentionally empty.)
      }

      return;
    }

    if (isPinching) {
      e.preventDefault();

      const [p1, p2] = evCache;
      if (!p1 || !p2) return;

      const t1 = p1.targetEl;
      const t2 = p2.targetEl;
      const bothOnZoomable = !!t1?.closest("[data-zoomable='true']") && !!t2?.closest("[data-zoomable='true']");
      if (!bothOnZoomable) return;

      const container = overlayRef.current;
      if (!container) return;

      const curCenter = {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2,
      };

      const curDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);

      const containerRect = container.getBoundingClientRect();
      const viewportCenter = {
        x: containerRect.left + containerRect.width / 2,
        y: containerRect.top + containerRect.height / 2,
      };

      if (pinchPrevDistanceRef.current == null || pinchPrevCenterRef.current == null) {
        pinchPrevDistanceRef.current = curDist;
        pinchPrevCenterRef.current = curCenter;
        return;
      }

      const prevDist = pinchPrevDistanceRef.current;
      const prevCenter = pinchPrevCenterRef.current;
      const prevPan = { x: pendingRef.current.panX, y: pendingRef.current.panY };
      const prevZoom = pendingRef.current.zoomScale;

      if (!prevDist || !prevCenter) return;

      const zoomStepFactor = curDist / prevDist;
      const nextZoomUnclamped = prevZoom * zoomStepFactor;

      const prevCenterX_i = (prevCenter.x - viewportCenter.x - prevPan.x) / prevZoom;
      const prevCenterY_i = (prevCenter.y - viewportCenter.y - prevPan.y) / prevZoom;

      const nextPanXUnclamped =
        curCenter.x - viewportCenter.x - nextZoomUnclamped * prevCenterX_i;

      const nextPanYUnclamped =
        curCenter.y - viewportCenter.y - nextZoomUnclamped * prevCenterY_i;

      if (nextPanUnclampedForClampedZoom.current === null && nextZoomUnclamped > MAX_ZOOM) {
        const nextPanXForClampedZoom = curCenter.x - viewportCenter.x - MAX_ZOOM * prevCenterX_i;
        const nextPanYForClampedZoom = curCenter.y - viewportCenter.y - MAX_ZOOM * prevCenterY_i;

        nextPanUnclampedForClampedZoom.current = { x: nextPanXForClampedZoom, y: nextPanYForClampedZoom };
      }

      pendingRef.current.zoomScale = nextZoomUnclamped;
      pendingRef.current.panX = nextPanXUnclamped;
      pendingRef.current.panY = nextPanYUnclamped;

      pinchPrevDistanceRef.current = curDist;
      pinchPrevCenterRef.current = { x: curCenter.x, y: curCenter.y };

      scheduleFlush();
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isClosing || evCacheRef.current.length === 0) return;

    const evCache = evCacheRef.current;
    const wasPinching = evCache.length === 2 && evCache.every((ev) => ev.pointerType === "touch");

    // Remove pointer from cache
    const idx = evCache.findIndex((p) => p.pointerId === e.pointerId);
    if (idx > -1) evCache.splice(idx, 1);

    const isPinching = evCache.length === 2 && evCache.every((ev) => ev.pointerType === "touch");
    const isNoLongerPinching = wasPinching && !isPinching;
    const isZoomedIn = pendingRef.current.zoomScale > 1;

    if (isNoLongerPinching) {
      noLongerPinchingRef.current = true;
    } else if (isPinching) {
      noLongerPinchingRef.current = false;
    } else if (!isPinching && !wasPinching) {
      noLongerPinchingRef.current = false;

      // If we weren't zoomed, we may have been vertical-dragging to close.
      if (!isZoomedIn) {
        const axis = swipeAxisRef.current;
        const deltaY = axis === "x" ? 0 : e.clientY - startYRef.current;

        const absY = Math.abs(deltaY);

        if (axis === "y" && absY > DRAG_CLOSE_THRESHOLD) {
          close();
        } else {
          // release -> snap back vertically (fade/transform reset)
          pendingRef.current.swipeY = 0;
          swipeSnapBackRef.current = true;
          scheduleFlush();
          window.setTimeout(() => {
            swipeSnapBackRef.current = false;
          }, BACKDROP_FADE_DURATION);
        }
      }
    }

    // When gesture ends completely
    if (evCache.length === 0) {
      regulatePanAndZoom();
      swipeAxisRef.current = null;
      pinchingRef.current = false;
      noLongerPinchingRef.current = false;
    }

    pinchPrevDistanceRef.current = null;
    pinchPrevCenterRef.current = null;
  };

  // --- Buttons / keyboard navigation ----------------------------------------

  const requestScrollTo = async (dir: "prev" | "next") => {
    if (isClosing || !isOpen || N <= 1) return;

    // Cancel any vertical drag influence
    pendingRef.current.swipeY = 0;
    scheduleFlush();

    // Phase 1: reset pan/zoom (keeps parity with your old behavior)
    await resetViewAnimated();

    // Phase 2: smooth scroll one slide
    const info = getPositionInfo();
    if (!info) return;

    const nextVirtual = dir === "prev" ? info.virtualIndex - 1 : info.virtualIndex + 1;
    scrollToVirtualIndex(nextVirtual, "smooth");
  };

  useEffect(() => {
    if (!isOpen || isClosing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") requestScrollTo("prev");
      if (e.key === "ArrowRight") requestScrollTo("next");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isClosing, N]);

  // --- Derived for rendering ------------------------------------------------

  const realIndex = currentIndex ?? 0;
  const currentImage = images[realIndex];

  const isZoomedIn = pendingRef.current.zoomScale > 1;
  const isPinching = pinchingRef.current;
  const isPointerDown = evCacheRef.current.length > 0;

  // Same as original: when zoomed/pinching, translate by pan; otherwise, translate by vertical swipe for close.
  let imgTx = 0;
  let imgTy = 0;
  if (isZoomedIn || isPinching) {
    imgTx = panX;
    imgTy = panY;
  } else {
    imgTx = 0;
    imgTy = swipeY;
  }

  return (
    <>
      {/* Thumbnail grid stays as-is */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, idx) => (
          <button
            disabled={isClosing}
            key={img.src + idx}
            type="button"
            className="group relative overflow-hidden rounded-xl border border-black/5 bg-black/5 hover:bg-black/10 transition"
            onClick={() => openAt(idx)}
          >
            <img
              src={img.src}
              alt={img.alt ?? ""}
              className="aspect-square w-full object-cover group-hover:scale-105 transition-transform"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity" />
          </button>
        ))}
      </div>

      {isOpen && currentImage && (
        <LightboxPortal>
          <div
            ref={overlayRef}
            className="fixed inset-0 z-[999] flex flex-col items-stretch justify-between overflow-hidden select-none backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
            style={{
              pointerEvents: isClosing ? "none" : "auto",
              backgroundColor: `rgba(0,0,0,${0.8 * backdropOpacity})`,
              transition: `background-color ${BACKDROP_FADE_DURATION}ms ease-out`,
              // IMPORTANT: do NOT use "touch-none" on the overlay now,
              // because we want native horizontal scrolling inside the carousel.
              // We only suppress default behavior when zooming/pinching/vertical close.
              touchAction: "manipulation",
            }}
          >
            {/* Zoom & Close buttons container */}
            <div className="flex flex-row z-10">
              {/* Zoom */}
              <div className="p-2 m-1 flex justify-end bg-black/40 backdrop-blur-sm">
                <button
                  disabled={isClosing}
                  type="button"
                  onClick={zoom}
                  className="p-1 text-sm uppercase tracking-wide cursor-pointer"
                  style={{
                    opacity: imageOpacity,
                    transition: isPointerDown ? "none" : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                  }}
                >
                  {isZoomedIn ? <ZoomOutIcon /> : <ZoomInIcon />}
                </button>
              </div>

              {/* Close */}
              <div className="p-2 m-1 flex justify-end bg-black/40 backdrop-blur-sm">
                <button
                  disabled={isClosing}
                  type="button"
                  onClick={close}
                  className="p-1 text-sm uppercase tracking-wide cursor-pointer"
                  style={{
                    opacity: imageOpacity,
                    transition: isPointerDown ? "none" : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                  }}
                >
                  <svg viewBox="0 -960 960 960" className="h-6 w-6 fill-current">
                    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Arrows (now scroll one slide instead of JS swipeDirection track) */}
            {N > 1 && (
              <>
                <button
                  disabled={isClosing}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestScrollTo("prev");
                  }}
                  className="absolute left-3 top-1/2 px-2 py-2 flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-black/60 cursor-pointer z-10"
                  style={{
                    opacity: imageOpacity,
                    transition: isPointerDown ? "none" : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                  }}
                  aria-label="Previous image"
                >
                  <svg viewBox="0 -960 960 960" className="h-6 w-6 fill-current">
                    <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                  </svg>
                </button>

                <button
                  disabled={isClosing}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestScrollTo("next");
                  }}
                  className="absolute right-3 top-1/2 px-2 py-2 flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-black/60 cursor-pointer z-10"
                  style={{
                    opacity: imageOpacity,
                    transition: isPointerDown ? "none" : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                  }}
                  aria-label="Next image"
                >
                  <svg viewBox="0 -960 960 960" className="h-6 w-6 fill-current">
                    <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" />
                  </svg>
                </button>
              </>
            )}

            {/* NATURAL SCROLL CAROUSEL (replaces JS-driven translateX swipe track) */}
            <div id="carousel-container" className="grow-2 relative flex w-screen">
              <div
                ref={containerRef}
                id="image-carousel-scroll"
                className="flex overflow-x-auto overflow-y-hidden w-screen snap-x snap-mandatory scroll-smooth"
                onScroll={handleScroll}
                // Pointer handlers live here so we can:
                // - pinch/pan on the current image (zoom)
                // - vertical drag to close (when not zoomed)
                // while leaving horizontal scroll natural.
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  // Allow natural horizontal panning. Vertical is blocked by overflow-y-hidden.
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {virtualImages.map((img, virtualIndex) => {
                  const real = mod(virtualIndex - CLONES, N);
                  const isCurrentReal = real === realIndex;

                  return (
                    <div
                      key={`${virtualIndex}-${img.src}`}
                      className="min-w-full flex-[0_0_100%] flex items-center justify-center snap-center snap-always"
                    >
                      {isCurrentReal ? (
                        // Current slide (gets pan/zoom and vertical close translation)
                        <div
                          ref={currentImgContainerRef}
                          id="current-image-container"
                          className="flex items-center justify-center w-full"
                          style={{
                            transform: `translate(${imgTx}px, ${imgTy}px)`,
                            transition:
                              isPointerDown
                                ? "none"
                                : swipeAxisRef.current === "y" && swipeSnapBackRef.current
                                  ? `transform ${RESET_DURATION}ms ease-out`
                                  : `transform ${RESET_DURATION}ms ease-out`,
                          }}
                        >
                          <img
                            id="current-image"
                            ref={imageRef}
                            src={images[real].src}
                            alt={images[real].alt ?? ""}
                            data-zoomable="true"
                            className={`max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20
                              ${pendingRef.current.zoomScale > 1 ? "cursor-move" : "cursor-grab active:cursor-grabbing"}`}
                            style={{
                              transformOrigin: "50% 50%",
                              transform: `scale(${exitScale * zoomScale})`,
                              opacity: imageOpacity,
                              transition: isPointerDown
                                ? "none"
                                : `transform ${RESET_DURATION}ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                            }}
                            onLoad={() => {
                              const imgEl = imageRef.current;
                              if (!imgEl) return;

                              const r = imgEl.getBoundingClientRect();
                              const effectiveScale = (exitScale * zoomScale) || 1;

                              baseImgWRef.current = r.width / effectiveScale;
                              baseImgHRef.current = r.height / effectiveScale;
                            }}
                          />
                        </div>
                      ) : (
                        // Neighbor/other slides: no pan/zoom, no pointer handlers needed.
                        // We keep a subtle vertical translate during swipeY (close gesture) to match old feel.
                        <img
                          src={images[real].src}
                          alt={images[real].alt ?? ""}
                          className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                          style={{
                            transform: `translateY(${swipeY}px)`,
                            opacity: imageOpacity,
                            transition: isPointerDown
                              ? "none"
                              : `transform ${RESET_DURATION}ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                          }}
                          draggable={false}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Caption + index */}
            <div
              className="mt-3 px-4 py-4 flex items-stretch justify-between text-xs z-10 bg-black/40 backdrop-blur-sm"
              style={{
                opacity: imageOpacity,
                transition: isPointerDown ? "none" : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
              }}
            >
              <div className="truncate pr-4">{currentImage.alt ?? "\u00A0"}</div>
              <div>
                {realIndex + 1} / {N}
              </div>
            </div>
          </div>
        </LightboxPortal>
      )}
    </>
  );
};

/**
 * Notes on what's now obsolete (kept conceptually from your original file):
 *
 * - swipeX state, swipeDirection state, and the translateX-based JS carousel track:
 *   replaced by a natural horizontal scroll container with CSS scroll-snap.
 *
 * - handleTrackTransitionEndOrCancel + swipeCommitGuardRef:
 *   no longer needed because "commit" happens when scroll settles/centers (handleScroll).
 *
 * - SWIPE_IMAGE_CHANGE_THRESHOLD:
 *   obsolete for horizontal; horizontal movement is just scroll.
 *
 * What is preserved/adapted:
 * - Pinch-to-zoom, trackpad pinch (ctrl+wheel), zoom toggle button
 * - Pan when zoomed in
 * - Vertical drag-to-close (now coexists with natural horizontal scroll by only intercepting when axis locks to 'y')
 * - Arrow buttons + keyboard arrows:
 *   now scroll one snap step (still resets pan/zoom first like your old requestSwipe flow)
 */
