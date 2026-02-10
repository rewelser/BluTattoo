// export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.1) {
export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.2) {

    const roots = Array.from(document.querySelectorAll(selector));

    type ParallaxBg = {
        parallaxWindow: Element | null;
        parallaxBg: Element | null;
        speed: number;
    };

    const parallaxBgs: ParallaxBg[] = [];

    for (const root of roots) {

        const add = (parallaxWindow: Element | null, parallaxBg: Element | null, speed: number) => {

            parallaxBgs.push({
                parallaxWindow: root,
                parallaxBg: parallaxBg,
                speed,
            });
        };

        const rect = root.getBoundingClientRect();
        if (!rect) return;

        add(root, root.querySelector(nestedSelector), speed);
    }

    let ticking = false;

    const onScroll = () => {

        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
console.log("sdgsdfsdf");
            for (const { parallaxWindow, parallaxBg } of parallaxBgs) {
                const r = parallaxWindow?.getBoundingClientRect();
                if (!r) return;
                const onScreen = r && r.bottom > 0 && r.top < window.innerHeight;
                const progress = Math.round(
                    Math.min(
                        1, Math.max(0,
                            (window.innerHeight - r.top) / (window.innerHeight + r.height)
                        )
                    ) * 100
                ) + "%";

                const element = parallaxBg as HTMLElement;
                if (element && onScreen) {
                    element.style.objectPosition = `50% ${progress}`;
                }
            }

            ticking = false;
        });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
}
