function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function initFlushParallax({
  windowSel = ".parallax-window",
  mediaSel = ".parallax-media",
  reverse = true,
}: {
  windowSel?: string;
  mediaSel?: string;
  reverse?: boolean;
} = {}) {
  const win = document.querySelector<HTMLElement>(windowSel);
  const img = win?.querySelector<HTMLImageElement>(mediaSel);
  if (!win || !img) return;

  let travel = 0;

  const measure = () => {
    const winRect = win.getBoundingClientRect();
    const boxW = winRect.width;
    const boxH = winRect.height;

    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;

    // cover scale
    const s = Math.max(boxW / naturalW, boxH / naturalH);

    const renderedH = naturalH * s;            // the "virtual" cover height
    const renderedW = naturalW * s;

    // make the element actually that size so translating reveals more pixels
    img.style.width = `${renderedW}px`;
    img.style.height = `${renderedH}px`;
    img.style.left = "50%";
    img.style.transform = "translate3d(-50%, 0, 0)"; // center horizontally

    travel = Math.max(0, renderedH - boxH);
  };

  const update = () => {
    const winRect = win.getBoundingClientRect();
    const vh = window.innerHeight;

    // 0..1 while window passes through viewport
    const start = vh;
    const end = -winRect.height;
    const t = clamp01((start - winRect.top) / (start - end));

    const y = reverse ? lerp(0, -travel, t) : lerp(-travel, 0, t);

    // keep the horizontal centering, just add Y
    img.style.transform = `translate3d(-50%, ${y}px, 0)`;
  };

  const onResize = () => { measure(); update(); };

  if (img.complete) measure();
  else img.addEventListener("load", () => { measure(); update(); }, { once: true });

  measure();
  update();

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
}
