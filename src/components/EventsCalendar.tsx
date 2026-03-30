import React, { useEffect, useMemo, useRef, useState } from "react";
import type { EventItem } from "../domain/events/events";
import type { EventsByYearMonthDate } from "../domain/events/types";
import {
    fmtDate,
    fmtTime,
    fmtTimeWindow,
    buildEventsByYearMonthDate,
} from "../domain/events/eventsClient";
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

    const calendarData = useMemo(() => {
        const year = traversedDate.getFullYear();
        const month = traversedDate.getMonth();

        const firstOfMonth = new Date(year, month, 1);
        const lastOfMonth = new Date(year, month + 1, 0);

        const firstDayOfWeek = firstOfMonth.getDay() + 1;
        const lastDayOfWeek = lastOfMonth.getDay() + 1;

        const daysInMonth = lastOfMonth.getDate();
        const prevTrailingPlaceholders = firstDayOfWeek - 1;
        const nextLeadingPlaceholders = 7 - lastDayOfWeek;

        const monthDates = Array.from({ length: daysInMonth }, (_, i) => {
            const y = year;
            const m = month;
            const d = i + 1; // + 1 to increment
            const rawY = String(y);
            const rawM = String(m + 1).padStart(2, "0"); // + 1 because js Date was designed by an idiot
            const rawD = String(d).padStart(2, "0");

            const current = new Date(y, m, d);
            const day = current.getDay() + 1; // + 1 because js Date was designed by an idiot
            return {
                rawYear: rawY,
                rawMonth: rawM,
                rawDate: rawD,
                year: y,
                month: m,
                dateNum: d,
                day,
                dateKey: `${y}-${m}-${d}`,
                isoLike: `${y}-${m}-${d}-${String(day).padStart(2, "0")}`,
            };
        });

        const prevTrailingDates = Array.from({ length: prevTrailingPlaceholders }, (_, i) => (new Date(year, month, -(prevTrailingPlaceholders - 1) + i).getDate()));

        const nextLeadingDates = Array.from({ length: nextLeadingPlaceholders }, (_, i) => (new Date(year, month + 1, i + 1).getDate()));

        return {
            monthDates,
            prevTrailingDates: prevTrailingDates,
            nextLeadingDates: nextLeadingDates,
        };
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
                {calendarData.prevTrailingDates.map((dateNum, i) => (
                    <div key={`prev-trailing-${i}`} className="calendar-day placeholder">
                        <div className="date-num">{dateNum}</div>
                    </div>
                ))}

                {calendarData.monthDates.map(
                    ({
                        rawYear,
                        rawMonth,
                        rawDate,
                        year,
                        month,
                        dateNum,
                        day,
                        dateKey,
                        isoLike,
                    }) => {
                        const now = new Date();

                        const isToday =
                            year === now.getFullYear() &&
                            month === now.getMonth() &&
                            dateNum === now.getDate();

                        const dailyEventsObj = eventsByYearMonthDate[rawYear]?.[rawMonth]?.[rawDate];
                        const dailyEvents = Array.from(dailyEventsObj ?? {});
                        const hasEvents = dailyEvents.length > 0;
                        const needsSingleEventImageVariant = dailyEvents.length === 1 && dailyEvents[0].image;
                        const isOpen = openDateKey === dateKey;
                        return (
                            <div
                                key={dateKey}
                                className={`calendar-day ${isToday ? "today" : ""}${needsSingleEventImageVariant ? "bg-img bg-cover bg-center" : ""}`}
                                onClick={() => {
                                    if (!canHover) {
                                        setOpenDateKey((prev) =>
                                            prev === dateKey ? null : dateKey
                                        );
                                    }
                                }}
                                style={{
                                    gridColumnStart: day,
                                    ...(needsSingleEventImageVariant && {
                                        backgroundImage: `url(${dailyEvents[0].image})`
                                    })
                                }}
                            >
                                <div className="date-num">{dateNum}</div>
                                <div className="daily-events text-sm leading-none">
                                    {!needsSingleEventImageVariant && dailyEvents.map((ev, index) => (
                                        <div
                                            className={`daily-event ${(dailyEvents.length > 1 && index !== dailyEvents.length - 1) ? "pb-2" : ""}`}
                                            key={`${ev.id}-${dateKey}`}
                                        >
                                            <a href={`/events/${ev.id}`}>
                                                <span className="italic font-bold">
                                                    {ev.startTime ? (
                                                        <>
                                                            {fmtTime(ev.startTime)}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {fmtTimeWindow(ev)}
                                                        </>
                                                    )}
                                                </span>
                                                <br />

                                                {ev.title}
                                            </a>
                                        </div>
                                    ))}
                                </div>

                                {hasEvents && (
                                    <div
                                        className={`overlay ${dailyEvents.length === 1 && !dailyEvents[0].detailsShort ? "short" : "medium"} ${isOpen && !canHover ? "is-open" : ""}`}
                                        aria-label={`Events for ${fmtDate(isoLike)}`}
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

                {calendarData.nextLeadingDates.map((dateNum, i) => (
                    <div
                        key={`next-leading-${i}`}
                        className="calendar-day placeholder"
                    >
                        <div className="date-num">{dateNum}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};