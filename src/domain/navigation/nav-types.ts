export type MenuLink = {
  type: "link";
  label: string;
  href: string;
  prefetch?: boolean;
};

export type MenuSubmenu = {
  type: "submenu";
  label: string;
  items: MenuLink[];
};

export type MenuItem = MenuLink | MenuSubmenu;
