import FrameClipTestframe32 from "./FrameClipTestframe32.astro";
// import FrameClipFrame2 from "./FrameClipFrame2.astro";
// import FrameClipFrame3 from "./FrameClipFrame3.astro";

import type {AstroComponentFactory} from "astro/runtime/server/index.js";
import type {FrameType} from "../../../domain/decor/types.ts";

type FrameModule = {
    default: AstroComponentFactory;
    frameType: FrameType;
    frameLabel?: string;
}

type FrameRegistryEntry = {
    Frame: AstroComponentFactory;
    label: string;
}

const frameModules = import.meta.glob<FrameModule>("./FrameClip.astro", {
    eager: true,
});

export const frameRegistry: Record<FrameType, FrameRegistryEntry> = Object.values(frameModules).reduce<Record<FrameType, FrameRegistryEntry>>(
    (acc, mod) => {
        acc[mod.frameType] = {
            Frame: mod.default,
            label: mod.frameLabel ?? mod.frameType,
        };
        return acc;
    }, {} as Record<FrameType, FrameRegistryEntry>
);

export const registry = {
    testframe3_2: {
        frameSrc: "/uploads/misc_images/testframe3_2.svg",
        // maskSrc: "/uploads/misc_images/frameclip-testframe3_2.svg",
        maskSrc: "/uploads/misc_images/frameensmallened3.svg",
        ClipComponent: FrameClipTestframe32,
    },

    // example
    // ornateGold: {
    //   frameSrc: "/uploads/misc_images/ornate-gold-frame.svg",
    //   maskSrc: "/uploads/misc_images/ornate-gold-mask.svg",
    //   ClipComponent: FrameClipOrnateGold,
    // },
} as const;

export type FrameKey = keyof typeof registry;