/**
 * Shussapp Wrapped (beta), ported 1:1 from the "Wrapped prototype" design:
 * a 390×844 story (scaled to the screen) with 7 auto-advancing slides —
 * intro, games, golden duo, shuss hour, photo highlights, play style and a
 * share card. Tap right/left to skip, pause in the header.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { WRAPPED_TYPES, type WrappedType } from "@/lib/wrapped";
import type { WrappedData } from "@/lib/db/wrapped";
import { shareWrappedCard } from "@/lib/wrapped-card";
import { CAP_PATH, D, Stage } from "./Stage";
import w from "./wrapped.module.css";

const INK = "#0E0E0F";
const GOLD = "#FFC23D";
const DURS = [7000, 6500, 8000, 7000, 7000, 8500, 9000];
const BASE_THEMES: [string, string][] = [
  [INK, "#FFFFFF"],
  [GOLD, INK],
  ["#C8261A", "#FFFFFF"],
  [INK, "#FFFFFF"],
  ["#F4F4F2", INK],
  ["#FF6B1A", INK],
  [INK, "#FFFFFF"],
];
const INTRO: [number, number, number, number, string][] = [
  [18, 10, 70, -18, GOLD], [120, 40, 54, 24, "#FF6B1A"], [230, 0, 88, 8, GOLD],
  [300, 120, 50, -30, "#C8261A"], [40, 140, 60, 40, "#F4F4F2"], [160, 150, 96, -6, GOLD],
  [270, 230, 64, 16, "#FF6B1A"], [10, 260, 48, -40, "#C8261A"], [110, 280, 58, 30, "#F4F4F2"],
];
const HOURS = ["20u", "21u", "22u", "23u", "00u", "01u"];

/** Per play style: slide colours (bg, fg), the icon disc and its stroke. */
const TYPE_LOOK: Record<WrappedType, { bg: string; fg: string; disc: string; stroke: string }> = {
  mama: { bg: "#FF6B1A", fg: INK, disc: INK, stroke: GOLD },
  muur: { bg: "#2747D6", fg: "#FFFFFF", disc: "#FFFFFF", stroke: "#2747D6" },
  kamikaze: { bg: "#C8261A", fg: "#FFFFFF", disc: INK, stroke: GOLD },
  laatbloeier: { bg: "#5B2BBF", fg: "#FFFFFF", disc: GOLD, stroke: INK },
  kameleon: { bg: "#FF7FB0", fg: INK, disc: INK, stroke: "#FF7FB0" },
  trouw: { bg: GOLD, fg: INK, disc: INK, stroke: GOLD },
  marathon: { bg: "#1C1C1D", fg: "#FFFFFF", disc: GOLD, stroke: INK },
};
const TYPE_ICON: Record<WrappedType, ReactNode> = {
  mama: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </>
  ),
  muur: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19" />
    </>
  ),
  kamikaze: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  laatbloeier: (
    <>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      <path d="M17 3v3M15.5 4.5h3" />
    </>
  ),
  kameleon: <path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3" />,
  trouw: (
    <>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </>
  ),
  marathon: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 2.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5" />
    </>
  ),
};

/** Two display lines like the design ("De Mama-" / "Machine"), sized so the
 * longest line fits the 350px column. */
function typeLines(name: string) {
  const up = name.toUpperCase();
  const words = up.split(" ");
  const hy = up.indexOf("-");
  const lines = hy > 0 ? [up.slice(0, hy + 1), up.slice(hy + 1)] : words.length > 2 ? [words.slice(0, 2).join(" "), words.slice(2).join(" ")] : [words[0], words.slice(1).join(" ")];
  const longest = Math.max(...lines.map((l) => l.length));
  return { lines: lines.filter(Boolean), size: Math.min(84, Math.floor(350 / (longest * 0.5))) };
}

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });
const delay = (sec: number): CSSProperties => ({ animationDelay: `${sec}s` });

function CapSvg({ size, fill, inner, ring, children }: Readonly<{ size: number; fill: string; inner: string; ring: string; children?: ReactNode }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <path d={CAP_PATH} fill={fill} stroke={fill} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="100" cy="100" r="70" fill={inner} stroke={ring} strokeWidth="6" />
      {children}
    </svg>
  );
}

export function WrappedPlayer({ data, closeHref }: Readonly<{ data: WrappedData; closeHref: string }>) {
  const { t, locale } = useT();
  const W = t.beta.wrapped;
  const [{ slide, elapsed }, setPos] = useState({ slide: 0, elapsed: 0 });
  const [paused, setPaused] = useState(false);
  const [sharing, setSharing] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    last.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - last.current;
      last.current = now;
      if (paused) return;
      setPos((p) => {
        const next = p.elapsed + dt;
        if (next >= DURS[p.slide]) return p.slide < 6 ? { slide: p.slide + 1, elapsed: 0 } : { ...p, elapsed: DURS[p.slide] };
        return { ...p, elapsed: next };
      });
    }, 40);
    return () => clearInterval(id);
  }, [paused]);

  const go = useCallback((n: number) => setPos({ slide: Math.max(0, Math.min(6, n)), elapsed: 0 }), []);

  const e = elapsed;
  const cnt = (target: number, d: number, dur: number) => Math.round(target * ease(clamp((e - d) / dur)));
  const look = TYPE_LOOK[data.type.key];
  const [bg, fg] = slide === 5 ? [look.bg, look.fg] : BASE_THEMES[slide];
  const darkFg = fg === INK;
  const track = darkFg ? "rgba(14,14,15,0.22)" : "rgba(255,255,255,0.3)";
  const season = format(data.season.half === "autumn" ? W.seasonAutumn : W.seasonSpring, { year: data.season.year });
  const days = W.days.split("|");
  const daysShort = W.daysShort.split("|");
  const type = W.types[data.type.key];
  const typeNames = WRAPPED_TYPES.map((k) => W.types[k].name.toUpperCase());
  const slotIdx = e < 900 ? -1 : Math.floor(ease(clamp((e - 900) / 2100)) * 23) % typeNames.length;
  const landed = e >= 3000;
  const maxHeat = Math.max(1, ...data.hour.heat.flat());
  const [hh, mm] = data.hour.time.split(":").map(Number);
  const target = ((hh < 12 ? hh + 24 : hh) - 20) * 60 + mm;
  const mins = 1200 + Math.round(Math.max(0, target) * ease(clamp((e - 900) / 2300)));
  const clock = `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  const nightFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
  const dateFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Brussels" });
  const words = data.name.trim().split(/\s+/);
  const myInit = (words.length > 1 ? words[0][0] + words[1][0] : words[0][0] ?? "?").toUpperCase();
  const tl = typeLines(type.name);
  const muted = "#3A3A38";

  const card = () => ({
    kicker: `${W.kicker} · ${season.toUpperCase()}`,
    name: data.name,
    rankLine: format(W.rankLine, { crew: data.crewName, rank: data.rank }),
    typeLabel: W.typeLabel,
    typeName: type.name,
    stats: [
      { label: W.games, value: String(data.games) },
      { label: W.winRate, value: `${data.winRate}%` },
      { label: W.eloPeak, value: String(data.eloPeak) },
      { label: W.mamas, value: String(data.mamas) },
    ],
    partnersLabel: W.topPartners,
    partners: data.topPartners,
    footer: "SHUSSAPP",
  });

  async function share(download = false) {
    setSharing(true);
    setPaused(true);
    await shareWrappedCard(card(), { download });
    setSharing(false);
  }

  const lead: CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.25, fontWeight: 800 };
  const kick: CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", marginTop: 4 };

  return (
    <Stage bg={bg} color={fg} style={{ transition: "background-color .6s ease, color .6s ease", zIndex: 50 }}>
      <button type="button" aria-label={W.prev} onClick={() => go(slide - 1)} style={abs({ left: 0, top: 76, bottom: 0, width: "35%", zIndex: 1 })} />
      <button type="button" aria-label={W.next} onClick={() => go(slide + 1)} style={abs({ right: 0, top: 76, bottom: 0, width: "65%", zIndex: 1 })} />

      <div style={abs({ left: 20, right: 20, top: 20, zIndex: 3 })}>
        <div style={{ display: "flex", gap: 4 }}>
          {DURS.map((d, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, overflow: "hidden", background: track }}>
              <div style={{ height: 3, background: fg, width: `${(i < slide ? 1 : i === slide ? clamp(e / d) : 0) * 100}%` }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.14em" }}>{W.kicker}</div>
          <div style={{ display: "flex", alignItems: "center", marginRight: -10 }}>
            <button type="button" aria-label={paused ? W.play : W.pause} onClick={() => setPaused((p) => !p)} style={{ width: 44, height: 44, color: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {paused ? (
                  <path d="M7 4.5v15l12-7.5z" />
                ) : (
                  <>
                    <rect x="6" y="4.5" width="4" height="15" rx="1" />
                    <rect x="14" y="4.5" width="4" height="15" rx="1" />
                  </>
                )}
              </svg>
            </button>
            <Link href={closeHref} aria-label={W.close} style={{ width: 44, height: 44, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div key={slide} style={abs({ left: 20, right: 20, top: 84, bottom: 30, zIndex: 2, pointerEvents: "none" })}>
        {slide === 0 && (
          <div style={abs({ inset: 0 })}>
            {INTRO.map(([l, tp, size, rot, fill], k) => (
              <div key={k} style={abs({ left: l, top: tp, width: size, height: size, transform: `rotate(${rot}deg)` })}>
                <div className={w.tossIn} style={{ width: "100%", height: "100%", ...delay(0.1 + k * 0.09) }}>
                  <svg width="100%" height="100%" viewBox="0 0 200 200" aria-hidden="true">
                    <path d={CAP_PATH} fill={fill} stroke={fill} strokeWidth="5" strokeLinejoin="round" />
                    <circle cx="100" cy="100" r="64" fill="none" stroke={INK} strokeWidth="9" />
                    <path d="M68 122 L68 86 L85 100 L100 74 L115 100 L132 86 L132 122 Z" fill={INK} />
                  </svg>
                </div>
              </div>
            ))}
            <div style={abs({ left: 0, right: 0, bottom: 0 })}>
              <div className={w.fu} style={{ ...delay(1), display: "inline-flex", background: GOLD, color: INK, fontWeight: 800, fontSize: 13, padding: "7px 12px", borderRadius: 999, textTransform: "uppercase" }}>
                {data.crewName} · {season}
              </div>
              <h1 className={w.slam} style={{ ...D, ...delay(1.2), margin: "16px 0 0", fontSize: 100, lineHeight: 0.84, whiteSpace: "nowrap", textTransform: "uppercase", transformOrigin: "30% 60%" }}>
                {W.introA}
                <br />
                {W.introB}
                <span style={{ color: GOLD }}>{W.introC}</span>
              </h1>
              <p className={w.fu} style={{ ...delay(1.8), margin: "20px 0 0", fontSize: 20, lineHeight: 1.35, fontWeight: 600, maxWidth: 300 }}>
                {format(W.introLine, { name: data.name })}
              </p>
              <p className={w.fu} style={{ ...delay(2.1), margin: "8px 0 0", fontSize: 15, lineHeight: 1.45, color: "#B8B8B4" }}>
                {format(W.introSub, { games: data.crewGames })}
              </p>
              <button type="button" className={w.fu} onClick={() => go(1)} style={{ ...delay(2.4), pointerEvents: "auto", marginTop: 24, width: "100%", height: 56, borderRadius: 999, background: "#FFFFFF", color: INK, fontWeight: 800, fontSize: 17 }}>
                {W.start}
              </button>
            </div>
          </div>
        )}

        {slide === 1 && (
          <div style={abs({ inset: 0 })}>
            <p className={w.fu} style={{ ...lead, ...abs({ left: 0, top: 24 }), maxWidth: 280 }}>{W.gamesLead}</p>
            <div className={w.big} style={{ ...D, ...delay(0.3), ...abs({ left: 0, top: 110 }), fontSize: data.games >= 100 ? 220 : 260, lineHeight: 0.8, letterSpacing: "-0.03em" }}>
              {cnt(data.games, 300, 1600)}
            </div>
            <div className={w.fu} style={{ ...D, ...delay(0.7), ...abs({ left: 0, top: 330 }), fontSize: 56, lineHeight: 0.9 }}>{W.games}</div>
            <p className={w.fu} style={{ ...delay(1.7), ...abs({ left: 0, top: 400 }), margin: 0, fontSize: 16, lineHeight: 1.45, maxWidth: 300 }}>
              {format(W.gamesShare, { pct: cnt(data.share, 1700, 900), total: data.crewGames, crew: data.crewName })}
            </p>
            <div className={w.fu} style={{ ...delay(2.2), ...abs({ left: 0, right: 0, bottom: 0 }), display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: `3px solid ${INK}` }}>
              {[
                [cnt(data.wins, 2200, 900), W.won],
                [cnt(data.losses, 2200, 900), W.lost],
                [`${cnt(data.winRate, 2200, 900)}%`, W.winRate],
              ].map(([v, l], i) => (
                <div key={String(l)} style={{ padding: i ? "14px 0 0 14px" : "14px 0 0", borderLeft: i ? `3px solid ${INK}` : undefined }}>
                  <div style={{ ...D, fontSize: 44, lineHeight: 1 }}>{v}</div>
                  <div style={kick}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide === 2 && (
          <div style={abs({ inset: 0 })}>
            <p className={w.fu} style={{ ...lead, ...abs({ left: 0, top: 4 }) }}>{W.duoLead}</p>
            {data.duo ? (
              <>
                <div className={w.vanish} style={{ ...delay(1.8), ...abs({ left: 115, top: 72, width: 120, height: 120 }), perspective: 800 }}>
                  <div className={w.tossC} style={{ ...delay(0.35), position: "relative", width: 120, height: 120 }}>
                    <div className={w.face}>
                      <CapSvg size={120} fill={GOLD} inner="#FFD36B" ring={INK}>
                        <text x="100" y="122" textAnchor="middle" fontFamily="var(--font-bigs), sans-serif" fontWeight="900" fontSize="64" fill={INK}>
                          {myInit}
                        </text>
                      </CapSvg>
                    </div>
                    <div className={cn(w.face, w.faceB)}>
                      <CapSvg size={120} fill={INK} inner="#222222" ring={GOLD}>
                        <text x="100" y="122" textAnchor="middle" fontFamily="var(--font-bigs), sans-serif" fontWeight="900" fontSize="64" fill="#FFFFFF">
                          {data.duo.partner.slice(0, 1).toUpperCase()}
                        </text>
                      </CapSvg>
                    </div>
                  </div>
                </div>
                <div className={w.ringX} style={{ ...delay(1.8), ...abs({ left: 125, top: 82, width: 100, height: 100 }), borderRadius: "50%", border: `5px solid ${GOLD}` }} />
                <div style={{ ...abs({ left: 0, right: 0, top: 70 }), display: "flex", justifyContent: "center" }}>
                  <div className={w.emL} style={{ ...D, ...delay(1.85), width: 124, height: 124, borderRadius: "50%", background: GOLD, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, border: "5px solid #C8261A", boxSizing: "border-box" }}>
                    {myInit}
                  </div>
                  <div className={w.emR} style={{ ...D, ...delay(1.85), width: 124, height: 124, borderRadius: "50%", background: INK, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, border: "5px solid #C8261A", marginLeft: -28, boxSizing: "border-box" }}>
                    {data.duo.partner.slice(0, 1).toUpperCase()}
                  </div>
                </div>
                <h2 className={w.fu} style={{ ...D, ...delay(2.3), ...abs({ left: 0, right: 0, top: 220 }), margin: 0, textAlign: "center", fontSize: 64, lineHeight: 0.88, textTransform: "uppercase" }}>
                  {W.duoYou}
                  <br />
                  <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: data.duo.partner.length > 10 ? 52 : 64 }}>{data.duo.partner}</span>
                </h2>
                <div className={w.pop} style={{ ...delay(2.7), ...abs({ left: 0, right: 0, top: 380 }), background: INK, color: "#FFFFFF", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "#B8B8B4" }}>{W.duoRecord}</div>
                    <div style={{ ...D, fontSize: 72, lineHeight: 1, marginTop: 2 }}>
                      <span style={{ color: GOLD }}>{cnt(data.duo.wins, 2700, 1000)}</span>–{cnt(data.duo.losses, 2700, 1000)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...D, fontSize: 40, lineHeight: 1 }}>{cnt(data.duo.winRate, 2700, 1000)}%</div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "#B8B8B4", marginTop: 4 }}>{W.duoWin}</div>
                  </div>
                </div>
                {data.duo.bestStreak >= 2 && (
                  <div className={w.fu} style={{ ...delay(3.4), ...abs({ left: 0, right: 0, top: 540 }), display: "flex", alignItems: "center", gap: 12 }}>
                    <svg className={w.pulse} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 8 11.5c0-1.5.6-2.5 1.5-3.5.3 1.5 1 2.3 2 2.5C11 8 11 5.5 12 3z" />
                      <path d="M12 21a6 6 0 0 0 6-6" />
                    </svg>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>{format(W.duoStreak, { n: cnt(data.duo.bestStreak, 3400, 800) })}</p>
                  </div>
                )}
                <p className={w.fu} style={{ ...delay(4), ...abs({ left: 0, right: 0, bottom: 0 }), margin: 0, fontSize: 14, lineHeight: 1.45, color: "#FFE1DC" }}>
                  {format(W.duoFoot, { n: data.duo.wins + data.duo.losses })}
                </p>
              </>
            ) : (
              <p className={w.fu} style={{ ...D, ...delay(0.4), ...abs({ left: 0, right: 0, top: 120 }), margin: 0, fontSize: 48, lineHeight: 0.95, textTransform: "uppercase" }}>{W.duoNone}</p>
            )}
          </div>
        )}

        {slide === 3 && (
          <div style={abs({ inset: 0 })}>
            <p className={w.fu} style={{ ...lead, ...abs({ left: 0, top: 4 }) }}>{W.hourLead}</p>
            <div className={w.big} style={{ ...D, ...delay(0.3), ...abs({ left: 0, top: 52 }), fontSize: 112, lineHeight: 0.85, color: "#FF8A3D", whiteSpace: "nowrap" }}>
              {daysShort[data.hour.weekday]} {clock}
            </div>
            <p className={w.fu} style={{ ...delay(0.8), ...abs({ left: 0, right: 0, top: 160 }), margin: 0, fontSize: 16, lineHeight: 1.45, color: "#D6D6D2", maxWidth: 310 }}>
              {format(W.hourBody, { day: days[data.hour.weekday] })}
            </p>
            <div style={{ ...abs({ left: 0, right: 0, top: 250 }), display: "flex", flexDirection: "column", gap: 6 }} role="img" aria-label={W.hourLead}>
              <div className={w.fu} style={{ ...delay(1), display: "grid", gridTemplateColumns: "28px repeat(6, minmax(0, 1fr))", gap: 6, fontSize: 11, fontWeight: 800, color: "#9A9A96" }}>
                <div />
                {HOURS.map((h) => (
                  <div key={h}>{h}</div>
                ))}
              </div>
              {data.hour.heat.map((row, r) => (
                <div key={r} style={{ display: "grid", gridTemplateColumns: "28px repeat(6, minmax(0, 1fr))", gap: 6, alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#B8B8B4" }}>{daysShort[r]}</div>
                  {row.map((v, col) => (
                    <div key={col} className={w.pop} style={{ ...delay(1.1 + (r * 6 + col) * 0.035), height: 30, borderRadius: 6, background: v ? `rgba(255,138,61,${(0.18 + (v / maxHeat) * 0.82).toFixed(2)})` : "rgba(255,255,255,0.07)" }} />
                  ))}
                </div>
              ))}
            </div>
            <div className={w.glow} style={{ animationDelay: "2.6s, 3.4s", ...abs({ left: 0, right: 0, bottom: 0 }), border: "2px solid #FF8A3D", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ ...D, fontSize: 52, lineHeight: 1, color: "#FF8A3D" }}>{cnt(data.hour.recordNight, 2600, 900)}</div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4, fontWeight: 600 }}>{W.recordNight}</p>
            </div>
          </div>
        )}

        {slide === 4 && (
          <div style={abs({ inset: 0 })}>
            {data.highlights.length > 0 &&
              [0.95, 1.45, 1.95].slice(0, data.highlights.length).map((d) => <div key={d} className={w.flashO} style={{ ...delay(d), ...abs({ left: -20, right: -20, top: -84, bottom: -30 }), background: "#FFFFFF", zIndex: 5 }} />)}
            <p className={w.fu} style={{ ...lead, margin: "4px 0 0" }}>{W.highlightsLead}</p>
            <h2 className={w.fu} style={{ ...D, ...delay(0.2), margin: "6px 0 0", fontSize: 64, lineHeight: 0.9, textTransform: "uppercase" }}>{W.highlightsTitle}</h2>
            {data.highlights.length === 0 ? (
              <p className={w.fu} style={{ ...delay(0.5), margin: "32px 0 0", fontSize: 18, lineHeight: 1.45, fontWeight: 600, maxWidth: 320 }}>{W.highlightsNone}</p>
            ) : (
              <div style={{ position: "relative", height: 430, marginTop: 24 }}>
                {data.highlights.map((h, i) => {
                  const pos = [
                    { left: 6, top: 10, w: 200, img: 200, r: -6 },
                    { right: 2, top: 70, w: 180, img: 180, r: 5 },
                    { left: 70, top: 230, w: 190, img: 150, r: -2 },
                  ][i];
                  return (
                    <div
                      key={h.gameId}
                      className={w.drop}
                      style={{ ...delay(0.5 + i * 0.5), ...abs({ left: pos.left, right: pos.right, top: pos.top, width: pos.w }), background: "#FFFFFF", padding: "10px 10px 14px", boxShadow: "0 10px 30px rgba(14,14,15,0.16)", boxSizing: "border-box", ["--r" as string]: `${pos.r}deg` } as CSSProperties}
                    >
                      <div style={{ position: "relative", height: pos.img, background: "#E4E4E0", overflow: "hidden" }}>
                        <Image src={h.src} alt="" fill sizes="200px" style={{ objectFit: "cover" }} unoptimized />
                      </div>
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: INK }}>{dateFmt.format(new Date(h.playedAt))}</div>
                      <div style={{ fontSize: 12, color: "#5A5A56", marginTop: 2 }}>{format(W.reactions, { n: h.reactions })}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className={w.fu} style={{ ...delay(2.6), ...abs({ left: 0, right: 0, bottom: 0 }), margin: 0, fontSize: 14, lineHeight: 1.4, color: "#3A3A38" }}>{W.highlightsBy}</p>
          </div>
        )}

        {slide === 5 && (
          <div style={abs({ inset: 0 })}>
            <p className={w.fu} style={{ ...lead, ...abs({ left: 0, top: 4 }) }}>{W.typeLead}</p>
            <div style={{ ...abs({ left: 105, top: 240, width: 140, height: 140 }), perspective: 800 }}>
              <div className={w.tossL} style={{ ...delay(0.6), position: "relative", width: 140, height: 140 }}>
                <div className={w.face}>
                  <svg width="140" height="140" viewBox="0 0 200 200" aria-hidden="true">
                    <path d={CAP_PATH} fill={INK} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
                    <circle cx="100" cy="100" r="70" fill={look.disc} stroke={GOLD} strokeWidth="6" />
                    <g transform="translate(52 52) scale(4)" fill="none" stroke={look.stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {TYPE_ICON[data.type.key]}
                    </g>
                  </svg>
                </div>
                <div className={cn(w.face, w.faceB)}>
                  <CapSvg size={140} fill={GOLD} inner="#FFD36B" ring={INK}>
                    <text x="100" y="128" textAnchor="middle" fontFamily="var(--font-bigs), sans-serif" fontWeight="900" fontSize="84" fill={INK}>
                      ?
                    </text>
                  </CapSvg>
                </div>
              </div>
            </div>
            <div className={w.ringX} style={{ ...delay(3), ...abs({ left: 115, top: 250, width: 120, height: 120 }), borderRadius: "50%", border: `5px solid ${fg}` }} />
            <div style={abs({ left: 0, right: 0, top: 56, height: 150 })}>
              {landed ? (
                <h2 className={w.slam} style={{ ...D, margin: 0, fontSize: tl.size, lineHeight: 0.86, whiteSpace: "nowrap", transformOrigin: "20% 50%" }}>
                  {tl.lines.map((part, k) => (
                    <span key={k} style={{ display: "block" }}>
                      {part}
                    </span>
                  ))}
                </h2>
              ) : (
                <div style={{ height: 150, display: "flex", flexDirection: "column", justifyContent: "center", borderTop: `3px solid ${fg}`, borderBottom: `3px solid ${fg}`, overflow: "hidden" }}>
                  <div style={{ ...D, fontSize: 50, lineHeight: 1, whiteSpace: "nowrap", opacity: slotIdx < 0 ? 0.35 : 0.55 }}>{slotIdx < 0 ? "? ? ?" : typeNames[slotIdx]}</div>
                </div>
              )}
            </div>
            <p className={w.fu} style={{ ...delay(3.5), ...abs({ left: 0, right: 0, top: 410 }), margin: 0, fontSize: 17, lineHeight: 1.45, fontWeight: 600 }}>{type.body}</p>
            <div className={w.fu} style={{ ...delay(3.8), ...abs({ left: 0, right: 0, top: 500 }), display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: `3px solid ${fg}` }}>
              {[
                [data.type.a, type.a],
                [data.type.b, type.b],
              ].map(([v, l], i) => (
                <div key={l} style={{ padding: i ? "10px 0 0 14px" : "10px 0 0", borderLeft: i ? `3px solid ${fg}` : undefined }}>
                  <div style={{ ...D, fontSize: 48, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ ...abs({ left: 0, right: 0, top: 596 }), display: "flex", flexWrap: "wrap", gap: 8 }}>
              {type.chips.split("|").map((chip, k) => (
                <div
                  key={chip}
                  className={w.pop}
                  style={{ ...delay(4 + k * 0.2), padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 800, ...(k < 2 ? { background: fg, color: bg } : { border: `2px solid ${fg}` }) }}
                >
                  {chip}
                </div>
              ))}
            </div>
            <div className={w.fu} style={{ ...delay(4.8), ...abs({ left: 0, right: 0, bottom: 0 }), paddingTop: 12, borderTop: `1.5px solid ${darkFg ? "rgba(14,14,15,0.3)" : "rgba(255,255,255,0.35)"}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{W.whyType}</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.4 }}>{type.why}</p>
            </div>
          </div>
        )}

        {slide === 6 && (
          <div style={abs({ inset: 0 })}>
            <div style={abs({ left: 175, top: 260, width: 0, height: 0 })} aria-hidden="true">
              {Array.from({ length: 14 }, (_, k) => {
                const size = k % 3 === 0 ? 24 : 16;
                return (
                  <div key={k} style={abs({ left: 0, top: 0, width: 0, height: 0, transform: `rotate(${k * (360 / 14) + 6}deg)` })}>
                    <div className={w.shardB} style={{ ...delay(0.15 + (k % 4) * 0.04), ...abs({ left: -size / 2, top: -size / 2, width: size, height: size }), borderRadius: "50%", border: `4px solid ${INK}`, boxSizing: "border-box", background: [GOLD, "#FF6B1A", "#C8261A", "#FFFFFF"][k % 4] }} />
                  </div>
                );
              })}
            </div>
            <div className={w.flip} style={{ ...delay(0.25), ...abs({ left: 0, right: 0, top: 0, height: 560 }), boxSizing: "border-box", background: GOLD, color: INK, borderRadius: 22, padding: 20, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em" }}>
                    {W.kicker} · {season.toUpperCase()}
                  </div>
                  <div style={{ ...D, fontSize: data.name.length > 8 ? 60 : 76, lineHeight: 0.82, marginTop: 8, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{format(W.rankLine, { crew: data.crewName, rank: data.rank })}</div>
                </div>
                <svg className={w.spin} width="60" height="60" viewBox="0 0 200 200" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d={CAP_PATH} fill={INK} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
                  <circle cx="100" cy="100" r="66" fill="none" stroke={GOLD} strokeWidth="10" />
                </svg>
              </div>
              <div className={w.fu} style={{ ...delay(1), marginTop: 16, padding: "12px 14px", borderRadius: 14, background: INK, color: GOLD }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", opacity: 0.8 }}>{W.typeLabel}</div>
                <div style={{ ...D, fontSize: 38, lineHeight: 0.95, marginTop: 2, textTransform: "uppercase" }}>{type.name}</div>
              </div>
              <div className={w.fu} style={{ ...delay(1.3), display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", paddingBottom: 6, borderBottom: `2px solid ${INK}` }}>{W.topPartners}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8, fontSize: 14, fontWeight: 800 }}>
                    {data.topPartners.map((p, i) => (
                      <div key={p} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {i + 1}&nbsp;&nbsp;{p}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", paddingBottom: 6, borderBottom: `2px solid ${INK}` }}>{W.topNights}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8, fontSize: 14, fontWeight: 800 }}>
                    {data.topNights.map((n) => (
                      <div key={n.night} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{nightFmt.format(new Date(`${n.night}T12:00:00Z`))}</span>
                        <span>
                          {n.wins}–{n.losses}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={w.fu} style={{ ...delay(1.6), display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: "auto", borderTop: `2px solid ${INK}`, paddingTop: 10 }}>
                {[
                  [data.games, W.games],
                  [`${data.winRate}%`, W.winRate],
                  [data.eloPeak, W.eloPeak],
                  [data.mamas, W.mamas],
                ].map(([v, l]) => (
                  <div key={String(l)}>
                    <div style={{ ...D, fontSize: 34, lineHeight: 1 }}>{v}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em" }}>
                <span>
                  {W.shussHour}: {daysShort[data.hour.weekday]} {data.hour.time}
                </span>
                <span>SHUSSAPP</span>
              </div>
            </div>
            <div className={w.fu} style={{ ...delay(2.2), ...abs({ left: 0, right: 0, bottom: 0 }), display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" onClick={() => share()} disabled={sharing} style={{ pointerEvents: "auto", height: 54, borderRadius: 999, background: "#FFFFFF", color: INK, fontWeight: 800, fontSize: 16 }}>
                {sharing ? W.sharing : W.share}
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <button type="button" onClick={() => share(true)} disabled={sharing} style={{ pointerEvents: "auto", height: 50, border: `2px solid ${muted}`, borderRadius: 999, color: "#FFFFFF", fontWeight: 800, fontSize: 15 }}>
                  {W.save}
                </button>
                <button type="button" onClick={() => go(0)} style={{ pointerEvents: "auto", height: 50, border: `2px solid ${muted}`, borderRadius: 999, color: "#FFFFFF", fontWeight: 800, fontSize: 15 }}>
                  {W.again}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Stage>
  );
}
