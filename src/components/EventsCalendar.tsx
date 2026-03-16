import React, { useEffect, useMemo, useRef, useState } from "react";
import type { EventItem } from "../scripts/events";
import type { EventsByYearMonthDate } from "../scripts/eventsClient";
import {
    fmtDate,
    fmtTime,
    fmtTimeWindow,
    buildEventsByYearMonthDate,
} from "../scripts/eventsClient";
import "../styles/EventsCalendar.css";

interface EventsCalendarProps {
    events: EventItem[];
}

// sherpa thuggin
export const EventsCalendar: React.FC<EventsCalendarProps> = ({ events }) => {
    // todo: is there a better place in here to declare this? Maybe not
    const eventsByYearMonthDate: EventsByYearMonthDate = buildEventsByYearMonthDate(events);
    const [traversedDate, setTraversedDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const [openDateKey, setOpenDateKey] = useState<string | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);
    let leadingDayStart = 0;

    const traversedMonthDates = useMemo(() => {
        const year = traversedDate.getFullYear();
        const month = traversedDate.getMonth();
        const cur = new Date(year, month, 1);
        const dates: string[] = [];

        while (cur.getMonth() === month) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, "0");
            const dt = String(cur.getDate()).padStart(2, "0");
            const day = (String(cur.getDay() + 1)).padStart(2, "0");

            dates.push(`${y}-${m}-${dt}-${day}`);
            cur.setDate(cur.getDate() + 1);
        }

        return dates;
    }, [traversedDate]);

    const monthYearLabel = new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric"
    }).format(traversedDate);

    const prev = () => {
        setTraversedDate((prevDate) => {
            const nextDate = new Date(prevDate);
            nextDate.setMonth(nextDate.getMonth() - 1);
            return nextDate;
        });
        setOpenDateKey(null);
    };

    const next = () => {
        setTraversedDate((prevDate) => {
            const nextDate = new Date(prevDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            return nextDate;
        });
        setOpenDateKey(null);
    };

    const getAllWeekdayNames = (
        locale: string = "en-US",
        options: Intl.DateTimeFormatOptions = { weekday: "short" }
    ) => {
        const days = [];
        const date = new Date("1970-01-04T12:00:00.000Z");
        for (let i = 0; i < 7; i++) {
            days.push(date.toLocaleDateString(locale, options));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const canHover =
        typeof window !== "undefined" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    useEffect(() => {
        if (canHover) return;

        function handleClickOutside(event: PointerEvent) {
            if (!calendarRef.current?.contains(event.target as Node)) {
                setOpenDateKey(null);
            }
        }

        document.addEventListener("pointerdown", handleClickOutside);
        return () =>
            document.removeEventListener("pointerdown", handleClickOutside);
    }, [canHover]);

    return (
        <div>
            <section className="flex items-center justify-between p-5 sm:p-10 md:px-30">
                <button
                    className="cursor-pointer"
                    onClick={prev}
                    aria-label="Previous month"
                >
                    <svg
                        viewBox="0 -960 960 960"
                        className="h-6 w-6 fill-current"
                        aria-hidden="true"
                    >
                        <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                </button>

                <h1 className="text-3xl sm:text-5xl">{monthYearLabel}</h1>

                <button
                    className="cursor-pointer"
                    onClick={next}
                    aria-label="Next month"
                >
                    <svg
                        viewBox="0 -960 960 960"
                        className="h-6 w-6 fill-current"
                        aria-hidden="true"
                    >
                        <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" />
                    </svg>
                </button>
            </section>

            <div className="grid h-full w-full grid-cols-7 items-center gap-1">
                {getAllWeekdayNames().map((day) => (
                    <div key={day} className="calendar-day-header flex justify-center">
                        {day}
                    </div>
                ))}
            </div>

            <div
                ref={calendarRef}
                className="calendar-grid grid h-full w-full grid-cols-7 items-center gap-1"
            >
                {Array.from({ length: Number(traversedMonthDates[0].split("-")[traversedMonthDates[0].split("-").length - 1]) - 1 }).map((_, i, prevMonthTrailingArr) => {
                    const trailCount = prevMonthTrailingArr.length - 1;
                    return (
                        <div
                            key={i}
                            className="calendar-day placeholder"
                        >
                            <div className="date-num">{new Date(traversedDate.getFullYear(), traversedDate.getMonth(), 0 - (trailCount - i)).getDate()}</div>
                        </div>
                    )
                })
                }
                {traversedMonthDates.map((date) => {
                    const [rawYear, rawMonth, rawDate, rawDay] = date.split("-");
                    const year = Number(rawYear); // todo: it's because you're rendering them as numbers, dumb fuck
                    const month = Number(rawMonth);
                    const dateNum = Number(rawDate);
                    const day = Number(rawDay);
                    leadingDayStart = day;
                    const dateKey = `${year}-${month}-${dateNum}`;
                    const now = new Date();

                    const isToday =
                        year === now.getFullYear() &&
                        month === now.getMonth() + 1 &&
                        dateNum === now.getDate();

                    const dailyEventsObj = eventsByYearMonthDate[rawYear]?.[rawMonth]?.[rawDate];
                    const dailyEvents = Array.from(dailyEventsObj ?? {});
                    const hasEvents = dailyEvents.length > 0;
                    const isOpen = openDateKey === dateKey;
                    return (
                        <div
                            key={dateKey}
                            className={`calendar-day ${isToday ? "today" : ""}`}
                            onClick={() => {
                                if (!canHover) {
                                    setOpenDateKey((prev) =>
                                        prev === dateKey ? null : dateKey
                                    );
                                }
                            }}
                            style={{ gridColumnStart: day }}
                        >
                            <div className="date-num">{dateNum}</div>
                            <div className="daily-events text-sm leading-none">
                                {dailyEvents.map((ev, index) => (
                                    <div
                                        className={`daily-event ${(dailyEvents.length > 1 && index !== dailyEvents.length - 1) ? "pb-2" : ""}`}
                                        key={`${ev.id}-${dateKey}`}
                                    >
                                        <a href={`/events/${ev.id}`}>
                                            {ev.startTime && (
                                                <>
                                                    <span className="italic font-bold">
                                                        {fmtTime(ev.startTime)}
                                                    </span>
                                                    <br />
                                                </>
                                            )}
                                            {ev.title}
                                        </a>
                                    </div>
                                ))}
                            </div>

                            {hasEvents && (
                                <div
                                    className={`overlay ${dailyEvents.length === 1 ? "short" : "medium"} ${isOpen && !canHover ? "is-open" : ""}`}
                                    aria-label={`Events for ${fmtDate(date)}`}
                                >
                                    <div className="overlay-events">
                                        {dailyEvents.map((ev, index) => (
                                            <div key={ev.id}>
                                                <section
                                                    className={`overlay-event p-5 leading-none
                                                        ${index > 0 ? "scalloped-border-top" : ""}
                                                        ${!ev.detailsShort ? "no-short-details" : ""}`}
                                                >
                                                    <a href={`/events/${ev.id}`}>
                                                        <h2 className="text-xl leading-none">{ev.title} →</h2>
                                                    </a>
                                                    <div className="text-xs leading-none py-2">
                                                        {fmtTimeWindow(ev)}
                                                        {ev.location && ` • ${ev.location}`}
                                                    </div>
                                                    {ev.detailsShort && (
                                                        <>
                                                            <hr className="border-0 border-t-6 border-dotted border-black/40 my-2"></hr>
                                                            <p className="leading-none">{ev.detailsShort}</p>
                                                        </>
                                                    )}
                                                </section>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {Array.from({ length: 7 - leadingDayStart }).map((_, i) => (
                    <div
                        key={i}
                        className="calendar-day placeholder"
                    >
                        <div className="date-num">{new Date(traversedDate.getFullYear(), traversedDate.getMonth() + 1, 1 + i).getDate()}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};