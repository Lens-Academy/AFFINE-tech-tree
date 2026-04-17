type AvailabilityCircleProps = {
  available: boolean;
  className?: string;
  title?: string;
};

export function AvailabilityCircle({
  available,
  className = "",
  title = "Available for tutoring",
}: AvailabilityCircleProps) {
  if (!available) {
    return null;
  }

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full bg-orange-400 ${className}`.trim()}
      title={title}
    />
  );
}
