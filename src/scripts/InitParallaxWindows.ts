// export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.1) {
export function initParallaxWindows(selector = ".parallax-window", nestedSelector = ".parallax-bg", speed = 0.2) {

    const roots = Array.from(document.querySelectorAll(selector));

    type ParallaxBg = {
        parallaxWindow: Element | null;
        parallaxBg: Element | null;
        speed: number;
        startOffset: number;
    };

    const parallaxBgs: ParallaxBg[] = [];

    for (const root of roots) {

        const add = (parallaxWindow: Element | null, parallaxBg: Element | null, speed: number, startOffset = 0) => {

            parallaxBgs.push({
                parallaxWindow: root,
                parallaxBg: parallaxBg,
                speed,
                startOffset,
            });
        };

        const rect = root.getBoundingClientRect();
        console.log(root);
        if (!rect) return;


        const speed = 0.1;

        const ALIGN_AT_PX = (rect.top + (rect.height / 2) + window.scrollY) - (window.innerHeight / 2);
        add(root, root.querySelector(nestedSelector), speed, speed * ALIGN_AT_PX);
    }

    let ticking = false;

    const onScroll = () => {

        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            const y = window.scrollY;

            for (const { parallaxWindow, parallaxBg, speed, startOffset } of parallaxBgs) {
                const r = parallaxWindow?.getBoundingClientRect();
                const onScreen = r && r.bottom > 0 && r.top < window.innerHeight;
                // console.log(
                //     onScreen
                //         ? "ON SCREEN"
                //         : "off screen"
                // );

                // startOffset pushes down initially; scroll pulls upward
                // const ty = startOffset - (y * speed);
                console.log("y", y);
                console.log("speed", speed);
                const ty = (y * speed);
                const element = parallaxBg as HTMLElement;
                if (element && onScreen && false) {
                    console.log("is adjusting");
                    console.log(ty);
                    element.style.transform = `translate3d(0, ${ty}px, 0)`; // -ty scrolls with, +ty scrolls against
                }
                // if (element) {
                //     element.style.transform = `translate3d(0, ${ty}px, 0)`; // -ty scrolls with, +ty scrolls against
                // }
            }

            ticking = false;
        });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
}
