import { ReactNode } from "react";

// Chamfered cyberpunk panel — outer layer provides the 1px "border",
// inner layer holds the content. Hover brightens the border to neon.
export default function HudPanel({
  children,
  className = "",
  innerClassName = "",
  accent = "cyan",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  accent?: "cyan" | "magenta";
}) {
  const accentClass = accent === "magenta" ? "hud-panel-magenta" : "";
  return (
    <div className={`hud-panel ${accentClass} ${className}`}>
      <div className={`hud-panel-inner ${innerClassName}`}>{children}</div>
    </div>
  );
}
