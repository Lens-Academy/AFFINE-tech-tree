import { useState, type MouseEvent } from "react";

const VB_W = 960.74587;
const VB_H = 552.37823;

export type MeetPoint = { x: number; y: number };

type Props = {
  point: MeetPoint | null;
  onChange: (point: MeetPoint | null) => void;
  disabled?: boolean;
};

export function MatchMap({ point, onChange, disabled }: Props) {
  // Optimistic local copy so the dot moves instantly while the mutation runs.
  const [local, setLocal] = useState<MeetPoint | null>(point);
  // When the server value changes (refetch), reconcile.
  const serverKey = point ? `${point.x},${point.y}` : "null";
  const [lastServerKey, setLastServerKey] = useState(serverKey);
  if (lastServerKey !== serverKey) {
    setLastServerKey(serverKey);
    setLocal(point);
  }

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const svg = e.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const { x, y } = pt.matrixTransform(ctm.inverse());
    const next = {
      x: Math.max(0, Math.min(1, x / VB_W)),
      y: Math.max(0, Math.min(1, y / VB_H)),
    };
    setLocal(next);
    onChange(next);
  };

  const handleClear = () => {
    setLocal(null);
    onChange(null);
  };

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={`block h-auto w-full rounded-lg bg-white select-none ${
          disabled ? "" : "cursor-crosshair"
        }`}
        onClick={handleClick}
      >
        <image href="/host-wayfinding.svg" width={VB_W} height={VB_H} />
        {local && (
          <g pointerEvents="none">
            <circle
              cx={local.x * VB_W}
              cy={local.y * VB_H}
              r={18}
              fill="#f97316"
              fillOpacity={0.35}
            />
            <circle
              cx={local.x * VB_W}
              cy={local.y * VB_H}
              r={9}
              fill="#f97316"
              stroke="white"
              strokeWidth={3}
            />
          </g>
        )}
      </svg>
      {local && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute top-2 right-2 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Clear
        </button>
      )}
    </div>
  );
}
