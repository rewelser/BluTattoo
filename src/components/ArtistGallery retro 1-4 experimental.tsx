import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type ArtistImage = {
  src: string;
  alt?: string;
};

type ArtistGalleryProps = {
  images: ArtistImage[];
};

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

type CarouselMetrics = {
  w: number;
  firstReal: number;
  lastReal: number;
  EPS: number;
};

type PositionInfo = {
  virtualIndex: number;
  realIndex: number;
  targetVirtualIfNormalized: number | null;
  distToCenter: number;
  isCentered: boolean;
  inLeftClone: boolean;
  inRightClone: boolean;
};

export function ArtistGallery({ images }: ArtistGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Lazy-load tracking by REAL slide index (0..N-1)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState(0);

  const lastLoggedVirtual = useRef<number | null>(null);

  const N = images.length;
  const CLONES = Math.min(2, N);

  const virtualImages = useMemo(() => {
    if (N === 0) return [];
    const head = images.slice(N - CLONES);
    const tail = images.slice(0, CLONES);
    return [...head, ...images, ...tail];
  }, [images, N, CLONES]);

  // Measure slide width (assumes each slide is min-w-full / 100% of container)
  const slideWidthRef = useRef<number>(0);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      slideWidthRef.current = el.clientWidth || 0;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (!el) return;

    const w = slideWidthRef.current;
    if (!w) return;

    el.scrollTo({ left: (CLONES + openIndex) * w, behavior: "auto" });
  }, [isOpen, openIndex, CLONES]);

  // IntersectionObserver: observe virtual slides, but record REAL index
  useEffect(() => {
    const container = containerRef.current;
    if (!container || N === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const realIndexAttr = entry.target.getAttribute("data-real-index");
          if (realIndexAttr == null) return;
          const realIndex = Number(realIndexAttr);
          if (Number.isNaN(realIndex)) return;

          setVisibleSet((prev) => {
            if (prev.has(realIndex)) return prev;
            const next = new Set(prev);
            next.add(realIndex);
            return next;
          });
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
  }, [N, virtualImages]);

  // --- Shared helpers -------------------------------------------------------

  const getMetrics = (): { el: HTMLDivElement; metrics: CarouselMetrics } | null => {
    const el = containerRef.current;
    if (!el || N === 0) return null;

    const w = slideWidthRef.current;
    if (!w) return null;

    const firstReal = CLONES;
    const lastReal = CLONES + (N - 1);

    // Your tolerance
    const EPS = 10;

    return { el, metrics: { w, firstReal, lastReal, EPS } };
  };

  // Uses viewport midpoint (your current behavior), returns everything callers need.
  const getPositionInfo = (): { el: HTMLDivElement; info: PositionInfo } | null => {
    const ctx = getMetrics();
    if (!ctx) return null;
    const { el, metrics } = ctx;
    const { w, firstReal, lastReal, EPS } = metrics;

    const viewportMid = el.scrollLeft + el.clientWidth / 2;
    const virtualIndex = Math.round((viewportMid - w / 2) / w);

    const slideMid = virtualIndex * w + w / 2;
    const distToCenter = Math.abs(viewportMid - slideMid);
    const isCentered = distToCenter <= EPS;

    const inLeftClone = virtualIndex < firstReal;
    const inRightClone = virtualIndex > lastReal;

    const realIndex = mod(virtualIndex - CLONES, N);

    // If we're in clone zones, this is where we'd jump to.
    const targetVirtualIfNormalized =
      inLeftClone || inRightClone ? CLONES + realIndex : null;

    return {
      el,
      info: {
        virtualIndex,
        realIndex,
        targetVirtualIfNormalized,
        distToCenter,
        isCentered,
        inLeftClone,
        inRightClone,
      },
    };
  };

  // Disable snap -> jump -> re-enable snap next frame (prevents visible snapping artifacts).
  const jumpWithoutSnap = (el: HTMLDivElement, left: number) => {
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
    el.scrollTo({ left, behavior: "auto" });

    requestAnimationFrame(() => {
      el.style.scrollSnapType = prevSnap || "";
    });
  };

  // Normalizes based on shared position info. Optionally accept precomputed info.
  const normalizeIfNeeded = (precomputed?: { el: HTMLDivElement; info: PositionInfo } | null) => {
    const ctx = precomputed ?? getPositionInfo();
    if (!ctx) return;

    const { el, info } = ctx;
    const { w } = slideWidthRef.current ? { w: slideWidthRef.current } : { w: 0 };
    if (!w) return;

    if (info.targetVirtualIfNormalized == null) return;

    jumpWithoutSnap(el, info.targetVirtualIfNormalized * w);
  };

  // --- Scroll handler -------------------------------------------------------

  const handleScroll = () => {
    const ctx = getPositionInfo();
    if (!ctx) return;

    const { info } = ctx;

    // Gate work so we only act once per slide "center lock" (your lastLoggedVirtual logic).
    if (info.isCentered) {
      if (lastLoggedVirtual.current !== info.virtualIndex) {
        lastLoggedVirtual.current = info.virtualIndex;

        // Only normalize when we’re centered *and* in clone zones.
        if (info.inLeftClone || info.inRightClone) {
          normalizeIfNeeded(ctx);
        }
      }
    } else {
      // Optional: reset when we’re no longer centered so it can trigger again.
      if (lastLoggedVirtual.current === info.virtualIndex) {
        lastLoggedVirtual.current = null;
      }
    }
  };

  if (N === 0) return null;

  return (
    <>
      {/* Thumbnail grid */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
        {images.map((img, index) => (
          <a
            key={img.src ?? index}
            href={`#artist-slide-${index}`}
            onClick={() => {
              setOpenIndex(index);
              setIsOpen(true);
            }}
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
          className="flex overflow-x-auto overflow-y-hidden max-w-full max-h-full scroll-auto snap-x snap-mandatory"
          onScroll={handleScroll}
        >
          {virtualImages.map((img, virtualIndex) => {
            const realIndex = mod(virtualIndex - CLONES, N);

            return (
              <figure
                key={`${virtualIndex}-${img.src}`}
                data-slide
                data-real-index={realIndex}
                id={`artist-virtual-${virtualIndex}`}
                className="min-w-full flex-[0_0_100%] flex items-center justify-center snap-center snap-always"
              >
                {visibleSet.has(realIndex) ? (
                  <img
                    src={images[realIndex].src}
                    alt={images[realIndex].alt ?? ""}
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
