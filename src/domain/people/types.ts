import type {CollectionEntry} from "astro:content";

export type PersonEntry = CollectionEntry<"people">;
export type PersonItem = PersonEntry["data"] & { id: string };