import React, { useEffect, useRef, useState } from "react";

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

  const handleScrollEnd = (
    e: React.UIEvent<HTMLElement>
  ) => {
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
        rootMargin: "200px", // pre-load slides slightly before they appear
        threshold: 0.1,
      }
    );

    container.querySelectorAll("[data-slide]").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [images]);

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
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="absolute top-4 right-4 text-4xl text-white bg-transparent border-0 cursor-pointer"
          onClick={() => {
            setIsOpen(false);
            // Optional: clear hash
            if (window.location.hash) {
              history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search
              );
            }
          }}
        >
          ×
        </button>

        <div
          className="flex overflow-x-auto overflow-y-hidden max-w-full max-h-full snap-x snap-mandatory"
          ref={containerRef}
          onScrollEnd={handleScrollEnd}
        >
          {images.map((img, index) => (
            <figure
              key={img.src ?? index}
              id={`artist-slide-${index}`}
              data-slide
              data-index={index}
              className="min-w-full flex-[0_0_100%] flex items-center justify-center snap-center snap-always"
              onScrollEnd={handleScrollEnd}
            >
              {visibleSet.has(index) ? (
                // Real image once visible
                <img
                  src={img.src}
                  alt={img.alt ?? ""}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                // Placeholder
                <div className="w-full h-full bg-[#222] opacity-40" />
              )}
            </figure>
          ))}
        </div>
      </div>
    </>
  );
}