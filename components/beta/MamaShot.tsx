/**
 * Beta mama moment while logging shots (Animaties › Schot · gsm): the mat
 * from above, the thrower's cap flies into the opponent's mama zone, the zone
 * flashes red, rings burst, the screen shakes and MAMA! slams in. Team B
 * throws the other way (the mat is mirrored). One 3.3s run; tap to skip.
 */
"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { D, Stage } from "./Stage";
import m from "./mama.module.css";

export function MamaShot({ name, team, onDone }: Readonly<{ name: string; team: number; onDone: () => void }>) {
  const { t } = useT();
  const S = t.beta.start;

  useEffect(() => {
    const id = setTimeout(onDone, 3300);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <Stage bg="#08090A" role="button" aria-label={S.close} onClick={onDone}>
      <div className={m.root} style={{ position: "absolute", inset: 0 }}>
      <div className={m.flash} style={{ position: "absolute", inset: -400, background: "#E3101E", pointerEvents: "none" }} />

      <div style={{ position: "absolute", left: 20, right: 20, top: 30, height: 64, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em" }}>TEAM {String.fromCharCode(65 + team)}</div>
        <div style={{ ...D, fontSize: 32, lineHeight: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase" }}>{name}</div>
        <div className={m.badge} style={{ padding: "5px 10px", borderRadius: 999, background: "#E3101E", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", flexShrink: 0 }}>{S.mamaBadge}</div>
      </div>

      <svg width="212" height="659" viewBox="0 0 265 824" aria-hidden="true" style={{ position: "absolute", left: 89, top: 110, overflow: "visible", transform: team === 1 ? "scaleY(-1)" : undefined }}>
        <g transform="translate(265 0) rotate(90)">
          <rect x="28" y="10" width="768" height="245" rx="16" fill="#0E1012" stroke="#E0A43A" strokeWidth="6" />
          <rect x="36" y="18" width="752" height="229" rx="10" fill="none" stroke="#1E2124" strokeWidth="2" />
          <rect x="42" y="95" width="38" height="90" fill="#E3101E" />
          <rect className={m.zone} x="744" y="95" width="38" height="90" fill="#E3101E" />
          <circle cx="76" cy="101" r="19" fill="#4A2A1C" stroke="#2A160E" strokeWidth="3" />
          <circle cx="76" cy="166" r="19" fill="#4A2A1C" stroke="#2A160E" strokeWidth="3" />
          <circle cx="748" cy="101" r="19" fill="#4A2A1C" stroke="#2A160E" strokeWidth="3" />
          <circle cx="748" cy="166" r="19" fill="#4A2A1C" stroke="#2A160E" strokeWidth="3" />
          <polygon points="95,131 175,100 175,163" fill="#E0A43A" />
          <polygon points="182,96 255,70 255,195 182,167" fill="#E0A43A" />
          <polygon points="262,68 320,35 401,131 320,228 262,195" fill="#E0A43A" />
          <polygon points="423,131 504,35 562,68 562,195 504,228" fill="#E0A43A" />
          <polygon points="569,70 642,96 642,167 569,195" fill="#E0A43A" />
          <polygon points="649,100 729,131 649,163" fill="#E0A43A" />
          <line className={m.aim} x1="60" y1="228" x2="765" y2="136" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="4 8" strokeLinecap="round" />
          <circle className={m.ring} cx="763" cy="138" r="24" fill="none" stroke="#FFFFFF" strokeWidth="4" />
          <circle className={m.ring2} cx="763" cy="138" r="24" fill="none" stroke="#E3101E" strokeWidth="4" />
          <g className={m.cap}>
            <circle cx="60" cy="228" r="15" fill="#EFE7D3" stroke="#C9A55A" strokeWidth="3" />
            <circle cx="60" cy="228" r="7" fill="none" stroke="#C9BFA8" strokeWidth="2" />
          </g>
        </g>
      </svg>

      <div className={m.txt} style={{ ...D, position: "absolute", left: 0, right: 0, top: 360, textAlign: "center", fontSize: 120, lineHeight: 1, color: "#FFFFFF", textShadow: "0 6px 0 #E3101E" }} aria-live="assertive">
        {S.mamaTitle}
      </div>
      </div>
    </Stage>
  );
}
