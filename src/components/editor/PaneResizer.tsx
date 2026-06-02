import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type PaneResizerProps = {
  label: string;
  max: number;
  min: number;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  title: string;
  value: number;
};

export function PaneResizer({
  label,
  max,
  min,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  title,
  value,
}: PaneResizerProps) {
  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={Math.round(value)}
      className="pane-resizer"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      role="separator"
      tabIndex={0}
      title={title}
    />
  );
}
