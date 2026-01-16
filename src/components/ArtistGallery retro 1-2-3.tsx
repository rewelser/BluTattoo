import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type ArtistImage = { src: string; alt?: string };
type ArtistGalleryProps = { images: ArtistImage[] };

export function ArtistGallery({ images }: ArtistGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Order of slides currently in the DOM (indices into `images`)
  const [order, setOrder] = useState<number[]>(() => images.map((_, i) => i));

  // Lazy-load tracking based on image index (not DOM position)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent re-entrant recycling while we adjust scrollLeft
  const isRecyclingRef = useRef(false);

  // If `images` changes length, reset order
  useEffect(() => {
    setOrder(images.map((_, i) => i));
    setVisibleSet(new Set());
  }, [images]);

  // Helper: disable snap during the “surgery” (optional but helps on some browsers)
  const setSnapEnabled = (enabled: boolean) => {
    const el = containerRef.current;
    if (!el) return;
    if (enabled) el.classList.add("snap-x", "snap-mandatory");
    else el.classList.remove("snap-x", "snap-mandatory");
  };

  const recycleRightIfNeeded = () => {
    console.log("recycleRightIfNeeded");
    const el = containerRef.current;
    if (!el || isRecyclingRef.current) return;

    const w = el.clientWidth;              // one slide width
    const max = el.scrollWidth - w;        // last snap position
    const threshold = w * 0.35;            // how close to end counts as “entered last”

    if (el.scrollLeft >= max - threshold) {
      isRecyclingRef.current = true;

      // Optional: turn off snap to avoid a visible snap fight
      setSnapEnabled(false);

      // 1) Rotate: move first item to end
      setOrder((prev) => {
        if (prev.length <= 1) return prev;
        return [...prev.slice(1), prev[0]];
      });

      // 2) Compensate scrollLeft by one slide width so the viewport doesn't jump
      // Do it next frame so the DOM has applied the reorder
      requestAnimationFrame(() => {
        // After rotation, what used to be slide #2 is now at position #1 -> shift back by w.
        el.scrollLeft -= w;

        // Re-enable snap on the next frame
        requestAnimationFrame(() => {
          setSnapEnabled(true);
          isRecyclingRef.current = false;
        });
      });
    }
  };

  // Use onScroll (more reliable than onScrollEnd right now)
  const onScroll = () => {
    // Keep it cheap; a single check
    recycleRightIfNeeded();
  };

  // IntersectionObserver: observe slides currently in the DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute("data-image-index"));
          if (entry.isIntersecting) {
            setVisibleSet((prev) => {
              if (prev.has(idx)) return prev;
              const next = new Set(prev);
              next.add(idx);
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

    const nodes = container.querySelectorAll("[data-slide]");
    nodes.forEach((n) => observer.observe(n));

    return () => observer.disconnect();
  }, [order]); // <-- important: DOM nodes change when we reorder

  return (
    <>
      {/* Thumbnail grid */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
        {images.map((img, index) => (
          <a
            key={img.src ?? index}
            href={`#artist-slide-${index}`}
            onClick={() => setIsOpen(true)}
            className="block"
          >
            <img src={img.src} alt={img.alt ?? ""} className="w-full h-auto block cursor-pointer" />
          </a>
        ))}
      </div>

      {/* Lightbox overlay always rendered */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
      >
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

        <div
          ref={containerRef}
          onScroll={onScroll}
          className="flex overflow-x-auto overflow-y-hidden max-w-full max-h-full snap-x snap-mandatory"
        >
          {order.map((imageIndex, domPos) => {
            const img = images[imageIndex];
            return (
              <figure
                key={`${img.src ?? imageIndex}-${domPos}`} // domPos changes with rotation
                id={`artist-slide-${imageIndex}`}
                data-slide
                data-image-index={imageIndex}
                className="min-w-full flex-[0_0_100%] flex items-center justify-center snap-center snap-always"
              >
                {visibleSet.has(imageIndex) ? (
                  <img src={img.src} alt={img.alt ?? ""} className="max-w-full max-h-full object-contain" />
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
