import {getCollection} from "astro:content";
import type {PersonEntry} from "./types.ts";

// export async function loadActiveArtists(): Promise<PersonEntry[]> {
//     const entries = (await getCollection(
//         "people",
//         (e) => e.data.active && e.data.primaryRole === "Tattoo Artist"
//     )) as PersonEntry[];
//
//     return entries
//         .sort(
//             (a, b) =>
//                 (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.name.localeCompare(b.data.name),
//         );
// }

export async function loadActiveArtists(): Promise<PersonEntry[]> {
    const entries = await loadActivePeople();

    return entries
        .filter((e) => e.data.primaryRole === "Tattoo Artist")
        .sort(
            (a, b) =>
                (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.name.localeCompare(b.data.name),
        );
}


/////


export async function loadActivePeople(): Promise<PersonEntry[]> {
    const entries = (await getCollection(
        "people",
        (e) => e.data.active
    )) as PersonEntry[];

    return entries;
}