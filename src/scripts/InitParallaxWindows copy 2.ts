// export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.1) {
export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 1, directionReversed = false) {

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

            for (const { parallaxWindow, parallaxBg, speed } of parallaxBgs) {
                // These seemed to cause a jump on iOS Chrome:
                // const viewportH = window.visualViewport?.height ?? window.innerHeight;

                // Whereas this did not:
                const viewportH = document.documentElement.clientHeight;

                const r = parallaxWindow?.getBoundingClientRect();
                if (!r) return;
                const onScreen = r && r.bottom > 0 && r.top < viewportH;

                // const baselinePercent = 100 - speed * 100;
                // console.log(baselinePercent);
                let progressPercent = Math.min(
                    1, Math.max(0,
                        (viewportH - r.top) / (viewportH + r.height)
                    )
                ) * 100 * speed;

                progressPercent = directionReversed ? progressPercent : 100 - progressPercent;

                const element = parallaxBg as HTMLElement;
                if (element && onScreen) {
                    element.style.backgroundPosition = `50% ${progressPercent}%`;
                }
            }

            ticking = false;
        });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
}
