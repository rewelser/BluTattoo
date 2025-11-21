import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

interface ArtistImage {
  src: string;
  alt?: string;
}

interface ArtistGalleryProps {
  images?: ArtistImage[];
}

export const ArtistGallery: React.FC<ArtistGalleryProps> = ({ images = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const prevIndex =
    currentIndex === null ? null : (currentIndex - 1 + images.length) % images.length;

  const nextIndex =
    currentIndex === null ? null : (currentIndex + 1) % images.length;

  const currentImage = currentIndex !== null ? images[currentIndex] : null;
  const prevImage = prevIndex !== null ? images[prevIndex] : null;
  const nextImage = nextIndex !== null ? images[nextIndex] : null;

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const hasSeenFirstBatch = useRef(false);
  const testCurrentIndex = useRef<Number>(1);

  // IntersectionObserver (unchanged)
  useEffect(() => {
    if (!isOpen || !scrollRef.current) return;

    const root = scrollRef.current;
    const visibility: Record<string, number> = {};
    const elementIds: Record<string, number> = {};

    const observer = new IntersectionObserver(
      (entries) => {
        console.log("observer 1 ran");
        entries.forEach((entry) => {
          const role = (entry.target as HTMLElement).dataset.role;
          const idxStr = (entry.target as HTMLElement).dataset.index ?? "";
          if (idxStr == null) return;
          const idx = Number(idxStr);
          if (Number.isNaN(idx) || !role) return;
          visibility[role] = entry.intersectionRatio;
          elementIds[role] = idx;
        });

        let bestRole: string | null = null;
        let bestRatio = 0;
        let bestIndex = 0;
        ["prev", "current", "next"].forEach((role) => {
          const r = visibility[role] ?? 0;
          const i = elementIds[role] ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestRole = role;
            bestIndex = i;
          }
        });

        // Skip the first batch of intersections (initial layout)
        console.log("hasSeenFirstBatch: ", hasSeenFirstBatch);
        if (!hasSeenFirstBatch.current) {
            hasSeenFirstBatch.current = true;
            return;
        }

        // console.log(entry.target);
        if (bestRatio > 0.7) {
          console.log(bestRole + " fully visible");
          console.log("best's index: " + bestIndex);
          setCurrentIndex((prev) => {
            if (prev === bestIndex) return prev; // already current, do nothing
            return bestIndex;
          });
        }
      },
      { root, threshold: [0.25, 0.5, 0.7, 0.9] }
    );

    const targets = root.querySelectorAll<HTMLElement>("[data-role]");
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [isOpen]);

  if (!images || images.length === 0) return null;

  const openAt = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setCurrentIndex(null);
    hasSeenFirstBatch.current = false;
  };

  const showPrev = () => {
    if (currentIndex === null) return;
    setCurrentIndex((p) => (p === null ? 0 : (p - 1 + images.length) % images.length));
  };

  const showNext = () => {
    if (currentIndex === null) return;
    setCurrentIndex((p) => (p === null ? 0 : (p + 1) % images.length));
  };

  const LightboxPortal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    typeof document === "undefined" ? null : ReactDOM.createPortal(children, document.body);

  // keyboard navigation (unchanged)
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, currentIndex]);

  return (
    <>
      {/* Thumbnail grid */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, idx) => {
          const id = `image-${idx}`;
          return (
            <a 
            key={img.src + idx}
            href={`#${id}`}
            onClick={() => openAt(idx)}
            className="group relative overflow-hidden rounded-xl border border-black/5 bg-black/5 hover:bg-black/10 transition w-full"
            >
                <img
                    src={img.src}
                    alt={img.alt ?? ""}
                    className="aspect-square w-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity" />
            </a>
          );
        })}
      </div>

      {/* Lightbox overlay */}
      {isOpen && currentImage && (
        <LightboxPortal>
          <div
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex flex-col h-screen"
            onClick={(e) => e.target === e.currentTarget && close()}
          >

            <div className="flex justify-end px-4 pt-4">
              <button className="text-white/70 hover:text-white text-sm" onClick={close}>
                Close ✕
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div
                ref={scrollRef}
                className="flex w-screen overflow-x-auto snap-x snap-mandatory scroll-smooth space-x-4 px-4 scrollbar-color: auto;"
              >
                {prevImage && (
                  <div
                    data-role="prev"
                    data-index={prevIndex ?? undefined}
                    id={`image-${prevIndex}`}
                    className="shrink-0 snap-center w-screen flex justify-center"
                  >
                    <img
                      src={prevImage.src}
                      className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-lg"
                    />
                  </div>
                )}

                <div
                  data-role="current"
                  data-index={currentIndex ?? undefined}
                  id={`image-${currentIndex}`}
                  className="shrink-0 snap-center w-screen flex justify-center"
                >
                  <img
                    src={currentImage.src}
                    className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-lg"
                  />
                </div>

                {nextImage && (
                  <div
                    data-role="next"
                    data-index={nextIndex ?? undefined}
                    id={`image-${nextIndex}`}
                    className="shrink-0 snap-center w-screen flex justify-center"
                  >
                    <img
                      src={nextImage.src}
                      className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-lg"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-white/70 p-3 px-4">
              <div className="truncate pr-4">{currentImage.alt ?? "\u00A0"}</div>
              <div>{(currentIndex ?? 0) + 1} / {images.length}</div>
            </div>

            {/* Prev / Next arrows */}
            {images.length > 1 && (
              <>
                {/* <button
                  onClick={(e) => { e.stopPropagation(); showPrev(); }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 hidden sm:flex text-white bg-black/40 px-2 py-2"
                >
                  ←
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); showNext(); }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:flex text-white bg-black/40 px-2 py-2"
                >
                  →
                </button> */}
                <a
                    href={`#image-${prevIndex}`}
                //   onClick={(e) => { e.stopPropagation(); showPrev(); }}
                    onClick={(e) => {
                        // e.stopPropagation();
                        if (prevIndex !== null) {
                            setCurrentIndex(prevIndex);
                        }
                    }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 hidden sm:flex text-white bg-black/40 px-2 py-2"
                >
                  ←
                </a>
                <a
                    href={`#image-${nextIndex}`}
                    //   onClick={(e) => { e.stopPropagation(); showNext(); }}
                    onClick={(e) => {
                        // e.stopPropagation();
                        if (nextIndex !== null) {
                            setCurrentIndex(nextIndex);
                        }
                    }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:flex text-white bg-black/40 px-2 py-2"
                >
                  →
                </a>
              </>
            )}

          </div>
        </LightboxPortal>
      )}
    </>
  );
};
