import type {BySetPos, Weekday} from "./types.ts";

/**
 * Expansion range for recurrent events in the "upcoming" context is a rolling "season", comprising 90 days.
 * Because we are trying to adhere to half-open intervals, we set the actual range to 91, and compare like: X < 0.
 */
export const UPCOMING_EVENT_RANGE: number = 91;

export const weekdayTypes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export const weekdayNames = {
    SU: "Sunday",
    MO: "Monday",
    TU: "Tuesday",
    WE: "Wednesday",
    TH: "Thursday",
    FR: "Friday",
    SA: "Saturday",
} as const satisfies Record<Weekday, string>;

export const bySetPosNames = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    [-1]: "last",
} as const satisfies Record<BySetPos, string>

export const bySetPosTypes = [1, 2, 3, 4, -1] as const;