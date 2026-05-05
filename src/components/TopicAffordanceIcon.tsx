import { BookmarkIcon } from "./BookmarkIcon";
import { StarIcon } from "./StarIcon";

type BaseProps = {
  kind: "star" | "bookmark";
  filled: boolean;
  title: string;
  className?: string;
  groupHover?: boolean;
  active?: boolean;
};

type InteractiveProps = BaseProps & {
  variant: "interactive";
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  ariaPressed?: boolean;
};

type ReadOnlyProps = BaseProps & {
  variant: "read-only";
};

export function TopicAffordanceIcon(props: InteractiveProps | ReadOnlyProps) {
  const Icon = props.kind === "star" ? StarIcon : BookmarkIcon;
  const colorClass = getColorClass(props);
  const className = [colorClass, props.className].filter(Boolean).join(" ");

  if (props.variant === "interactive") {
    return (
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.ariaLabel}
        aria-pressed={props.ariaPressed}
        title={props.title}
        className={[
          "rounded-lg p-1 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Icon filled={props.filled} />
      </button>
    );
  }

  return (
    <span title={props.title} className={className}>
      <Icon filled={props.filled} />
    </span>
  );
}

function getColorClass(props: BaseProps): string {
  if (props.filled && (props.active || !props.groupHover)) {
    return "text-orange-400";
  }
  if (props.groupHover) {
    return "text-zinc-600 transition group-hover:text-orange-400 hover:text-orange-400 [@media(hover:none)]:text-orange-400";
  }
  return "text-zinc-600 transition hover:text-orange-400 [@media(hover:none)]:text-orange-400";
}
