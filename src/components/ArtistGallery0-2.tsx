import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

interface ArtistImage {
  src: string;
  alt?: string;
}

interface ArtistGalleryProps {
  images?: ArtistImage[];
}

const DRAG_CLOSE_THRESHOLD = 400000; // px distance to trigger close

const LightboxPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === "undefined") return null; // SSR guard
  return ReactDOM.createPortal(children, document.body);
};


export const ArtistGallery: React.FC<ArtistGalleryProps> = ({ images = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;


      const [translateY, setTranslateY] = useState(0);
      const [backdropOpacity, setBackdropOpacity] = useState(1);
      const draggingRef = useRef(false);
      const startYRef = useRef(0);
  
      const handlePointerDown = (e: React.PointerEvent) => {
          draggingRef.current = true;
          startYRef.current = e.clientY;
  
          // capture pointer so moves outside the image still report to this element
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
      };
  
        const handlePointerMove = (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
  
      const deltaY = e.clientY - startYRef.current;
  
      // Only care about vertical drag; you can add direction locking if you want
      setTranslateY(deltaY);
  
      // Fade backdrop as you drag further away (clamp to [0,1])
      const opacity = Math.max(0, Math.min(1, 1 - Math.abs(deltaY) / 300));
      setBackdropOpacity(opacity);
    };
  
      const handlePointerUp = (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      console.log("pointerup");
  
      const deltaY = e.clientY - startYRef.current;
  
    //   if (Math.abs(deltaY) > DRAG_CLOSE_THRESHOLD) {
    //     close();
    //   } else {
    //     // Snap back
    //     setTranslateY(0);
    //     setBackdropOpacity(1);
    //   }
    };

  const openAt = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
    document.body.style.overflow = "hidden"; // lock scroll when open
  };

  const close = () => {
    setIsOpen(false);
    setCurrentIndex(null);
    document.body.style.overflow = ""; // restore scroll
  };

  const showPrev = () => {
    if (currentIndex === null) return;
    setCurrentIndex((currentIndex - 1 + images.length) % images.length);
  };

  const showNext = () => {
    if (currentIndex === null) return;
    setCurrentIndex((currentIndex + 1) % images.length);
  };

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

  const currentImage =
    currentIndex !== null ? images[currentIndex] : null;

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
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                close();
              }
            }}
          >
            <div className="relative max-w-5xl w-full">
              {/* Close */}
              <button
                type="button"
                onClick={close}
                className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm uppercase tracking-wide"
              >
                Close ✕
              </button>

              {/* Image */}
              <div className="flex items-center justify-center">
                <img
                  src={currentImage.src}
                  alt={currentImage.alt ?? ""}
                  className="max-h-[80vh] w-auto max-w-full object-contain shadow-lg bg-black/20"
                    style={{
                        transform: `translateY(${translateY}px)`,
                        transition: draggingRef.current ? "none" : "transform 150ms ease-out",
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                />
              </div>

              {/* Caption + index */}
              <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                <div className="truncate pr-4">
                  {currentImage.alt ?? "\u00A0"}
                </div>
                <div>
                  {(currentIndex ?? 0) + 1} / {images.length}
                </div>
              </div>

              {/* Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      showPrev();
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 hidden sm:flex items-center justify-center rounded-full border border-white/40 bg-black/40 px-2 py-2 text-white hover:bg-black/60"
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
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 hidden sm:flex items-center justify-center rounded-full border border-white/40 bg-black/40 px-2 py-2 text-white hover:bg-black/60"
                    aria-label="Next image"
                  >
                    →
                  </button>
                </>
              )}
            </div>
          </div>
        </LightboxPortal>
      )}
    </>
  );
};
