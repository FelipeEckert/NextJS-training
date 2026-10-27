"use client";

import { useEffect, useRef } from "react";
import { GLOBE, globeFrame } from "@/lib/globe";
import { useHeroPaused } from "@/components/HeroMotion";

// Same frame the loop starts from, so the server HTML already shows the globe and nothing jumps when JS loads
const FIRST = globeFrame(GLOBE.start);

const OUT_DELAY = [0, -1.1, -2.3, -0.6, -3.1, -1.7, -2.8, -0.2, -3.9, -1.4, -4.6, -2.1];
const OUT_DUR = [4.4, 5, 4.8, 4, 4.6, 5.6, 3.4, 6, 6.2, 6.4, 5.8, 6.6];
const IN_DELAY = [-2.2, -3.6, -0.9, -1.8, -4.2, -2.9];
const IN_DUR = [4.4, 5, 4.8, 4, 6, 6.4];

const hubPath = (hub: { x: number; y: number } | null) => (hub ? `M${hub.x},${hub.y}h0` : "");

export function HeroGlobe() {
  const svg = useRef<SVGSVGElement>(null);
  // A ref, so pausing and resuming continues from where the globe stopped
  const lonRef = useRef<number>(GLOBE.start);
  const paused = useHeroPaused();

  useEffect(() => {
    const root = svg.current;
    if (!root || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = (id: string) => root.querySelector(`[data-g="${id}"]`);
    const arcs = Array.from({ length: 12 }, (_, i) => [el(`arc-${i}`), el(`out-${i}`), i < 6 ? el(`in-${i}`) : null]);
    const cities = el("cities");
    const hub = el("hub");
    const label = el("hub-label");

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(root);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // Keeps scheduling but does no work while off screen or in a background tab
      if (!visible || document.hidden) { last = now; return; }
      const dt = now - last;
      if (dt < 33) return;
      last = now;

      let lon0 = lonRef.current - (4 * dt) / 1000;
      if (lon0 < -180) lon0 += 360;
      lonRef.current = lon0;

      const f = globeFrame(lon0);
      arcs.forEach((group, i) => group.forEach((node) => node?.setAttribute("d", f.arcs[i])));
      cities?.setAttribute("d", f.cities);
      hub?.setAttribute("d", hubPath(f.hub));
      label?.setAttribute("x", String(f.hub ? f.hub.x + 12 : -100));
      label?.setAttribute("y", String(f.hub ? f.hub.y + 26 : -100));
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [paused]);

  const { r, cx, cy } = GLOBE;
  return (
    <div aria-hidden="true" className="hero-globe pointer-events-none absolute inset-0 -z-10">
      <svg ref={svg} viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id="hgBrand" gradientUnits="userSpaceOnUse" x1="260" y1="860" x2="1260" y2="-160">
            <stop offset="0%" style={{ stopColor: "var(--globe-1)" }} />
            <stop offset="55%" style={{ stopColor: "var(--globe-2)" }} />
            <stop offset="100%" style={{ stopColor: "var(--globe-3)" }} />
          </linearGradient>
          <radialGradient id="hgSphere" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r} fx="620" fy="170">
            <stop offset="0%" style={{ stopColor: "var(--globe-sphere-hi)" }} />
            <stop offset="75%" style={{ stopColor: "var(--globe-sphere-mid)" }} />
            <stop offset="100%" style={{ stopColor: "var(--globe-sphere-lo)" }} />
          </radialGradient>
          <radialGradient id="hgLimb" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
            <stop offset="72%" style={{ stopColor: "var(--globe-1)" }} stopOpacity="0" />
            <stop offset="100%" style={{ stopColor: "var(--globe-2)", stopOpacity: "var(--globe-limb)" }} />
          </radialGradient>
          <radialGradient id="hgAtmos" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r + 60}>
            <stop offset="89%" style={{ stopColor: "var(--globe-3)", stopOpacity: "var(--globe-atmos)" }} />
            <stop offset="100%" style={{ stopColor: "var(--globe-3)" }} stopOpacity="0" />
          </radialGradient>
          <clipPath id="hgDisc"><circle cx={cx} cy={cy} r={r} /></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={r + 60} fill="url(#hgAtmos)" />
        <circle cx={cx} cy={cy} r={r} fill="url(#hgSphere)" />
        <g clipPath="url(#hgDisc)">
          <path data-g="grid" d={FIRST.grid} fill="none" stroke="url(#hgBrand)" strokeWidth="1" style={{ strokeOpacity: "var(--globe-grid)" }} />
          <path data-g="land" d={FIRST.land} fill="url(#hgBrand)" stroke="none" style={{ fillOpacity: "var(--globe-land)" }} />
          <path data-g="coast" d={FIRST.coast} fill="none" stroke="url(#hgBrand)" strokeWidth="1.2" strokeLinejoin="round" style={{ strokeOpacity: "var(--globe-coast)" }} />
        </g>
        <circle cx={cx} cy={cy} r={r} fill="url(#hgLimb)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#hgBrand)" strokeWidth="1.6" style={{ strokeOpacity: "var(--globe-rim)" }} />
        {FIRST.arcs.map((d, i) => (
          <path key={i} data-g={`arc-${i}`} d={d} fill="none" stroke="url(#hgBrand)" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />
        ))}
        {FIRST.arcs.map((d, i) => (
          <path key={i} className="streak" pathLength={100} data-g={`out-${i}`} d={d} fill="none" strokeWidth="3" strokeLinecap="round"
            style={{ stroke: "var(--globe-flow-out)", animationDelay: `${OUT_DELAY[i]}s`, animationDuration: `${OUT_DUR[i]}s` }} />
        ))}
        {FIRST.arcs.slice(0, 6).map((d, i) => (
          <path key={i} className="streak in" pathLength={100} data-g={`in-${i}`} d={d} fill="none" strokeWidth="3" strokeLinecap="round"
            style={{ stroke: "var(--globe-flow-in)", animationDelay: `${IN_DELAY[i]}s`, animationDuration: `${IN_DUR[i]}s` }} />
        ))}
        <path data-g="cities" d={FIRST.cities} fill="none" strokeWidth="7" strokeLinecap="round" style={{ stroke: "var(--globe-flow-out)" }} />
        <path data-g="hub" d={hubPath(FIRST.hub)} fill="none" strokeWidth="12" strokeLinecap="round" style={{ stroke: "var(--globe-hub)" }} />
        <text data-g="hub-label" x={FIRST.hub ? FIRST.hub.x + 12 : -100} y={FIRST.hub ? FIRST.hub.y + 26 : -100} fontSize="13" fontWeight="700" style={{ fill: "var(--globe-label)" }}>BRL</text>
      </svg>
    </div>
  );
}
