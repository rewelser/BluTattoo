import React from "react";

type Props = React.SVGProps<SVGSVGElement>;

export const LoadingSpinner: React.FC<Props> = ({
  className = "",
  color = "red",
  width = "48",
  height = "48",
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 50 50"
      width={`${width}`}
      height={`${height}`}
      role="img"
      aria-label="Loading"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={`${color}`}
        strokeOpacity="0.2"
        strokeWidth="5"
      />

      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={`${color}`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="60 80"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
};
