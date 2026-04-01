
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import type {IconType, SocialType} from "../../../domain/contact/types.ts";

type IconModule = {
  default: AstroComponentFactory;
  iconType: IconType;
  iconLabel?: string;
};

type IconRegistryEntry = {
  Icon: AstroComponentFactory;
  label: string;
};

const iconModules = import.meta.glob<IconModule>("./*Icon.astro", {
  eager: true,
});

export const iconRegistry: Record<IconType, IconRegistryEntry> = Object.values(iconModules).reduce<
  Record<IconType, IconRegistryEntry>
>((acc, mod) => {
  acc[mod.iconType] = {
    Icon: mod.default,
    label: mod.iconLabel ?? mod.iconType,
  };
  return acc;
}, {} as Record<IconType, IconRegistryEntry>);