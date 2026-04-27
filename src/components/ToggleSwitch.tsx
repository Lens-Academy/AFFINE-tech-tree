export function ToggleSwitch({
  ariaLabel,
  checked,
  disabled,
  label,
  offLabel,
  onClick,
  title,
}: {
  ariaLabel?: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  offLabel?: string;
  onClick: () => void;
  title?: string;
}) {
  const displayLabel = checked || !offLabel ? label : offLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-7 items-center gap-2 rounded-sm py-1 text-xs text-zinc-500 transition hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
        disabled ? "opacity-50" : ""
      }`}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
    >
      <span
        className={`relative inline-flex h-4 w-8 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? "bg-orange-400" : "bg-zinc-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      {displayLabel}
    </button>
  );
}
