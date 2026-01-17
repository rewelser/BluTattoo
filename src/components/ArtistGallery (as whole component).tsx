import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

interface ArtistImage {
    src: string;
    alt?: string;
}

interface ArtistGalleryProps {
    images?: ArtistImage[];
}

// DOUBLE_TAP_MS & DOUBLE_TAP_SLOP_PX were used for manual double-tap detection, but I think we can use onDoubleClick instead
const DOUBLE_TAP_MS = 250;
const DOUBLE_TAP_SLOP_PX = 24;

const DRAG_CLOSE_THRESHOLD = 120;
const DRAG_LOCK_THRESHOLD = 10;
const RESET_DURATION = 200; // todo 1.16.26: conflate with Backdrop fade duration?
const BACKDROP_FADE_DURATION = 200;
// const BACKDROP_FADE_DURATION = 2000;
const SWIPE_IMAGE_CHANGE_THRESHOLD = 80; // 80 too small for desktop, 200 too big for mobile
// ^ might need to make a mobile threshold as well ^
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

export const ArtistGallery: React.FC<ArtistGalleryProps> = ({ images = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [currentIndex, setCurrentIndex] = useState<number | null>(null);
    const prevIndex = currentIndex !== null ? (currentIndex - 1 + images.length) % images.length : null;
    const nextIndex = currentIndex !== null ? (currentIndex + 1) % images.length : null;
    const [swipeX, setSwipeX] = useState(0);
    const [swipeY, setSwipeY] = useState(0);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const panXStartRef = useRef(0);
    const panYStartRef = useRef(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const baseImgWRef = useRef<number | null>(null);
    const baseImgHRef = useRef<number | null>(null);
    const [exitScale, setExitScale] = useState(1);
    const [backdropOpacity, setBackdropOpacity] = useState(1);
    const [imageOpacity, setImageOpacity] = useState(1);
    const [zoomScale, setZoomScale] = useState(1);
    const pinchingRef = useRef(false);
    const noLongerPinchingRef = useRef(false);
    const nextPanUnclampedForClampedZoom = useRef<{ x: number; y: number } | null>(null)
    const swipeAxisRef = useRef<"x" | "y" | null>(null);
    const swipeSnapBackRef = useRef(false);
    const [swipeDirection, setSwipeDirection] = useState<"prev" | "next" | null>(null);
    const swipeCommitGuardRef = useRef(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const evCacheRef = useRef<CachedPointer[]>([]);
    const rafIdRef = useRef<number | null>(null);
    const pinchPrevDistanceRef = useRef<number | null>(null);
    const pinchPrevCenterRef = useRef<{ x: number; y: number } | null>(null);
    const currentImgContainerRef = useRef<HTMLDivElement | null>(null);
    const resetInFlightRef = useRef<Promise<void> | null>(null);


    const lastTapRef = useRef<{
        time: number;
        x: number;
        y: number;
    } | null>(null);

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

    if (!images || images.length === 0) return null;

    const scheduleFlush = () => {
        if (rafIdRef.current != null) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const p = pendingRef.current;
            setPanX(p.panX);
            setPanY(p.panY);
            setSwipeX(p.swipeX);
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

        const container = containerRef.current;
        const baseW = baseImgWRef.current;
        const baseH = baseImgHRef.current;

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

        // 4) Clamp pan to bounds for nextZoom
        pendingRef.current.panX = clamp(desiredPanX, minPanX, maxPanX);
        pendingRef.current.panY = clamp(desiredPanY, minPanY, maxPanY);
        scheduleFlush();
    };

    const openAt = (index: number) => {
        setCurrentIndex(index);
        setIsOpen(true);
        setIsClosing(false);
        pendingRef.current.swipeX = 0;
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
            pendingRef.current.swipeX = 0;
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
    };

    const resetViewAnimated = () => {
        // Coalesce calls if user spams next/prev
        if (resetInFlightRef.current) return resetInFlightRef.current;

        // If already reset, no need to wait
        const alreadyReset =
            pendingRef.current.zoomScale === 1 &&
            pendingRef.current.panX === 0 &&
            pendingRef.current.panY === 0;

        if (alreadyReset) return Promise.resolve();

        resetInFlightRef.current = new Promise<void>((resolve) => {
            // pan translate lives here
            const imgContainer = currentImgContainerRef.current;
            // scale lives here
            const img = imageRef.current;

            // If we can't listen for transitions, just do the state update and resolve quickly
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

            // Fallback in case transitionend doesn't fire (e.g. same value, interrupted, etc.)
            const timer = window.setTimeout(() => {
                cleanup();
                resetInFlightRef.current = null;
                resolve();
            }, RESET_DURATION + 80);

            // Listen BEFORE we trigger changes
            imgContainer.addEventListener("transitionend", onImgContainerEnd);
            img.addEventListener("transitionend", onImgEnd);

            // Trigger reset
            resetViewImmediate();
            scheduleFlush();
        });

        return resetInFlightRef.current;
    };

    const requestSwipe = async (dir: "prev" | "next") => {
        if (isClosing) return;

        // redundant protections to cancel any drag-driven transform path
        pendingRef.current.swipeX = 0;
        pendingRef.current.swipeY = 0;
        scheduleFlush();

        // Phase 1: reset pan/zoom
        await resetViewAnimated();

        // Phase 2: swipe track
        setSwipeDirection(dir);

    };

    const resetViewImmediate = () => {
        pendingRef.current.zoomScale = 1;
        pendingRef.current.panX = 0;
        pendingRef.current.panY = 0;
        pendingRef.current.swipeX = 0;
        pendingRef.current.swipeY = 0;
        nextPanUnclampedForClampedZoom.current = null;
    };

    const showPrev = () => {
        if (currentIndex === null) return;

        setCurrentIndex((prev) => {
            if (prev === null) return prev;
            return (prev - 1 + images.length) % images.length;
        });
        setSwipeDirection(null);
        pendingRef.current.swipeX = 0;
        scheduleFlush();
    };

    const showNext = () => {
        if (currentIndex === null) return;

        setCurrentIndex((prev) => {
            if (prev === null) return prev;
            return (prev + 1) % images.length;
        });
        setSwipeDirection(null);
        pendingRef.current.swipeX = 0;
        scheduleFlush();
    };

    // was used for manual double-tap detection, but I think we can use onDoubleClick instead
    const clearGestureState = () => { // todo 01.16.26: question this... we are doing similar things in onPointerUp
        evCacheRef.current.length = 0;
        swipeAxisRef.current = null;
        pinchingRef.current = false;
        noLongerPinchingRef.current = false;
        pinchPrevDistanceRef.current = null;
        pinchPrevCenterRef.current = null;
    };

    // todo: figure out how the math for this is different from the isPinching block and why it still works (without "// First pinch frame – initialize baseline")
    // todo: also, figure out how center(x,y) equals the midpoint between both fingers (maybe this is automatic?)
    useEffect(() => {
        if (!isOpen || isClosing) return;

        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            /* ===============================
               1) Trackpad pinch-to-zoom
               =============================== */
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
    }, [isOpen, isClosing, swipeDirection]);


    const handlePointerDown = (e: React.PointerEvent) => {
        if (isClosing) return;
        e.preventDefault();

        // All of this is made redundant, I believe, by onDoubleClick
        // ---- double-tap to zoom ----
        // const now = performance.now();
        // const last = lastTapRef.current;

        // if (last) {
        //     const dt = now - last.time;
        //     const dx = e.clientX - last.x;
        //     const dy = e.clientY - last.y;
        //     const dist = Math.hypot(dx, dy);

        //     if (dt <= DOUBLE_TAP_MS && dist <= DOUBLE_TAP_SLOP_PX) {
        //         // Treat as double tap => zoom, and cancel any swipe/pan gesture start
        //         lastTapRef.current = null;

        //         zoom();
        //         clearGestureState();

        //         // Also reset any active swipe offsets so we don't "jump"
        //         pendingRef.current.swipeX = 0;
        //         pendingRef.current.swipeY = 0;
        //         scheduleFlush();

        //         return;
        //     }
        // }

        // // Not a double tap yet: record this tap as the "first"
        // lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        // --------------------------------------------------------

        const evCache = evCacheRef.current;
        evCache.push(toCachedPointer(e));
        const isPinching =
            evCache.length === 2 &&
            evCache.every((ev) => ev.pointerType === "touch");

        if (evCache.length > MAX_TOUCH_POINTS) {
            // Too many touch points: treat this as a cancelled gesture
            evCache.length = 0;
            pinchingRef.current = false;
            swipeAxisRef.current = null;
            noLongerPinchingRef.current = false;
        } else {
            // capture pointer so moves outside the image still report to this element
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            noLongerPinchingRef.current = false;
            swipeAxisRef.current = null;
            startXRef.current = e.clientX;
            startYRef.current = e.clientY;

            if (pendingRef.current.zoomScale > 1) {
                panXStartRef.current = pendingRef.current.panX;
                panYStartRef.current = pendingRef.current.panY;
            }

            if (isPinching) {
                pinchingRef.current = true;
            }
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
        } else if (!isPinching && isZoomedIn) {
            // Panning a zoomed image

            const deltaX = e.clientX - startXRef.current;
            const deltaY = e.clientY - startYRef.current;
            const nextPanXUnclamped = panXStartRef.current + deltaX;
            const nextPanYUnclamped = panYStartRef.current + deltaY;
            pendingRef.current.panX = nextPanXUnclamped;
            pendingRef.current.panY = nextPanYUnclamped;

            scheduleFlush();
        } else if (!isPinching && !isZoomedIn) {
            // Swiping (x to swipe next/prev, or y to close)

            const deltaX = e.clientX - startXRef.current;
            const deltaY = e.clientY - startYRef.current;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            // Determine if we are swiping horizontally or vertically
            if (swipeAxisRef.current === null) {
                const maxDelta = Math.max(absX, absY);
                if (maxDelta < DRAG_LOCK_THRESHOLD) return;
                swipeAxisRef.current = absX > absY ? "x" : "y";
            }

            if (swipeAxisRef.current === "x") {
                pendingRef.current.swipeX = deltaX;
                pendingRef.current.swipeY = 0;
            } else {
                pendingRef.current.swipeY = deltaY;
                pendingRef.current.swipeX = 0;
            }

            scheduleFlush();


        }

        // new isPinching block (incremental deltas)
        else if (isPinching) {
            const [p1, p2] = evCache;
            if (!p1 || !p2) return;

            const t1 = p1.targetEl;
            const t2 = p2.targetEl;
            const bothOnZoomable =
                !!t1?.closest("[data-zoomable='true']") &&
                !!t2?.closest("[data-zoomable='true']");
            if (!bothOnZoomable) return;

            const container = containerRef.current;
            if (!container) return;

            // X & Y midpoints between pinching fingers (screen space)
            const curCenter = {
                x: (p1.clientX + p2.clientX) / 2,
                y: (p1.clientY + p2.clientY) / 2,
            };

            // Distance between the two pointers
            const curDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);


            //// Explanation of viewport center usage:
            /* 
            At pan = 0, zoom = 1, image is centered in viewport, so viewport center = image center.
            Viewport center makes sense as a reference point because of the above, and because pan and zoom
            are not applied to the same element (pan on container, zoom on image), so we need a 
            stable reference point. Because the image scales around its center, the image center 
            (in screen space) is:

                                    imageCenterScreen = viewportCenter + pan

            Now take any point on the unscaled image in image-local space i (a vector from the image center).
            Scaling by z makes that vector become z * i in screen pixels. So the full mapping is:

                                    pointScreen_i = imageCenterScreen + z * i 

            Generally:
                                    S = C + P + z⋅i 
            where:
                screen == S (a screen-space point)
                viewportCenter == C
                pan == P
                imageCoord == i (image-local coordinate)
                zoom == z
            */
            const containerRect = container.getBoundingClientRect();
            const viewportCenter = { x: containerRect.left + containerRect.width / 2, y: containerRect.top + containerRect.height / 2 };

            // Seed the incremental integrator - wait for next move to have a delta
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

            // Incremental scale step for this frame
            const zoomStepFactor = curDist / prevDist;
            const nextZoomUnclamped = prevZoom * zoomStepFactor;

            /* 
            During the pinch, we know prevCenter (screen point between fingers) and we want to 
            find which image-local point was under that screen point. Starting from the mapping:
                                    S = C + P + z⋅i
            Solve for i:
                                    i = (S - C - P) / z
            plug in prev values:
                S = prevCenter
                C = viewportCenter
                P = prevPan
                z = prevZoom
                                    i = (prevCenter - viewportCenter - prevPan) / prevZoom

            i gets multiplied by nextZoom because scaling multiplies image-local 
            offsets from the center. If i = (10, 0) means “10px right of the image center 
            in image-local space”, then at zoom 1 it shows up 10 screen pixels right. 
            At zoom 2, it shows up 20 screen pixels right. So on the next frame, when zoom 
            is nextZoom, the screen-space offset of that same point becomes:

                                    screenOffset = nextZoom * i

            And therefore the screen position of that point is:

                                    S_next = C + P_next + nextZoom * i

            We want that to equal curCenter, because the fingers moved and you want the image point to 
            stay under them:
                                    curCenter = viewportCenter + nextPan + nextZoom * i
            Solve for the new pan:
                                    nextPan = curCenter - viewportCenter - nextZoom * i
            */
            const prevCenterX_i = (prevCenter.x - viewportCenter.x - prevPan.x) / prevZoom;
            const prevCenterY_i = (prevCenter.y - viewportCenter.y - prevPan.y) / prevZoom;

            // Incremental pan update
            const nextPanXUnclamped =
                curCenter.x -
                viewportCenter.x -
                nextZoomUnclamped * prevCenterX_i;

            const nextPanYUnclamped =
                curCenter.y -
                viewportCenter.y -
                nextZoomUnclamped * prevCenterY_i;

            if (nextPanUnclampedForClampedZoom.current === null && nextZoomUnclamped > MAX_ZOOM) {

                const nextPanXForClampedZoom = curCenter.x - viewportCenter.x - MAX_ZOOM * prevCenterX_i;
                const nextPanYForClampedZoom = curCenter.y - viewportCenter.y - MAX_ZOOM * prevCenterY_i;

                nextPanUnclampedForClampedZoom.current = {
                    x: nextPanXForClampedZoom,
                    y: nextPanYForClampedZoom
                };
            }

            // Commit
            pendingRef.current.zoomScale = nextZoomUnclamped;
            pendingRef.current.panX = nextPanXUnclamped;
            pendingRef.current.panY = nextPanYUnclamped;
            pinchPrevDistanceRef.current = curDist;
            pinchPrevCenterRef.current = { x: curCenter.x, y: curCenter.y };

            scheduleFlush();
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isClosing || evCacheRef.current.length === 0) return;
        e.preventDefault();
        const evCache = evCacheRef.current;
        const wasPinching =
            evCache.length === 2 &&
            evCache.every((ev) => ev.pointerType === "touch");

        // Remove this event from the cache
        const index = evCache.findIndex(
            (cachedEvPointer) => cachedEvPointer.pointerId === e.pointerId
        );
        if (index > -1) {
            evCache.splice(index, 1);
        }
        const isPinching =
            evCache.length === 2 &&
            evCache.every((ev) => ev.pointerType === "touch");
        const isNoLongerPinching = wasPinching && !isPinching;
        const isZoomedIn = pendingRef.current.zoomScale > 1;

        // take 1st finger off: isPinching || isNoLongerPinching: false, true
        // take 2nd finger off: !isPinching && !wasPinching: true, true

        if (isNoLongerPinching) {
            noLongerPinchingRef.current = true;
        } else if (isPinching) {
            noLongerPinchingRef.current = false;
        } else if (!isPinching && !wasPinching) {
            noLongerPinchingRef.current = false;

            // Then must be:
            // - (1) single-pointer drag (drag-x or drag-y to swipe or close on release)
            // - (2) single-pointer pan on zoomed image

            if (!isZoomedIn) {
                // We did (1) single-finger drag-x or -y, so swipe or close on release
                const axis = swipeAxisRef.current;
                const deltaX = axis === "y" ? 0 : e.clientX - startXRef.current;
                const deltaY = axis === "x" ? 0 : e.clientY - startYRef.current;

                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                if (axis === "y" && absY > DRAG_CLOSE_THRESHOLD) {
                    close();
                } else if (axis === "x" && absX > SWIPE_IMAGE_CHANGE_THRESHOLD) {
                    // setSwipeDirection(deltaX > 0 ? "prev" : "next");
                    requestSwipe(deltaX > 0 ? "prev" : "next");
                } else {
                    setSwipeDirection(null);
                    pendingRef.current.swipeX = 0;
                    pendingRef.current.swipeY = 0;
                    swipeSnapBackRef.current = true;
                    scheduleFlush();
                    window.setTimeout(() => {
                        swipeSnapBackRef.current = false;
                    }, BACKDROP_FADE_DURATION);

                }

            }
        }

        // Reset other stuff only when no pointers are left (gesture is over)
        if (evCache.length === 0) {
            regulatePanAndZoom();
            swipeAxisRef.current = null;
            pinchingRef.current = false;
            noLongerPinchingRef.current = false;
        }
        // Reset pinch-specific stuff regardless
        pinchPrevDistanceRef.current = null;
        pinchPrevCenterRef.current = null;
    };

    const handleTrackTransitionEndOrCancel = (
        e: React.TransitionEvent<HTMLDivElement>
    ) => {
        // Ignore bubbled transitionend events from children
        if (e.target !== e.currentTarget) return;

        // If we're not in a swipe animation, ignore.
        if (!swipeDirection) return;

        // "transitionend" | "transitioncancel"
        const nativeType = (e.nativeEvent as TransitionEvent).type;
        const prop = (e as any).propertyName as string | undefined;

        if (nativeType === "transitionend") {
            // if transitionend, only care about transform finishing:
            if (prop !== "transform") return;
        }

        // Ensure we only commit once per swipe
        if (swipeCommitGuardRef.current) return;
        swipeCommitGuardRef.current = true;

        // Commit the index change
        if (swipeDirection === "prev") {
            showPrev();
        } else if (swipeDirection === "next") {
            showNext();
        }
    };

    useEffect(() => {
        // whenever a new swipe is initiated, allow exactly one commit
        if (swipeDirection) swipeCommitGuardRef.current = false;
    }, [swipeDirection]);

    useEffect(() => {
        if (!isOpen || isClosing) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowLeft") requestSwipe("prev");
            if (e.key === "ArrowRight") requestSwipe("next");
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, isClosing, currentIndex, images.length]);

    ////
    // Final derived offsets:
    ////
    const currentImage = currentIndex !== null ? images[currentIndex] : null;
    const isZoomedIn = pendingRef.current.zoomScale > 1;
    const isPinching = pinchingRef.current;
    const isPointerDown = evCacheRef.current.length > 0
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
            {/* Thumbnail grid stays as-is, inside your layout card */}
            <div id="thumbnail-grid" className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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

            {/* Lightbox overlay goes into <body> via portal */}
            {
                isOpen && currentImage && (
                    <LightboxPortal>
                        <div
                            ref={containerRef}
                            className="fixed inset-0 z-[999] flex flex-col items-stretch justify-between overflow-hidden select-none touch-none backdrop-blur-sm"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    close();
                                }
                            }}
                            style={{
                                pointerEvents: isClosing ? "none" : "auto",
                                backgroundColor: `rgba(0,0,0,${0.8 * backdropOpacity})`,
                                transition: `background-color ${BACKDROP_FADE_DURATION}ms ease-out`,
                            }}
                        >

                            {/* Zoom & Close buttons container */}
                            <div
                                className="flex flex-row z-10"
                            >
                                {/* Zoom */}
                                <div className="p-2 m-1 flex justify-end bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm">
                                    <button
                                        disabled={isClosing}
                                        type="button"
                                        onClick={zoom}
                                        className="p-1 text-sm uppercase tracking-wide cursor-pointer"
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
                                <div className="p-2 m-1 flex justify-end bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm">
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
                                    <button
                                        disabled={isClosing}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            requestSwipe("prev");
                                        }}
                                        className="absolute left-3 top-1/2 px-2 py-2 flex items-center justify-center bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm hover:bg-black/60 cursor-pointer z-10"
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
                                    <button
                                        disabled={isClosing}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // setSwipeDirection("next");
                                            requestSwipe("next");
                                        }}
                                        className="absolute right-3 top-1/2 px-2 py-2 flex items-center justify-center bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm hover:bg-black/60 cursor-pointer z-10"
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

                            {/* Image track: prev | current | next */}
                            <div
                                id="carousel-container"
                                className="grow-2 relative flex overflow-x-visible w-screen"
                            >
                                <div
                                    id="image-carousel"
                                    className="flex"
                                    onDoubleClick={zoom} // todo: what about this?
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={handlePointerUp}
                                    onTransitionEnd={handleTrackTransitionEndOrCancel}
                                    onTransitionCancel={handleTrackTransitionEndOrCancel}
                                    style={{
                                        transform: swipeAxisRef.current === "x"
                                            ? `translateX(calc(-100vw + ${swipeX}px))`
                                            : swipeDirection === "prev"
                                                ? "translateX(0vw)"
                                                : swipeDirection === "next"
                                                    ? "translateX(-200vw)"
                                                    : "translateX(-100vw)",
                                        transition: (isPointerDown || swipeDirection === null) && !swipeSnapBackRef.current
                                            ? "none"
                                            : `transform ${RESET_DURATION}ms ease-out`,
                                    }}
                                >
                                    {/* Prev slide (off to the left) */}
                                    {prevIndex !== null && (
                                        <div className="flex items-center justify-center w-screen ">
                                            <img
                                                src={images[prevIndex].src}
                                                alt={images[prevIndex].alt ?? ""}
                                                className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20 "
                                                // no pointer handlers on neighbors
                                                style={{
                                                    transform: `translateY(${swipeY}px)`,
                                                    opacity: imageOpacity,
                                                    transition: isPointerDown
                                                        ? "none"
                                                        : `transform ${RESET_DURATION}ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Current slide (center) */}
                                    <div
                                        ref={currentImgContainerRef}
                                        id="current-image-container"
                                        className="flex items-center justify-center w-screen"
                                        style={{
                                            transform: `translate(${imgTx}px, ${imgTy}px)`,
                                            transition: isPointerDown
                                                ? "none"
                                                : `transform ${RESET_DURATION}ms ease-out`,
                                        }}
                                    // onMouseDown={() => console.log("touched")}
                                    >
                                        <img
                                            id="current-image"
                                            ref={imageRef}
                                            src={currentImage.src}
                                            alt={currentImage.alt ?? ""}
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
                                                const img = imageRef.current;
                                                if (!img) return;

                                                const r = img.getBoundingClientRect();

                                                // effective scale currently applied to the element
                                                const effectiveScale = (exitScale * zoomScale) || 1;

                                                baseImgWRef.current = r.width / effectiveScale;
                                                baseImgHRef.current = r.height / effectiveScale;
                                            }}
                                        // onMouseDown={() => console.log("touched")}
                                        />
                                    </div>

                                    {/* Next slide (off to the right) */}
                                    {nextIndex !== null && (
                                        <div className="flex items-center justify-center w-screen">
                                            <img
                                                src={images[nextIndex].src}
                                                alt={images[nextIndex].alt ?? ""}
                                                className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20 "
                                                style={{
                                                    transform: `translateY(${swipeY}px)`,
                                                    opacity: imageOpacity,
                                                    transition: isPointerDown
                                                        ? "none"
                                                        : `transform ${RESET_DURATION}ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Caption + index */}
                            <div
                                className="mt-3 px-4 py-4 flex items-stretch justify-between text-xs z-10 bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm"
                                style={{
                                    opacity: imageOpacity,
                                    transition: isPointerDown
                                        ? "none"
                                        : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                }}
                            >
                                <div className="truncate pr-4">
                                    {currentImage.alt ?? "\u00A0"}
                                </div>
                                <div>
                                    {(currentIndex ?? 0) + 1} / {images.length}
                                </div>
                            </div>
                        </div>
                    </LightboxPortal>
                )
            }
        </>
    );
};