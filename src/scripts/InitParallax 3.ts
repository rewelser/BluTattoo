// parallax.ts
type ParallaxOptions = {
  /**
   * 0..100
   * 0   => starts hidden above by 100% of bg height
   * 25  => starts hidden above by 75%
   * 100 => starts flush at top
   */
  startVisiblePercent?: number;

  /**
   * Scroll speed multiplier.
   * 1   = normal
   * 0.5 = half speed (slower)
   * 0.25 = very slow
   */
  speed?: number;

  smart?: boolean;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * t;

export function initParallax(options: ParallaxOptions = {}) {
  const startVisiblePercent = clamp(options.startVisiblePercent ?? 0, 0, 100);
  const speed = options.speed ?? 1;
  const smart = options.smart ?? true;

  const windows = Array.from(
    document.querySelectorAll<HTMLElement>(".parallax-window")
  );
  if (!windows.length) return () => {};

  let raf = 0;
  let active = new Set<HTMLElement>(windows);

  let io: IntersectionObserver | null = null;
  if (smart && "IntersectionObserver" in window) {
    active = new Set();
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) active.add(e.target as HTMLElement);
          else active.delete(e.target as HTMLElement);
        }
        requestTick();
      },
      { rootMargin: "200px 0px 200px 0px", threshold: 0 }
    );
    windows.forEach(w => io!.observe(w));
  }

  const requestTick = () => {
    if (!raf) raf = requestAnimationFrame(updateAll);
  };

  const updateOne = (win: HTMLElement) => {
    const bg = win.querySelector<HTMLElement>(".parallax-bg");
    if (!bg) return;

    const rect = win.getBoundingClientRect();
    const vh = window.innerHeight;

    // Normalized progress: 0 → entering viewport, 1 → leaving
    let progress =
      (vh - rect.top) / (vh + rect.height);

    progress = clamp(progress * speed, 0, 1);

    const bgH = bg.getBoundingClientRect().height;

    const hiddenAboveFrac = 1 - startVisiblePercent / 100;
    const travel = bgH * hiddenAboveFrac;

    const startY = -travel;
    const endY = +travel;

    const y = lerp(startY, endY, progress);
    bg.style.transform = `translate3d(0, ${y}px, 0)`;
  };

  const updateAll = () => {
    raf = 0;
    for (const w of active) updateOne(w);
  };

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);

  updateAll();

  return () => {
    if (io) io.disconnect();
    window.removeEventListener("scroll", requestTick);
    window.removeEventListener("resize", requestTick);
    if (raf) cancelAnimationFrame(raf);
  };
}
