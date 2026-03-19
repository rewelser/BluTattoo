
import type { SocialType } from "../../../scripts/socials";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

type SocialIconModule = {
  default: AstroComponentFactory;
  socialType: SocialType;
  socialLabel?: string;
};

type SocialRegistryEntry = {
  Icon: AstroComponentFactory;
  label: string;
};

const iconModules = import.meta.glob<SocialIconModule>("./*Icon.astro", {
  eager: true,
});

export const socialIcons: Record<SocialType, SocialRegistryEntry> = Object.values(iconModules).reduce<
  Record<SocialType, SocialRegistryEntry>
>((acc, mod) => {
  acc[mod.socialType] = {
    Icon: mod.default,
    label: mod.socialLabel ?? mod.socialType,
  };
  return acc;
}, {} as Record<SocialType, SocialRegistryEntry>);