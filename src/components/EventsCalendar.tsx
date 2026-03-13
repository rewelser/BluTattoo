import React, { useEffect, useState, useRef, useMemo } from "react";
import type { EventsByYearMonthDay, EventItem } from "../scripts/events";
import "../styles/EventsCalendar.css";

interface EventsCalendarProps {
    eventsByYearMonthDay: EventsByYearMonthDay;
    currentDate: Date;
}

// sherpa thuggin
export const EventsCalendar: React.FC<EventsCalendarProps> = ({ eventsByYearMonthDay, currentDate }) => {
    const [traversedDate, setTraversedDate] = useState<Date>(() => {
        return new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth(),
            1
        ));
    });

    const [openDayKey, setOpenDayKey] = useState<string | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    const utcDateFormatter = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });

    const fmtDate = (d: Date | string | number) => {
        const date = d instanceof Date ? d : new Date(d);

        if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid date: ${String(d)}`);
        }

        return utcDateFormatter.format(date);
    };

    function fmtTime(time: string): string {
        const [rawHour, rawMinute] = time.split(":");
        const hour = Number(rawHour);
        const minute = Number(rawMinute);

        if (
            !Number.isInteger(hour) ||
            !Number.isInteger(minute) ||
            hour < 0 ||
            hour > 23 ||
            minute < 0 ||
            minute > 59
        ) {
            throw new Error(`Invalid time: ${time}`);
        }

        const suffix = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;

        return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
    }

    function fmtDateRange(ev: Pick<EventItem, "startDate" | "endDate">): string {
        return ev.endDate ? `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}` : fmtDate(ev.startDate);
    }

    function fmtTimeRange(ev: Pick<EventItem, "startTime" | "endTime">): string {
        return ev.endTime ? `${fmtTime(ev.startTime!)} – ${fmtTime(ev.endTime)}` : fmtTime(ev.startTime!);
    }

    const traversedMonthDates = useMemo(() => {
        const year = traversedDate.getUTCFullYear();
        const month = traversedDate.getUTCMonth();
        const date = new Date(Date.UTC(year, month, 1));
        const dates: Date[] = [];

        while (date.getUTCMonth() === month) {
            dates.push(new Date(date));
            date.setUTCDate(date.getUTCDate() + 1);
        }

        return dates;
    }, [traversedDate]);

    const monthYearLabel = new Intl.DateTimeFormat("default", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(traversedDate);

    const prev = () => {
        setTraversedDate((prevDate) => {
            const nextDate = new Date(prevDate);
            nextDate.setUTCMonth(nextDate.getUTCMonth() - 1);
            return nextDate;
        });
        setOpenDayKey(null);
    };

    const next = () => {
        setTraversedDate((prevDate) => {
            const nextDate = new Date(prevDate);
            nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
            return nextDate;
        });
        setOpenDayKey(null);
    };

    const getAllWeekdayNames = (
        locale: string = "en-US",
        options: Intl.DateTimeFormatOptions = { weekday: "short" }
    ) => {
        const days = [];
        const date = new Date("1970-01-04T12:00:00.000Z");
        for (let i = 0; i < 7; i++) {
            days.push(date.toLocaleDateString(locale, options));
            date.setUTCDate(date.getUTCDate() + 1);
        }
        return days;
    }

    const canHover =
        typeof window !== "undefined" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    useEffect(() => {
        if (canHover) return;

        function handleClickOutside(event: PointerEvent) {
            if (!calendarRef.current?.contains(event.target as Node)) {
                setOpenDayKey(null);
            }
        }

        document.addEventListener("pointerdown", handleClickOutside);
        return () =>
            document.removeEventListener("pointerdown", handleClickOutside);
    }, [canHover]);

    return (
        <div>
            <section className="flex items-center justify-between p-5 sm:p-10 md:px-30">
                <button className="cursor-pointer" onClick={prev} aria-label="Previous month">
                    <svg viewBox="0 -960 960 960" className="h-6 w-6 fill-current" aria-hidden="true">
                        <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                </button>

                <h1 className="text-3xl sm:text-5xl">{monthYearLabel}</h1>

                <button className="cursor-pointer" onClick={next} aria-label="Next month">
                    <svg viewBox="0 -960 960 960" className="h-6 w-6 fill-current" aria-hidden="true">
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

            <div ref={calendarRef} className="calendar-grid grid h-full w-full grid-cols-7 items-center gap-1">
                {traversedMonthDates.map((date) => {
                    const year = date.getUTCFullYear();
                    const month = date.getUTCMonth();
                    const day = date.getUTCDate();
                    const dayKey = `${year}-${month}-${day}`;

                    const isToday =
                        year === currentDate.getUTCFullYear() &&
                        month === currentDate.getUTCMonth() &&
                        day === currentDate.getUTCDate();

                    const dailyEventsObj = eventsByYearMonthDay[year]?.[month]?.[day];
                    const dailyEvents = Array.from(dailyEventsObj ?? {});
                    const hasEvents = dailyEvents.length > 0;
                    const isOpen = openDayKey === dayKey;
                    return (
                        <div
                            key={date.toISOString()}
                            className={`calendar-day ${isToday ? "today" : ""}`}
                            onClick={() => {
                                if (!canHover) {
                                    setOpenDayKey((prev) => (prev === dayKey ? null : dayKey));
                                }
                            }}
                        >
                            <div className="date-num">{day}</div>
                            <div className="daily-events text-sm leading-none">
                                {dailyEvents.map((ev, index) => (
                                    <div
                                        className={`daily-event ${(dailyEvents.length > 1 && index !== dailyEvents.length - 1) ? "pb-2" : ""}`}
                                        key={ev.id}
                                    >
                                        {ev.startTime && (
                                            <>
                                                <span className="italic font-bold">{fmtTime(ev.startTime)}</span>
                                                <br />
                                            </>
                                        )}
                                        {ev.title}
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
                                                    className=
                                                    {`overlay-event p-5 leading-none
                                                        ${index > 0 ? "scalloped-border-top" : ""}
                                                        ${!ev.detailsShort ? "no-short-details" : ""}
                                                        `}
                                                >
                                                    <h2 className="text-xl leading-none">{ev.title}</h2>
                                                    <div className="text-xs leading-none py-2">
                                                        {fmtTimeRange(ev)}
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
            </div>
        </div>
    );
};
