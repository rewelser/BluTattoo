export const weekdayTypes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

// Expansion range for recurrent events in the "upcoming" context is a rolling "season", comprising 90 days.
export const upcomingEventRecurrenceExpansionRange: number = 90;