import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

type ArtistImage = {
  src: string;
  alt?: string;
};

type ArtistGalleryProps = {
  images: ArtistImage[];
};

export function ArtistGallery({ images }: ArtistGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Render order lives in state so we can reorder slides.
  const [orderedImages, setOrderedImages] = useState<ArtistImage[]>(images);

  // Lazy-load tracking
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔒 prevent onScroll from re-triggering reorders during programmatic scroll/re-render
  const suppressScrollRef = useRef(false);

  // ⏭️ defer the scrollLeft adjustment until AFTER React commits the reordered DOM
  const pendingShiftRef = useRef<0 | -1 | 1>(0);

  // If the prop changes, reset the order + lazy set.
  useEffect(() => {
    setOrderedImages(images);
    setVisibleSet(new Set());
    suppressScrollRef.current = false;
    pendingShiftRef.current = 0;
  }, [images]);

  const handleScroll = () => {
    if (suppressScrollRef.current) return;

    const el = containerRef.current;
    if (!el) return;

    const w = el.clientWidth;
    if (!w) return;

    // Midpoint of the viewport in scroll-content coordinates
    const viewportMid = el.scrollLeft + w / 2;

    // Which virtual slide midpoint is closest to viewport midpoint?
    const virtualIndex = Math.round((viewportMid - w / 2) / w);

    const slideCount = orderedImages.length;
    const lastIndex = slideCount - 1;

    // Now check the distance to be sure we're actually centered (tolerance)
    const slideMid = virtualIndex * w + w / 2;
    const dist = Math.abs(viewportMid - slideMid);

    const EPS = 20;
    const isCentered = dist <= EPS;

    if (lastIndex === virtualIndex && isCentered) {
      console.log("last slide & centered!", { virtualIndex });
      moveFrontToBack();
    }
  };

  const moveFrontToBack = () => {
    if (orderedImages.length <= 1) return;

    // lock scroll handler, and schedule "shift left one slide" after reorder commits
    suppressScrollRef.current = true;
    pendingShiftRef.current = -1;

    setOrderedImages((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  };

  const moveBackToFront = () => {
    if (orderedImages.length <= 1) return;

    // lock scroll handler, and schedule "shift right one slide" after reorder commits
    suppressScrollRef.current = true;
    pendingShiftRef.current = 1;

    setOrderedImages((prev) => {
      if (prev.length <= 1) return prev;
      const last = prev[prev.length - 1];
      return [last, ...prev.slice(0, -1)];
    });
  };

  // ✅ run AFTER React commits reordered DOM, then do the scrollLeft nudge exactly once
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const shift = pendingShiftRef.current;
    if (shift === 0) return;

    pendingShiftRef.current = 0;

    el.scrollTo({ left: el.scrollLeft + shift * el.clientWidth, behavior: "auto" });

    // release lock after the programmatic scroll + snap settle fire their scroll events
    requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    });
  }, [orderedImages]);

  const logScrollPosition = () => {
    const el = containerRef.current;
    if (!el) return;

    console.log({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      maxScrollLeft: el.scrollWidth - el.clientWidth,
      normalized: el.scrollLeft / (el.scrollWidth - el.clientWidth), // 0 → 1
      currentSlide: Math.round(el.scrollLeft / el.clientWidth),
    });
  };

  // keep these buttons working; just suppress scroll-triggered reorder while clicking
  const modifyScrollLeftLeft = () => {
    const el = containerRef.current;
    if (!el) return;
    suppressScrollRef.current = true;
    el.scrollTo({ left: el.scrollLeft - el.clientWidth, behavior: "auto" });
    requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    });
  };

  const modifyScrollLeftRight = () => {
    const el = containerRef.current;
    if (!el) return;
    suppressScrollRef.current = true;
    el.scrollTo({ left: el.scrollLeft + el.clientWidth, behavior: "auto" });
    requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-index"));
          if (entry.isIntersecting) {
            setVisibleSet((prev) => {
              const next = new Set(prev);
              next.add(index);
              return next;
            });
          }
        });
      },
      {
        root: container,
        rootMargin: "200px",
        threshold: 0.1,
      }
    );

    container.querySelectorAll("[data-slide]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [orderedImages]); // observe new DOM order after reordering

  return (
    <>
      {/* Thumbnail grid (still based on original images) */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
        {images.map((img, index) => (
          <a
            key={img.src ?? index}
            href={`#artist-slide-${index}`}
            onClick={() => setIsOpen(true)}
            className="block"
          >
            <img
              src={img.src}
              alt={img.alt ?? ""}
              className="w-full h-auto block cursor-pointer"
            />
          </a>
        ))}
      </div>

      {/* Lightbox overlay */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
      >
        {/* Close */}
        <button
          className="absolute top-4 right-4 text-4xl text-white bg-transparent border-0 cursor-pointer"
          onClick={() => {
            setIsOpen(false);
            if (window.location.hash) {
              history.replaceState(null, "", window.location.pathname + window.location.search);
            }
          }}
        >
          ×
        </button>

        <button
          className="absolute left-4 top-4 text-white px-3 py-2 bg-black/40 rounded"
          onClick={logScrollPosition}
          type="button"
        >
          print scroll stuff
        </button>

        <button
          className="absolute left-40 top-4 text-white px-3 py-2 bg-black/40 rounded"
          onClick={modifyScrollLeftLeft}
          type="button"
        >
          el.scrollLeft - el.clientWidth
        </button>

        <button
          className="absolute left-40 top-20 text-white px-3 py-2 bg-black/40 rounded"
          onClick={modifyScrollLeftRight}
          type="button"
        >
          el.scrollLeft + el.clientWidth
        </button>

        {/* Reorder buttons */}
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white px-3 py-2 bg-black/40 rounded"
          onClick={moveBackToFront}
          type="button"
        >
          ◀ Back → Front
        </button>

        <button
          className="absolute right-16 top-1/2 -translate-y-1/2 text-white px-3 py-2 bg-black/40 rounded"
          onClick={moveFrontToBack}
          type="button"
        >
          Front → Back ▶
        </button>

        <div
          className="flex overflow-x-auto overflow-y-hidden max-w-full max-h-full snap-x snap-mandatory"
          ref={containerRef}
          onScroll={handleScroll}
        >
          {orderedImages.map((img) => {
            // Find the original index so your visibleSet remains stable even after reordering.
            const originalIndex = images.findIndex((x) => x.src === img.src);

            return (
              <figure
                key={img.src} // key by src so React moves nodes correctly
                id={`artist-slide-${originalIndex}`}
                data-slide
                data-index={originalIndex}
                className="min-w-full flex-[0_0_100%] flex items-center justify-center snap-center snap-always"
              >
                {visibleSet.has(originalIndex) ? (
                  <img
                    src={img.src}
                    alt={img.alt ?? ""}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-[#222] opacity-40" />
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </>
  );
}
