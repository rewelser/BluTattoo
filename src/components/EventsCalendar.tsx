
import React, { useEffect, useState, useRef, useMemo } from "react";
import type { EventsByYearMonthDay } from "../scripts/events";

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
                <div className="calendar-grid grid h-full w-full grid-cols-7 items-center gap-1">
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
                    {traversedMonthDates.map((date) => {
                        const year = date.getUTCFullYear();
                        const month = date.getUTCMonth();
                        const day = date.getUTCDate();
                        const isToday =
                            year === currentDate.getUTCFullYear() &&
                            month === currentDate.getUTCMonth() &&
                            day === currentDate.getUTCDate();
                        const dailyEventsObj = eventsByYearMonthDay[year]?.[month]?.[day];
                        const dailyEvents = Array.from(dailyEventsObj ?? {});
                        return (
                            <div
                                key={date.toISOString()}
                                className={`calendar-day ${isToday ? "today" : ""}`}
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
                                {/* <div className="overlay">Big panel</div> */}
                            </div>
                        )
                    })}
                </div>
            </div>

            <style>
                {`
                /* multiple events will be listed inside the calendar day box, with the title, time, and short description. Each event will be a link to the event page. */
                .calendar-day {
                    position: relative;
                    display: flex;
                    align-items: end;
                    flex-direction: column;
                    padding: 5px;
                    aspect-ratio: 1 / 1;
                    background-color: rgba(0, 0, 0, 0.05);
                    // overflow: hidden;
                }

                .calendar-grid > .calendar-day:nth-child(7n + 1) {
  background: blue;
}

.calendar-grid > .calendar-day:nth-child(-n + 7) {
  background: purple;
}


  .calendar-grid > .calendar-day:nth-child(-n+3) {
  background-color: lightblue;
  /* Styles for the first row */
}

.calendar-grid > .calendar-day:nth-child(7n) {
  background: green;
}

.calendar-grid > .calendar-day:nth-child(-n + 3) {
background: teal;
}

.calendar-grid > .calendar-day:nth-last-child(-n + 7) {
background: yellow;
}

                .calendar-day.today {
                    background-color: rgba(0, 0, 0, 0);
                    border: 2px solid rgba(0, 0, 0, 0.05);
                }

                .calendar-day.closed {
                    background-image: url("/assets/closed.png");
                }

                .daily-events {
                position: relative;
                    // flex: 1 1 auto;
                    // min-height: 0;
                    // width: 100%;
                    overflow: hidden;
                    flex: 1;
                }

                .daily-events::after {
                    // content: "...";
                    // position: absolute;
                    // right: 0;
                    // bottom: 0;
                    // background-color: lightgray;
                    // padding-left: 0.25em;
                    // width: 100%;
                }

                .date-num {
                    height: 100%;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    // border-radius: 50%;
                    // background-color: rgba(0, 0, 0, 0.1);
                }

                @media (width >= 40rem) {
                    .date-num {
                        height: calc(var(--spacing) * 6);
                        width: calc(var(--spacing) * 6);
                    }

                    .calendar-day.bg-img .date-num {
                        background-color: rgba(0, 0, 0, 0.1);
                    }
                }

                .overlay {
                    position: absolute;
                    top: 0;
                    left: calc(100% + 0.25rem);
                    // width: calc(200% + 0.25rem);
                    width: calc(400% + 0.75rem);
                    height: calc(200% + 0.25rem);
                    opacity: 0;
                    pointer-events: none;
                    z-index: 20;
                    transition: opacity 160ms ease;
                    background-color: red;
                }

.calendar-day:hover .overlay,
.calendar-day:focus-within .overlay {
  opacity: 1;
  pointer-events: auto;
}
                `}
            </style>
        </>
    );
};
