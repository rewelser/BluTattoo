export function initParallaxSvgs(selector = ".parallax-svg") {
    const items = Array.from(
        document.querySelectorAll(selector)
    ) as (HTMLElement | SVGElement)[];

    let ticking = false;

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
    }

    window.addEventListener("scroll", onScroll, { passive: true });


    return () => window.removeEventListener("scroll", onScroll);
}

// export function initParallaxSvgs(selector = ".parallax-svg") {
//     const items = Array.from(
//         document.querySelectorAll(selector)
//     ) as (HTMLElement | SVGElement)[];

//     let ticking = false;
//     const y_init = window.scrollY || 0;
//     let dif = y_init;
//     // let dif = 0;

//     // <svg class="parallax-svg" data-speed="0.35" data-offset="40" data-min="-120" data-max="180">...</svg>

//     const update = (e: WheelEvent) => {
//         const validWheelEvent = (Math.abs(e.deltaY) > 0)
//         && window.scrollY > 0
//         && window.scrollY < document.body.scrollHeight;

//         if (validWheelEvent) {
//             if (Math.sign(e.deltaY) == -1) {
//                 dif--;
//             } else {
//                 dif++;
//             }
//         }

//         for (const el of items) {
//             const speed = Number(el.dataset?.speed ?? 0.3);
//             const offset = Number(el.dataset?.offset ?? 0);

//             el.style.transform = `translate3d(0, ${-(dif * speed) + offset}px, 0)`;
//         }
//     };

//     const onScroll = (e: WheelEvent) => {
//         if (ticking) return;
//         ticking = true;

//         requestAnimationFrame(() => {
//             update(e);
//             ticking = false;
//         });
//     };

//     window.addEventListener("wheel", onScroll, { passive: true });

//     return () => window.removeEventListener("wheel", onScroll);
// }


///////////



// export function initParallaxSvgs(selector = ".parallax-svg") {
//     const items = Array.from(
//         document.querySelectorAll(selector)
//     ) as (HTMLElement | SVGElement)[];

//     let ticking = false;

//     const onScroll = () => {
//         if (ticking) return;
//         ticking = true;

//         requestAnimationFrame(() => {
//             for (const el of items) {
//                 const speed = Number(el.dataset?.speed ?? 0.3);
//                 const offset = Number(el.dataset?.offset ?? 0);

//                 el.style.transform = `translate3d(0, ${-(window.scrollY * speed) + offset}px, 0)`;
//             }

//             ticking = false;
//         });
//     }

//     window.addEventListener("scroll", onScroll, { passive: true });


//     // window.addEventListener("wheel", onScroll, { passive: true });

//     return () => window.removeEventListener("scroll", onScroll);
// }
