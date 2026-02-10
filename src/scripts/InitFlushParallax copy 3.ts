function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function initParallaxY({
  windowSel = ".parallax-window",
  imgSel = ".parallax-media",
  reverse = false,
}: {
  windowSel?: string;
  imgSel?: string;
  reverse?: boolean;
} = {}) {
  const win = document.querySelector<HTMLElement>(windowSel);
  const img = win?.querySelector<HTMLElement>(imgSel);
  if (!win || !img) return;

  let travel = 0;
  let winTopDoc = 0;
  let winH = 0;

  let ticking = false;

  const measure = () => {
    // Document-relative top so we don't call getBoundingClientRect on every scroll
    const rect = win.getBoundingClientRect();
    winH = rect.height;
    winTopDoc = rect.top + window.scrollY;

    const imgRect = img.getBoundingClientRect();
    travel = Math.max(0, imgRect.height - winH);
  };

  const update = () => {
    ticking = false;

    const vh = document.documentElement.clientHeight;
    const scrollY = window.scrollY;

    // Window top relative to viewport = docTop - scrollY
    const top = winTopDoc - scrollY;

    const start = vh;
    const end = -winH;
    const t = clamp01((start - top) / (start - end));

    // const y = reverse ? lerp(0, -travel, t) : lerp(-travel, 0, t);
    const y = reverse ? lerp(0, -travel, t) : lerp(-travel + 300, 0, t);
    console.log(t);
    // const y = reverse ? lerp(0, -travel, t) : lerp(0, travel, t);

    // Optional: quantize to reduce subpixel shimmer on some GPUs
    img.style.setProperty("--py", `${Math.round(y)}px`);
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  const refresh = () => { measure(); update(); };

  if (img instanceof HTMLImageElement && !img.complete) {
    img.addEventListener("load", refresh, { once: true });
  }

  refresh();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh, { passive: true });
}
