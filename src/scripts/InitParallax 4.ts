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
  if (!windows.length) return () => { };

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

    // Only bother if the window is on screen at all
    const isVisible = rect.bottom > 0 && rect.top < vh;
    if (!isVisible) return;

    const bgH = bg.getBoundingClientRect().height;

    const hiddenAboveFrac = 1 - startVisiblePercent / 100;
    const startY = -bgH * hiddenAboveFrac;
    const endY = +bgH * hiddenAboveFrac;

    let y: number;

    if (rect.top > 0) {
      // ENTERING: rect.top goes vh -> 0
      // Force y to stay <= 0 the entire time by interpolating startY -> 0.
      const tEnter = clamp((vh - rect.top) / vh, 0, 1);
      y = lerp(startY, 0, tEnter);
      // (y will never exceed 0 as long as startY <= 0, which it is)
    } else {
      // PASSING/LEAVING: rect.top goes 0 -> -rect.height
      const tPass = clamp((-rect.top) / rect.height, 0, 1);
      y = lerp(0, endY, tPass);

      // Critical constraint while viewport top is within the window:
      // bgTop = rect.top + y must not go below viewport top (0)
      // => y <= -rect.top
      y = Math.min(y, -rect.top);
    }

    bg.style.transform = `translate3d(0, ${y}px, 0)`;
  };

  const updateAll = () => {
    raf = 0;
    for (const w of active) updateOne(w);
  };

  const onScroll = () => requestTick();
  const onResize = () => requestTick();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  updateAll();

  return () => {
    if (io) io.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    if (raf) cancelAnimationFrame(raf);
  };
}
