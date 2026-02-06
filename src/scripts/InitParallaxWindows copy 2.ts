// export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.1) {
export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.2) {

    const roots = Array.from(document.querySelectorAll(selector));
    let VIEWPORT_H = window.innerHeight;

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

            for (const { parallaxWindow, parallaxBg } of parallaxBgs) {
                // These seemed to cause a jump on iOS Chrome:
                // const viewportH = window.visualViewport?.height ?? window.innerHeight;

                // Whereas this did not:
                const viewportH = document.documentElement.clientHeight;
                const r = parallaxWindow?.getBoundingClientRect();
                if (!r) return;

                const onScreen = r && r.bottom > 0 && r.top < window.innerHeight;
                const progress = Math.round(
                    Math.min(
                        1, Math.max(0,
                            (viewportH - r.top) / (viewportH + r.height)
                        )
                    ) * 100
                ) + "%";
                const progress2 = Math.min(
                    1, Math.max(0,
                        (document.documentElement.clientHeight - r.top) / (document.documentElement.clientHeight + r.height)
                    )
                ) * 100;
                // console.log(progress2);

                const element = parallaxBg as HTMLElement;
                if (element && onScreen) {
                    element.style.backgroundPosition = `50% ${progress2}%`;
                }
            }

            ticking = false;
        });
    };

    window.addEventListener("resize", () => {
        VIEWPORT_H = window.innerHeight;
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
}
