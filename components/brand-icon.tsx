import type { SimpleIcon } from "simple-icons";

export function BrandIcon({
  className,
  icon
}: {
  className?: string;
  icon: SimpleIcon;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      role="img"
      viewBox="0 0 24 24"
    >
      <path d={icon.path} />
    </svg>
  );
}
