import React, { useEffect, useMemo, useRef, useState } from "react";

type ArtistImage = {
  src: string;
  alt?: string;
};

type ArtistGalleryProps = {
  images: ArtistImage[];
};

export function ArtistGallery({ images }: ArtistGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Lazy-load tracking
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state (for gating snap + handling pointer moves)
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const handleScrollEnd = (e: React.UIEvent<HTMLElement>) => {
    console.log("scroll end", e.currentTarget);
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
  }, [images]);

  // Helper to find nearest slide after dragging ends
  const snapToNearestSlide = () => {
    const container = containerRef.current;
    if (!container) return;

    const slides = Array.from(container.querySelectorAll<HTMLElement>("[data-slide]"));
    if (slides.length === 0) return;

    const containerCenter = container.scrollLeft + container.clientWidth / 2;

    let best = slides[0];
    let bestDist = Number.POSITIVE_INFINITY;

    for (const slide of slides) {
      // slide center in scroll coordinates
      const slideCenter = slide.offsetLeft + slide.clientWidth / 2;
      const dist = Math.abs(slideCenter - containerCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = slide;
      }
    }

    best.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const container = containerRef.current;
    if (!container) return;

    // Only left click for mouse; pointer events for touch/pen still work
    if (e.pointerType === "mouse" && e.button !== 0) return;

    dragRef.current.pointerId = e.pointerId;
    dragRef.current.startX = e.clientX;
    dragRef.current.startScrollLeft = container.scrollLeft;
    dragRef.current.moved = false;

    setIsDragging(true);

    // keep receiving move/up events even if pointer leaves element
    container.setPointerCapture(e.pointerId);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const container = containerRef.current;
    if (!container) return;
    if (!isDragging) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 2) dragRef.current.moved = true;

    container.scrollLeft = dragRef.current.startScrollLeft - dx;

    // Prevent text/image drag selection while moving pointer
    e.preventDefault();
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    if (!isDragging) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    try {
      container.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if capture already lost
    }

    dragRef.current.pointerId = -1;

    // Re-enable snap and settle onto nearest slide
    setIsDragging(false);

    // If you want “snap settle” only when user actually dragged:
    if (dragRef.current.moved) snapToNearestSlide();
  };

  const containerSnapClass = useMemo(
    () => (isDragging ? "" : "snap-x snap-mandatory"),
    [isDragging]
  );

  const slideSnapClass = useMemo(
    () => (isDragging ? "" : "snap-center snap-always"),
    [isDragging]
  );

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
            <img
              src={img.src}
              alt={img.alt ?? ""}
              className="w-full h-auto block cursor-pointer"
            />
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
          className={[
            "flex overflow-x-auto overflow-y-hidden max-w-full max-h-full",
            containerSnapClass,
            // nicer feel while dragging
            isDragging ? "cursor-grabbing select-none" : "cursor-grab",
          ].join(" ")}
          onScrollEnd={handleScrollEnd}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(e) => {
            // If capture is active, leave won’t fire; this is just a safety net
            if (isDragging) endDrag(e);
          }}
          // Helps prevent the browser from treating pointer moves as panning/zooming gestures
          // while you’re dragging. You can loosen this to `pan-y` if you want vertical gestures.
          style={{ touchAction: "none" }}
        >
          {images.map((img, index) => (
            <figure
              key={img.src ?? index}
              id={`artist-slide-${index}`}
              data-slide
              data-index={index}
              className={[
                "min-w-full flex-[0_0_100%] flex items-center justify-center",
                slideSnapClass,
              ].join(" ")}
              onScrollEnd={handleScrollEnd}
              // stops native image drag ghosting in some browsers
              draggable={false}
            >
              {visibleSet.has(index) ? (
                <img
                  src={img.src}
                  alt={img.alt ?? ""}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-[#222] opacity-40" />
              )}
            </figure>
          ))}
        </div>
      </div>
    </>
  );
}
