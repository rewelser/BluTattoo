import React, { useEffect, useMemo, useState } from "react";
import { ArtistGalleryThumbnailGrid } from "./ArtistGalleryThumbnailGrid";
import { GalleryLightbox } from "./GalleryLightbox";
import { GalleryLightboxNaturalScroll } from "./GalleryLightboxNaturalScroll.tsx";

interface ArtistImage {
    src: string;
    thumbSrc?: string;
    alt?: string;
}

interface ArtistGalleryProps {
    images?: ArtistImage[];
}

/**
 * Device breakpoint:
 * - < 1024px: mobile + tablets => GalleryLightbox
 * - >= 1024px: laptops/desktops => GalleryLightboxNaturalScroll
 */
const useMinWidth = (minWidthPx: number) => {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === "undefined") return false; // SSR-safe default
        return window.matchMedia(`(min-width: ${minWidthPx}px)`).matches;
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mql = window.matchMedia(`(min-width: ${minWidthPx}px)`);

        const onChange = () => setMatches(mql.matches);
        onChange();

        // Safari < 14 fallback
        if (typeof mql.addEventListener === "function") {
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange);
        } else {
            // eslint-disable-next-line deprecation/deprecation
            mql.addListener(onChange);
            // eslint-disable-next-line deprecation/deprecation
            return () => mql.removeListener(onChange);
        }
    }, [minWidthPx]);

    return matches;
}


const usePointerInfo = () => {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;

        return (
            window.matchMedia("(hover: hover) and (pointer: fine)").matches
        );
    });

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mqlInput = window.matchMedia("(hover: hover) and (pointer: fine)");
        const mqlWidth = window.matchMedia("(min-width: 1024px)");

        const onChange = () => {
            setMatches(mqlInput.matches);
        };

        onChange();

        // Safari < 14 fallback
        if (typeof mqlInput.addEventListener === "function") {
            mqlInput.addEventListener("change", onChange);
            mqlWidth.addEventListener("change", onChange);
            return () => {
                mqlInput.removeEventListener("change", onChange);
                mqlWidth.removeEventListener("change", onChange);
            };
        } else {
            // eslint-disable-next-line deprecation/deprecation
            mqlInput.addListener(onChange);
            // eslint-disable-next-line deprecation/deprecation
            mqlWidth.addListener(onChange);
            // eslint-disable-next-line deprecation/deprecation
            return () => {
                mqlInput.removeListener(onChange);
                // eslint-disable-next-line deprecation/deprecation
                mqlWidth.removeListener(onChange);
            };
        }
    }, []);

    return matches;
}

export const ArtistGallery: React.FC<ArtistGalleryProps> = ({ images = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [startIndex, setStartIndex] = useState(0);

    const isLaptopOrDesktop = useMinWidth(1024);
    const LightboxComponent = useMemo(
        () => (isLaptopOrDesktop ? GalleryLightboxNaturalScroll : GalleryLightbox),
        [isLaptopOrDesktop]
    );

    if (!images.length) return null;

    return (
        <>
            <ArtistGalleryThumbnailGrid
                images={images}
                onSelect={(idx) => {
                    setStartIndex(idx);
                    setIsOpen(true);
                }}
                disabled={isOpen}
            />

            {isOpen && (
                <LightboxComponent
                    images={images}
                    isOpen={isOpen}
                    startIndex={startIndex}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </>
    );
};
