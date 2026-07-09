import React, {useEffect, useMemo, useRef, useState} from "react";
import type {EventItem, EventsByYearMonthDate} from "../domain/events/types";
import {
    buildEventsByYearMonthDate,
} from "../domain/events/grouping.ts";
import {buildMonthBoundedRecurrentEvents} from "../domain/events/recurrence/grouping.ts";
/**
 * todo: once safari supports @supports at-rules, then we can simply use:
 * @EventsCalendar.css
 *
 * Then, once safari supports all the cool stuff, we can just use the anchor version.
 * In that case, we can delete the medium and small class logic in this component.
 */
import "../styles/EventsCalendar-anchor-with-fallback.css";
// import {fmtDate, fmtTime, fmtTimeWindow} from "../domain/events/format.ts";
import {fmtDate, fmtTime} from "../domain/events/format.ts";
import type {RecurrentEventItem} from "../domain/events/recurrence/types.ts";
import {Temporal} from "temporal-polyfill";

interface EventsCalendarProps {
    events: EventItem[];
}

// sherpa thuggin
export const EventsCalendar: React.FC<EventsCalendarProps> = ({events}) => {
    // todo: is there a better place in here to declare this? Maybe not
    // const eventsByYearMonthDate: EventsByYearMonthDate = buildEventsByYearMonthDate(events);
    // addendum to todo: memoization allows us to only call buildEventsByYearMonthDate when the events prop changes, rather than on every rerender
    const eventsByYearMonthDate: EventsByYearMonthDate = useMemo(
        () => buildEventsByYearMonthDate(events),
        [events]
    );
    const [traversedMonthStartDate, setTraversedMonthStartDate] = useState<Temporal.PlainDate>(() => {
        return Temporal.Now.plainDateISO().with({day: 1})
    })

    const [openDateKey, setOpenDateKey] = useState<string | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    // todo - recurrences: this is the main piece of logic needed in this whole component for recurrences to work, I think.
    const recurrentEventsByMonth = useMemo(() => {
        const year = traversedMonthStartDate.year;
        const month = traversedMonthStartDate.month;

        console.log("-------------------");
        console.table({
            year: year,
            month: month,
        })

        return buildMonthBoundedRecurrentEvents(events, year, month);

        // return expandRecurrentEventsFromRange({kind: "month", year: year, month: month})

    }, [traversedMonthStartDate]);

    const calendarData = useMemo(() => {
        const prevTrailingPlaceholders = traversedMonthStartDate.dayOfWeek % traversedMonthStartDate.daysInWeek;
        const nextLeadingPlaceholders = traversedMonthStartDate.daysInWeek - (traversedMonthStartDate.with({day: Number.MAX_VALUE}).dayOfWeek % traversedMonthStartDate.daysInWeek) - 1;

        const prevTrailingDates = Array.from({length: prevTrailingPlaceholders}, (_, i) =>
            traversedMonthStartDate.subtract({days: prevTrailingPlaceholders - i}).day
        );
        const nextLeadingDates = Array.from({length: nextLeadingPlaceholders}, (_, i) =>
            traversedMonthStartDate.add({months: 1, days: i}).day
        );

        const monthDates = Array.from({length: traversedMonthStartDate.daysInMonth}, (_, i) => {
            const d = i + 1; // + 1 to increment
            const rawY = String(traversedMonthStartDate.year);
            const rawM = String(traversedMonthStartDate.month).padStart(2, "0");
            const rawD = String(d).padStart(2, "0");

            const temporalCursor = Temporal.PlainDate.from({
                year: Number(rawY),
                month: Number(rawM),
                day: Number(rawD)
            });
            const gridColumnStart = temporalCursor.dayOfWeek % temporalCursor.daysInWeek + 1;
            return {
                temporalCursor,
                rawYear: rawY,
                rawMonth: rawM,
                rawDate: rawD,
                gridColumnStart,
                dateKey: temporalCursor.toString(),
            };
        });

        return {
            monthDates,
            prevTrailingDates: prevTrailingDates,
            nextLeadingDates: nextLeadingDates,
        };
    }, [traversedMonthStartDate]);

    const monthYearLabel = traversedMonthStartDate.toLocaleString("en-US", {
        month: "long",
        year: "numeric"
    });

    // todo - recurrences: consider calling our expandRecurrentEventsFromRange here, updating a smaller list separate from eventsByYearMonthDate (but whose return value is structured similarly)
    const prev = () => {
        setTraversedMonthStartDate((prev) => prev.subtract({months: 1}).with({day: 1}));
        setOpenDateKey(null);
    };

    // todo - recurrences: consider calling our expandRecurrentEventsFromRange here, updating a smaller list separate from eventsByYearMonthDate (but whose return value is structured similarly)
    const next = () => {
        setTraversedMonthStartDate((prev) => prev.add({months: 1}).with({day: 1}));
        setOpenDateKey(null);
    };

    const getAllWeekdayNames = (
        locale: string = "en-US",
        options: Intl.DateTimeFormatOptions = {weekday: "short"}
    ) => {
        return Array.from({length: 7}, (_, i) =>
            Temporal.PlainDate.from("1970-01-04").add({days: i}).toLocaleString(locale, options)
        );
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
        <section aria-labelledby="calendar-month-heading">
            <div className="flex items-center justify-between p-5 sm:p-10 md:px-30">
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
                        <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z"/>
                    </svg>
                </button>

                <h2 id="calendar-month-heading" className="text-3xl sm:text-5xl">{monthYearLabel}</h2>

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
                        <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"/>
                    </svg>
                </button>
            </div>

            <div className="grid h-full w-full grid-cols-7 items-center gap-1">
                {getAllWeekdayNames().map((weekday_short) => (
                    <div key={weekday_short} className="calendar-day-header flex justify-center">
                        {weekday_short}
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
                         temporalCursor,
                         rawYear,
                         rawMonth,
                         rawDate,
                         gridColumnStart,
                         dateKey,
                     }) => {
                        const now = Temporal.Now.plainDateISO();
                        const isToday = now.equals(temporalCursor);

                        const dailyEventsObj = eventsByYearMonthDate[rawYear]?.[rawMonth]?.[rawDate];
                        /**
                         * todo - recurrences: here, we will (I think) do the same thing as dailyEventsObj but for recurrences:
                         *  something like 'dailyRecurrentEventsObj', using a recurrentEventsByMonthDate, which we will
                         *  then fold into dailyEvents. I think it might truly be that simple.
                         */
                        const dailyEvents = Array.from(dailyEventsObj ?? {});

                        const hasEvents = dailyEvents.length > 0;
                        const needsSingleEventImageVariant = dailyEvents.length === 1 && dailyEvents[0].image;
                        const isOpen = openDateKey === dateKey;
                        const hasClosedShopEvent = hasEvents && dailyEvents.some((event) => (event.shopClosed));
                        return (
                            <div
                                key={dateKey}
                                className={`calendar-day ${isToday ? "today" : ""} ${needsSingleEventImageVariant ? "bg-img bg-cover bg-center" : ""}`}
                                onClick={() => {
                                    if (!canHover) {
                                        setOpenDateKey((prev) =>
                                            prev === dateKey ? null : dateKey
                                        );
                                    }
                                }}
                                style={{
                                    gridColumnStart: gridColumnStart,
                                    ...(needsSingleEventImageVariant && {
                                        backgroundImage: `url(${dailyEvents[0].image?.src})`
                                    })
                                }}
                            >
                                {
                                    needsSingleEventImageVariant && (
                                        <a className="single-event-anchor absolute top-0 left-0 z-20 h-full w-full"
                                           href={`/events/${dailyEvents[0].id}`}></a>
                                    )
                                }
                                <div className="date-num">{temporalCursor.day}</div>
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
                                                            <time dateTime={ev.startTime}>{fmtTime(ev.startTime)}</time>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/*{fmtTimeWindow(ev)}*/}
                                                            All Day
                                                        </>
                                                    )}
                                                </span>
                                                <br/>

                                                {ev.title}
                                            </a>
                                        </div>
                                    ))}
                                </div>

                                {hasEvents && (
                                    <div
                                        className={`overlay ${dailyEvents.length === 1 && !dailyEvents[0].detailsShort ? "short" : "medium"} ${isOpen && !canHover ? "is-open" : ""}`}
                                        aria-label={`Events for ${fmtDate(dateKey)}`}
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
                                                            <h3 className="text-xl leading-none">{ev.title} →</h3>
                                                        </a>
                                                        <div className="text-xs leading-none py-2">
                                                            {/*{fmtTimeWindow(ev)}*/}
                                                            {ev.startTime && ev.endTime ?
                                                                <>
                                                                    <time
                                                                        dateTime={ev.startTime}>{fmtTime(ev.startTime)}</time>
                                                                    {` – `}
                                                                    <time
                                                                        dateTime={ev.endTime}>{fmtTime(ev.endTime)}</time>
                                                                </>
                                                                : ev.startTime ?
                                                                    <>Starts <time
                                                                        dateTime={ev.startTime}>{fmtTime(ev.startTime)}</time></>
                                                                    : ev.endTime ?
                                                                        <>
                                                                            Until <time
                                                                            dateTime={ev.endTime}>{fmtTime(ev.endTime)}</time>
                                                                        </>
                                                                        : "All day"}
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
        </section>
    );
};