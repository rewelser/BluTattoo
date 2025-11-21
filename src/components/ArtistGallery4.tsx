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
  
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);
    
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
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex flex-col"
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
                {images.map((img, idx) => (
                    <div
                    key={img.src + idx}
                    id={`image-${idx}`}
                    className="shrink-0 snap-center w-screen flex justify-center"
                    >
                        <img
                            src={img.src}
                            className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-lg"
                        />
                    </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-white/70 p-3 px-4">
              <div className="truncate pr-4">{currentImage.alt ?? "\u00A0"}</div>
              <div>{(currentIndex ?? 0) + 1} / {images.length}</div>
            </div>

            {/* Prev / Next arrows */}
            {images.length > 1 && (
              <>
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
