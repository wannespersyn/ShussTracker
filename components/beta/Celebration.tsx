/**
 * Beta "viermomenten" on the game page, ported 1:1 from the Animaties
 * designs: Game gewonnen → Streak +1 → Ranking-klim → Achievement unlocked
 * (max 3, winners only), once per device per game. Each moment plays its
 * own timeline, then the next one starts; tap to skip ahead.
 */
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useT } from "@/lib/i18n/client";
import { format, type Dictionary } from "@/lib/i18n";
import { ACHIEVEMENT_ICON_PATH } from "@/lib/achievements-v2";
import type { CelebrationMoment } from "@/lib/db/celebrate";
import { cn } from "@/lib/cn";
import { streakTier } from "@/lib/streak-tier";
import { CAP_PATH, D, FLAME_PATH, HEX, Shards, Stage } from "./Stage";
import c from "./celebrate.module.css";

const DUR: Record<CelebrationMoment["kind"], number> = { win: 4700, streak: 3900, climb: 4600, achievement: 4800 };
const seenKey = (gameId: string) => `shuss:celebrated:${gameId}`;
type Copy = Dictionary["beta"]["celebrate"];
const SPARK = "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)";

export function Celebration({ gameId, moments }: Readonly<{ gameId: string; moments: CelebrationMoment[] }>) {
  const { t } = useT();
  const C = t.beta.celebrate;
  const [i, setI] = useState<number | null>(null);

  useEffect(() => {
    if (moments.length === 0) return;
    try {
      if (localStorage.getItem(seenKey(gameId))) return;
    } catch {
      // Storage blocked: still celebrate, it just may replay.
    }
    // Mark as seen only once it actually starts (dev StrictMode runs this
    // effect twice; marking up front made the second run bail out).
    const id = setTimeout(() => {
      try {
        localStorage.setItem(seenKey(gameId), "1");
      } catch {
        // ignore
      }
      setI(0);
    }, 0);
    return () => clearTimeout(id);
  }, [gameId, moments.length]);

  useEffect(() => {
    if (i === null) return;
    const id = setTimeout(() => setI((x) => (x === null || x + 1 >= moments.length ? null : x + 1)), DUR[moments[i].kind]);
    return () => clearTimeout(id);
  }, [i, moments]);

  if (i === null) return null;
  const m = moments[i];
  const next = () => setI((x) => (x === null || x + 1 >= moments.length ? null : x + 1));

  return (
    <Stage bg="#0E0E0F" role="button" tabIndex={0} aria-label={C.tap} onClick={next} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && next()}>
      <div key={i} className={c.mIn} style={{ position: "absolute", inset: 0 }} aria-live="assertive">
        {m.kind === "win" && <Win m={m} C={C} />}
        {m.kind === "streak" && <Streak m={m} C={C} />}
        {m.kind === "climb" && <Climb m={m} C={C} />}
        {m.kind === "achievement" && <Achievement m={m} C={C} />}
      </div>
      {moments.length > 1 && (
        <div style={{ position: "absolute", left: 20, right: 20, top: 16, display: "flex", gap: 4 }} aria-hidden="true">
          {moments.map((_, k) => (
            <span key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: k <= i ? "#FFFFFF" : "rgba(255,255,255,0.25)" }} />
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#6E6E6A" }}>{C.tap}</div>
    </Stage>
  );
}

function Win({ m, C }: Readonly<{ m: Extract<CelebrationMoment, { kind: "win" }>; C: Copy }>) {
  return (
    <>
      <div className={c.wnFlash} style={{ position: "absolute", inset: -400, background: "#FFC23D" }} />
      <div className={c.wnShake} style={{ position: "absolute", inset: 0 }}>
        <div className={c.wnRays} style={{ position: "absolute", left: -130, top: 30, width: 650, height: 650, borderRadius: "50%", background: "repeating-conic-gradient(rgba(255,194,61,0.22) 0deg 9deg, rgba(255,194,61,0) 9deg 24deg)" }} />
        <Shards x={195} y={355} n={14} big={26} small={18} border={4} offset={6} className={c.wnShard} delay={(k) => (k % 4) * 0.04} />
        <div className={c.wnDrop} style={{ position: "absolute", left: 95, top: 255, width: 200, height: 200 }}>
          <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
            <path d={CAP_PATH} fill="#FFC23D" stroke="#FFC23D" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="100" cy="100" r="70" fill="#FFD36B" stroke="#0E0E0F" strokeWidth="5" />
            <path d="M66 124 L66 80 L84 96 L100 66 L116 96 L134 80 L134 124 Z" fill="#0E0E0F" />
          </svg>
        </div>
        <div className={c.wnSlam} style={{ ...D, position: "absolute", left: 0, right: 0, top: 500, textAlign: "center", fontSize: 92, lineHeight: 0.9, color: "#FFFFFF" }}>{C.won}</div>
        <div className={c.wnUp} style={{ position: "absolute", left: 20, right: 20, top: 600, display: "flex", justifyContent: "center" }}>
          <div style={{ padding: "8px 14px", borderRadius: 999, background: "#FFFFFF", color: "#0E0E0F", fontSize: 14, fontWeight: 800, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.team}</div>
        </div>
        {m.elo !== 0 && (
          <div className={c.wnUp} style={{ position: "absolute", left: 20, right: 20, top: 660, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 12 }}>
            <div style={{ position: "relative", width: 140, height: 60 }}>
              <div className={c.wnEloA} style={{ ...D, position: "absolute", right: 0, fontSize: 60, lineHeight: 1, color: "#B8B8B4" }}>{m.before}</div>
              <div className={c.wnEloB} style={{ ...D, position: "absolute", right: 0, fontSize: 60, lineHeight: 1, color: "#FFC23D" }}>{m.after}</div>
            </div>
            <div style={{ ...D, fontSize: 30, color: m.elo > 0 ? "#7BE08A" : "#FF8A7A" }}>{format(C.eloDelta, { n: m.elo > 0 ? `+${m.elo}` : String(m.elo) })}</div>
          </div>
        )}
      </div>
    </>
  );
}

function Streak({ m, C }: Readonly<{ m: Extract<CelebrationMoment, { kind: "streak" }>; C: Copy }>) {
  const dots = Math.min(m.n, 12);
  const tier = streakTier(m.n);
  const title = [C.onFire, C.tierHot, C.tierBlue, C.tierLegend][tier.level];
  const embers: [number, number, number, string, number, number][] = [
    [150, 420, 8, tier.accent, -30, 0],
    [200, 430, 6, tier.flame, 20, 0.5],
    [240, 410, 7, tier.accent, 40, 1.1],
    [175, 425, 5, "#FFFFFF", -10, 1.6],
    [130, 415, 6, tier.flame, -50, 0.8],
  ];
  return (
    <>
      <div className={c.skHalo} style={{ position: "absolute", left: 20, top: 150, width: 350, height: 350, borderRadius: "50%", background: tier.flame, filter: "blur(70px)" }} />
      <div style={{ position: "absolute", left: 20, right: 20, top: 44, textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#B8B8B4", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.team}</div>
        <div style={{ ...D, fontSize: 40, lineHeight: 1, marginTop: 4 }}>{title}</div>
      </div>
      <div className={c.skRing} style={{ position: "absolute", left: 120, top: 250, width: 150, height: 150, borderRadius: "50%", border: `4px solid ${tier.accent}` }} />
      <div className={c.skGrow} style={{ position: "absolute", left: 75, top: 140, width: 240, height: 300 }}>
        <svg className={c.skFlick} width="240" height="300" viewBox="0 0 200 250" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          <path d={FLAME_PATH} fill={tier.flame} />
          <path d={FLAME_PATH} fill="none" stroke={tier.stroke} strokeWidth="6" />
        </svg>
        <svg className={c.skInner} width="240" height="300" viewBox="0 0 200 250" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          <path d="M100 96 C112 126 140 140 138 182 C136 214 118 236 100 236 C82 236 62 216 62 186 C62 160 80 150 84 124 C92 136 96 140 100 96 Z" fill={tier.inner} />
          <path d="M100 160 C106 176 120 184 118 204 C117 220 109 230 100 230 C91 230 82 220 82 206 C82 194 90 188 92 176 C96 182 98 184 100 160 Z" fill={tier.core} />
        </svg>
      </div>
      {embers.map(([l, tp, sz, col, dx, dl], k) => (
        <div key={k} className={c.skEmber} style={{ position: "absolute", left: l, top: tp, width: sz, height: sz, borderRadius: "50%", background: col, ["--dx" as string]: `${dx}px`, animationDelay: `${dl}s` } as CSSProperties} />
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 470, height: 150, overflow: "hidden" }}>
        <div className={c.skOld} style={{ ...D, position: "absolute", left: 0, right: 0, top: 0, textAlign: "center", fontSize: 150, lineHeight: 1, color: "#FFFFFF" }}>{m.n - 1}</div>
        <div className={c.skNew} style={{ ...D, position: "absolute", left: 0, right: 0, top: 0, textAlign: "center", fontSize: 150, lineHeight: 1, color: tier.accent }}>{m.n}</div>
      </div>
      <div style={{ ...D, position: "absolute", left: 0, right: 0, top: 622, textAlign: "center", fontSize: 32, lineHeight: 1 }}>{C.winsInRow}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 676, display: "flex", justifyContent: "center", gap: 6 }}>
        {Array.from({ length: dots }, (_, k) => (
          <div key={k} className={k === dots - 1 ? c.skDot : undefined} style={{ width: 14, height: 14, borderRadius: "50%", background: k === dots - 1 ? "#2A2A2A" : tier.flame, ["--dot" as string]: tier.flame } as CSSProperties} />
        ))}
      </div>
      {m.record && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 60, display: "flex", justifyContent: "center" }}>
          <div className={c.skBadge} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: tier.accent, color: "#0E0E0F", fontSize: 14, fontWeight: 800 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 18L4 8l4.5 4L12 5l3.5 7L20 8v10z" />
            </svg>
            {format(C.recordCrew, { crew: m.crew })}
          </div>
        </div>
      )}
    </>
  );
}

function Climb({ m, C }: Readonly<{ m: Extract<CelebrationMoment, { kind: "climb" }>; C: Copy }>) {
  const rankColor = (r: number) => (r === 1 ? "#FFC23D" : r <= 3 ? "#D6D6D2" : "#9A9A96");
  const places = m.from - m.to;
  const gained = m.eloAfter - m.eloBefore;
  return (
    <>
      <div style={{ position: "absolute", left: 20, right: 20, top: 44 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#B8B8B4", textTransform: "uppercase" }}>{format(C.crewRanking, { crew: m.crew })}</div>
        <div style={{ ...D, fontSize: 56, lineHeight: 0.9, marginTop: 4 }}>{C.climb}</div>
      </div>
      <div className={c.rkList} style={{ position: "absolute", left: 20, right: 20, top: 170, height: 500 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 34 }}>
          {m.rows.map((r) => (
            <div key={r.rank} style={{ ...D, height: 76, marginBottom: 8, display: "flex", alignItems: "center", fontSize: 30, color: rankColor(r.rank) }}>
              {r.rank}
            </div>
          ))}
        </div>
        {m.rows.map((r, j) => {
          if (r.me) return null;
          const moves = j > m.newSlot && j <= m.oldSlot;
          return (
            <div key={`${r.rank}-${r.name}`} className={moves ? c.rkDown : undefined} style={{ position: "absolute", left: 40, right: 0, top: (moves ? j - 1 : j) * 84, height: 76, borderRadius: 16, background: "#1C1C1D", display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{r.initial}</div>
              <div style={{ flex: 1, fontSize: 17, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ ...D, fontSize: 28 }}>{r.elo}</div>
            </div>
          );
        })}
        {m.rows
          .filter((r) => r.me)
          .map((r) => (
            <div key="me" className={c.rkMe} style={{ position: "absolute", left: 40, right: 0, top: m.oldSlot * 84, height: 76, borderRadius: 16, background: "#FFC23D", color: "#0E0E0F", display: "flex", alignItems: "center", gap: 12, padding: "0 16px", zIndex: 2, ["--up" as string]: `${-(m.oldSlot - m.newSlot) * 84}px` } as CSSProperties}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#0E0E0F", color: "#FFC23D", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{r.initial}</div>
              <div style={{ flex: 1, fontSize: 17, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{format(C.you, { name: r.name })}</div>
              <svg className={c.rkArrow} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
              <div style={{ position: "relative", width: 62, height: 30 }}>
                <div className={c.rkEloA} style={{ ...D, position: "absolute", right: 0, fontSize: 28, lineHeight: "30px" }}>{m.eloBefore}</div>
                <div className={c.rkEloB} style={{ ...D, position: "absolute", right: 0, fontSize: 28, lineHeight: "30px" }}>{m.eloAfter}</div>
              </div>
            </div>
          ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", justifyContent: "center" }}>
        <div className={c.rkBadge} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 999, background: "#7BE08A", color: "#0E0E0F", fontSize: 16, fontWeight: 800 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
          {places === 1 ? C.placesOne : format(C.places, { n: places })}
          {gained > 0 && ` · +${gained} Elo`}
        </div>
      </div>
    </>
  );
}

function Achievement({ m, C }: Readonly<{ m: Extract<CelebrationMoment, { kind: "achievement" }>; C: Copy }>) {
  const from = m.need > 1 ? Math.round((Math.min(m.before, m.need - 1) / m.need) * 100) : 0;
  return (
    <>
      <div className={c.acRays} style={{ position: "absolute", left: -80, top: 50, width: 550, height: 550, borderRadius: "50%", background: "repeating-conic-gradient(rgba(255,194,61,0.2) 0deg 8deg, rgba(255,194,61,0) 8deg 20deg)" }} />
      <div className={c.acBadge} style={{ position: "absolute", left: 95, top: 220, width: 200, height: 220 }}>
        <div style={{ position: "absolute", inset: 0, clipPath: HEX, background: "#FFC23D", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 14, clipPath: HEX, background: "#0E0E0F", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#FFC23D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ACHIEVEMENT_ICON_PATH[m.icon]} />
            </svg>
          </div>
          <div className={c.acShine} style={{ position: "absolute", left: 0, top: -40, width: 50, height: 300, background: "rgba(255,255,255,0.45)" }} />
        </div>
      </div>
      <div className={c.acSpark} style={{ position: "absolute", left: 70, top: 230, width: 22, height: 22, background: "#FFFFFF", clipPath: SPARK }} />
      <div className={c.acSpark} style={{ position: "absolute", left: 300, top: 270, width: 28, height: 28, background: "#FFC23D", clipPath: SPARK, animationDelay: ".1s" }} />
      <div className={c.acSpark} style={{ position: "absolute", left: 290, top: 420, width: 18, height: 18, background: "#FFFFFF", clipPath: SPARK, animationDelay: ".2s" }} />

      <div className={c.acLbl} style={{ position: "absolute", left: 20, right: 20, top: 480, textAlign: "center", fontSize: 13, fontWeight: 800, letterSpacing: "0.2em", color: "#FFC23D", textTransform: "uppercase" }}>{C.unlocked}</div>
      <div className={c.acNm} style={{ position: "absolute", left: 20, right: 20, top: 506, textAlign: "center" }}>
        <div style={{ ...D, fontSize: m.name.length > 12 ? 52 : 64, lineHeight: 0.9, textTransform: "uppercase" }}>{m.name}</div>
        <div style={{ fontSize: 15, color: "#D6D6D2", marginTop: 8 }}>
          {m.desc}
          {m.rarity < 50 && ` · ${format(C.rarity, { n: m.rarity })}`}
        </div>
      </div>

      {m.need > 1 && (
        <div className={c.acBox} style={{ position: "absolute", left: 20, right: 20, bottom: 60, border: "2px solid #3A3A38", borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
            <div style={{ position: "relative", width: 70, height: 20, flexShrink: 0 }}>
              <div className={c.acCA} style={{ ...D, position: "absolute", right: 0, fontSize: 22, lineHeight: "20px", color: "#B8B8B4" }}>
                {Math.min(m.before, m.need - 1)}/{m.need}
              </div>
              <div className={c.acCB} style={{ ...D, position: "absolute", right: 0, fontSize: 22, lineHeight: "20px", color: "#FFC23D" }}>
                {m.need}/{m.need}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, height: 10, borderRadius: 5, background: "#2A2A2A", overflow: "hidden" }}>
            <div className={cn(c.acBar)} style={{ height: 10, borderRadius: 5, background: "#FFC23D", ["--from" as string]: `${from}%` } as CSSProperties} />
          </div>
        </div>
      )}
    </>
  );
}
