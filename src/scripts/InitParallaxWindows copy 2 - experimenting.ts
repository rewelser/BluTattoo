// export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.1) {
export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 1, parallaxInScrollDirection = false) {

    const roots = Array.from(document.querySelectorAll(selector));
    const vh = document.documentElement.clientHeight * 0.01;

    type ParallaxBg = {
        parallaxWindow: Element | null;
        parallaxBg: Element | null;
        parallaxBgH: number | undefined;
        imgH: number;
        speed: number;
    };

    const parallaxBgs: ParallaxBg[] = [];

    for (const root of roots) {

        const add = (parallaxWindow: Element | null, parallaxBg: Element | null, parallaxBgH: number | undefined, imgH: number, speed: number) => {

            parallaxBgs.push({
                parallaxWindow: root,
                parallaxBg: parallaxBg,
                parallaxBgH: parallaxBgH,
                imgH,
                speed,
            });
        };

        const rect = root.getBoundingClientRect();
        if (!rect) return;
        // const naturalH = img.naturalHeight
        // const img = win?.querySelector<HTMLImageElement>(mediaSel);
        const imgH = 1100;
        const parallaxBg = root.querySelector(nestedSelector);
        const parallaxBgH = parallaxBg?.getBoundingClientRect().height;

        add(root, parallaxBg, parallaxBgH, imgH, speed);
    }

    let ticking = false;
    let lastScrollY = window.scrollY;

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        let scrollDirection = "";

        const y = window.scrollY;
        if (y !== lastScrollY) {
            scrollDirection = y > lastScrollY ? "down" : "up";
            lastScrollY = y;
        }

        requestAnimationFrame(() => {

            for (const { parallaxWindow, parallaxBg, parallaxBgH, imgH, speed } of parallaxBgs) {
                // These seemed to cause a jump on iOS Chrome:
                // const viewportH = window.visualViewport?.height ?? window.innerHeight;

                // Whereas this did not:
                const viewportH = document.documentElement.clientHeight;

                const r = parallaxWindow?.getBoundingClientRect();
                if (!r) return;
                const onScreen = r && r.bottom > 0 && r.top < viewportH;

                let progFraction = Math.min(
                    1, Math.max(0,
                        (viewportH - r.top) / (viewportH + r.height)
                    )
                );

                let progressPercent = progFraction * 100;
                if (parallaxInScrollDirection) {
                    progFraction = (1 - progFraction);
                    progressPercent = (100 - progressPercent);
                }

                const offsetY = (-imgH) + (parallaxBgH! - (-imgH)) * progFraction;
                const percentY = (100 * offsetY) / (parallaxBgH! - imgH);
                // console.log("percentY,", percentY);

                const element = parallaxBg as HTMLElement;
                if (element && onScreen) {
                    // element.style.backgroundPosition = `50% ${progressPercent}%`;
                    element.style.backgroundPosition = `50% ${offsetY}px`;
                }
            }

            ticking = false;
        });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
}
