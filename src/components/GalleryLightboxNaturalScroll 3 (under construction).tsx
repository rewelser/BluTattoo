import React, { useMemo, useState, useEffect, useRef } from "react";

interface ArtistImage {
  src: string;
  thumbSrc?: string;
  alt?: string;
}

interface GalleryLightboxProps {
  images: ArtistImage[];
  isOpen: boolean;
  startIndex: number;     // which image to show when opening
  onClose: () => void;
}

// DOUBLE_TAP_MS & DOUBLE_TAP_SLOP_PX used for manual double-tap detection
const DOUBLE_TAP_MS = 250;
const DOUBLE_TAP_SLOP_PX = 24;

const DRAG_CLOSE_THRESHOLD = 120;
const DRAG_LOCK_THRESHOLD = 10;
const RESET_DURATION = 200; // todo 1.16.26: conflate with Backdrop fade duration?
const BACKDROP_FADE_DURATION = 200;
const SWIPE_IMAGE_CHANGE_THRESHOLD = 80; // 80 too small for desktop, 200 too big for mobile

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const MAX_TOUCH_POINTS = 2;



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



export const GalleryLightbox: React.FC<GalleryLightboxProps> = ({
  images,
  isOpen,
  startIndex,
  onClose,
}) => {
  // Lazy-load tracking (only render real <img> once a slide is near/inside viewport)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(() => new Set());
  const [isClosing, setIsClosing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(startIndex);

  const [swipeX, setSwipeX] = useState(0);
  const [swipeY, setSwipeY] = useState(0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const panXStartRef = useRef(0);
  const panYStartRef = useRef(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const carouselContainerRef = useRef<HTMLDivElement | null>(null);
  const currentImgContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const baseImgWRef = useRef<number | null>(null);
  const baseImgHRef = useRef<number | null>(null);

  const [exitScale, setExitScale] = useState(1);
  const [backdropOpacity, setBackdropOpacity] = useState(1);
  const [imageOpacity, setImageOpacity] = useState(1);
  const [zoomScale, setZoomScale] = useState(1);

  const pinchingRef = useRef(false);
  const noLongerPinchingRef = useRef(false);
  const nextPanUnclampedForClampedZoom = useRef<{ x: number; y: number } | null>(null);

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
  const resetInFlightRef = useRef<Promise<void> | null>(null);

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

  const safeStartIndex = useMemo(() => {
    const max = Math.max(0, images.length - 1);
    const n = Number.isFinite(startIndex) ? startIndex : 0;
    return Math.min(Math.max(0, n), max);
  }, [startIndex, images.length]);

  // When opened (or startIndex changes), scroll to the requested slide
  // useEffect(() => {
  //   // if (!isOpen) return;
  //   const container = carouselContainerRef.current;
  //   if (!container) return;

  //   // Ensure first paint happens before scroll
  //   requestAnimationFrame(() => {
  //     requestAnimationFrame(() => {
  //       requestAnimationFrame(() => {
  //           // do scrollTo here
  //           const el = container.querySelector<HTMLElement>(`[data-index="${safeStartIndex}"]`);
  //           console.log("Scrolling to index", safeStartIndex, el);
  //           if (el) {
  //             console.log("Scrolling to element", el);
  //             el.scrollIntoView({ behavior: "auto" as ScrollBehavior, inline: "center", block: "nearest" });
  //           } else {
  //             console.log("Element not found for index", safeStartIndex);
  //             // Fallback: approximate using container width
  //             container.scrollLeft = container.clientWidth * safeStartIndex;
  //           }
  //       });

  //     });

  //   });
  // }, [isOpen, safeStartIndex]);

  // useEffect(() => {
  //   if (!isOpen) return;
  //   const container = carouselContainerRef.current;
  //   if (!container) return;

  //   const scrollToIndex = () => {
  //     const el = container.querySelector<HTMLElement>(`[data-index="${safeStartIndex}"]`);
  //     if (!el) return;
  //     const left = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
  //     container.scrollTo({ left, behavior: "auto" });
  //   };

  //   // Try immediately (might work on subsequent opens)
  //   scrollToIndex();

  //   const ro = new ResizeObserver(() => {
  //     // When geometry changes (first stable size), scroll
  //     scrollToIndex();
  //   });

  //   ro.observe(container);

  //   return () => ro.disconnect();
  // }, [isOpen, safeStartIndex]);

  ////////

  // useEffect(() => {
  //   if (!isOpen) return;
  //   const container = carouselContainerRef.current;
  //   if (!container) return;

  //   let raf = 0;
  //   let tries = 0;

  //   const tryScroll = () => {
  //     tries += 1;

  //     const el = container.querySelector<HTMLElement>(`[data-index="${safeStartIndex}"]`);

  //     // “Ready” conditions — tweak if your logs show different failure mode
  //     const ready =
  //       !!el &&
  //       container.clientWidth > 0 &&
  //       container.scrollWidth > container.clientWidth &&
  //       el.offsetLeft > 0; // offsetLeft is often 0 until layout settles

  //     if (ready) {
  //       // Prefer scrollTo with computed left; scrollIntoView can fight snap/ancestors.
  //       const left = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
  //       container.scrollTo({ left, behavior: "auto" });
  //       return;
  //     }

  //     if (tries < 30) {
  //       raf = requestAnimationFrame(tryScroll);
  //     } else {
  //       // last-ditch: do what you were doing
  //       if (el) el.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  //     }
  //   };

  //   raf = requestAnimationFrame(tryScroll);
  //   return () => cancelAnimationFrame(raf);
  // }, [isOpen, safeStartIndex]);

  /////// 
  // useEffect(() => {
  //   if (!isOpen) return;
  //   const container = carouselContainerRef.current;
  //   if (!container) return;

  //   let frame = 0;
  //   let raf = 0;

  //   const tick = () => {
  //     frame += 1;
  //     const el = container.querySelector<HTMLElement>(`[data-index="${safeStartIndex}"]`);

  //     const cRect = container.getBoundingClientRect();
  //     const eRect = el?.getBoundingClientRect();

  //     console.log(`[frame ${frame}]`,
  //       {
  //         clientWidth: container.clientWidth,
  //         scrollWidth: container.scrollWidth,
  //         scrollLeft: container.scrollLeft,
  //         containerRectW: cRect.width,
  //         elOffsetLeft: el?.offsetLeft,
  //         elRectLeft: eRect?.left,
  //         elRectW: eRect?.width,
  //       }
  //     );

  //     if (frame < 10) raf = requestAnimationFrame(tick);
  //   };

  //   raf = requestAnimationFrame(tick);
  //   return () => cancelAnimationFrame(raf);
  // }, [isOpen, safeStartIndex]);


  /////////


  useEffect(() => {
    if (!isOpen) return;
    const container = carouselContainerRef.current;
    if (!container) return;

    const doScroll = () => {
      const el = container.querySelector<HTMLElement>(`[data-index="${safeStartIndex}"]`);
      if (!el) return false;
      if (container.clientWidth === 0) return false;

      const left = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
      container.scrollTo({ left, behavior: "auto" });
      return true;
    };

    // Try immediately (works on later opens)
    if (doScroll()) return;

    const ro = new ResizeObserver(() => {
      if (doScroll()) ro.disconnect(); // scroll once when ready
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [isOpen, safeStartIndex]);




  ////
  // Final derived offsets:
  ////
  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const isZoomedIn = pendingRef.current.zoomScale > 1;
  const isPinching = pinchingRef.current;
  const isPointerDown = evCacheRef.current.length > 0;

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
    <div
      ref={containerRef}
      className="fixed inset-0 z-[999] overflow-hidden select-none touch-none backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        pointerEvents: isClosing ? "none" : "auto",
        backgroundColor: `rgba(0,0,0,${0.8 * backdropOpacity})`,
        transition: `background-color ${BACKDROP_FADE_DURATION}ms ease-out`,
      }}
    >
      {/* Zoom & Close buttons */}


      {/* Image Area (Natural scroll) */}
      <div id="carousel-container" className="absolute inset-0 flex">
        <div
          ref={carouselContainerRef}
          id="image-carousel"
          // className="flex overflow-x-scroll overflow-y-hidden snap-x snap-mandatory"
          className="flex overflow-x-auto overflow-y-hidden max-w-full max-h-full snap-x snap-mandatory"
        // onDoubleClick={zoom} // todo: this did not work as well as I had hoped (see zoom() for details)

        // onTransitionEnd={handleTrackTransitionEndOrCancel}
        // onTransitionCancel={handleTrackTransitionEndOrCancel}
        // Helpful on trackpads/mice (prevents vertical wheel from feeling “stuck”)
        // onWheel={(e) => {
        //   // If the user is primarily scrolling vertically, translate some of it to horizontal.
        //   if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        //     const el = containerRef.current;
        //     if (!el) return;
        //     el.scrollLeft += e.deltaY;
        //     e.preventDefault();
        //   }
        // }}
        >

          {/* Current slide (center) */}
          {images.map((img, index) => (
            <div
              key={(img.src ?? "") + index}
              data-welsertest={(img.src ?? "") + index}
              data-index={index}
              ref={currentImgContainerRef}
              // className="flex items-center justify-center w-screen snap-center snap-always"
              className="min-w-full flex-[0_0_100%] flex items-center justify-center snap-center snap-always"
              style={{
                transition: isPointerDown
                  ? "none"
                  : `transform ${RESET_DURATION}ms ease-out`,
              }}
            >
              <img
                ref={imageRef}
                src={img.src}
                alt={img.alt ?? ""}
                data-zoomable="true"
                className={`max-h-[100vh] w-auto max-w-full object-contain shadow-lg bg-black/20 ${pendingRef.current.zoomScale > 1 ? "cursor-move" : "cursor-grab active:cursor-grabbing"}`}
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
                  const effectiveScale = (exitScale * zoomScale) || 1;
                  baseImgWRef.current = r.width / effectiveScale;
                  baseImgHRef.current = r.height / effectiveScale;
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* <div
          ref={containerRef}
          className={
            containerClassName ??
            "flex overflow-x-auto overflow-y-hidden max-w-full max-h-full snap-x snap-mandatory"
          }
          // Helpful on trackpads/mice (prevents vertical wheel from feeling “stuck”)
          onWheel={(e) => {
            // If the user is primarily scrolling vertically, translate some of it to horizontal.
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              const el = containerRef.current;
              if (!el) return;
              el.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }}
        >
          {images.map((img, index) => (
            <figure
              key={(img.src ?? "") + index}
              data-slide
              data-index={index}
              className={
                figureClassName ??
                "min-w-full flex-[0_0_100%] flex items-center justify-center snap-center snap-always"
              }
            >
              {visibleSet.has(index) ? (
                <img
                  src={img.src}
                  alt={img.alt ?? ""}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-[#222] opacity-40" />
              )}
            </figure>
          ))}
        </div> */}

      {/* Caption + index */}
      <div
        className="absolute left-1 right-1 bottom-1 z-10 flex items-stretch justify-between text-xs"
        style={{
          opacity: imageOpacity,
          transition: isPointerDown
            ? "none"
            : `opacity ${BACKDROP_FADE_DURATION}ms ease-out`,
        }}
      >
        <div className="truncate p-3 bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm">
          {currentImage.alt ?? "\u00A0"}
        </div>
        <div className="p-3 bg-black/60 lg:bg-black/40 lg:backdrop-blur-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};