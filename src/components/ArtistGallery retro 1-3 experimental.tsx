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

export function ArtistGallery({ images }: ArtistGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Lazy-load tracking by REAL slide index (0..N-1)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState(0);
  const rafId = useRef<number | null>(null);


  const N = images.length;

  // How many slides to clone at each end.
  // 1 is usually enough for "page-sized" slides; 2 is safer if you allow partial peeks.
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
      // Because your slides are 100% width, slide width == container clientWidth.
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

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || N === 0) return;

    const w = slideWidthRef.current;
    if (!w) return;

    // Midpoint of the viewport in scroll-content coordinates
    const viewportMid = el.scrollLeft + el.clientWidth / 2;

    // Which virtual slide midpoint is closest to viewport midpoint?
    // slide center positions are: (i * w + w/2)
    const virtualIndex = Math.round((viewportMid - w / 2) / w);

    // Now check the distance to be sure we're actually centered (tolerance)
    const slideMid = virtualIndex * w + w / 2;
    const dist = Math.abs(viewportMid - slideMid);
    // console.log(viewportMid, slideMid);

    // Tolerance: how close counts as "midpoint reached midpoint"?
    // 1-2px is strict; 8-12px is more forgiving (esp. fractional scrolling).
    const EPS = 20;

    const firstReal = CLONES;              // virtual index of real slide 0
    const lastReal = CLONES + (N - 1);     // virtual index of real slide N-1
    const isCentered = dist <= EPS && lastLoggedVirtual.current !== virtualIndex;
    const isCenteredOrBeyondInRightCloneRegion = viewportMid >= slideMid - EPS && virtualIndex > lastReal;
    const isCenteredOrBeyondInLeftCloneRegion = viewportMid <= slideMid + EPS && virtualIndex < firstReal;

    lastLoggedVirtual.current = isCentered ? virtualIndex : lastLoggedVirtual.current;

    // In left clone region
    if (virtualIndex < firstReal && isCenteredOrBeyondInLeftCloneRegion) {
      console.log("In left clone region");
      const realIndex = mod(virtualIndex - CLONES, N);
      console.log("Centered!", { virtualIndex, realIndex });
      normalizeIfNeeded();
    }

    // In right clone region
    if (virtualIndex > lastReal && isCenteredOrBeyondInRightCloneRegion) {
      console.log("In right clone region");
      const realIndex = mod(virtualIndex - CLONES, N);
      console.log("Centered!", { virtualIndex, realIndex });
      normalizeIfNeeded();

    }

    // if (dist <= EPS && lastLoggedVirtual.current !== virtualIndex) {
    //   lastLoggedVirtual.current = virtualIndex;

    //   const realIndex = mod(virtualIndex - CLONES, N);
    //   console.log("Centered!", { virtualIndex, realIndex });
    //   normalizeIfNeeded();
    // }

    // Optional: reset when we're no longer centered, so it can log again
    if (dist > EPS && lastLoggedVirtual.current === virtualIndex) {
      lastLoggedVirtual.current = null;
    }
  };

  // The core: if we end up in clone zones, silently jump to the matching real slide.
  const normalizeIfNeeded = () => {
    const el = containerRef.current;
    if (!el || N === 0) return;

    const w = slideWidthRef.current;
    if (!w) return;

    // Current "page" (virtual index)
    const virtualIndex = Math.round(el.scrollLeft / w);

    const firstReal = CLONES;              // virtual index of real slide 0
    const lastReal = CLONES + (N - 1);     // virtual index of real slide N-1

    // In left clone region
    if (virtualIndex < firstReal) {
      const realIndex = mod(virtualIndex - CLONES, N); // maps clone -> real
      const targetVirtual = CLONES + realIndex;

      jumpWithoutSnap(el, targetVirtual * w);
      return;
    }

    // In right clone region
    if (virtualIndex > lastReal) {
      const realIndex = mod(virtualIndex - CLONES, N);
      const targetVirtual = CLONES + realIndex;

      jumpWithoutSnap(el, targetVirtual * w);
      return;
    }
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

  // const handleScroll = () => {
  //   const el = containerRef.current;
  //   if (!el || N === 0) return;

  //   const w = slideWidthRef.current;
  //   if (!w) return;

  //   const virtualIndex = Math.round(el.scrollLeft / w);
  //   console.log("el?.scrollLeft", el?.scrollLeft);
  //   console.log("w", w);
  //   // if (rafId.current != null) {
  //   //   cancelAnimationFrame(rafId.current);
  //   // }
  // };

  const lastLoggedVirtual = useRef<number | null>(null);



  const lastScrollLeftRef = useRef<number>(0);
  const lastDirRef = useRef<"left" | "right" | null>(null);


  const handleScrollEnd = () => {
    console.log("scroll end - normalize if needed");
    normalizeIfNeeded();
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
        // onScrollCapture={() => console.log("WOOOO")}
        // onScrollEnd={handleScrollEnd}
        >
          {virtualImages.map((img, virtualIndex) => {
            // Map virtual index to REAL index (0..N-1)
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
