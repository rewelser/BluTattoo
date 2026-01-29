export function initParallaxSvgs(selector = ".parallax-svg") {
    const items = Array.from(
        document.querySelectorAll(selector)
    ) as (HTMLElement | SVGElement)[];
    console.log(items);

    let ticking = false;

    // ---- helper: trigger SMIL animate inside an svg ----
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

    // ---- debug buttons injected into DOM ----
    const panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.bottom = "12px";
    panel.style.right = "12px";
    panel.style.display = "flex";
    panel.style.gap = "8px";
    panel.style.zIndex = "9999";

    const makeBtn = (label: string, onClick: () => void) => {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.padding = "6px 10px";
        btn.style.fontSize = "12px";
        btn.style.borderRadius = "6px";
        btn.style.border = "1px solid #555";
        btn.style.background = "#111";
        btn.style.color = "#fff";
        btn.style.cursor = "pointer";
        btn.onclick = onClick;
        return btn;
    };

    panel.appendChild(makeBtn("Morph Up", () => morphAll("up")));
    panel.appendChild(makeBtn("Morph Down", () => morphAll("down")));
    panel.appendChild(makeBtn("Morph Rest", () => morphAll("rest")));

    document.body.appendChild(panel);

    // ---- your original scroll logic ----
    const onScroll = () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            for (const el of items) {
                const speed = Number(el.dataset?.speed ?? 0.3);
                const offset = Number(el.dataset?.offset ?? 0);

                el.style.transform = `translate3d(0, ${-(window.scrollY * speed) + offset}px, 0)`;
            }

            ticking = false;
        });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
        window.removeEventListener("scroll", onScroll);
        panel.remove();
    };
}
