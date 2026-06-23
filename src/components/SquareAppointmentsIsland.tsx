import {useEffect, useRef, useState} from "react";

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
    const [initialized, setInitialized] = useState(false);

    const rootRef = useRef<HTMLDivElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const countRef = useRef<number>(0);

    const base = `https://app.squareup.com/appointments/buyer/widget/${merchantSlug}/${locationSlug}`;

    useEffect(() => {
        const root = rootRef.current;
        const dialog = root?.closest("dialog");

        if (!dialog) return;

        const handleOpen = () => setOpen(true);
        const handleClose = () => setOpen(false);

        dialog.addEventListener("modal:open", handleOpen);
        dialog.addEventListener("modal:close", handleClose);
        dialog.addEventListener("close", handleClose);

        return () => {
            dialog.removeEventListener("modal:open", handleOpen);
            dialog.removeEventListener("modal:close", handleClose);
            dialog.removeEventListener("close", handleClose);
        };
    }, []);

    useEffect(() => {
        if (!open || loading || initialized || !wrapRef.current) return;

        if (countRef.current >= 1) return;
        countRef.current++;

        setLoading(true);

        const script = document.createElement("script");
        script.src = `${base}.js`;
        // script.src = base;
        script.async = true;

        script.onload = () => {
            setLoading(false);
            setInitialized(true);
        };

        script.onerror = () => {
            setLoading(false);
        };

        wrapRef.current.appendChild(script);

        return () => {
            script.remove();
        };
    }, [open, initialized, base]);

    return (
        <div ref={rootRef} className={className}>
            {(open || initialized) && (
                <div>
                    {loading && (
                        <div className="text-sm text-gray-500 p-3">
                            Loading booking widget…
                        </div>
                    )}

                    <div ref={wrapRef}>
                        {/*<a href={base} target="_blank" rel="noopener noreferrer">*/}
                        {/*    {label}*/}
                        {/*</a>*/}
                    </div>
                </div>
            )}
        </div>
    );
}