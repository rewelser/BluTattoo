import InstagramIcon from "./InstagramIcon.astro";
import TiktokIcon from "./TiktokIcon.astro";
import YoutubeIcon from "./YoutubeIcon.astro";
import FacebookIcon from "./FacebookIcon.astro";
import XIcon from "./XIcon.astro";
import ThreadsIcon from "./ThreadsIcon.astro";
import TumblrIcon from "./TumblrIcon.astro";
import PinterestIcon from "./PinterestIcon.astro";

export const socialDefs = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "tiktok", label: "TikTok", Icon: TiktokIcon },
  { key: "youtube", label: "YouTube", Icon: YoutubeIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
  { key: "x", label: "X", Icon: XIcon },
  { key: "threads", label: "Threads", Icon: ThreadsIcon },
  { key: "tumblr", label: "Tumblr", Icon: TumblrIcon },
  { key: "pinterest", label: "Pinterest", Icon: PinterestIcon },
] as const;

export type SocialKey = (typeof socialDefs)[number]["key"];
export type SocialLinks = Partial<Record<SocialKey, string>>;