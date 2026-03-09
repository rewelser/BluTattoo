
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

    // useEffect(() => {
    //     const getDaysInMonth = () => {
    //         const year = traversedDate.getUTCFullYear();
    //         const month = traversedDate.getUTCMonth();
    //         const date = new Date(Date.UTC(year, month, 1));
    //         const dates = [];
    //         while (date.getUTCMonth() === month) {
    //             dates.push(new Date(date));
    //             date.setUTCDate(date.getUTCDate() + 1);
    //         }
    //         setTraversedMonthDates(dates);

    //     };
    //     getDaysInMonth();
    // }, [traversedDate]);

    return (
        <>
            <div>
                <button
                    className="cursor-pointer"
                    onClick={prev}
                >
                    prev
                </button>
                <button
                    className="cursor-pointer"
                    onClick={next}
                >
                    next
                </button>
                <h1>{monthYearLabel}</h1>
                <div className="grid h-full w-full grid-cols-7 items-center gap-1">
                    <div className="calendar-day-header">Sun</div>
                    <div className="calendar-day-header">Mon</div>
                    <div className="calendar-day-header">Tue</div>
                    <div className="calendar-day-header">Wed</div>
                    <div className="calendar-day-header">Thu</div>
                    <div className="calendar-day-header">Fri</div>
                    <div className="calendar-day-header">Sat</div>
                    {traversedMonthDates.map((date) => {

                        // const queryResult = JSON.stringify(eventsByYearMonthDay);
                        const year = date.getUTCFullYear();
                        const month = date.getUTCMonth();
                        const day = date.getUTCDate();
                        const isToday =
                            year === currentDate.getUTCFullYear() &&
                            month === currentDate.getUTCMonth() &&
                            day === currentDate.getUTCDate();
                        // const queryResult = eventsByYearMonthDay[year][month][day];
                        const queryResult = eventsByYearMonthDay[year]?.[month]?.[day];
                        const arr = Array.from(queryResult ?? {});
                        console.log("arr", arr);
                        if (queryResult) {
                            console.log(queryResult[0].startDate);
                            console.log(queryResult[0].startDate.toISOString());
                            console.log(queryResult[0].startDate.toString());
                            console.log(queryResult[0].startDate.getUTCDate());
                        }


                        console.log("queryResult", queryResult);
                        const length = Object.keys(queryResult ?? {}).length;
                        console.log("length", length);
                        return (
                            <div
                                key={date.toISOString()}
                                className={`calendar-day ${isToday ? "today" : ""}`}
                            >
                                {length >= 1 && (
                                    <div>{queryResult[0].detailsShort} {queryResult[0].startDate.getUTCDate()}</div>
                                )}
                                <div className="date-num">
                                    {day}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <style>
                {`
                    /* multiple events will be listed inside the calendar day box, with the title, time, and short description. Each event will be a link to the event page. */
                .calendar-day {
                    display: flex;
                    align-items: end;
                    flex-direction: column;
                    padding: 5px;
                    aspect-ratio: 1 / 1;
                    background-color: rgba(0, 0, 0, 0.05);
                }

                .calendar-day.today {
                    background-color: rgba(0, 0, 0, 0);
                    border: 2px solid rgba(0, 0, 0, 0.05);
                }

                .calendar-day.closed {
                    background-image: url("/assets/closed.png");
                }

                .date-num {
                    height: 100%;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
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
                `}
            </style>
        </>
    );
};
