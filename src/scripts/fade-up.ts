// src/scripts/fade-up.ts
export type FadeUpOptions = {
  threshold?: number;
  rootMargin?: string;
  observeMutations?: boolean; // auto-bind late-added nodes
};

const DEFAULTS: Required<FadeUpOptions> = {
  threshold: 0.15,
  rootMargin: "0px 0px -10% 0px",
  observeMutations: true,
};

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Bind fade-up behavior to any `.js-fade-up` elements under `root`
 * that haven't been bound yet.
 */
export function initFadeUp(root: ParentNode = document, options: FadeUpOptions = {}) {
  if (!isBrowser()) return () => {};

  const { threshold, rootMargin } = { ...DEFAULTS, ...options };

  const els = Array.from(
    root.querySelectorAll<HTMLElement>(".js-fade-up:not([data-fade-bound])")
  );

  if (!els.length) return () => {};

  // Mark so we don't double-observe
  for (const el of els) el.dataset.fadeBound = "true";

  // If IO isn't supported, just reveal immediately
  if (!("IntersectionObserver" in window)) {
    for (const el of els) el.classList.add("is-in");
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add("is-in");
        io.unobserve(el); // animate once
      }
    },
    { threshold, rootMargin }
  );

  els.forEach((el) => io.observe(el));

  // cleanup for this batch
  return () => {
    els.forEach((el) => io.unobserve(el));
    io.disconnect();
  };
}

/**
 * Global bootstrap:
 * - runs once on load
 * - re-runs on Astro navigation swaps
 * - optionally observes DOM mutations to bind late-added elements
 */
export function bootFadeUp(options: FadeUpOptions = {}) {
  if (!isBrowser()) return () => {};

  const opts = { ...DEFAULTS, ...options };

  // Bind current DOM
  initFadeUp(document, opts);

  // Astro navigation hooks
  const onAstro = () => initFadeUp(document, opts);
  document.addEventListener("astro:page-load", onAstro);
  document.addEventListener("astro:after-swap", onAstro);

  // Optional: watch for injected nodes and bind only within those subtrees
  let mo: MutationObserver | null = null;
  if (opts.observeMutations && "MutationObserver" in window) {
    mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;

          // If the node itself is fade-up or contains fade-up descendants, bind within it
          if (node.matches(".js-fade-up") || node.querySelector(".js-fade-up")) {
            initFadeUp(node, opts);
          }
        }
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // cleanup
  return () => {
    document.removeEventListener("astro:page-load", onAstro);
    document.removeEventListener("astro:after-swap", onAstro);
    mo?.disconnect();
  };
}