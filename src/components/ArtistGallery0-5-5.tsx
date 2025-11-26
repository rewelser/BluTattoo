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
const BACKDROP_FADE_DURATION = 180;
const SWIPE_IMAGE_CHANGE_THRESHOLD = 80; // 80 too small for desktop, 200 too big for mobile
// ^ might need to make a mobile threshold as well ^
const SWIPE_IMAGE_RENDER_THRESHOLD = 40;

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
    const [translateY, setTranslateY] = useState(0);
    const [exitScale, setExitScale] = useState(1);
    const [backdropOpacity, setBackdropOpacity] = useState(1);
    const [imageOpacity, setImageOpacity] = useState(1);
    const draggingRef = useRef(false);
    const draggingXRef = useRef(false);
    const draggingYRef = useRef(false);
    const prevRenderRef = useRef(false);
    const nextRenderRef = useRef(false);
    const prevShowRef = useRef(false);
    const nextShowRef = useRef(false);
    const [swipeDirection, setSwipeDirection] = useState<"prev" | "next" | null>(null);
    const startXRef = useRef(0);
    const startYRef = useRef(0);

    if (!images || images.length === 0) return null;

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        draggingRef.current = true;
        draggingXRef.current = false;
        draggingYRef.current = false;
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;

        printStuff();

        // capture pointer so moves outside the image still report to this element
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current) return;

        const deltaX = e.clientX - startXRef.current;
        const deltaY = e.clientY - startYRef.current;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

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

        if (draggingXRef.current) {
            if (deltaX < -SWIPE_IMAGE_RENDER_THRESHOLD) {
                prevRenderRef.current = true;
            } else if (deltaX > SWIPE_IMAGE_RENDER_THRESHOLD) {
                nextRenderRef.current = true;
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.preventDefault();

        if (!draggingRef.current) return;

        const deltaX = draggingYRef.current ? 0 : e.clientX - startXRef.current;
        const deltaY = draggingXRef.current ? 0 : e.clientY - startYRef.current;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        draggingRef.current = false;

        if (draggingYRef.current && absY > DRAG_CLOSE_THRESHOLD) {
            close();
        }
        else if (draggingXRef.current && absX > SWIPE_IMAGE_CHANGE_THRESHOLD) {
            console.log("in swipe block");
            printStuff();
            draggingXRef.current = false;
            if (deltaX > 0) {
                // showPrev();
                // console.log("prevShowRef");
                // prevShowRef.current = true;
                // nextShowRef.current = false;
                setSwipeDirection("prev");
            } else {
                // showNext();
                // console.log("nextShowRef");
                // prevShowRef.current = false;
                // nextShowRef.current = true;
                setSwipeDirection("next");
            }
            // setTranslateX(0);
            // setTranslateY(0);
            window.setTimeout(() => {
                // showNext();
                printStuff();
            }, BACKDROP_FADE_DURATION);
        }
        else {
            // Snap back
            setSwipeDirection(null);
            setTranslateX(0);
            setTranslateY(0);
            setBackdropOpacity(1);
            setImageOpacity(1);
        }

        // draggingXRef.current = false;
        draggingYRef.current = false;
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
        document.body.style.overflow = "hidden"; // lock scroll when open
    };

    const close = () => {
        if (!isOpen || isClosing) return;

        setIsClosing(true);
        // setTranslateY(0);
        setBackdropOpacity(0);
        setImageOpacity(0);
        setExitScale(2);

        window.setTimeout(() => {
            setIsOpen(false);
            setCurrentIndex(null);
            setIsClosing(false);
            setBackdropOpacity(1);
            setImageOpacity(1);
            setTranslateX(0);
            setTranslateY(0);
            setExitScale(1);
            printStuff();
            document.body.style.overflow = ""; // restore scroll
        }, BACKDROP_FADE_DURATION);
    };

    const showPrev = () => {
        if (currentIndex === null) return;
        setCurrentIndex((currentIndex - 1 + images.length) % images.length);
    };

    const showNext = () => {
        console.log("shownext fired");
        if (currentIndex === null) return;
        setCurrentIndex((currentIndex + 1) % images.length);
        setSwipeDirection(null);
        printStuff();
    };

    // useLayoutEffect(() => {
    //     if (swipeDirection === null) {
    //         const lightboxImageContainer = document.querySelector('#lightbox-image-container');
    //         if (lightboxImageContainer === null) return;
    //         console.log("lightboxImageContainer: ", lightboxImageContainer);
    //         (lightboxImageContainer as HTMLElement).style.transitionDuration = '0s';
    //     }
    // }, [swipeDirection])

    const printStuff = () => {
        console.log("currentImage: ", currentImage);
        console.log("currentIndex: ", currentIndex);
        console.log("draggingXRef.current: ", draggingXRef.current);
        console.log("draggingRef.current: ", draggingRef.current);
    }

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowLeft") showPrev();
            if (e.key === "ArrowRight") showNext();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentIndex, images.length]);

    const currentImage = currentIndex !== null ? images[currentIndex] : null;

    return (
        <>
            {/* Thumbnail grid stays as-is, inside your layout card */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                    <button
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
                            backgroundColor: `rgba(0,0,0,${0.8 * backdropOpacity})`,
                            transition: `background-color ${BACKDROP_FADE_DURATION}ms ease-out`,
                        }}
                    >
                        {/* Close */}
                        <div className="px-4 flex justify-end">
                            <button
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

                        {/* printStuff button */}
                        <button
                            type="button"
                            onClick={(e) => { printStuff(); }}
                            className="cursor-pointer z-1"
                        >
                            ⭐
                        </button>

                        {/* Arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        showPrev();
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
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        showNext();
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
                        <div className="relative flex overflow-hidden w-screen">
                            <div
                                id="lightbox-image-container"
                                className="flex border-5 border-indigo-500 border-dotted"
                                style={{
                                    transform: draggingXRef.current
                                        ? `translateX(calc(-100vw + ${translateX}px))`
                                        : swipeDirection === "prev"
                                            ? "translateX(0vw)"
                                            : swipeDirection === "next"
                                                ? "translateX(-200vw)"
                                                : "translateX(-100vw)",
                                    // transition: swipeDirection === null
                                    transition: draggingRef.current
                                        ? "none"
                                        : `transform ${BACKDROP_FADE_DURATION}ms ease-out`,
                                }}
                            >
                                {/* Prev slide (off to the left) */}
                                {prevIndex !== null && (
                                    <div className="flex items-center justify-center w-screen border-5 border-teal-500 border-dotted">
                                        <img
                                            src={images[prevIndex].src}
                                            alt={images[prevIndex].alt ?? ""}
                                            className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                                            // no pointer handlers on neighbors
                                            style={{
                                                transform: `translateY(${translateY}px) scale(${exitScale})`,
                                                opacity: imageOpacity,
                                                transition: draggingRef.current
                                                    ? "none"
                                                    : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out, scale ${BACKDROP_FADE_DURATION}ms ease-out`,
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Current slide (center) */}
                                <div className="flex items-center justify-center w-screen border-5 border-teal-500 border-dotted">
                                    <img
                                        src={currentImage.src}
                                        alt={currentImage.alt ?? ""}
                                        className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                                        style={{
                                            transform: `translateY(${translateY}px) scale(${exitScale})`,
                                            opacity: imageOpacity,
                                            transition: draggingRef.current
                                                ? "none"
                                                : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out, scale ${BACKDROP_FADE_DURATION}ms ease-out`,
                                        }}
                                        onPointerDown={handlePointerDown}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        onPointerCancel={handlePointerUp}
                                    />
                                </div>

                                {/* Next slide (off to the right) */}
                                {nextIndex !== null && (
                                    <div className="flex items-center justify-center w-screen border-5 border-teal-500 border-dotted">
                                        <img
                                            src={images[nextIndex].src}
                                            alt={images[nextIndex].alt ?? ""}
                                            className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                                            style={{
                                                transform: `translateY(${translateY}px) scale(${exitScale})`,
                                                opacity: imageOpacity,
                                                transition: draggingRef.current
                                                    ? "none"
                                                    : `transform 150ms ease-out, opacity ${BACKDROP_FADE_DURATION}ms ease-out, scale ${BACKDROP_FADE_DURATION}ms ease-out`,
                                            }}
                                            onPointerDown={handlePointerDown}
                                            onPointerMove={handlePointerMove}
                                            onPointerUp={handlePointerUp}
                                            onPointerCancel={handlePointerUp}
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