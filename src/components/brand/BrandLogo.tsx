import { cn } from "@/lib/utils";

const LOGO_SRC = "/micabo-logo.png";

const SIZES = {
  sm: "size-8",
  md: "size-9",
  lg: "size-12",
  xl: "size-16",
} as const;

/** Icône officielle micabo (stylo 3D). Jamais de lettre de substitution. */
export function BrandLogo({
  className,
  size = "md",
  decorative = true,
}: {
  className?: string;
  size?: keyof typeof SIZES;
  decorative?: boolean;
}) {
  return (
    <img
      src={LOGO_SRC}
      alt={decorative ? "" : "micabo"}
      aria-hidden={decorative || undefined}
      className={cn("rounded-[22%] object-cover shadow-xs/10", SIZES[size], className)}
    />
  );
}
