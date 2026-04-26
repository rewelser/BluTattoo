import { useEffect, useRef, useState } from "react";

type Props = {
    merchantSlug: string;
    locationSlug: string;
    label?: string;
    className?: string;
};

export default function SquareAppointmentsIsland({
                                                     merchantSlug,
                                                     locationSlug,
                                                     label = "Book an appointment",
                                                     className = "",
                                                 }: Props) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const wrapRef = useRef<HTMLDivElement | null>(null);

    const base = `https://app.squareup.com/appointments/buyer/widget/${merchantSlug}/${locationSlug}`;

    useEffect(() => {
        if (!open || loading || !wrapRef.current) return;

        setLoading(true);

        const script = document.createElement("script");
        script.src = `${base}.js`;
        script.async = true;

        script.onload = () => {
            setLoading(false);      // script loaded
        };

        script.onerror = () => {
            setLoading(false);      // fail gracefully
        };

        wrapRef.current.appendChild(script);
    }, [open, base]);

    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
                {label}
            </button>

            {open && (
                <div className="mt-3 border border-gray-200 p-3">
                    {loading && (
                        <div className="text-sm text-gray-500">
                            Loading booking widget…
                        </div>
                    )}

                    <div ref={wrapRef}>
                        <a href={base} target="_blank" rel="noopener noreferrer">
                            {label}
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}