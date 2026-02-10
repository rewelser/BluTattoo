// parallax.ts
type ParallaxOptions = {
  /** 0..100. 0 = starts as far up as possible, 100 = starts centered (no initial offset). */
  startVisiblePercent?: number;

  /**
   * How tall the moving layer is relative to the window height.
   * 2 = 200% (common), 3 = 300% (slower / more travel headroom).
   */
  oversize?: number;

  /** Only animate when near view. */
  smart?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function initParallax(options: ParallaxOptions = {}) {
  const startVisiblePercent = clamp(options.startVisiblePercent ?? 0, 0, 100);
  const oversize = Math.max(1, options.oversize ?? 2);
  const smart = options.smart ?? true;

  const windows = Array.from(document.querySelectorAll<HTMLElement>(".parallax-window"));
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
    for (const w of windows) io.observe(w);
  }

  const requestTick = () => {
    if (!raf) raf = requestAnimationFrame(updateAll);
  };

  const ensureSizing = (win: HTMLElement, bg: HTMLElement) => {
    // Window must clip
    // (If you prefer not to do it in TS, set overflow-hidden in your class list.)
    if (getComputedStyle(win).overflow === "visible") {
      win.style.overflow = "hidden";
    }

    const winH = win.getBoundingClientRect().height;

    // Make bg taller than window and vertically centered.
    // Total height = oversize * windowHeight.
    bg.style.height = `${winH * oversize}px`;
    bg.style.top = "50%";
    bg.style.bottom = "auto";
    bg.style.transform = "translate3d(0, 0, 0)"; // will be overwritten each tick
    bg.style.willChange = "transform";
    bg.style.position = "absolute";
    bg.style.left = "0";
    bg.style.right = "0";

    // Center it: we’ll apply -50% via translateY in the update tick (so we can add motion cleanly)
  };

  const updateOne = (win: HTMLElement) => {
    const bg = win.querySelector<HTMLElement>(".parallax-bg");
    if (!bg) return;

    ensureSizing(win, bg);

    const rect = win.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // Progress across the entire time the section travels through the viewport:
    // 0 when top is at viewport bottom, 1 when bottom is at viewport top
    const progress = clamp((vh - rect.top) / (vh + rect.height), 0, 1);

    const winH = rect.height;
    const bgH = winH * oversize;

    // Max travel available without ever showing a gap:
    // (bg is taller than window by extra = bgH - winH, so we can shift by extra/2 up or down)
    const maxShift = (bgH - winH) / 2;

    // Your knob: 0 => start as far up as possible (-maxShift),
    // 25 => start at -0.75*maxShift, etc.
    const hiddenAboveFrac = 1 - startVisiblePercent / 100;

    const startY = -maxShift * hiddenAboveFrac;
    const endY = +maxShift * hiddenAboveFrac;

    const y = lerp(startY, endY, progress);

    // We center bg at 50% via -50% translate, then add parallax shift
    bg.style.transform = `translate3d(0, calc(-50% + ${y}px), 0)`;
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
