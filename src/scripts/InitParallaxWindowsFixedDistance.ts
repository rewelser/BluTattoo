type ParallaxOptions = {
  selector?: string;
  nestedSelector?: string;

  /**
   * How many scroll pixels should it take to go from start -> end.
   * Bigger = slower parallax. Constant across devices.
   */
  scrollLengthPx?: number;

  /**
   * Multiply progress (acts like "speed"). 1 = normal.
   * If you use this, keep it <= 1 for "slower than scroll".
   */
  speed?: number;

  /**
   * true = parallax moves with scroll direction (your "in-direction" case)
   * false = reverse
   */
  parallaxInScrollDirection?: boolean;

  /**
   * Round backgroundPositionY to whole pixels (recommended for iOS seams)
   */
  roundPx?: boolean;
};

type BgInfo = {
  winEl: HTMLElement;
  bgEl: HTMLElement;
  imgW: number;
  imgH: number;
  // cached computed background-size string (optional)
  lastBgSize?: string;
  // cached rendered height result (optional)
  lastRenderedH?: number;
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

// Extract url(...) from computed background-image
const getBgUrl = (el: HTMLElement): string | null => {
  const bg = getComputedStyle(el).backgroundImage;
  const m = bg.match(/url\(["']?(.*?)["']?\)/);
  return m?.[1] ?? null;
};

// Parse background-size into a rendered size (NO assumption of cover)
const getRenderedBgHeightPx = (el: HTMLElement, imgW: number, imgH: number): number => {
  const cs = getComputedStyle(el);
  const bgSize = cs.backgroundSize.trim();

  // common keywords
  if (bgSize === "contain") {
    const Cw = el.clientWidth;
    const Ch = el.clientHeight;
    const scale = Math.min(Cw / imgW, Ch / imgH);
    return imgH * scale;
  }
  if (bgSize === "cover") {
    // you said you're not using cover, but handle anyway (harmless)
    const Cw = el.clientWidth;
    const Ch = el.clientHeight;
    const scale = Math.max(Cw / imgW, Ch / imgH);
    return imgH * scale;
  }

  // explicit sizes: "auto", "100% auto", "800px 600px", etc.
  const parts = bgSize.split(/\s+/);
  const sxRaw = parts[0] ?? "auto";
  const syRaw = parts[1] ?? "auto";

  const Cw = el.clientWidth;
  const Ch = el.clientHeight;

  const parseLen = (v: string, basis: number): number | null => {
    if (v === "auto") return null;
    if (v.endsWith("px")) return Number.parseFloat(v);
    if (v.endsWith("%")) return (Number.parseFloat(v) / 100) * basis;
    return null;
  };

  const sx = parseLen(sxRaw, Cw);
  const sy = parseLen(syRaw, Ch);

  // both explicit
  if (sy != null) return sy;

  // width explicit, height auto => preserve aspect ratio
  if (sx != null && sy == null) return sx * (imgH / imgW);

  // both auto => natural size
  return imgH;
};

export async function initParallaxWindowsFixedDistance(
  opts: ParallaxOptions = {}
) {
  const {
    selector = ".parallax-window",
    nestedSelector = ".parallax-bg",
    scrollLengthPx = 1200,
    speed = 1,
    parallaxInScrollDirection = true,
    roundPx = true,
  } = opts;

  const windows = Array.from(document.querySelectorAll<HTMLElement>(selector));

  // Build list + preload image sizes
  const infos: BgInfo[] = [];
  await Promise.all(
    windows.map(async (winEl) => {
      const bgEl = winEl.querySelector<HTMLElement>(nestedSelector);
      if (!bgEl) return;

      const url = getBgUrl(bgEl);
      if (!url) return;

      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // fail soft
        img.src = url;
      });

      if (!img.naturalWidth || !img.naturalHeight) return;

      infos.push({
        winEl,
        bgEl,
        imgW: img.naturalWidth,
        imgH: img.naturalHeight,
      });
    })
  );

  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      const viewportH = document.documentElement.clientHeight;

      for (const info of infos) {
        const r = info.winEl.getBoundingClientRect();
        const onScreen = r.bottom > 0 && r.top < viewportH;
        if (!onScreen) continue;

        // Progress based on a FIXED scroll length:
        // t=0 when the window top hits viewport bottom (r.top === viewportH)
        const dist = viewportH - r.top; // increases as you scroll down
        let t = clamp01((dist / scrollLengthPx) * speed);

        // direction toggle
        if (!parallaxInScrollDirection) t = 1 - t;

        const C = info.bgEl.clientHeight;

        // Compute rendered background image height B using your current background-size
        // (cached a bit to avoid recomputing if unchanged)
        const cs = getComputedStyle(info.bgEl);
        if (info.lastBgSize !== cs.backgroundSize) {
          info.lastBgSize = cs.backgroundSize;
          info.lastRenderedH = getRenderedBgHeightPx(info.bgEl, info.imgW, info.imgH);
        }
        const B = info.lastRenderedH ?? info.imgH;

        // Desired travel:
        // start = -B (image bottom at container top)
        // end   = +C (image top at container bottom)
        const offsetY = (-B) + (C + B) * t;

        const y = roundPx ? Math.round(offsetY) : offsetY;
        info.bgEl.style.backgroundPosition = `50% ${y}px`;
      }

      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}
