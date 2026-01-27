import React from "react";

type Props = React.SVGProps<SVGSVGElement>;

export const ErrorSpinner: React.FC<Props> = ({
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
      aria-label="Error"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Outer faint ring (matches spinner tone) */}
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={`${color}`}
        strokeOpacity="0.2"
        strokeWidth="5"
      />

      {/* Bold ring */}
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={`${color}`}
        strokeWidth="5"
      />

      {/* X mark */}
      <line
        x1="17"
        y1="17"
        x2="33"
        y2="33"
        stroke={`${color}`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="33"
        y1="17"
        x2="17"
        y2="33"
        stroke={`${color}`}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
};
