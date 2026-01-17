import React from "react";

interface ArtistImage {
    src: string;
    alt?: string;
    // Future use: allow separate thumbnail source without changing callers
    thumbnailSrc?: string;
}

interface ArtistGalleryThumbnailGridProps {
    images?: ArtistImage[];
    isClosing?: boolean;
    onOpenAt: (index: number) => void;
}

export const ArtistGalleryThumbnailGrid: React.FC<ArtistGalleryThumbnailGridProps> = ({
    images = [],
    isClosing = false,
    onOpenAt,
}) => {
    if (!images || images.length === 0) return null;

    return (
        <>
            {/* Thumbnail grid stays as-is, inside your layout card */}
            <div id="thumbnail-grid" className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                    <button
                        disabled={isClosing}
                        key={img.src + idx}
                        type="button"
                        className="group relative overflow-hidden rounded-xl border border-black/5 bg-black/5 hover:bg-black/10 transition"
                        onClick={() => onOpenAt(idx)}
                    >
                        <img
                            src={img.thumbnailSrc ?? img.src}
                            alt={img.alt ?? ""}
                            className="aspect-square w-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                        />
                        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity" />
                    </button>
                ))}
            </div>
        </>
    );
};
