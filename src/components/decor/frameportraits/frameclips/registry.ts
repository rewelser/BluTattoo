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

export type FrameKey = keyof typeof frameRegistry;