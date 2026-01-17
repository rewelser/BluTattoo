import React from "react";

interface ArtistImage {
  src: string;
  thumbSrc?: string;
  alt?: string;
}

interface ArtistGalleryThumbnailGridProps {
  images: ArtistImage[];
  disabled?: boolean;
  onSelect: (index: number) => void;

  /**
   * Optional customization:
   * - className for the grid container
   * - itemClassName for each button
   */
  className?: string;
  itemClassName?: string;

  /**
   * Fallback if thumbSrc is missing.
   * Default: use full-size src (works, but not ideal).
   */
  getThumbSrc?: (img: ArtistImage, index: number) => string;
}

export const ArtistGalleryThumbnailGrid: React.FC<ArtistGalleryThumbnailGridProps> = ({
  images,
  disabled = false,
  onSelect,
  className = "mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3",
  itemClassName = "group relative overflow-hidden rounded-xl border border-black/5 bg-black/5 hover:bg-black/10 transition",
  getThumbSrc = (img) => img.thumbSrc ?? img.src,
}) => {
  if (!images?.length) return null;

  return (
    <div id="thumbnail-grid" className={className}>
      {images.map((img, idx) => (
        <button
          key={(img.thumbSrc ?? img.src) + idx}
          type="button"
          disabled={disabled}
          className={itemClassName}
          onClick={() => onSelect(idx)}
        >
          <img
            src={getThumbSrc(img, idx)}
            alt={img.alt ?? ""}
            className="aspect-square w-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
            // This hint helps the browser avoid fetching huge sources for thumbs (optional)
            // decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity" />
        </button>
      ))}
    </div>
  );
};
