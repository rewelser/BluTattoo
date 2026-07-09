import { Temporal as TemporalPolyfill } from "temporal-polyfill";

// todo: will probably work in typescript v6 (right now I think we are on 5.9.3)
// export const T = globalThis.Temporal ?? TemporalPolyfill;

// todo: this for now, and wait on ts6 until after we try upgrading astro
const maybeGlobalTemporal = globalThis as typeof globalThis & {
    Temporal?: typeof TemporalPolyfill;
};

export const T = maybeGlobalTemporal.Temporal ?? TemporalPolyfill;


// export function parsePlainDate(value: string) {
//     return Temporal.PlainDate.from(value, { overflow: "reject" });
// }
//
// export function parsePlainTime(value: string) {
//     return Temporal.PlainTime.from(value, { overflow: "reject" });
// }


// const d = Temporal.PlainDate.from("2026-05-15");