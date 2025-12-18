import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
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
 * Avoid storing the whole React.PointerEvent object.
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
    const [swipeY, setSwipeY] = useState(0); // was zero; might should still be zero--see note about "0 * i = 0"
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const panXRef = useRef(0);
    const panYRef = useRef(0);
    const panXStartRef = useRef(0);
    const panYStartRef = useRef(0);
    const containerRef = useRef<HTMLDivElement | null>(null); // should get viewport values a different way
    const imageRef = useRef<HTMLImageElement | null>(null);
    const baseImgWRef = useRef<number | null>(null);
    const baseImgHRef = useRef<number | null>(null);
    const [exitScale, setExitScale] = useState(1);
    const [backdropOpacity, setBackdropOpacity] = useState(1);
    const [imageOpacity, setImageOpacity] = useState(1);
    const [zoomScale, setZoomScale] = useState(1);
    const zoomScaleRef = useRef(1);
    const pinchingRef = useRef(false);
    const noLongerPinchingRef = useRef(false);
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartZoomRef = useRef(1);
    const pinchStartPanRef = useRef<{ x: number; y: number } | null>(null);
    const pinchAnchorRef = useRef<{ x: number; y: number } | null>(null);
    const pinchOriginRef = useRef<{ x: number; y: number } | null>(null);
    const lastPinchCenterRef = useRef<{ x: number; y: number } | null>(null);
    const nextPanUnclampedForClampedZoom = useRef<{ x: number; y: number }>(null);
    const pointerDownRef = useRef(false);
    const swipingXRef = useRef(false);
    const swipingYRef = useRef(false);
    const [swipeDirection, setSwipeDirection] = useState<"prev" | "next" | null>(null);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const evCacheRef = useRef<CachedPointer[]>([]);
    const rafIdRef = useRef<number | null>(null);

    // what we want React to render next frame
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
        console.log("pointerDownRef.current: ", pointerDownRef.current);
        if (rafIdRef.current != null) return;
        rafIdRef.current = requestAnimationFrame(() => {

            rafIdRef.current = null;

            const p = pendingRef.current;

            setPanX(p.panX);
            setPanY(p.panY);
            panXRef.current = p.panX;
            panYRef.current = p.panY;
            setSwipeX(p.swipeX);
            setSwipeY(p.swipeY);
            setExitScale(p.exitScale);
            setZoomScale(p.zoomScale);
            zoomScaleRef.current = p.zoomScale; // necessary? maybe not
            setBackdropOpacity(p.backdropOpacity);
            setImageOpacity(p.imageOpacity);
        });
    };

    const regulatePanAndZoom = () => {
        const nextZoomUnclamped = zoomScaleRef.current;
        const nextZoomClamped = clamp(nextZoomUnclamped, MIN_ZOOM, MAX_ZOOM);
        const zoomWasClamped = nextZoomClamped !== nextZoomUnclamped;

        // 1) Commit zoom first (always)
        pendingRef.current.zoomScale = nextZoomClamped;

        // 2) Compute bounds for *nextZoom* (don’t depend on useLayoutEffect timing)
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

        // 3) Choose pan source
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
            desiredPanX = panXRef.current;
            desiredPanY = panYRef.current;
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
        document.body.style.overflow = "hidden"; // lock scroll when open
    };

    const close = () => {
        if (!isOpen || isClosing) return;

        setIsClosing(true);
        const vh =
            typeof window !== "undefined"
                ? window.innerHeight || document.documentElement.clientHeight || 0
                : 0;
        setSwipeY((prevY) => {
            if (prevY === 0) {
                // If there was no vertical drag (e.g. close button / Esc)
                return 0;
            }
            return prevY < 0 ? -vh : vh;
        });
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
        if (zoomScaleRef.current > 1) {
            console.log("zoom - zoomScaleRef.current > 1");
            pendingRef.current.zoomScale = MIN_ZOOM;
        } else {
            console.log("zoom - zoomScaleRef.current <= 1");
            pendingRef.current.zoomScale = MAX_ZOOM;
        }
        scheduleFlush();
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

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isClosing) return;
        e.preventDefault();

        const evCache = evCacheRef.current;
        evCache.push(toCachedPointer(e));
        const isPinching =
            evCache.length === 2 &&
            evCache.every((ev) => ev.pointerType === "touch");

        if (evCache.length > MAX_TOUCH_POINTS) {
            // Too many touch points: treat this as a cancelled gesture
            evCache.length = 0;
            pointerDownRef.current = false;
            pinchingRef.current = false;
            swipingXRef.current = false;
            swipingYRef.current = false;
            noLongerPinchingRef.current = false;
        } else {
            // capture pointer so moves outside the image still report to this element
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            pointerDownRef.current = true;
            noLongerPinchingRef.current = false;
            swipingXRef.current = false;
            swipingYRef.current = false;
            startXRef.current = e.clientX;
            startYRef.current = e.clientY;

            if (zoomScaleRef.current > 1) {
                panXStartRef.current = panXRef.current;
                panYStartRef.current = panYRef.current;
            }

            if (isPinching) {
                pinchingRef.current = true;
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // maybe set draggingRef to false if isNoLongerPinching in handlePointerUp?
        if (isClosing || !pointerDownRef.current) return;
        const evCache = evCacheRef.current;
        upsertCachedPointer(evCache, e);

        const isPinching = pinchingRef.current;
        const isZoomedIn = zoomScaleRef.current > 1;

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
            if (!swipingXRef.current && !swipingYRef.current) {
                const maxDelta = Math.max(absX, absY);

                if (maxDelta < DRAG_LOCK_THRESHOLD) {
                    return;
                }

                if (absX > absY) {
                    swipingXRef.current = true;
                } else {
                    swipingYRef.current = true;
                }
            }

            if (swipingXRef.current) {
                pendingRef.current.swipeX = deltaX;
                pendingRef.current.swipeY = 0;
            } else if (swipingYRef.current) {
                pendingRef.current.swipeY = deltaY;
                pendingRef.current.swipeX = 0;
            }

            scheduleFlush();

        } else if (isPinching) {
            // If two pointers are down, check for pinch gestures
            const [p1, p2] = evCache;
            if (!p1 || !p2) return;

            const t1 = p1.targetEl;
            const t2 = p2.targetEl;
            const bothOnZoomable =
                !!t1?.closest("[data-zoomable='true']") &&
                !!t2?.closest("[data-zoomable='true']");

            if (!bothOnZoomable) {
                // Fingers aren’t both on the image — ignore pinch, maybe treat as drag or do nothing
                return;
            }

            const img = imageRef.current;
            if (!img) return;
            const imgRect = img.getBoundingClientRect();

            // X & Y midpoints between pinching fingers (screen space)
            const pinchCenterX = (p1.clientX + p2.clientX) / 2;
            const pinchCenterY = (p1.clientY + p2.clientY) / 2;
            lastPinchCenterRef.current = { x: pinchCenterX, y: pinchCenterY };

            // Distance between the two pointers
            const curPinchDist = Math.hypot(
                p1.clientX - p2.clientX,
                p1.clientY - p2.clientY
            );

            // First pinch frame – initialize baseline
            if (pinchStartDistanceRef.current === null) {
                pinchStartDistanceRef.current = curPinchDist;
                pinchStartZoomRef.current = zoomScaleRef.current;

                const pinchStartBaseZoom = pinchStartZoomRef.current || 1;

                // Current translation before pinch (same logic as render)
                const pinchStartPanX = isZoomedIn ? panXRef.current : 0;
                const pinchStartPanY = isZoomedIn ? panYRef.current : swipeY;

                // --- Center-based model ---------------------------------------
                // We treat the image center on screen as our primary "position".
                // With transform-origin: 50% 50%, scaling happens around the center.
                //
                // Let:
                //   Or0 = (originStartX, originStartY)  = image origin on screen at pinch start
                //   z0 = pinchStartBaseZoom            = zoom at pinch start
                //   P0 = (pinchCenterX, pinchCenterY)  = pinch center on screen at pinch start
                //
                // In the "image-centered" local coords p (origin at image center):
                //   screenPoint = Or + z * p
                //
                // For the anchor point under the fingers at pinch start:
                //   P0 = Or0 + z0 * p_anchor
                //   => p_anchor = (P0 - Or0) / z0
                //
                // Later, for new zoom z1, to keep that same p_anchor under the
                // (updated) pinch center P:
                //   P = Or1 + z1 * p_anchor
                //   => Or1 = P - z1 * p_anchor
                //
                // We don't store Or1 directly as state; we still store panX/panY.
                // At pinch start, the relationship is:
                //   Or0 = L0 + pinchStartPan
                // where L0 is some fixed "layout center" we don't need explicitly.
                // Rearranging:
                //   L0 = Or0 - pinchStartPan
                //
                // For the new origin Or1:
                //   panNext = Or1 - L0 = pinchStartPan + (Or1 - Or0)
                //
                // So we store:
                //   - Or0 in pinchOriginRef
                //   - pinchStartPan in pinchStartPanRef
                //   - p_anchor in pinchAnchorRef (anchor in image-centered coords)
                //-----------------------------------------------------------------

                // Image origin (center when transform-origin: 50% 50%) on screen at pinch start
                const originStartX = imgRect.left + imgRect.width / 2;
                const originStartY = imgRect.top + imgRect.height / 2;

                // Store origin-at-start (Or0)
                pinchOriginRef.current = { x: originStartX, y: originStartY };

                // Store pan-at-start (pinchStartPan)
                pinchStartPanRef.current = { x: pinchStartPanX, y: pinchStartPanY };

                // Anchor in image-centered local coords:
                // p_anchor = (P0 - Or0) / z0
                const anchorX = (pinchCenterX - originStartX) / pinchStartBaseZoom;
                const anchorY = (pinchCenterY - originStartY) / pinchStartBaseZoom;
                pinchAnchorRef.current = { x: anchorX, y: anchorY };

                // Initialize pinch translation to whatever we had
                pendingRef.current.panX = pinchStartPanX;
                pendingRef.current.panY = pinchStartPanY;
                scheduleFlush();
            } else {
                const pinchStartDist = pinchStartDistanceRef.current;
                const baseZoom = pinchStartZoomRef.current;
                const anchor = pinchAnchorRef.current;
                const originStart = pinchOriginRef.current;      // Or0
                const pinchStartPan = pinchStartPanRef.current;    // pinchStartPan

                if (
                    !pinchStartDist ||
                    !baseZoom ||
                    !anchor ||
                    !originStart ||
                    !pinchStartPan
                ) {
                    return;
                }

                // New zoom from pinch
                const scaleFactor = curPinchDist / pinchStartDist;
                const nextZoomUnclamped = baseZoom * scaleFactor;

                if (nextPanUnclampedForClampedZoom.current === null && nextZoomUnclamped > MAX_ZOOM) {
                    console.log("nextPanUnclampedForClampedZoom.current === null && nextZoomUnclamped > MAX_ZOOM");
                    const nextZoomPreclamped = clamp(nextZoomUnclamped, MIN_ZOOM, MAX_ZOOM);

                    const originNextXForClampedZoom = pinchCenterX - nextZoomPreclamped * anchor.x;
                    const originNextYForClampedZoom = pinchCenterY - nextZoomPreclamped * anchor.y;

                    const originDeltaXForClampedZoom = originNextXForClampedZoom - originStart.x;
                    const originDeltaYForClampedZoom = originNextYForClampedZoom - originStart.y;

                    nextPanUnclampedForClampedZoom.current = {
                        x: pinchStartPan.x + originDeltaXForClampedZoom,
                        y: pinchStartPan.y + originDeltaYForClampedZoom,
                    };
                    console.log("(where it is supposed to be set) nextPanUnclampedForClampedZoom.current: ", nextPanUnclampedForClampedZoom.current);

                }

                // Center-based update:
                //   Or1 = P - z1 * p_anchor
                const originNextX = pinchCenterX - nextZoomUnclamped * anchor.x;
                const originNextY = pinchCenterY - nextZoomUnclamped * anchor.y;

                // panNext = pinchStartPan + (Or1 - Or0)
                const originDeltaX = originNextX - originStart.x;
                const originDeltaY = originNextY - originStart.y;

                const nextPanXUnclamped = pinchStartPan.x + originDeltaX;
                const nextPanYUnclamped = pinchStartPan.y + originDeltaY;

                pendingRef.current.panX = nextPanXUnclamped;
                pendingRef.current.panY = nextPanYUnclamped;
                pendingRef.current.zoomScale = nextZoomUnclamped;
                scheduleFlush();
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isClosing || !pointerDownRef.current) return;
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
        const isZoomedIn = zoomScaleRef.current > 1;

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
                const deltaX = swipingYRef.current ? 0 : e.clientX - startXRef.current;
                const deltaY = swipingXRef.current ? 0 : e.clientY - startYRef.current;
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                if (swipingYRef.current && absY > DRAG_CLOSE_THRESHOLD) {
                    // Closing (drag-y)
                    close();
                } else if (swipingXRef.current && absX > SWIPE_IMAGE_CHANGE_THRESHOLD) {
                    // Swiping (drag-x)
                    setSwipeDirection(deltaX > 0 ? "prev" : "next");
                } else {
                    // Snap back (either direction)
                    setSwipeDirection(null);
                    pendingRef.current.swipeX = 0;
                    pendingRef.current.swipeY = 0;
                    scheduleFlush();
                }
            }
        }

        // Reset other stuff only when no pointers are left (gesture is over)
        if (evCache.length === 0) {
            pointerDownRef.current = false;
            regulatePanAndZoom(); // does setZoomScale + setPanX/Y
            // nextPanUnclampedForClampedZoom.current = null;
            swipingXRef.current = false;
            swipingYRef.current = false;
            pinchingRef.current = false;
            noLongerPinchingRef.current = false;
        }
        // Reset pinch-specific stuff regardless
        pinchAnchorRef.current = null;
        pinchStartDistanceRef.current = null;
    };

    const handleTrackTransitionEnd = (
        e: React.TransitionEvent<HTMLDivElement>
    ) => {
        // Only care about transform finishing:
        if (e.propertyName !== "transform") return;

        // If we're not in a swipe animation, ignore.
        if (!swipeDirection) return;

        // Commit the index change
        if (swipeDirection === "prev") {
            showPrev();
        } else if (swipeDirection === "next") {
            showNext();
        }
    };

    useEffect(() => {
        if (!isOpen || isClosing) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowLeft") showPrev();
            if (e.key === "ArrowRight") showNext();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, isClosing, currentIndex, images.length]);

    ////
    // Final derived offsets:
    ////
    const currentImage = currentIndex !== null ? images[currentIndex] : null;
    const isZoomedIn = zoomScaleRef.current > 1;
    const isPinching = pinchingRef.current;
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

            {/* Lightbox overlay goes into <body> via portal */}
            {isOpen && currentImage && (
                <LightboxPortal>
                    <div
                        ref={containerRef}
                        className="fixed inset-0 z-[999] flex flex-col items-stretch justify-between overflow-hidden select-none touch-none"
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
                            className="flex flex-row"
                        >
                            {/* Zoom */}
                            <div className="px-4 flex justify-end">
                                <button
                                    disabled={isClosing}
                                    type="button"
                                    onClick={zoom}
                                    className="py-4 text-white/70 hover:text-white text-sm uppercase tracking-wide cursor-pointer"
                                    style={{
                                        opacity: imageOpacity,
                                        transition: pointerDownRef.current
                                            ? "none"
                                            : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                    }}
                                >
                                    Zoom
                                </button>
                            </div>

                            {/* Close */}
                            <div className="px-4 flex justify-end">
                                <button
                                    disabled={isClosing}
                                    type="button"
                                    onClick={close}
                                    className="py-4 text-white/70 hover:text-white text-sm uppercase tracking-wide cursor-pointer"
                                    style={{
                                        opacity: imageOpacity,
                                        transition: pointerDownRef.current
                                            ? "none"
                                            : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                    }}
                                >
                                    Close ✕
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
                                        setSwipeDirection("prev");
                                    }}
                                    className="absolute left-3 top-1/2 hidden sm:flex items-center justify-center rounded-full border border-white/40 bg-black/40 px-2 py-2 text-white hover:bg-black/60 cursor-pointer z-1"
                                    style={{
                                        opacity: imageOpacity,
                                        transition: pointerDownRef.current
                                            ? "none"
                                            : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                    }}
                                    aria-label="Previous image"
                                >
                                    ←
                                </button>
                                <button
                                    disabled={isClosing}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSwipeDirection("next");
                                    }}
                                    className="absolute right-3 top-1/2 hidden sm:flex items-center justify-center rounded-full border border-white/40 bg-black/40 px-2 py-2 text-white hover:bg-black/60 cursor-pointer z-1"
                                    style={{
                                        opacity: imageOpacity,
                                        transition: pointerDownRef.current
                                            ? "none"
                                            : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                    }}
                                    aria-label="Next image"
                                >
                                    →
                                </button>
                            </>
                        )}

                        {/* Image track: prev | current | next */}
                        <div
                            // ref={containerRef}
                            id="carousel-container"
                            className="grow-2 relative flex overflow-x-visible w-screen"
                        >
                            <div
                                id="image-carousel"
                                className="flex"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onTransitionEnd={handleTrackTransitionEnd}
                                style={{
                                    transform: swipingXRef.current
                                        ? `translateX(calc(-100vw + ${swipeX}px))`
                                        : swipeDirection === "prev"
                                            ? "translateX(0vw)"
                                            : swipeDirection === "next"
                                                ? "translateX(-200vw)"
                                                : "translateX(-100vw)",
                                    transition: pointerDownRef.current || swipeDirection === null
                                        ? "none"
                                        : `transform ${BACKDROP_FADE_DURATION}ms ease-out`,
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
                                                transition: pointerDownRef.current
                                                    ? "none"
                                                    : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Current slide (center) */}
                                <div className="flex items-center justify-center w-screen ">
                                    <img
                                        id="current-image"
                                        ref={imageRef}
                                        src={currentImage.src}
                                        alt={currentImage.alt ?? ""}
                                        data-zoomable="true"
                                        className={`max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20  
                                            ${zoomScaleRef.current > 1 ? "cursor-move" : "cursor-grab active:cursor-grabbing"}`}
                                        style={{
                                            // transformOrigin: "0 0",
                                            transformOrigin: "50% 50%",
                                            transform: `translate(${imgTx}px, ${imgTy}px) scale(${exitScale * zoomScale})`,
                                            opacity: imageOpacity,
                                            transition: pointerDownRef.current
                                                ? "none"
                                                : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                        }}
                                        onLoad={() => {
                                            const img = imageRef.current;
                                            if (!img) return;

                                            // base size is the displayed size at zoom=1 (object-contain, max-h, etc.)
                                            const r = img.getBoundingClientRect();
                                            baseImgWRef.current = r.width;
                                            baseImgHRef.current = r.height;
                                        }}
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
                                                transition: pointerDownRef.current
                                                    ? "none"
                                                    : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Caption + index */}
                        <div
                            className="mt-3 px-4 py-4 flex items-stretch justify-between text-xs text-white/70"
                            style={{
                                opacity: imageOpacity,
                                transition: pointerDownRef.current
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
            )}
        </>
    );
};