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
    const maxPanXRef = useRef(0);
    const maxPanYRef = useRef(0);
    const minPanXRef = useRef(0);
    const minPanYRef = useRef(0);
    const [exitScale, setExitScale] = useState(1);
    const [backdropOpacity, setBackdropOpacity] = useState(1);
    const [imageOpacity, setImageOpacity] = useState(1);
    const [zoomScale, setZoomScale] = useState(1);
    const zoomScaleRef = useRef(1);
    const pinchingRef = useRef(false);
    const noLongerPinchingRef = useRef(false);
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartZoomRef = useRef(1);
    const pinchBaseTopLeftRef = useRef<{ x: number; y: number } | null>(null);
    const pinchAnchorRef = useRef<{ x: number; y: number } | null>(null);
    const pinchOriginRef = useRef<{ x: number; y: number } | null>(null);
    const pointerDownRef = useRef(false);
    const swipingXRef = useRef(false);
    const swipingYRef = useRef(false);
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

        // Find this event in the cache and update its record with this event
        const index = evCache.findIndex(
            (cachedEv) => cachedEv.pointerId === e.pointerId,
        );
        if (index === -1) {
            evCache.push(e);
        } else {
            evCache[index] = e;
        }

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
            panXRef.current = nextPanXUnclamped;
            panYRef.current = nextPanYUnclamped;
            setPanX(nextPanXUnclamped);
            setPanY(nextPanYUnclamped);
        } else if (!isPinching && !isZoomedIn) {
            // Dragging (x to swipe next/prev, or y to close)

            const deltaX = e.clientX - startXRef.current;
            const deltaY = e.clientY - startYRef.current;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            // Determine if we are dragging horizontally or vertically
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
                setTranslateX(deltaX);
                setTranslateY(0);
            } else if (swipingYRef.current) {
                setTranslateY(deltaY);
                setTranslateX(0);
            }

        } else if (isPinching) {
            // If two pointers are down, check for pinch gestures
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

            const img = imageRef.current;
            if (!img) return;
            const imgRect = img.getBoundingClientRect();

            // X & Y midpoints between pinching fingers
            const pinchCenterX = (ev1.clientX + ev2.clientX) / 2;
            const pinchCenterY = (ev1.clientY + ev2.clientY) / 2;

            // Calculate the distance between the two pointers
            const curPinchDist = Math.hypot(
                ev1.clientX - ev2.clientX,
                ev1.clientY - ev2.clientY
            );

            // First pinch frame – initialize baseline
            if (pinchStartDistanceRef.current === null) {
                pinchStartDistanceRef.current = curPinchDist;
                pinchStartZoomRef.current = zoomScaleRef.current;

                const pinchStartBaseZoom = pinchStartZoomRef.current || 1;

                // Current translation before pinch (same logic as render)
                const pinchStartPanX = isZoomedIn ? panXRef.current : 0;
                const pinchStartPanY = isZoomedIn ? panYRef.current : translateY;

                // --- Compute transform-origin in *local* coords (center of the unscaled image)
                // imgRect.* are after transform; divide by zoom to get local size
                const baseWidth = imgRect.width / pinchStartBaseZoom;
                const baseHeight = imgRect.height / pinchStartBaseZoom;

                const originX = baseWidth / 2;
                const originY = baseHeight / 2;
                pinchOriginRef.current = { x: originX, y: originY };

                // --- Compute the untransformed top-left L (where the image would be with zoom=1, pan=0)
                // We need a relationship between:
                // - imgRect.(left,top) (what the browser actually gives us after transforms),
                // - topLeft(x,y) (baseline top-left)
                // - pan(x,y)
                // - origin(x,y)
                // - zoom
                // The correct 1D formula for the top-left corner (local point (0,0)) when transform-origin is at (originX, originY) is:
                // rect.(left,top) = topLeft(x,y) + pan(x,y) + origin(x,y) * (1 - zoom)
                // ** (TOPLEFT IS THE SCREEN POSITION WHERE LAYOUT PUTS THE ELEMENT BEFORE TRANSFORMS.
                // SO ALTHOUGH IT IS A SCREEN POSITION, IT IS AS-YET UNTRANSFORMED. IT IS THE HALFWAY POINT BETWEEN
                // AN IMG-LOCAL POINT SUCH AS ANCHOR AND imgRect.(left,top). )
                const topLeftX = imgRect.left - pinchStartPanX - originX * (1 - pinchStartBaseZoom);
                const topLeftY = imgRect.top - pinchStartPanY - originY * (1 - pinchStartBaseZoom);
                pinchBaseTopLeftRef.current = { x: topLeftX, y: topLeftY };

                // Local coordinates (from top-left) of the point under the pinch center
                // From: pinchCenterX = rect.left + zoom * anchorX => anchorX = (pinchCenterX - rect.left) / zoom
                // const anchorX = (pinchCenterX - pinchStartPanX) / pinchStartBaseZoom;
                // const anchorY = (pinchCenterY - pinchStartPanY) / pinchStartBaseZoom;
                const anchorX = (pinchCenterX - imgRect.left) / pinchStartBaseZoom;
                const anchorY = (pinchCenterY - imgRect.top) / pinchStartBaseZoom;
                pinchAnchorRef.current = { x: anchorX, y: anchorY };

                // Initialize pinch translation to whatever we had
                setPanX(pinchStartPanX);
                setPanY(pinchStartPanY);
                panXRef.current = pinchStartPanX;
                panYRef.current = pinchStartPanY;
            } else {
                const pinchStartDist = pinchStartDistanceRef.current;
                const baseZoom = pinchStartZoomRef.current;
                const anchor = pinchAnchorRef.current;
                const origin = pinchOriginRef.current;
                const baseTopLeft = pinchBaseTopLeftRef.current;

                if (!pinchStartDist || !baseZoom || !anchor || !origin || !baseTopLeft) {
                    return;
                }

                // New zoom from pinch
                const scaleFactor = curPinchDist / pinchStartDist;
                const nextZoomUnclamped = baseZoom * scaleFactor;

                // New translation so that the anchor point stays under the *current* pinch center
                // const nextPanXUnclamped = pinchCenterX - anchor.x * nextZoomUnclamped;
                // const nextPanYUnclamped = pinchCenterY - anchor.y * nextZoomUnclamped;

                // From general mapping:
                // pinchCenterX = baseTopLeft.x + origin.x + panX + nextZoomUnclamped * (anchor.x - origin.x)
                // => panX = pinchCenterX - baseTopLeft.x - origin.x - nextZoomUnclamped * (anchor.x - origin.x)
                const nextPanXUnclamped = pinchCenterX - baseTopLeft.x - origin.x - nextZoomUnclamped * (anchor.x - origin.x);
                const nextPanYUnclamped = pinchCenterY - baseTopLeft.y - origin.y - nextZoomUnclamped * (anchor.y - origin.y);


                setPanX(nextPanXUnclamped);
                setPanY(nextPanYUnclamped);
                panXRef.current = nextPanXUnclamped;
                panYRef.current = nextPanYUnclamped;

                setZoomScale(nextZoomUnclamped);
                zoomScaleRef.current = nextZoomUnclamped;
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
            (cachedEv) => cachedEv.pointerId === e.pointerId
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
            // regulatePanAndZoom();
        } else if (isPinching) {
            noLongerPinchingRef.current = false;
            // regulatePanAndZoom();
        } else if (!isPinching && !wasPinching) {
            noLongerPinchingRef.current = false;

            // Then must be:
            // - (1) single-pointer drag (drag-x or drag-y to swipe or close on release)
            // - (2) single-pointer pan on zoomed image

            // regulatePanAndZoom();

            if (!isZoomedIn) {
                // We did (1) single-finger drag-x or -y, so sqipe or close on release

                const deltaX = swipingYRef.current ? 0 : e.clientX - startXRef.current;
                const deltaY = swipingXRef.current ? 0 : e.clientY - startYRef.current;
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                if (swipingYRef.current && absY > DRAG_CLOSE_THRESHOLD) {
                    // Closing (drag-y)
                    close();
                } else if (swipingXRef.current && absX > SWIPE_IMAGE_CHANGE_THRESHOLD) {
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
                }
            }
        }
        // Reset pinch-specific stuff regardless
        pinchAnchorRef.current = null;
        pinchStartDistanceRef.current = null;

        // Reset other stuff only when no pointers are left (gesture is over)
        if (evCache.length === 0) {
            pointerDownRef.current = false;
            swipingXRef.current = false;
            swipingYRef.current = false;
            pinchingRef.current = false;
            noLongerPinchingRef.current = false;
        }
    };

    // old
    const regulatePanAndZoom = () => {
        console.log("regulatePanAndZoom");
        // Clamp zoom in any case
        const nextZoomClamped = clamp(zoomScaleRef.current, MIN_ZOOM, MAX_ZOOM);
        setZoomScale(nextZoomClamped);
        zoomScaleRef.current = nextZoomClamped;

        if (zoomScaleRef.current > 1) {
            // Zoomed in - clamp pan
            const minPanX = minPanXRef.current;
            const maxPanX = maxPanXRef.current;
            const minPanY = minPanYRef.current;
            const maxPanY = maxPanYRef.current;
            const nextPanXClamped = clamp(panXRef.current, minPanX, maxPanX);
            console.log("panXRef.current: " + panXRef.current + ", minPanX: " + minPanX + ", maxPanX: " + maxPanX);
            const nextPanYClamped = clamp(panYRef.current, minPanY, maxPanY);
            console.log("panXRef.current: " + panYRef.current + ", minPanY: " + minPanY + ", maxPanY: " + maxPanY);

            panXRef.current = nextPanXClamped;
            panYRef.current = nextPanYClamped;
            setPanX(nextPanXClamped);
            setPanY(nextPanYClamped);
        } else {
            // Zoomed all the way out or more – recenter/reset pan
            maxPanXRef.current = 0;
            maxPanYRef.current = 0;
            minPanXRef.current = 0;
            minPanXRef.current = 0;
            panXRef.current = 0;
            panYRef.current = 0;
            setPanX(0);
            setPanY(0);
        }
    }

    const openAt = (index: number) => {
        setCurrentIndex(index);
        setIsOpen(true);
        setIsClosing(false);
        setTranslateX(0);
        setTranslateY(0);
        setBackdropOpacity(1);
        setImageOpacity(1);
        setExitScale(1);
        setZoomScale(1);
        zoomScaleRef.current = 1;
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
            if (prevY === 0) {
                // If there was no vertical drag (e.g. close button / Esc)
                return 0;
            }
            return prevY < 0 ? -vh : vh;
        });
        setBackdropOpacity(0);
        setImageOpacity(0);
        setExitScale(2);

        window.setTimeout(() => {
            setIsOpen(false);
            setCurrentIndex(null);
            setIsClosing(false);
            setTranslateX(0);
            setTranslateY(0);
            setBackdropOpacity(1);
            setImageOpacity(1);
            setExitScale(1);
            setZoomScale(1);
            document.body.style.overflow = ""; // restore scroll
        }, BACKDROP_FADE_DURATION);
    };

    const zoom = () => {
        if (zoomScaleRef.current > 1) {
            setZoomScale(MIN_ZOOM);
            zoomScaleRef.current = MIN_ZOOM;
        } else {
            setZoomScale(MAX_ZOOM);
            zoomScaleRef.current = MAX_ZOOM;
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

        const imgTop = imgRect.top; // why



        const extraW = Math.max(0, imgW - viewportW);
        const extraH = Math.max(0, imgH - viewportH);
        const PAD = 30;

        // this doesn't work
        // minPanXRef.current = -extraW - PAD;
        // maxPanXRef.current = PAD;
        // minPanYRef.current = -extraH - PAD;
        // maxPanYRef.current = PAD;

        // this also doesn't work
        // minPanXRef.current = -PAD;
        // maxPanXRef.current = extraW + PAD;
        // minPanYRef.current = -PAD;
        // maxPanYRef.current = extraH + PAD;

        maxPanXRef.current = (extraW / 2) + 30;
        maxPanYRef.current = (extraH / 2) + 30;
        minPanXRef.current = -maxPanXRef.current;
        minPanYRef.current = -maxPanYRef.current;

        // console.log("///////////////////");
        // console.log("imgW: ", imgRect.width);
        // console.log("imgH: ", imgRect.height);
        // console.log("viewportW: ", containerRect.width);
        // console.log("viewportH: ", containerRect.height);
        // console.log("extraW: ", extraW);
        // console.log("extraH: ", extraH);
        // console.log("maxPanXRef.current: ", maxPanXRef.current);
        // console.log("maxPanYRef.current: ", maxPanYRef.current);

    }, [zoomScale, isOpen]);

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
            console.log("draggingXRef.current: ", swipingXRef.current);
            console.log("draggingRef.current: ", pointerDownRef.current);
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
    const isZoomedIn = zoomScaleRef.current > 1;
    const isPinching = pinchingRef.current;
    let imgTx = 0;
    let imgTy = 0;

    if (isZoomedIn || isPinching) {
        imgTx = panX;
        imgTy = panY;
    } else {
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
                                    transform: swipingXRef.current
                                        ? `translateX(calc(-100vw + ${translateX}px))`
                                        : swipeDirection === "prev"
                                            ? "translateX(0vw)"
                                            : swipeDirection === "next"
                                                ? "translateX(-200vw)"
                                                : "translateX(-100vw)",
                                    // transition: draggingRef.current
                                    transition: pointerDownRef.current || swipeDirection === null
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
                                                transition: pointerDownRef.current
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
                                        className={`max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20 
                                            ${zoomScaleRef.current > 1 ? "cursor-move" : "cursor-grab active:cursor-grabbing"}`}
                                        style={{
                                            // transformOrigin: "0 0",
                                            transformOrigin: "50% 50%",
                                            transform: `translate(${imgTx}px, ${imgTy}px) scale(${exitScale * zoomScale})`,
                                            opacity: imageOpacity,
                                            transition: pointerDownRef.current
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