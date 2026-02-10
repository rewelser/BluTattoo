export function initParallaxWindows(
  selector = ".parallax-window",
  nestedSelector = ".parallax-bg",
  speed = 0.2
) {
  const roots = Array.from(document.querySelectorAll(selector));

  type ParallaxBg = {
    parallaxWindow: Element | null;
    parallaxBg: Element | null;
    speed: number;
  };

  const parallaxBgs: ParallaxBg[] = [];

  for (const root of roots) {
    parallaxBgs.push({
      parallaxWindow: root,
      parallaxBg: root.querySelector(nestedSelector),
      speed,
    });
  }

  // ✅ Use a stable "layout viewport" height; tends to be less twitchy than innerHeight on iOS.
  let STABLE_VH = document.documentElement.clientHeight;

  // Update STABLE_VH only after things settle (prevents direction-change UI jumps from affecting math).
  let resizeTimer: number | undefined;
  const scheduleStableViewportUpdate = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      STABLE_VH = document.documentElement.clientHeight;
      // If you prefer visualViewport when available, swap next line in:
      // STABLE_VH = window.visualViewport?.height ?? document.documentElement.clientHeight;
    }, 150);
  };

  window.addEventListener("resize", scheduleStableViewportUpdate);
  window.visualViewport?.addEventListener("resize", scheduleStableViewportUpdate);

  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      for (const { parallaxWindow, parallaxBg } of parallaxBgs) {
        const r = parallaxWindow?.getBoundingClientRect();
        if (!r) continue;

        const onScreen = r.bottom > 0 && r.top < STABLE_VH;
        if (!onScreen) continue;

        const progress =
          Math.min(1, Math.max(0, (STABLE_VH - r.top) / (STABLE_VH + r.height))) * 100;

        const element = parallaxBg as HTMLElement | null;
        if (element) {
          element.style.backgroundPosition = `50% ${100 - progress}%`;
        }
      }

      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", scheduleStableViewportUpdate);
    window.visualViewport?.removeEventListener("resize", scheduleStableViewportUpdate);
  };
}
