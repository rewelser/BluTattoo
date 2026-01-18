import React, { useEffect, useMemo, useRef, useState } from "react";

export interface ArtistImage {
  src: string;
  thumbSrc?: string;
  alt?: string;
}

export interface GalleryLightboxNaturalScrollProps {
  images: ArtistImage[];
  isOpen: boolean;
  startIndex?: number;
  onClose: () => void;

  /**
   * Optional class hooks
   */
  overlayClassName?: string;
  containerClassName?: string;
  figureClassName?: string;
}

export const GalleryLightboxNaturalScroll: React.FC<
  GalleryLightboxNaturalScrollProps
> = ({
  images,
  isOpen,
  startIndex = 0,
  onClose,
  overlayClassName,
  containerClassName,
  figureClassName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy-load tracking (only render real <img> once a slide is near/inside viewport)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(() => new Set());

  const safeStartIndex = useMemo(() => {
    const max = Math.max(0, images.length - 1);
    const n = Number.isFinite(startIndex) ? startIndex : 0;
    return Math.min(Math.max(0, n), max);
  }, [startIndex, images.length]);

  const close = () => {
    onClose();
    // Optional: clear hash (in case other code sets it)
    if (typeof window !== "undefined" && window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // When opened (or startIndex changes), scroll to the requested slide
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    // Ensure first paint happens before scroll
    requestAnimationFrame(() => {
      const el = container.querySelector<HTMLElement>(`[data-index="${safeStartIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "instant" as ScrollBehavior, inline: "start", block: "nearest" });
      } else {
        // Fallback: approximate using container width
        container.scrollLeft = container.clientWidth * safeStartIndex;
      }
    });
  }, [isOpen, safeStartIndex]);

  // IntersectionObserver: track which slides are near view
  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).getAttribute("data-index"));
          if (!Number.isFinite(idx)) continue;

          setVisibleSet((prev) => {
            if (prev.has(idx)) return prev;
            const next = new Set(prev);
            next.add(idx);
            return next;
          });
        }
      },
      {
        root: container,
        rootMargin: "250px", // preload before fully visible
        threshold: 0.05,
      }
    );

    const slides = Array.from(container.querySelectorAll<HTMLElement>("[data-slide]"));
    slides.forEach((el) => observer.observe(el));

    // Seed the visible set with the start slide so it renders immediately
    setVisibleSet((prev) => {
      const next = new Set(prev);
      next.add(safeStartIndex);
      // also prime neighbors for quick swipe/scroll
      if (safeStartIndex - 1 >= 0) next.add(safeStartIndex - 1);
      if (safeStartIndex + 1 < images.length) next.add(safeStartIndex + 1);
      return next;
    });

    return () => observer.disconnect();
  }, [isOpen, images.length, safeStartIndex]);

  if (!isOpen || !images?.length) return null;

  return (
    <div
      className={
        overlayClassName ??
        "fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      }
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      onMouseDown={(e) => {
        // click outside closes (but don't close when clicking inside the scroller)
        if (e.target === e.currentTarget) close();
      }}
    >
      <button
        type="button"
        className="absolute top-4 right-4 text-4xl text-white bg-transparent border-0 cursor-pointer"
        aria-label="Close"
        onClick={close}
      >
        ×
      </button>

      <div
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
      </div>
    </div>
  );
};
