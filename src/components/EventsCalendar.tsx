
import React, { useEffect, useState } from "react";
// import { buildEventsByYearMonth, type EventItem } from "../scripts/events";
import type { EventsByYearMonthDay } from "../scripts/events";

interface EventsCalendarProps {
    eventsByYearMonthDay: EventsByYearMonthDay;
}

export const EventsCalendar: React.FC<EventsCalendarProps> = ({ eventsByYearMonthDay }) => {
    // const yearMonthEvents = buildEventsByYearMonth(events);
    const [currentDate] = useState<Date>(new Date());
    const [traversedDate, setTraversedDate] = useState<Date>(currentDate);
    const [traversedMonthDates, setTraversedMonthDates] = useState<Date[]>([]);

    const prev = (e: React.MouseEvent<HTMLElement>) => {
        setTraversedDate(new Date(traversedDate.setMonth(traversedDate.getMonth() - 1)));
    };

    const next = (e: React.MouseEvent<HTMLElement>) => {
        setTraversedDate(new Date(traversedDate.setMonth(traversedDate.getMonth() + 1)));
    };

    useEffect(() => {
        const getDaysInMonth = () => {
            const year = traversedDate.getFullYear();
            const month = traversedDate.getMonth();
            const date = new Date(year, month, 1);
            const dates = [];
            while (date.getMonth() === month) {
                dates.push(date);
                date.setDate(date.getDate() + 1);
            }
            setTraversedMonthDates(dates);

        };
        getDaysInMonth();
    }, [traversedDate]);



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
                <div className="grid h-full w-full grid-cols-7 items-center gap-1">
                    <div className="calendar-day-header">Sun</div>
                    <div className="calendar-day-header">Mon</div>
                    <div className="calendar-day-header">Tue</div>
                    <div className="calendar-day-header">Wed</div>
                    <div className="calendar-day-header">Thu</div>
                    <div className="calendar-day-header">Fri</div>
                    <div className="calendar-day-header">Sat</div>
                    {traversedMonthDates.map((date, index) => (
                        <div
                            key={index}
                            className="calendar-day"
                        >
                            <div className="date-num">
                                {date.getDay()}
                            </div>
                        </div>
                    ))}

                    {/* <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day today"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div>
                    <div className="calendar-day"><div className="date-num">1</div></div> */}
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


{/* <script define:vars={{ yearMonthEvents, currentDate: Date }}>
    (() => {
        let curDate = currentDate;
    const btn = document.getElementById("myprevbtn");
    btn.addEventListener("click", function () {
        // curDate = curDate
        curDate.setMonth(curDate.getMonth() - 1);
    console.log(curDate);
        });

            // console.log("events", events);
    // console.log(getOccurrencesForMonth("2026", 3));

    // const getOccurrencesForMonth = (events, monthIndex, year) => {
        //     const dates = [];
        //     let currentDate = new Date(year, monthIndex);
        //     console.log(currentDate);

        // };
        // console.log("yearMonthEvents", yearMonthEvents);

        // 2. Add an event listener for the 'click' event
    })();
</script> */}
