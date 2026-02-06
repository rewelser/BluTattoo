function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function initFlushParallax({
  windowSel = ".parallax-window",
  bgSel = ".parallax-bg",
  imgSel = "img",
  reverse = false,   // reverse-direction parallax by default
}: {
  windowSel?: string;
  bgSel?: string;
  imgSel?: string;
  reverse?: boolean;
} = {}) {
  const win = document.querySelector<HTMLElement>(windowSel);
  if (!win) return;

  const bg = win.querySelector<HTMLElement>(bgSel);
  const img = bg?.querySelector<HTMLImageElement>(imgSel);
  if (!bg || !img) return;

  // ensure sizing works
  bg.style.position = "absolute";
  bg.style.inset = "0";
  img.style.width = "100%";
  img.style.height = "100%";
//   img.style.objectFit = "cover";

  let travel = 0;

  const measure = () => {
    // force layout with latest sizes
    const winRect = win.getBoundingClientRect();

    // We want the *rendered* image size.
    // With object-cover on an <img> sized to the bg, the "content" is cropped,
    // but the element itself is winRect size. So we need travel based on the
    // "cover scale" rather than img.getBoundingClientRect().
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;

    const boxW = winRect.width;
    const boxH = winRect.height;

    // cover scale factor
    const s = Math.max(boxW / naturalW, boxH / naturalH);
    const renderedH = naturalH * s;
    console.log("naturalH, s, naturalH * s", naturalH, s, naturalH * s);

    travel = Math.max(0, renderedH - boxH);
    // console.log("renderedH, boxH, renderedH - boxH", renderedH, boxH, renderedH - boxH);
  };

  const update = () => {
    const winRect = win.getBoundingClientRect();
    const vh = window.innerHeight;

    // progress 0..1 as the window moves through viewport:
    // 0 when window top hits bottom of viewport
    // 1 when window bottom hits top of viewport
    const start = vh;
    const end = -winRect.height;
    const t = clamp01((start - winRect.top) / (start - end));

    // map progress to transform
    const from = 0;
    const to = -travel;

    const y = reverse ? lerp(from, to, t) : lerp(to, from, t);
    console.log("y",y);
    console.log("lerp(to, from, t)", to, from, t);
    bg.style.transform = `translate3d(0, ${y}px, 0)`;
  };

  const onResize = () => { measure(); update(); };

  // Wait until the image is loaded so naturalWidth/Height are correct
  if (img.complete) measure();
  else img.addEventListener("load", measure, { once: true });

  measure();
  update();

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
}
