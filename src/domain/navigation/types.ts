import type {EventItem} from "../events/types.ts";

export type MenuLink = {
  type: "link";
  label: string;
  event?: EventItem;
  start?: string;
  end?: string;
  href: string;
  prefetch?: boolean;
};

export type MenuSubmenu = {
  type: "submenu";
  label: string;
  href?: string;
  items: MenuLink[];
};

export type MenuItem = MenuLink | MenuSubmenu;
