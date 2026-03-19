import { getCollection, type CollectionEntry } from "astro:content";

export type PersonEntry = CollectionEntry<"people">;
export type PersonItem = PersonEntry["data"] & { id: string };


export async function loadArtistsActiveNonguest(): Promise<PersonEntry[]> {
    const entries = (await getCollection(
        "people",
        (e) => e.data.active && !e.data.guest && e.data.primary_role === "tattoo_artist"
    )) as PersonEntry[];

    return entries
        .sort(
            (a, b) =>
                (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.name.localeCompare(b.data.name),
        );
}