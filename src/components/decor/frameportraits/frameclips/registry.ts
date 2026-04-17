// import FrameClipTestframe32 from "./FrameClipTestframe32.js";
// import FrameClipFrame2 from "./FrameClipFrame2.astro";
// import FrameClipFrame3 from "./FrameClipFrame3.astro";

import type {AstroComponentFactory} from "astro/runtime/server/index.js";
import type {FrameType} from "../../../../domain/decor/types.ts";
import type {ImageMetadata} from "astro";

type FrameModule = {
    default: AstroComponentFactory;
    frameType: FrameType;
    frame: ImageMetadata;
    mask: ImageMetadata;
}

type FrameRegistryEntry = {
    FrameClipComponent: AstroComponentFactory;
    frame: ImageMetadata;
    mask: ImageMetadata;
}

const frameModules = import.meta.glob<FrameModule>("./*FrameClip.astro", {
    eager: true,
});

export const frameRegistry: Record<FrameType, FrameRegistryEntry> = Object.values(frameModules).reduce<Record<FrameType, FrameRegistryEntry>>(
    (acc, mod) => {
        acc[mod.frameType] = {
            FrameClipComponent: mod.default,
            frame: mod.frame,
            mask: mod.mask,
        };
        return acc;
    }, {} as Record<FrameType, FrameRegistryEntry>
);

// export const registry = {
//     testframe3_2: {
//         frameSrc: "/uploads/misc_images/testframe3_2.svg",
//         // maskSrc: "/uploads/misc_images/frameclip-testframe3_2.svg",
//         maskSrc: "/uploads/misc_images/frameensmallened3.svg",
//         ClipComponent: FrameClipTestframe32,
//     },
//
//     // example
//     // ornateGold: {
//     //   frameSrc: "/uploads/misc_images/ornate-gold-frame.svg",
//     //   maskSrc: "/uploads/misc_images/ornate-gold-mask.svg",
//     //   ClipComponent: FrameClipOrnateGold,
//     // },
// } as const;

// export type FrameKey = keyof typeof registry;

export type FrameKey = keyof typeof frameRegistry;