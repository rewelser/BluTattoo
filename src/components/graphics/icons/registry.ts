import type {AstroComponentFactory} from "astro/runtime/server/index.js";
import type {IconType, IconVariant} from "../../../domain/contact/types.ts";

type IconModule = {
    default: AstroComponentFactory;
    iconType: IconType;
    iconVariant?: IconVariant;
    iconLabel?: string;
};

type IconRegistryEntry = {
    Icon: AstroComponentFactory;
    label: string;
};

const defaultVariant = "thin";

const iconModules = import.meta.glob<IconModule>("./*Icon.astro", {
    eager: true,
});

// export const iconRegistry: Record<IconType, IconRegistryEntry> = Object.values(iconModules).reduce<
//   Record<IconType, IconRegistryEntry>
// >((acc, mod) => {
//   acc[mod.iconType] = {
//     Icon: mod.default,
//     label: mod.iconLabel ?? mod.iconType,
//   };
//   return acc;
// }, {} as Record<IconType, IconRegistryEntry>);


export const iconRegistry = Object.values(iconModules).reduce<
    Partial<Record<IconType, Partial<Record<IconVariant | "default", IconRegistryEntry>>>>
>((acc, mod) => {
    const variant = mod.iconVariant ?? "default";

    acc[mod.iconType] ??= {};

    const entry = {
        Icon: mod.default,
        label: mod.iconLabel ?? mod.iconType,
    };

    acc[mod.iconType]![variant] = entry;

    if (variant === defaultVariant) {
        acc[mod.iconType]!.default = entry;
    }

    return acc;
}, {});

export const getIconEntry = (
    type: IconType,
    variants: readonly IconVariant[]
): IconRegistryEntry | undefined => {
    for (const variant of variants) {
        const entry = iconRegistry[type]?.[variant];

        if (entry) {
            return entry;
        }
    }

    return iconRegistry[type]?.default;
}