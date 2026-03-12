
import React, { useEffect, useState, useRef, useMemo } from "react";
import type { EventsByYearMonthDay } from "../scripts/events";
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

    const monthYearLabel = new Intl.DateTimeFormat('default', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(traversedDate);

    const prev = (e: React.MouseEvent<HTMLElement>) => {
        // setTraversedDate(new Date(traversedDate.setMonth(traversedDate.getMonth() - 1)));
        setTraversedDate((prevDate) => {
            const nextDate = new Date(prevDate);
            nextDate.setUTCMonth(nextDate.getUTCMonth() - 1);
            return nextDate;
        });
    };

    const next = (e: React.MouseEvent<HTMLElement>) => {
        // setTraversedDate(new Date(traversedDate.setMonth(traversedDate.getMonth() + 1)));
        setTraversedDate((prevDate) => {
            const nextDate = new Date(prevDate);
            nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
            return nextDate;
        });
    };

    const getAllWeekdayNames = (locale: string = "en-US", options: Intl.DateTimeFormatOptions = { weekday: "short" }) => {
        const days = [];
        const date = new Date('1970-01-04T12:00:00.000Z');
        for (let i = 0; i < 7; i++) {
            days.push(date.toLocaleDateString(locale, options));
            date.setUTCDate(date.getUTCDate() + 1);
        }
        return days;
    }

    return (
        <>
            <div>
                <section className="flex items-center justify-between p-5 sm:p-10 md:px-30">
                    <button
                        className="cursor-pointer"
                        onClick={prev}
                    >
                        <svg
                            viewBox="0 -960 960 960"
                            className="h-6 w-6 fill-current"
                        >
                            <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                        </svg>
                    </button>
                    <h1 className="text-3xl sm:text-5xl">{monthYearLabel}</h1>
                    <button
                        className="cursor-pointer"
                        onClick={next}
                    >
                        <svg
                            viewBox="0 -960 960 960"
                            className="h-6 w-6 fill-current"
                        >
                            <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" />
                        </svg>
                    </button>
                </section>
                <div className="grid h-full w-full grid-cols-7 items-center gap-1">
                    {getAllWeekdayNames().map((day) => (
                        <div
                            key={day}
                            className="calendar-day-header flex justify-center"
                        >
                            {day}
                        </div>
                    ))}
                </div>
                <div className="calendar-grid grid h-full w-full grid-cols-7 items-center gap-1">
                    {traversedMonthDates.map((date, index) => {
                        const year = date.getUTCFullYear();
                        const month = date.getUTCMonth();
                        const day = date.getUTCDate();
                        const isToday =
                            year === currentDate.getUTCFullYear() &&
                            month === currentDate.getUTCMonth() &&
                            day === currentDate.getUTCDate();
                        const dailyEventsObj = eventsByYearMonthDay[year]?.[month]?.[day];
                        const dailyEvents = Array.from(dailyEventsObj ?? {});

                        const col = index % 7;
                        const row = Math.floor(index / 7);
                        const totalRows = Math.ceil(traversedMonthDates.length / 7);

                        const isLeft = col < 3; // 0,1,2
                        const isTop = row < Math.ceil(totalRows / 2);

                        const quadrantClass = isTop
                            ? isLeft
                                ? "quadrant-top-left"
                                : "quadrant-top-right"
                            : isLeft
                                ? "quadrant-bottom-left"
                                : "quadrant-bottom-right";
                        return (
                            <div
                                key={date.toISOString()}
                                className={`calendar-day ${quadrantClass} ${isToday ? "today" : ""}`}
                            >
                                <div className="date-num">
                                    {day}
                                </div>
                                <div className="daily-events text-sm">
                                    {dailyEvents.map((ev) => (
                                        <div
                                            className="daily-event"
                                            key={ev.id}
                                        >
                                            • {ev.title}
                                        </div>
                                    ))}
                                </div>
                                <div className="overlay">Big panel</div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </>
    );
};
