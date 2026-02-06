export function initParallaxSvgLayers(selector = ".parallax-svg") {

    const roots = Array.from(document.querySelectorAll(selector));

    const getSvgRoot = (el: Element): SVGSVGElement | null => {
        if (el instanceof SVGSVGElement) return el;
        return el.querySelector("svg");
    };

    const findById = <T extends Element>(svg: SVGSVGElement, id: string): T | null =>
        svg.querySelector<T>(`[id="${CSS.escape(id)}"]`);

    type Layer = {
        el: SVGGElement;
        speed: number;
        startOffset: number;   // <-- NEW
        baseTransform: string;
    };

    const layers: Layer[] = [];

    for (const root of roots) {
        const svg = getSvgRoot(root);
        if (!svg) continue;

        const add = (id: string, speed: number, startOffset = 0) => {
            const g = findById<SVGGElement>(svg, id);
            if (!g) return;

            layers.push({
                el: g,
                speed,
                startOffset,
                baseTransform: g.getAttribute("transform") ?? "",
            });
        };

        // Background starts lower, foreground starts less low (tune to taste)
        // add("circles",   0.12, 80);
        // add("filigree",  0.22, 50);
        // add("red panes", 0.35, 25);

        const el = document.querySelector<HTMLElement>(".parallax-layered-svg-container");
        // const el = document.querySelector<HTMLElement>(".promo-outline");
        // const el = document.querySelector<HTMLElement>("#sticky-nav-desktop");
        const rect = el?.getBoundingClientRect();
        if (!rect) return;
        // console.log("rect?.y:", rect?.y);
        // console.log("Math.abs(rect.height / 2):", Math.round(rect.height / 2));
        // console.log("Y (viewport):", rect?.y + Math.abs(rect.height / 2));

        const ALIGN_AT_PX = (rect.top + (rect.height / 2) + window.scrollY) - (window.innerHeight / 2); // when everything lines up
        // const ALIGN_AT_PX = 2200; // when everything lines up
        // console.log("ALIGN_AT_PX", ALIGN_AT_PX);
        // add("circles",   0.9, 0);
        // add("filigree",  0.5, 0);
        // add("red panes", 0.4, 0);
        add("circles", 0.9, 0.9 * ALIGN_AT_PX);
        add("filigree", 0.5, 0.5 * ALIGN_AT_PX);
        add("red panes", 0.4, 0.4 * ALIGN_AT_PX);
    }

    let ticking = false;

    const onScroll = () => {

        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            const y = window.scrollY;

            for (const { el, speed, startOffset, baseTransform } of layers) {
                // startOffset pushes down initially; scroll pulls upward
                const ty = startOffset - (y * speed);
                const parallax = `translate(0 ${ty})`;
                el.setAttribute("transform", baseTransform ? `${baseTransform} ${parallax}` : parallax);
            }

            ticking = false;
        });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
}
