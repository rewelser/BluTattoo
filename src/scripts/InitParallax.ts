// parallax.ts
type ParallaxOptions = {
  /**
   * 0..100
   * How much of the bg height starts "not hidden above" (i.e. already down).
   * Example: 25 => starts hidden above by 75% of its height.
   *
   * 0   => starts hidden above by 100% (fully above)
   * 100 => starts hidden above by 0%   (flush at top)
   */
  startVisiblePercent?: number;

  /** If true, uses IntersectionObserver to only animate when near view. */
  smart?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function initParallax(options: ParallaxOptions = {}) {
  const startVisiblePercent = clamp(options.startVisiblePercent ?? 0, 0, 100);
  const smart = options.smart ?? true;

  const windows = Array.from(document.querySelectorAll<HTMLElement>(".parallax-window"));
  if (!windows.length) return () => {};

  let raf = 0;
  let active = new Set<HTMLElement>(windows);

  // If "smart", only update elements near/in view.
  let io: IntersectionObserver | null = null;
  if (smart && "IntersectionObserver" in window) {
    active = new Set(); // start empty; IO will populate
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) active.add(e.target as HTMLElement);
          else active.delete(e.target as HTMLElement);
        }
        requestTick();
      },
      // Start updating a bit before it enters / after it leaves
      { root: null, threshold: 0, rootMargin: "200px 0px 200px 0px" }
    );

    for (const w of windows) io.observe(w);
  }

  const requestTick = () => {
    if (!raf) raf = requestAnimationFrame(updateAll);
  };

  const updateOne = (win: HTMLElement) => {
    const bg = win.querySelector<HTMLElement>(".parallax-bg");
    if (!bg) return;

    const rect = win.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // progress: 0 when window top is at viewport bottom (entering)
    //           1 when window bottom is at viewport top (leaving)
    const progress = clamp((vh - rect.top) / (vh + rect.height), 0, 1);

    // measure bg height (use its rendered box)
    const bgH = bg.getBoundingClientRect().height;

    // hiddenAboveFrac: 1.0 => fully hidden above by its own height
    //                  0.75 => hidden above by 75% of its height, etc.
    const hiddenAboveFrac = 1 - startVisiblePercent / 100;

    const startY = -bgH * hiddenAboveFrac;
    const endY = +bgH * hiddenAboveFrac;

    const y = lerp(startY, endY, progress);
    bg.style.transform = `translate3d(0, ${y}px, 0)`;
  };

  const updateAll = () => {
    raf = 0;
    for (const w of active) updateOne(w);
  };

  // initial + events
  const onScroll = () => requestTick();
  const onResize = () => requestTick();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  // set initial position immediately
  updateAll();

  // cleanup
  return () => {
    if (io) io.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    if (raf) cancelAnimationFrame(raf);
  };
}
