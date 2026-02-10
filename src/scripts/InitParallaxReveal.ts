export function initRevealishContentFillParallax(
  selector = ".parallax-window",
  scale = 1.15,
  extraParallaxPx = 20,
  direction = 1
) {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let ticking = false;

  const update = () => {
    ticking = false;
    const vh = document.documentElement.clientHeight;

    for (const el of roots) {
      const r = el.getBoundingClientRect();
      const t = clamp((vh - r.top) / (vh + r.height), 0, 1);

      const h = el.clientHeight;

      // available pan range from scaling (top-to-bottom)
      const range = Math.max(0, (scale - 1) * h);

      // base pan traverses full range over the pass:
      // 0 => -range/2 (show “top” more)
      // 1 => +range/2 (show “bottom” more)
      const base = (t - 0.5) * range;

      // subtle extra parallax “feel”
      const par = direction * ((t - 0.5) * 2) * extraParallaxPx;

      const y = base + par;

      el.style.setProperty("--py", `${y.toFixed(2)}px`);
      el.style.setProperty("--scale", String(scale));
    }
  };

  const requestTick = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  requestTick();
}
