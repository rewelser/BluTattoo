import type { MenuItem } from "./types.ts";
import { loadActiveArtists } from "../people/server.ts";

let artists = await loadActiveArtists();

const artistLinks = artists.map((entry) => ({
  type: "link" as const,
  label: entry.data.name,
  href: `/artists/${entry.id}/`,
  prefetch: true,
}));

export const navItems: MenuItem[] = [
  { type: "link", label: "Home", href: "/" },
  { type: "submenu", label: "Artists", items: artistLinks },
  { type: "link", label: "Booking", href: "/booking" },
  { type: "link", label: "Piercing", href: "/piercing" },
  { type: "link", label: "Events", href: "/events" },
  { type: "link", label: "Aftercare", href: "/aftercare" },
  { type: "link", label: "FAQ", href: "/faq" },
  { type: "link", label: "Contact Us", href: "/contact" },
];