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

  // only when it's on screen at all
  if (!(rect.bottom > 0 && rect.top < vh)) return;

  const bgH = bg.getBoundingClientRect().height;

  const hiddenAboveFrac = 1 - startVisiblePercent / 100;
  const startY = -bgH * hiddenAboveFrac; // <= 0
  const endY = +bgH * hiddenAboveFrac;   // >= 0

  // Pick a slope k < 1 so bg never "catches up" to the viewport (no sticky).
  // Also keep y<=0 during entering (rect.top>0) by forcing c<=0.
  // And don't exceed endY by the time rect.top hits -rect.height.

  const eps = 0.5;

  // 1) Ensure c = startY + k*vh <= -eps  =>  k <= (-eps - startY)/vh
  // (startY is negative, so this is usually a positive bound)
  const kMaxEnter = (-eps - startY) / Math.max(vh, 1);

  // 2) Ensure y_end = startY + k*(vh + rect.height) <= endY
  // => k <= (endY - startY)/(vh + rect.height)
  const kMaxEnd = (endY - startY) / Math.max(vh + rect.height, 1);

  // 3) Always keep k meaningfully < 1 to avoid the sticky look
  const kMaxSticky = 0.95;

  const k = clamp(Math.min(kMaxEnter, kMaxEnd, kMaxSticky), 0, 1);

  const c = startY + k * vh;

  // Single linear mapping across the entire pass:
  let y = -k * rect.top + c;

  // Extra safety: honor your bounds
  y = clamp(y, startY, endY);

  // Your debug number: distance from viewport top (0) to bg top in viewport coords
  // (negative = above viewport top; near 0 = almost touching)
  // console.log(rect.top + y);

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
