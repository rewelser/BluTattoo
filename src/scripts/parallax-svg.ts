export function initParallaxSvgs(selector = ".parallax-svg") {
    const items = Array.from(
        document.querySelectorAll(selector)
    ) as (HTMLElement | SVGElement)[];

    let ticking = false;
    let lastY = window.scrollY;
    let dir = "rest";

    const begin = (root: Element, id: string) => {
        const anim = root.querySelector<SVGAnimateElement>(`#${id}`);
        (anim as any)?.beginElement?.();
    };

    const morphAll = (kind: "up" | "down" | "rest") => {
        for (const el of items) {
            const svg =
                el instanceof SVGElement
                    ? el
                    : el.querySelector("svg");

            if (!svg) continue;

            if (kind === "up") begin(svg, "morph-up");
            else if (kind === "down") begin(svg, "morph-down");
            else begin(svg, "morph-rest");
        }
    };

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        const newDir = window.scrollY > lastY ? "up" : "down"
        if (dir !== newDir) {
            dir = newDir;
            morphAll(dir as "rest" | "up" | "down");
        }

        lastY = window.scrollY;

        requestAnimationFrame(() => {
            for (const el of items) {
                const speed = Number(el.dataset?.speed ?? 0.3);
                const offset = Number(el.dataset?.offset ?? 0);

                el.style.transform = `translate3d(0, ${-(window.scrollY * speed) + offset}px, 0)`;
            }

            ticking = false;
        });
    }

    const onScrollEnd = () => {
        dir = "rest";
        morphAll(dir as "rest" | "up" | "down");
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd);
    return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("scrollend", onScrollEnd);
    }
}
