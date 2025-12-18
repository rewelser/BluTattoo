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

const LightboxPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (typeof document === "undefined") return null; // SSR guard
    return ReactDOM.createPortal(children, document.body);
};

export const ArtistGallery: React.FC<ArtistGalleryProps> = ({ images = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [currentIndex, setCurrentIndex] = useState<number | null>(null);
    const prevIndex =
        currentIndex !== null ? (currentIndex - 1 + images.length) % images.length : null;
    const nextIndex =
        currentIndex !== null ? (currentIndex + 1) % images.length : null;
    const [translateX, setTranslateX] = useState(0);
    const [translateY, setTranslateY] = useState(0); // was zero; might should still be zero--see note about "0 * i = 0"
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const panXRef = useRef(0);
    const panYRef = useRef(0);
    const panXStartRef = useRef(0);
    const panYStartRef = useRef(0);
    const containerRef = useRef<HTMLDivElement | null>(null); // should get viewport values a different way
    const imageRef = useRef<HTMLImageElement | null>(null);
    // const maxPanXRef = useRef(0);
    // const maxPanYRef = useRef(0);

    const minPanXRef = useRef(0);
    const maxPanXRef = useRef(0);
    const minPanYRef = useRef(0);
    const maxPanYRef = useRef(0);
    const [exitScale, setExitScale] = useState(1);
    const [backdropOpacity, setBackdropOpacity] = useState(1);
    const [imageOpacity, setImageOpacity] = useState(1);
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const pinchRef = useRef(false);
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartZoomRef = useRef(1);
    const pinchAnchorRef = useRef<{ x: number; y: number } | null>(null);
    const [pinchTranslateX, setPinchTranslateX] = useState(0);
    const [pinchTranslateY, setPinchTranslateY] = useState(0);
    const pinchTranslateXRef = useRef(0);
    const pinchTranslateYRef = useRef(0);
    const draggingRef = useRef(false);
    const draggingXRef = useRef(false);
    const draggingYRef = useRef(false);
    const [swipeDirection, setSwipeDirection] = useState<"prev" | "next" | null>(null);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    //pinchzoom
    const evCacheRef = useRef<React.PointerEvent[]>([]);

    if (!images || images.length === 0) return null;

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isClosing) return;
        e.preventDefault();

        const evCache = evCacheRef.current;
        evCache.push(e);
        // capture pointer so moves outside the image still report to this element
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        draggingRef.current = true;
        draggingXRef.current = false;
        draggingYRef.current = false;
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;

        if (zoomRef.current > 1) {
            panXStartRef.current = panXRef.current;
            panYStartRef.current = panYRef.current;
        }

        const isPinchGesture =
            evCache.length === 2 &&
            evCache.every((ev) => ev.pointerType === "touch");

        if (isPinchGesture) {
            pinchRef.current = true;
            console.log("pinchRef.current: ", pinchRef.current);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isClosing) return;
        // console.log("pointerMove");
        const evCache = evCacheRef.current;

        // Find this event in the cache and update its record with this event
        const index = evCache.findIndex(
            (cachedEv) => cachedEv.pointerId === e.pointerId,
        );
        if (index === -1) {
            evCache.push(e);
        } else {
            evCache[index] = e;
        }

        const isPinchGesture =
            evCache.length === 2 &&
            evCache.every((ev) => ev.pointerType === "touch");

        if (!isPinchGesture) {
            // panning a zoomed image
            if (zoomRef.current > 1) {
                console.log("draggingRef.current: ", draggingRef.current);
                if (!draggingRef.current) return;
                console.log("is panning");

                const deltaX = e.clientX - startXRef.current;
                const deltaY = e.clientY - startYRef.current;
                const rawPanX = panXStartRef.current + deltaX;
                const rawPanY = panYStartRef.current + deltaY;
                const maxX = maxPanXRef.current;
                const maxY = maxPanYRef.current;
                const clampedX = clamp(rawPanX, -maxX, maxX);
                const clampedY = clamp(rawPanY, -maxY, maxY);
                panXRef.current = clampedX;
                panYRef.current = clampedY;
                setPanX(clampedX);
                setPanY(clampedY);
            } else {
                // else, dragging (x to swipe next/prev, or y to close)
                if (!draggingRef.current) return;
                console.log("is dragging");

                const deltaX = e.clientX - startXRef.current;
                const deltaY = e.clientY - startYRef.current;
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                // Determine if we are dragging horizontally or vertically
                if (!draggingXRef.current && !draggingYRef.current) {
                    const maxDelta = Math.max(absX, absY);

                    if (maxDelta < DRAG_LOCK_THRESHOLD) {
                        return;
                    }

                    if (absX > absY) {
                        draggingXRef.current = true;
                    } else {
                        draggingYRef.current = true;
                    }
                }

                if (draggingXRef.current) {
                    setTranslateX(deltaX);
                    setTranslateY(0);
                } else if (draggingYRef.current) {
                    setTranslateY(deltaY);
                    setTranslateX(0);
                }
            }
        }
        ////// pinchzoom stuff
        // If two pointers are down, check for pinch gestures
        else if (isPinchGesture) {
            const [ev1, ev2] = evCache;
            const t1 = ev1.target as HTMLElement;
            const t2 = ev2.target as HTMLElement;
            const bothOnZoomable =
                t1.closest("[data-zoomable='true']") &&
                t2.closest("[data-zoomable='true']");

            if (!bothOnZoomable) {
                // Fingers aren’t both on the image — ignore pinch, maybe treat as drag or do nothing
                return;
            }

            // X & Y midpoints between pinching fingers
            const pinchCenterX = (ev1.clientX + ev2.clientX) / 2;
            const pinchCenterY = (ev1.clientY + ev2.clientY) / 2;

            // Calculate the distance between the two pointers
            const curPinchDist = Math.hypot(ev1.clientX - ev2.clientX, ev1.clientY - ev2.clientY);

            // First pinch frame – initialize baseline
            if (pinchStartDistanceRef.current === null) {
                pinchStartDistanceRef.current = curPinchDist;
                pinchStartZoomRef.current = zoomRef.current;

                const pinchStartBaseZoom = pinchStartZoomRef.current || 1;

                // Current translation before pinch (same logic as render)
                const isZoomedInNow = zoomRef.current > 1;
                const currentTx = isZoomedInNow ? panXRef.current : 0;
                const currentTy = isZoomedInNow ? panYRef.current : translateY;

                // Compute anchor point in image coordinates under pinch center
                const anchorX = (pinchCenterX - currentTx) / pinchStartBaseZoom;
                const anchorY = (pinchCenterY - currentTy) / pinchStartBaseZoom;
                pinchAnchorRef.current = { x: anchorX, y: anchorY };

                // Initialize pinch translation to whatever we had
                setPinchTranslateX(currentTx);
                setPinchTranslateY(currentTy);
                pinchTranslateXRef.current = currentTx;
                pinchTranslateYRef.current = currentTy;
                return;
            }

            const pinchStartDist = pinchStartDistanceRef.current;
            const baseZoom = pinchStartZoomRef.current;
            if (!pinchStartDist || !baseZoom) return;

            const scaleFactor = curPinchDist / pinchStartDist;
            const nextZoomUnclamped = baseZoom * scaleFactor;

            const anchor = pinchAnchorRef.current;
            if (!anchor) return;

            // New translation so that the anchor point stays under the *current* pinch center
            const newTx = pinchCenterX - anchor.x * nextZoomUnclamped;
            const newTy = pinchCenterY - anchor.y * nextZoomUnclamped;

            setPinchTranslateX(newTx);
            setPinchTranslateY(newTy);
            pinchTranslateXRef.current = newTx;
            pinchTranslateYRef.current = newTy;

            setZoom(nextZoomUnclamped);
            zoomRef.current = nextZoomUnclamped;
        }
        console.log("pinchRef.current: ", pinchRef.current);

    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isClosing) return;
        console.log("pointerUp");
        e.preventDefault();

        const evCache = evCacheRef.current;
        const isPinchGesture =
            evCache.length === 2 &&
            evCache.every((ev) => ev.pointerType === "touch");

        // Remove this event from the cache
        const index = evCache.findIndex(
            (cachedEv) => cachedEv.pointerId === e.pointerId
        );
        if (index > -1) {
            evCache.splice(index, 1);
        }

        if (isPinchGesture) {
            printStuff("PINCH");
            const nextZoom = clamp(zoomRef.current, MIN_ZOOM, MAX_ZOOM);
            setZoom(nextZoom);
            zoomRef.current = nextZoom;

            if (zoomRef.current <= 1) {
                // Zoomed all the way out – recenter/reset pan
                maxPanXRef.current = 0;
                maxPanYRef.current = 0;
                panXRef.current = 0;
                panYRef.current = 0;
                setPanX(0);
                setPanY(0);
            } else {
                // Still zoomed in – commit pinch translation into pan
                panXRef.current = pinchTranslateXRef.current;
                panYRef.current = pinchTranslateYRef.current;
                setPanX(pinchTranslateXRef.current);
                setPanY(pinchTranslateYRef.current);
            }

            // Reset pinch-specific stuff
            setPinchTranslateX(0);
            setPinchTranslateY(0);
            pinchAnchorRef.current = null;
            pinchStartDistanceRef.current = null;
        } else if (!isPinchGesture) {
            // Then must be:
            // - (1) single-finger drag (drag-x or drag-y to swipe or close on release)
            // - (2) single-finger pan on zoomed image

            pinchStartDistanceRef.current = null;
            pinchStartZoomRef.current = zoomRef.current;

            if (zoomRef.current <= 1) {
                // Not zoomed in, so we did (1) single-finger drag (drag-x or drag-y to swipe or close on release)
                if (!draggingRef.current) return;

                const deltaX = draggingYRef.current ? 0 : e.clientX - startXRef.current;
                const deltaY = draggingXRef.current ? 0 : e.clientY - startYRef.current;
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                if (draggingYRef.current && absY > DRAG_CLOSE_THRESHOLD) {
                    // Closing (drag-y)
                    close();
                } else if (draggingXRef.current && absX > SWIPE_IMAGE_CHANGE_THRESHOLD) {
                    // Swiping (drag-x)
                    if (deltaX > 0) {
                        setSwipeDirection("prev");
                    } else {
                        setSwipeDirection("next");
                    }
                } else {
                    // Snap back (either direction)
                    setSwipeDirection(null);
                    setTranslateX(0);
                    setTranslateY(0);
                    setBackdropOpacity(1);
                    setImageOpacity(1);
                }
            }
        }
        draggingRef.current = false;
        draggingXRef.current = false;
        draggingYRef.current = false;
        pinchRef.current = false;
    };

    const openAt = (index: number) => {
        setCurrentIndex(index);
        setIsOpen(true);
        setIsClosing(false);
        setTranslateX(0);
        setTranslateY(0);
        setBackdropOpacity(1);
        setImageOpacity(1);
        setExitScale(1);
        setZoom(1);
        zoomRef.current = 1;
        document.body.style.overflow = "hidden"; // lock scroll when open
    };

    const close = () => {
        if (!isOpen || isClosing) return;

        setIsClosing(true);
        const vh =
            typeof window !== "undefined"
                ? window.innerHeight || document.documentElement.clientHeight || 0
                : 0;

        setTranslateY((prevY) => {
            console.log("prevY: ", prevY);
            if (prevY === 0) {
                // If there was no vertical drag (e.g. close button / Esc)
                return 0;
            }
            return prevY < 0 ? -vh : vh;
        });

        console.log("setIsClosing");
        setBackdropOpacity(0);
        setImageOpacity(0);
        setExitScale(2);

        window.setTimeout(() => {
            setIsOpen(false);
            setCurrentIndex(null);
            setIsClosing(false);
            setBackdropOpacity(1);
            setImageOpacity(1);
            setPinchTranslateX(0);
            setPinchTranslateY(0);
            setTranslateX(0);
            setTranslateY(0);
            setExitScale(1);
            printStuff("close:setTimeout");
            document.body.style.overflow = ""; // restore scroll
        }, BACKDROP_FADE_DURATION);
    };

    const zoomBtn = () => {
        if (zoomRef.current > 1) {
            setZoom(MIN_ZOOM);
            zoomRef.current = MIN_ZOOM;
        } else {
            setZoom(MAX_ZOOM);
            zoomRef.current = MAX_ZOOM;
        }
    }

    const showPrev = () => {
        if (currentIndex === null) return;
        setCurrentIndex((prev) => {
            if (prev === null) return prev;
            return (prev - 1 + images.length) % images.length;
        });
        setSwipeDirection(null);
        setTranslateX(0);
    };

    const showNext = () => {
        if (currentIndex === null) return;
        setCurrentIndex((prev) => {
            if (prev === null) return prev;
            return (prev + 1) % images.length;
        });
        setSwipeDirection(null);
        setTranslateX(0);
    };

    useLayoutEffect(() => {
        if (!isOpen) return;

        const container = containerRef.current;
        const img = imageRef.current;

        if (!container || !img) return;

        const containerRect = container.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();

        // At current zoom, these rects already reflect scaled sizes.
        const imgW = imgRect.width;
        const imgH = imgRect.height;
        const viewportW = containerRect.width;
        const viewportH = containerRect.height;

        const extraW = Math.max(0, imgW - viewportW);
        const extraH = Math.max(0, imgH - viewportH);

        maxPanXRef.current = (extraW / 2) + 30;
        maxPanYRef.current = (extraH / 2) + 30;

        // console.log("///////////////////");
        console.log("imgW: ", imgRect.width);
        console.log("imgH: ", imgRect.height);
        console.log("viewportW: ", containerRect.width);
        console.log("viewportH: ", containerRect.height);
        console.log("extraW: ", extraW);
        console.log("extraH: ", extraH);
        console.log("maxPanXRef.current: ", maxPanXRef.current);
        console.log("maxPanYRef.current: ", maxPanYRef.current);

    }, [zoom, isOpen]);

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

    const printStuff = (func: string, printDragData?: boolean) => {
        console.log("//////////");
        console.log(func);
        if (printDragData) {
            console.log("currentImage: ", currentImage);
            console.log("currentIndex: ", currentIndex);
            console.log("draggingXRef.current: ", draggingXRef.current);
            console.log("draggingRef.current: ", draggingRef.current);
        }
    }

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
    const isZoomedIn = zoomRef.current > 1;
    const isPinching = pinchRef.current;
    let imgTx = 0;
    let imgTy = 0;

    if (isPinching) {
        // 3) Pinch-dragging: use pinchTranslateX/Y
        imgTx = pinchTranslateX;
        imgTy = pinchTranslateY;
    } else if (isZoomedIn) {
        // 2) Zoomed in, not pinching: use panX/panY
        imgTx = panX;
        imgTy = panY;
    } else {
        // 1) Zoomed out, not pinching:
        //    horizontal swipe is handled by the carousel,
        //    so image only needs vertical translateY for drag-to-close.
        imgTx = 0;
        imgTy = translateY;
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
                        className="fixed inset-0 z-[999] flex flex-col items-stretch justify-between"
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

                        {/* Zoom */}
                        <div className="px-4 flex justify-end">
                            <button
                                disabled={isClosing}
                                type="button"
                                onClick={zoomBtn}
                                className="py-4 text-white/70 hover:text-white text-sm uppercase tracking-wide cursor-pointer"
                                style={{
                                    opacity: imageOpacity,
                                    transition: draggingRef.current
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
                                    transition: draggingRef.current
                                        ? "none"
                                        : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                }}
                            >
                                Close ✕
                            </button>
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
                                        transition: draggingRef.current
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
                                        transition: draggingRef.current
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
                            ref={containerRef}
                            id="carousel-container"
                            className="grow-2 relative flex overflow-x-visible w-screen"
                        >
                            <div
                                id="image-carousel"
                                className="flex touch-none"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onTransitionEnd={handleTrackTransitionEnd}
                                style={{
                                    transform: draggingXRef.current
                                        ? `translateX(calc(-100vw + ${translateX}px))`
                                        : swipeDirection === "prev"
                                            ? "translateX(0vw)"
                                            : swipeDirection === "next"
                                                ? "translateX(-200vw)"
                                                : "translateX(-100vw)",
                                    // transition: draggingRef.current
                                    transition: draggingRef.current || swipeDirection === null
                                        ? "none"
                                        : `transform ${BACKDROP_FADE_DURATION}ms ease-out`,
                                }}
                            >
                                {/* Prev slide (off to the left) */}
                                {prevIndex !== null && (
                                    <div className="flex items-center justify-center w-screen">
                                        <img
                                            src={images[prevIndex].src}
                                            alt={images[prevIndex].alt ?? ""}
                                            className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                                            // no pointer handlers on neighbors
                                            style={{
                                                transform: `translateY(${translateY}px)`,
                                                opacity: imageOpacity,
                                                transition: draggingRef.current
                                                    ? "none"
                                                    : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Current slide (center) */}
                                <div className="flex items-center justify-center w-screen">
                                    <img
                                        id="current-image"
                                        ref={imageRef}
                                        src={currentImage.src}
                                        alt={currentImage.alt ?? ""}
                                        data-zoomable="true"
                                        className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                                        style={{
                                            transformOrigin: "0 0",
                                            transform: `translate(${imgTx}px, ${imgTy}px) scale(${exitScale * zoom})`,
                                            opacity: imageOpacity,
                                            transition: draggingRef.current
                                                ? "none"
                                                : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out, scale ${BACKDROP_FADE_DURATION}ms ease-out`,
                                        }}
                                    />

                                </div>

                                {/* Next slide (off to the right) */}
                                {nextIndex !== null && (
                                    <div className="flex items-center justify-center w-screen">
                                        <img
                                            src={images[nextIndex].src}
                                            alt={images[nextIndex].alt ?? ""}
                                            className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                                            style={{
                                                transform: `translateY(${translateY}px)`,
                                                opacity: imageOpacity,
                                                transition: draggingRef.current
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
                                transition: draggingRef.current
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