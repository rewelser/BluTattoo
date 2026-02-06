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

  const measure = () => {
    // READ sizes only — do not set width/height anywhere
    const winRect = win.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    travel = Math.max(0, imgRect.height - winRect.height);
  };

  const update = () => {
    const winRect = win.getBoundingClientRect();
    const vh = document.documentElement.clientHeight;

    // progress 0..1 as window moves through viewport
    const start = vh;
    const end = -winRect.height;
    const t = clamp01((start - winRect.top) / (start - end));

    const y = reverse ? lerp(0, -travel, t) : lerp(-travel, 0, t);
    img.style.setProperty("--py", `${y}px`);
  };

  const refresh = () => { measure(); update(); };

  // If the image loads after script runs, measure again
  if (img instanceof HTMLImageElement) {
    if (!img.complete) img.addEventListener("load", refresh, { once: true });
  }

  refresh();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", refresh, { passive: true });
}
