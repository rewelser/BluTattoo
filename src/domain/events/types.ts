import type { EventItem } from "./events";


export type EventsByYearMonthDate = Record<string, Record<string, Record<string, EventItem[]>>>;
