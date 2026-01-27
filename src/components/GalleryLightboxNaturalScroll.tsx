import React, { useMemo, useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { LoadingSpinner } from "./graphics/LoadingSpinner";
import { ErrorSpinner } from "./graphics/ErrorSpinner";


interface ArtistImage {
  src: string;
  thumbSrc?: string;
  alt?: string;
}

interface GalleryLightboxProps {
  images: ArtistImage[];
  isOpen: boolean;
  startIndex: number;
  onClose: () => void;
}

// DOUBLE_TAP_MS & DOUBLE_TAP_SLOP_PX used for manual double-tap detection
const DOUBLE_TAP_MS = 250;
const DOUBLE_TAP_SLOP_PX = 24;

const DRAG_CLOSE_THRESHOLD = 120;
const DRAG_LOCK_THRESHOLD = 10;
const RESET_DURATION = 200; // todo 1.16.26: conflate with Backdrop fade duration?
const BACKDROP_FADE_DURATION = 200;
const SWIPE_IMAGE_CHANGE_THRESHOLD = 100; // 80 too small for desktop, 200 too big for mobile

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const MAX_TOUCH_POINTS = 2;

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

export const GalleryLightboxNaturalScroll: React.FC<GalleryLightboxProps> = ({
  images,
  isOpen,
  startIndex,
  onClose,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(startIndex);
  // const prevIndex = currentIndex !== null ? (currentIndex - 1 + images.length) % images.length : null;
  // const nextIndex = currentIndex !== null ? (currentIndex + 1) % images.length : null;

  const currentIndexRef = useRef<number | null>(null);

  // No swipeX in desktop, as scrolleft is used in lieu translate
  const [swipeY, setSwipeY] = useState(0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const panXStartRef = useRef(0);
  const panYStartRef = useRef(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const carouselContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const baseSizeByIndexRef = useRef<Record<number, { w: number; h: number }>>({});

  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [errored, setErrored] = useState<Record<number, boolean>>({});

  const [exitScale, setExitScale] = useState(1);
  const [backdropOpacity, setBackdropOpacity] = useState(1);
  const [imageOpacity, setImageOpacity] = useState(1);
  const [zoomScale, setZoomScale] = useState(1);
  const [isZoomTransitioning, setIsZoomTransitioning] = useState(false);

  const nextPanUnclampedForClampedZoom = useRef<{ x: number; y: number } | null>(null);

  const swipeAxisRef = useRef<"x" | "y" | null>(null);
  const [swipeAxis, setSwipeAxis] = useState<"x" | "y" | null>(null);
  const swipeDirectionRef = useRef<string | null>(null);
  const scrollLeftStartRef = useRef(0);
  const [snapDisabled, setSnapDisabled] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingRef = useRef(false);
  const programmaticScrollingRef = useRef(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const evCacheRef = useRef<CachedPointer[]>([]);
  const rafIdRef = useRef<number | null>(null);
  // todo: testing vvv

  const wheelZoomingEndTimerRef = useRef<number | null>(null);
  const isWheelZoomingRef = useRef(false);
  // todo: testing ^^^

  const setAxis = (axis: "x" | "y" | null) => {
    swipeAxisRef.current = axis;
    setSwipeAxis(axis);
  };

  const lastTapRef = useRef<{
    time: number;
    x: number;
    y: number;
  } | null>(null);

  // what to render next frame
  const pendingRef = useRef({
    panX: 0,
    panY: 0,
    swipeX: 0,
    swipeY: 0,
    zoomScale: 1,
    exitScale: 1,
    backdropOpacity: 1,
    imageOpacity: 1,
  });

  // todo: figure out why we need this when startIndex is set (not going to be some crazy number???)
  const safeStartIndex = useMemo(() => {
    const max = Math.max(0, images.length - 1);
    const n = Number.isFinite(startIndex) ? startIndex : 0;
    return Math.min(Math.max(0, n), max);
  }, [startIndex, images.length]);

  // When opened (or startIndex changes), scroll to the requested slide
  useEffect(() => {
    if (!isOpen) return;
    const container = carouselContainerRef.current;
    if (!container) return;

    const doScroll = () => {
      const el = container.querySelector<HTMLElement>(`[data-index="${safeStartIndex}"]`);
      if (!el) return false;
      if (container.clientWidth === 0) return false;
      el.scrollIntoView({ behavior: "auto" as ScrollBehavior, inline: "center", block: "nearest" });

      // If using scrollTo instead:
      // const left = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
      // container.scrollTo({ left, behavior: "auto" });

      return true;
    };

    // Try immediately (works on later opens)
    if (doScroll()) return;

    // Scroll once when ready
    const ro = new ResizeObserver(() => {
      if (doScroll()) ro.disconnect();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [isOpen, safeStartIndex]);


  // set current index (todo: figure out how this works)
  useEffect(() => {
    if (!isOpen) return;
    const container = carouselContainerRef.current;
    if (!container) return;

    let raf: number | null = null;

    const computeIndexFromScroll = () => {
      raf = null;

      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;

      const slides = container.querySelectorAll<HTMLElement>("[data-index]");
      if (!slides.length) return;

      let bestIndex = 0;
      let bestDist = Number.POSITIVE_INFINITY;

      slides.forEach((el) => {
        const r = el.getBoundingClientRect();
        const elCenter = r.left + r.width / 2;
        const d = Math.abs(elCenter - centerX);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = Number(el.dataset.index ?? 0);
        }
      });
      setCurrentIndex((prev) => (prev === bestIndex ? prev : bestIndex));
    };

    const onScroll = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(computeIndexFromScroll);
    };

    container.addEventListener("scroll", onScroll, { passive: true });

    // compute once on mount/open (after scrollIntoView runs)
    onScroll();

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [isOpen, images.length]);

  const PRELOAD_RADIUS = 1;

  const shouldLoad = (i: number, current: number, total: number) => {
    const dist = Math.min(
      Math.abs(i - current),
      total - Math.abs(i - current)
    );
    return dist <= PRELOAD_RADIUS;
  };

  // lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // reset internal animation state when opening
  useEffect(() => {
    if (!isOpen) return;
    setIsClosing(false);
    const carousel = carouselContainerRef.current;
    if (!carousel) return;
    pendingRef.current.swipeY = 0;
    pendingRef.current.exitScale = 1;
    pendingRef.current.zoomScale = 1;
    pendingRef.current.backdropOpacity = 1;
    pendingRef.current.imageOpacity = 1;
    pendingRef.current.panX = 0;
    pendingRef.current.panY = 0;
    scheduleFlush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const scheduleFlush = () => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      const carousel = carouselContainerRef.current;
      if (!carousel) return;
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

  useEffect(() => {
    if (!isOpen) return;
    if (isZoomTransitioning) return;
    if (pendingRef.current.zoomScale !== 1) return;

    const img = imageRef.current;
    if (!img) return;

    const r = img.getBoundingClientRect();
    baseSizeByIndexRef.current[currentIndex] = { w: r.width, h: r.height };
  }, [isOpen, currentIndex, isZoomTransitioning]);

  const regulatePanAndZoom = (e?: WheelEvent) => {
    const nextZoomUnclamped = pendingRef.current.zoomScale;
    const nextZoomClamped = clamp(nextZoomUnclamped, MIN_ZOOM, MAX_ZOOM);
    const zoomWasClamped = nextZoomClamped != nextZoomUnclamped;

    pendingRef.current.zoomScale = nextZoomClamped;

    const container = containerRef.current;
    if (!container) return;

    const base = baseSizeByIndexRef.current[currentIndex];
    const baseW = base?.w ?? null;
    const baseH = base?.h ?? null;

    let minPanX = 0, maxPanX = 0, minPanY = 0, maxPanY = 0;

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

      // todo: interesting, but ultimately not useful; keeping for a posterity commit
      // const panRoomX = Math.abs(scaledW - viewportW) / 2;
      // const panRoomY = Math.abs(scaledH - viewportH) / 2;
      // maxPanX = panRoomX;
      // minPanX = -panRoomX;
      // maxPanY = panRoomY;
      // minPanY = -panRoomY;
    }

    let desiredPanX: number;
    let desiredPanY: number;

    if (nextZoomClamped <= 1) {
      // zoomed all the way out => reset
      desiredPanX = 0;
      desiredPanY = 0;

      // also clear any pending snapback target
      nextPanUnclampedForClampedZoom.current = null;
    } else if (zoomWasClamped && nextPanUnclampedForClampedZoom.current) {
      // snapback case (your special stored pan for clamped zoom)
      desiredPanX = nextPanUnclampedForClampedZoom.current.x;
      desiredPanY = nextPanUnclampedForClampedZoom.current.y;
      nextPanUnclampedForClampedZoom.current = null;
    } else {
      // normal case
      desiredPanX = pendingRef.current.panX;
      desiredPanY = pendingRef.current.panY;
    }

    // 4) Clamp pan to bounds for nextZoom (or not, in the case of wheel)
    // const shouldClampPan = !(e instanceof WheelEvent) || zoomWasClamped;
    const shouldClampPan = !(e instanceof WheelEvent);

    if (shouldClampPan) {
      pendingRef.current.panX = clamp(desiredPanX, minPanX, maxPanX);
      pendingRef.current.panY = clamp(desiredPanY, minPanY, maxPanY);
    } else {
      pendingRef.current.panX = desiredPanX;
      pendingRef.current.panY = desiredPanY;
    }

    scheduleFlush();
  };

  const close = () => {
    if (!isOpen || isClosing) return;

    setIsClosing(true);
    const vh =
      typeof window !== "undefined"
        ? window.innerHeight || document.documentElement.clientHeight || 0
        : 0;

    // Changed to 2x for desktop
    pendingRef.current.swipeY = Math.sign(pendingRef.current.swipeY) * 2 * vh;
    pendingRef.current.exitScale = 2;
    pendingRef.current.backdropOpacity = 0;
    pendingRef.current.imageOpacity = 0;
    scheduleFlush();

    window.setTimeout(() => {
      setIsClosing(false);
      setLoaded({});
      setErrored({});
      onClose();
    }, BACKDROP_FADE_DURATION);
  };

  const zoom = (e: React.MouseEvent<HTMLElement>) => {
    if (isClosing || programmaticScrollingRef.current || scrollingRef.current) return;
    e.stopPropagation();
    setIsZoomTransitioning(true);

    /**
     * Using dblclick here would have been good, but as-is can conflict with swipe-x if user holds down second click too long,
     * so we are using manual double-tap detection instead inside of handlePointerDown. Keeping this here
     * for posterity, and in case we can fix the conflict later.
     */
    // if (e.type === "dblclick") {
    //   zoomAtClientPoint(e.clientX, e.clientY);

    // } else {
    if (pendingRef.current.zoomScale > 1) {
      pendingRef.current.zoomScale = MIN_ZOOM;
    } else {
      pendingRef.current.zoomScale = MAX_ZOOM;
    }
    scheduleFlush();
    regulatePanAndZoom();
    // }
  };

  const zoomAtClientPoint = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    setIsZoomTransitioning(true);

    // Toggle target zoom
    const prevZoom = pendingRef.current.zoomScale;
    const nextZoom = prevZoom > 1 ? MIN_ZOOM : MAX_ZOOM;

    const rect = container.getBoundingClientRect();
    const Cx = rect.left + rect.width / 2;
    const Cy = rect.top + rect.height / 2;

    const prevPanX = pendingRef.current.panX;
    const prevPanY = pendingRef.current.panY;

    // Similar mapping used in pinch:
    // i = (S - C - P) / z
    const ix = (clientX - Cx - prevPanX) / prevZoom;
    const iy = (clientY - Cy - prevPanY) / prevZoom;

    // nextPan = S - C - nextZoom * i
    pendingRef.current.zoomScale = nextZoom;
    pendingRef.current.panX = clientX - Cx - nextZoom * ix;
    pendingRef.current.panY = clientY - Cy - nextZoom * iy;
    regulatePanAndZoom();
  };

  const zoomOut = () => {
    if (pendingRef.current.zoomScale > 1) setIsZoomTransitioning(true);
    pendingRef.current.zoomScale = MIN_ZOOM;
    regulatePanAndZoom();
  }

  const zoomOutIfNeeded = (after?: () => void) => { // todo: consider instead using isZoomTransitioning/onTransitionEnd somehow
    if (pendingRef.current.zoomScale <= 1) {
      after?.();
      return;
    }

    setAxis(null);
    zoomOut();

    window.setTimeout(() => {
      after?.();
    }, RESET_DURATION);
  };

  // Used for manual double-tap detection
  // todo 01.16.26: question this... we are doing similar things in onPointerUp
  const clearGestureState = () => {
    evCacheRef.current.length = 0;
    setAxis(null);
  };

  const setScrolling = (set: boolean) => {
    scrollingRef.current = set;
    setIsScrolling(set);

  }

  const handleScroll = () => {
    setScrolling(true);
    const container = carouselContainerRef.current;
    if (!container) return;
    if (programmaticScrollingRef.current) return;

    const start = container.clientWidth;
    const end = container.scrollWidth - (container.clientWidth * 2);
    const scrollingPastStart = container.scrollLeft < start;
    const scrollingPastEnd = container.scrollLeft > end;

    if (scrollingPastStart) {
      showPrev();
    } else if (scrollingPastEnd) {
      showNext();
    }
  }

  const endScroll = () => {
    setScrolling(false)
    pendingRef.current.zoomScale = 1;
    scheduleFlush();
  }

  const endProgrammaticScroll = () => {
    programmaticScrollingRef.current = false;
    setSnapDisabled(false);
  };

  const beginProgrammaticScroll = () => {
    programmaticScrollingRef.current = true;
    setSnapDisabled(true);
  };

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    const container = carouselContainerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!el) return;

    swipeDirectionRef.current = null;
    if (!programmaticScrollingRef.current) beginProgrammaticScroll();
    el.scrollIntoView({ behavior, inline: "center", block: "nearest" });
  };

  const showPrev = (fromSwipe = false) => {
    zoomOutIfNeeded(() => {
      const currentIndexChangedBySwiping = fromSwipe
        && currentIndexRef.current != null
        && currentIndexRef.current !== currentIndex;

      const target = currentIndexChangedBySwiping
        ? currentIndex
        : (currentIndex - 1 + images.length) % images.length;
      scrollToIndex(target, "smooth");
    });
  };

  const showNext = (fromSwipe = false) => {
    zoomOutIfNeeded(() => {
      const currentIndexChanged = fromSwipe
        && currentIndexRef.current != null
        && currentIndexRef.current !== currentIndex;

      const target = currentIndexChanged
        ? currentIndex
        : (currentIndex + 1) % images.length;
      scrollToIndex(target, "smooth");
    });
  };

  useEffect(() => {
    if (!isOpen || isClosing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isScrolling = (programmaticScrollingRef.current || scrollingRef.current);
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        // if (e.repeat && isScrolling) return; // todo: may still need this; pend debug
        if (isScrolling) return;
        showPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        // if (e.repeat && isScrolling) return; // todo: may still need this; pend debug
        if (isScrolling) return;
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isClosing, currentIndex, images.length]);

  // To be used primarily for wheel + scroll (e.ctrlKey) events; aka zooming on trackpad
  const markWheelActivity = (e: WheelEvent) => {
    if (!isWheelZoomingRef.current) {
      isWheelZoomingRef.current = true;
    }

    if (wheelZoomingEndTimerRef.current != null) {
      window.clearTimeout(wheelZoomingEndTimerRef.current);
    }

    wheelZoomingEndTimerRef.current = window.setTimeout(() => {
      wheelZoomingEndTimerRef.current = null;
      isWheelZoomingRef.current = false;

      // If zoom is too small to be intentional, zoom back out (todo: consider putting a guard like this on touch)
      if (pendingRef.current.zoomScale <= 1.15) {
        zoomOut();
      }

      if (Math.sign(e.deltaY) != -1) {
        regulatePanAndZoom();
      }
    }, 120);
  };

  // wheel + scroll (e.ctrlKey) pinch-to-zoom (onWheel inside useEffect for active preventDefault)
  useEffect(() => {
    if (!isOpen || isClosing) return;
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {

      // Trackpad pinch-zoom
      if (e.ctrlKey) {
        e.preventDefault();
        markWheelActivity(e);

        // todo: determine if this is meaningful... Does this actually work?
        // re:todo: it does something that looks negligible, and does not stop our side effect where an incomplete zoom will finish on another image following an arrow swipe. smdh my dang head
        if (scrollingRef.current) {
          // console.log("scrollking");
          return;
        }

        const prevZoom = pendingRef.current.zoomScale;
        // const nextZoom = clamp(prevZoom * Math.exp(-e.deltaY * .02), MIN_ZOOM, MAX_ZOOM);
        const nextZoomUnclamped = prevZoom * Math.exp(-e.deltaY * .01);

        const rect = container.getBoundingClientRect();
        const viewportCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }

        const prevPan = {
          x: pendingRef.current.panX,
          y: pendingRef.current.panY,
        }

        /**
         * Similar mapping used in pinch:
         *  i = (S - C - P) / z
         * from:
         *  S = C + P + z⋅i
         */
        const ix = (e.clientX - viewportCenter.x - prevPan.x) / prevZoom;
        const iy = (e.clientY - viewportCenter.y - prevPan.y) / prevZoom;

        // nextPan = S - C - nextZoom * i
        pendingRef.current.zoomScale = nextZoomUnclamped;
        pendingRef.current.panX = e.clientX - viewportCenter.x - nextZoomUnclamped * ix;
        pendingRef.current.panY = e.clientY - viewportCenter.y - nextZoomUnclamped * iy;

        // todo: revisit this (and in mobile location): I think we need the first condition, but Chat had other ideas:
        // "...means you only capture the “clamped pan” once (the first frame you exceed MAX). If the user keeps pinching/scrolling while already over MAX, the “correct” pan at MAX changes with pointer movement, but you won’t update it. Usually you want to overwrite it every time you’re beyond MAX..."
        if (nextPanUnclampedForClampedZoom.current === null && nextZoomUnclamped > MAX_ZOOM) {
          nextPanUnclampedForClampedZoom.current = {
            x: e.clientX - viewportCenter.x - MAX_ZOOM * ix,
            y: e.clientY - viewportCenter.y - MAX_ZOOM * iy,
          };
        }

        regulatePanAndZoom(e);
        return;
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isClosing]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isClosing || scrollingRef.current || programmaticScrollingRef.current) return;
    e.preventDefault();

    /**
     * Introduced stalifiable currentIndexRef in the event that a swipe-x-scroll in the case that you
     * have swipe-x'd the image far enough that currentIndex has already been updated, and thus letting
     * go of the swipe in either prev or next direction would have actually sent you past the image to
     * which you were swiping. In that case, showPrev/Next logic can run off of the stale (original)
     * currentIndex instead.
     */
    if (carouselContainerRef.current) {
      scrollLeftStartRef.current = carouselContainerRef.current.scrollLeft;
      currentIndexRef.current = currentIndex;
    }

    // Manual double-tap to zoom
    // Would be made redundant by onDoubleClick, except for the hold-swipe bug (see zoom() for details)
    const now = performance.now();

    const last = lastTapRef.current;

    if (last) {
      const dt = now - last.time;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      const dist = Math.hypot(dx, dy);

      if (dt <= DOUBLE_TAP_MS && dist <= DOUBLE_TAP_SLOP_PX) {
        lastTapRef.current = null;

        if (pendingRef.current.zoomScale > 1) { zoomOut(); }
        else { zoomAtClientPoint(e.clientX, e.clientY); }
        clearGestureState();
        pendingRef.current.swipeY = 0;
        scheduleFlush();
        return;
      }
    }

    // Not a double tap yet: record this tap as the "first"
    lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };

    const evCache = evCacheRef.current;
    evCache.push(toCachedPointer(e));

    if (evCache.length > MAX_TOUCH_POINTS) {
      // Too many touch points: treat this as a cancelled gesture
      evCache.length = 0;
      setAxis(null);
      return;
    }

    // capture pointer so moves outside the image still report to this element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setAxis(null);
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;

    if (pendingRef.current.zoomScale > 1) {
      panXStartRef.current = pendingRef.current.panX;
      panYStartRef.current = pendingRef.current.panY;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isClosing || evCacheRef.current.length === 0) return;
    const evCache = evCacheRef.current;
    upsertCachedPointer(evCache, e);

    if (scrollingRef.current || programmaticScrollingRef.current) return;

    const isZoomedIn = pendingRef.current.zoomScale > 1;

    if (isZoomedIn) {
      // Panning a zoomed image
      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;
      pendingRef.current.panX = panXStartRef.current + deltaX;
      pendingRef.current.panY = panYStartRef.current + deltaY;
      scheduleFlush();
      return;
    }

    if (!isZoomedIn) {
      // Swiping (y to close)
      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Determine if we are swiping horizontally or vertically
      if (swipeAxisRef.current === null) {
        const maxDelta = Math.max(absX, absY);
        if (maxDelta < DRAG_LOCK_THRESHOLD) return;
        setAxis(absX > absY ? "x" : "y");
        // cancel double-tap sequence
        lastTapRef.current = null;
      }

      if (swipeAxisRef.current === "y") {
        pendingRef.current.swipeY = deltaY;
      } else if (swipeAxisRef.current === "x") {
        const carousel = carouselContainerRef.current;
        if (!carousel) return;
        carousel.scrollLeft = scrollLeftStartRef.current - deltaX;
      }
      scheduleFlush();
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isClosing || evCacheRef.current.length === 0) return;
    e.preventDefault();

    const evCache = evCacheRef.current;

    // Remove this event from the cache
    const index = evCache.findIndex((p) => p.pointerId === e.pointerId);
    if (index > -1) evCache.splice(index, 1);

    // if (scrollingRef.current || programmaticScrollingRef.current) return; // todo: This may be a bad idea--check and make sure that we actually need it // re:todo: I definitely found a bug where swipeAxis is set (to x) and never unset when this is uncommented. Makes sense. 

    const isZoomedIn = pendingRef.current.zoomScale > 1;

    // Then must be:
    // - (1) single-pointer drag (drag-y to close on release)
    // - (2) single-pointer pan on zoomed image
    if (!isZoomedIn) {
      // We did (1) single-finger drag-y, so close on release
      const axis = swipeAxisRef.current;
      const deltaX = axis === "y" ? 0 : e.clientX - startXRef.current;
      const deltaY = axis === "x" ? 0 : e.clientY - startYRef.current;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (axis === "y" && absY > DRAG_CLOSE_THRESHOLD) {
        close();
      } else if (axis === "x" && absX > SWIPE_IMAGE_CHANGE_THRESHOLD) {
        swipeDirectionRef.current = deltaX > 0 ? "prev" : "next";
      } else {
        swipeDirectionRef.current = null;
        pendingRef.current.swipeY = 0;
        scheduleFlush();
      }
    }

    // Reset other stuff only when no pointers are left (gesture is over)
    if (evCache.length === 0) {
      regulatePanAndZoom();
      if (swipeAxisRef.current) {
        if (swipeDirectionRef.current === "next") {
          showNext(true);
        } else if (swipeDirectionRef.current === "prev") {
          showPrev(true);
        } else {
          scrollToIndex(currentIndex);
        }
      }
      setAxis(null);
      currentIndexRef.current = null;
      swipeDirectionRef.current = null;
    }
  };

  if (!isOpen || !images.length) return null;

  ////
  // Final derived offsets:
  ////
  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const isZoomedIn = pendingRef.current.zoomScale > 1;
  const isPointerDown = evCacheRef.current.length > 0;

  let imgTx = 0;
  let imgTy = 0;

  if (isZoomedIn || isZoomTransitioning) {
    imgTx = panX;
    imgTy = panY;
  } else {
    imgTx = 0;
    imgTy = swipeY;
  }

  const ZoomInIcon = () => (
    <svg
      // viewBox="0 0 24 24"
      viewBox="0 -960 960 960"
      className="h-6 w-6 fill-current"
      aria-hidden="true"
    >
      <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Zm-40-60v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Z" />
    </svg>
  );

  const ZoomOutIcon = () => (
    <svg
      viewBox="0 -960 960 960"
      className="h-6 w-6 fill-current"
      aria-hidden="true"
    >
      <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400ZM280-540v-80h200v80H280Z" />
    </svg>
  );

  return (
    <LightboxPortal>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[999] overflow-hidden select-none touch-none backdrop-blur-sm"
        style={{
          pointerEvents: isClosing ? "none" : "auto",
          backgroundColor: `rgba(0,0,0,${0.8 * backdropOpacity})`,
          transition: `background-color ${BACKDROP_FADE_DURATION}ms ease-out`,
        }}
      >
        {/* Zoom & Close buttons */}
        <div className="absolute top-1 right-1 z-10 flex flex-row">
          {/* Zoom */}
          <div className="p-2 mr-1 flex justify-end bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm">
            <button
              disabled={isClosing}
              type="button"
              onClick={zoom}
              className={`p-1 text-sm uppercase tracking-wide cursor-pointer ${snapDisabled || isScrolling ? "pointer-events-none" : ""} focus:outline-none`}
              style={{
                opacity: imageOpacity,
                transition: isPointerDown
                  ? "none"
                  : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
              }}
            >
              {isZoomedIn ? <ZoomOutIcon /> : <ZoomInIcon />}
            </button>
          </div>

          {/* Close */}
          <div className="p-2 flex justify-end bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm">
            <button
              disabled={isClosing}
              type="button"
              onClick={close}
              className="p-1 text-sm uppercase tracking-wide cursor-pointer"
              style={{
                opacity: imageOpacity,
                transition: isPointerDown
                  ? "none"
                  : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
              }}
            >
              <svg
                viewBox="0 -960 960 960"
                className="h-6 w-6 fill-current"
              >
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Arrows */}
        {images.length > 1 && (
          <>
            {/* Previous arrow */}
            <button
              disabled={isClosing}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showPrev();
              }}
              className="absolute left-1 top-1/2 p-2 flex items-center justify-center bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm hover:bg-black/60 cursor-pointer z-10"
              style={{
                opacity: imageOpacity,
                transition: isPointerDown
                  ? "none"
                  : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
              }}
              aria-label="Previous image"
            >
              <svg
                viewBox="0 -960 960 960"
                className="h-6 w-6 fill-current"
              >
                <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
              </svg>
            </button>

            {/* Next arrow */}
            <button
              disabled={isClosing}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showNext();
              }}
              className="absolute right-1 top-1/2 p-2 flex items-center justify-center bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm hover:bg-black/60 cursor-pointer z-10"
              style={{
                opacity: imageOpacity,
                transition: isPointerDown
                  ? "none"
                  : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
              }}
              aria-label="Next image"
            >
              <svg
                viewBox="0 -960 960 960"
                className="h-6 w-6 fill-current"
              >
                <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" />
              </svg>
            </button>
          </>
        )}

        {/* Image Area (Natural scroll) */}
        <div id="carousel-container" className="absolute inset-0 flex">
          <style>
            {`
              #image-carousel::-webkit-scrollbar {
                display: none;
              }
            `}
          </style>
          <div
            ref={carouselContainerRef}
            id="image-carousel"
            className={`flex ${(isZoomedIn || isZoomTransitioning) ? "overflow-x-hidden" : (swipeAxis === "x" || snapDisabled) ? "overflow-x-auto snap-none" : "overflow-x-auto snap-x snap-mandatory"} overflow-y-hidden max-w-full max-h-full`}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            // onDoubleClick={zoom} // todo: this did not work as well as I had hoped (see zoom() for details)
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onScroll={handleScroll}
            onScrollEnd={() => { endProgrammaticScroll(); endScroll(); }}
          >
            <div
              id="dummy-slide-beginning"
              className={`min-w-full flex-[0_0_100%] flex items-center justify-center ${(isZoomedIn || isZoomTransitioning || swipeAxis === "x" || snapDisabled) ? "" : "snap-center snap-always"}`}
            >
            </div>
            {/* Current slide (center) */}
            {images.map((img, index) => {
              const isActive = index === currentIndex;
              const shouldLoadImg = shouldLoad(index, currentIndex, images.length);

              return (
                <div
                  ref={isActive ? imageContainerRef : null}
                  key={(img.src ?? "") + index}
                  data-index={index}
                  className={`min-w-full flex-[0_0_100%] h-[100vh] w-[100vw] flex items-center justify-center ${(isZoomedIn || isZoomTransitioning || swipeAxis === "x" || snapDisabled) ? "" : "snap-center snap-always"}`}
                  style={{
                    // transform: isActive && (isZoomedIn || isZoomTransitioning || swipeAxisRef.current === "y" || isClosing)
                    //   ? `translate(${imgTx}px, ${imgTy}px)`
                    //   : "none",
                    transform: isActive
                      ? `translate3d(${imgTx}px, ${imgTy}px, 0)`
                      : `translate3d(0px, 0px, 0)`,
                    transition: isPointerDown
                      ? "none"
                      : `transform ${RESET_DURATION}ms ease-out`,
                  }}
                >
                  {!loaded[index] && !errored[index] && (
                    <div
                      className="absolute inset-0 h-[100vh] w-[100vw] object-contain flex items-center justify-center"
                      style={{
                        visibility:
                          isClosing
                            ?
                            "hidden" :
                            "visible",
                      }}
                    >
                      <LoadingSpinner color="currentColor" width="100" height="100" />
                    </div>
                  )}

                  {errored[index] && (
                    <div
                      className="absolute inset-0 h-[100vh] w-[100vw] object-contain flex items-center justify-center"
                      style={{
                        visibility:
                          isClosing
                            ?
                            "hidden" :
                            "visible",
                      }}
                    >
                      {/* <LoadingSpinner color="currentColor" width="100" height="100" /> */}
                      <ErrorSpinner color="currentColor" width="100" height="100" />
                    </div>
                  )}

                  {shouldLoadImg && (
                    <img
                      ref={isActive ? imageRef : null}
                      src={img.src}
                      // src={"/bad-url.jpg"}
                      // src={shouldLoad(index, currentIndex, images.length) ? img.src : undefined}
                      loading={isActive ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={isActive ? "high" : "auto"}
                      alt={img.alt ?? ""}
                      data-src={img.src}
                      data-zoomable="true"
                      onLoad={() => setLoaded(p => ({ ...p, [index]: true }))}
                      onError={() => setErrored(p => ({ ...p, [index]: true }))}
                      className={`max-h-[100vh] w-auto max-w-full object-contain shadow-lg bg-black/20 ${isActive && pendingRef.current.zoomScale > 1 ? "cursor-all-scroll" : "cursor-zoom-in active:cursor-grabbing"} ${snapDisabled || isScrolling ? "pointer-events-none" : ""}`}
                      style={{
                        transformOrigin: "50% 50%",
                        transform: isActive ? `scale(${exitScale * zoomScale})` : `scale(1)`,
                        opacity: errored[index] ? 0 : imageOpacity,
                        transition: isPointerDown || errored[index]
                          ? "none"
                          : `transform ${RESET_DURATION}ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                      }}
                      onTransitionStart={(e) => {
                        if (!isActive) return;
                        if (e.propertyName !== "transform") return;
                        setIsZoomTransitioning(true);
                      }}
                      onTransitionEnd={(e) => {
                        if (!isActive) return;
                        if (e.propertyName !== "transform") return;
                        setIsZoomTransitioning(pendingRef.current.zoomScale > 1 || false);
                        // setIsZoomTransitioning(false);
                      }}
                      onTransitionCancel={(e) => {
                        if (!isActive) return;
                        if (e.propertyName !== "transform") return;
                        setIsZoomTransitioning(pendingRef.current.zoomScale > 1 || false);
                        // setIsZoomTransitioning(false);
                      }}
                    />
                  )}
                </div>
              )
            })}
            <div
              id="dummy-slide-end"
              className={`min-w-full flex-[0_0_100%] flex items-center justify-center ${(isZoomedIn || isZoomTransitioning || swipeAxis === "x" || snapDisabled) ? "" : "snap-center snap-always"}`}
            >
            </div>
          </div>
        </div>

        {/* Caption */}
        <div
          className="absolute bottom-1 z-10 text-xs bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm p-3 left-1 right-auto truncate"
          style={{
            opacity: imageOpacity,
            transition: isPointerDown
              ? "none"
              : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
          }}
        >
          {currentImage.alt ?? "\u00A0"}
        </div>

        {/* Index */}
        <div
          className="absolute bottom-1 z-10 text-xs bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm p-3 right-1 left-auto"
          style={{
            opacity: imageOpacity,
            transition: isPointerDown
              ? "none"
              : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
          }}
        >
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </LightboxPortal >
  );
};