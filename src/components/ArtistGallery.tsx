import React, { useState } from "react";
import { ArtistGalleryThumbnailGrid } from "./ArtistGalleryThumbnailGrid";
import { GalleryLightbox } from "./GalleryLightbox";

interface ArtistImage {
    src: string;
    thumbSrc?: string;
    alt?: string;
}

interface ArtistGalleryProps {
    images?: ArtistImage[];
}

export const ArtistGallery: React.FC<ArtistGalleryProps> = ({ images = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [startIndex, setStartIndex] = useState(0);

    if (!images.length) return null;

    return (
        <>
            <ArtistGalleryThumbnailGrid
                images={images}
                onSelect={(idx) => {
                    setStartIndex(idx);
                    setIsOpen(true);
                }}
                disabled={isOpen} // optional: disable while open (or you can keep it enabled)
            />
            {isOpen && (
                <GalleryLightbox
                    images={images}
                    isOpen={isOpen}
                    startIndex={startIndex}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </>
    );
};
