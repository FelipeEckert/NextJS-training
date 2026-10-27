// Orthographic globe for the home hero, in a 1280×720 viewBox. Pure math: the hero renders frame(GLOBE.start)
// on the server and the client redraws frame(lon0) as the globe turns.

export type LonLat = [lon: number, lat: number];
export type Projected = { x: number; y: number; visible: boolean };

export const GLOBE = { r: 500, cx: 760, cy: 340, lat0: 12, start: -30 } as const;

const rad = (d: number) => (d * Math.PI) / 180;

// lift > 1 raises a point off the surface (arcs). A lifted point stays visible once it clears the silhouette.
export function project(lon: number, lat: number, lon0: number, lift = 1): Projected {
  const l = rad(lon - lon0), p = rad(lat), p0 = rad(GLOBE.lat0);
  const x = Math.cos(p) * Math.sin(l);
  const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l);
  const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  const visible = z >= 0 || (lift > 1 && Math.hypot(x, y) * lift > 1);
  return { x: Math.round(GLOBE.cx + x * GLOBE.r * lift), y: Math.round(GLOBE.cy - y * GLOBE.r * lift), visible };
}

// For filled shapes: a point on the far side slides onto the silhouette, so the polygon stays closed
export function projectToLimb(lon: number, lat: number, lon0: number): Projected {
  const l = rad(lon - lon0), p = rad(lat), p0 = rad(GLOBE.lat0);
  let x = Math.cos(p) * Math.sin(l);
  let y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l);
  const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  if (z < 0) {
    const n = Math.hypot(x, y) || 1;
    x /= n;
    y /= n;
  }
  return { x: Math.round(GLOBE.cx + x * GLOBE.r), y: Math.round(GLOBE.cy - y * GLOBE.r), visible: z >= 0 };
}

// Coarse continent outlines (a sketch, not a map), as [lon, lat]
export const LAND: LonLat[][] = [
  [[-80,10],[-72,12],[-62,10],[-52,5],[-50,0],[-35,-5],[-35,-9],[-39,-15],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-65,-42],[-67,-46],[-68,-52],[-72,-50],[-74,-42],[-73,-30],[-71,-18],[-76,-14],[-80,-6],[-81,-2],[-78,2],[-77,8]],
  [[-168,66],[-160,70],[-140,70],[-125,72],[-100,73],[-85,70],[-80,63],[-65,60],[-60,53],[-56,48],[-66,44],[-70,42],[-75,38],[-76,35],[-81,31],[-80,26],[-82,25],[-84,30],[-90,29],[-97,27],[-97,22],[-92,18],[-88,21],[-87,16],[-83,10],[-80,8],[-78,8],[-82,9],[-86,12],[-92,15],[-97,16],[-105,20],[-110,24],[-112,29],[-117,32],[-121,35],[-124,40],[-124,46],[-130,54],[-140,59],[-150,60],[-158,57],[-165,60]],
  [[-55,60],[-45,60],[-40,65],[-25,70],[-20,76],[-30,82],[-50,82],[-60,78],[-70,77],[-58,70]],
  [[-10,36],[-9,43],[-2,44],[-5,48],[-1,49],[2,51],[5,53],[8,54],[10,57],[5,58],[6,62],[12,66],[18,70],[28,71],[40,67],[45,68],[60,70],[70,73],[80,73],[100,77],[110,74],[130,72],[145,72],[160,70],[170,66],[180,65],[178,62],[163,60],[160,54],[156,51],[150,59],[140,54],[135,43],[130,42],[127,38],[126,35],[122,40],[118,38],[122,30],[120,24],[110,20],[108,16],[106,10],[100,13],[100,8],[104,1],[98,8],[97,17],[92,21],[88,22],[80,15],[78,8],[73,17],[72,21],[67,25],[57,26],[52,28],[48,30],[50,26],[56,24],[59,22],[55,17],[52,16],[45,13],[43,15],[39,22],[35,28],[34,31],[36,36],[30,37],[27,37],[26,40],[23,38],[22,36],[21,40],[19,42],[13,45],[16,41],[18,40],[16,38],[12,38],[12,42],[10,44],[7,43],[3,43],[0,39],[-2,37],[-5,36],[-9,37]],
  [[-17,21],[-16,28],[-10,30],[-6,35],[0,36],[10,37],[11,33],[20,31],[30,31],[32,31],[35,28],[38,22],[43,12],[51,12],[51,10],[48,5],[42,-2],[40,-10],[41,-15],[35,-22],[33,-26],[27,-34],[20,-35],[18,-32],[15,-26],[12,-17],[13,-8],[9,-1],[9,4],[4,6],[-4,5],[-8,4],[-12,7],[-15,11],[-17,15]],
  [[-5,50],[1,51],[2,53],[-2,56],[-3,58],[-6,58],[-5,55],[-3,54],[-5,52]],
  [[114,-22],[122,-18],[130,-12],[137,-12],[142,-11],[146,-19],[153,-26],[150,-37],[141,-38],[138,-35],[131,-31],[123,-34],[115,-34]],
  [[130,31],[135,34],[140,35],[142,40],[141,45],[139,42],[136,36],[131,34]],
  [[109,1],[117,7],[119,5],[118,1],[116,-4],[110,-3]],
  [[95,5],[98,4],[106,-6],[104,-6],[96,1]],
  [[44,-25],[47,-25],[50,-15],[49,-12],[44,-17]],
];

// São Paulo, the hub every cash flow starts from
export const HUB: LonLat = [-46.6, -23.5];
export const ROUTES: { code: string; at: LonLat }[] = [
  { code: "USD", at: [-74, 40.7] }, { code: "GBP", at: [-0.1, 51.5] }, { code: "EUR", at: [8.7, 50.1] },
  { code: "MXN", at: [-99.1, 19.4] }, { code: "ZAR", at: [28, -26.2] }, { code: "AED", at: [55.3, 25.2] },
  { code: "ARS", at: [-58.4, -34.6] }, { code: "JPY", at: [139.7, 35.7] }, { code: "CNY", at: [121.5, 31.2] },
  { code: "AUD", at: [151.2, -33.9] }, { code: "SGD", at: [103.8, 1.35] }, { code: "INR", at: [72.9, 19.1] },
];

// Adds 3 points per edge so outlines bend with the sphere, and closes the ring
export function densify(ring: LonLat[]): LonLat[] {
  const out: LonLat[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    for (let s = 0; s < 4; s++) out.push([a[0] + ((b[0] - a[0]) * s) / 4, a[1] + ((b[1] - a[1]) * s) / 4]);
  }
  out.push(out[0]);
  return out;
}

// A polyline through the visible points only, broken wherever it goes behind the globe
export function visibleRuns(points: LonLat[], lon0: number, lifts?: number[]): string {
  let d = "", open = false;
  points.forEach(([lon, lat], i) => {
    const q = project(lon, lat, lon0, lifts?.[i] ?? 1);
    if (q.visible) { d += `${open ? "L" : "M"}${q.x},${q.y}`; open = true; } else open = false;
  });
  return d;
}

// Great-circle path from a to b, lifted off the surface toward the middle (longer routes rise higher)
export function greatCircle(a: LonLat, b: LonLat, steps = 28): { points: LonLat[]; lifts: number[] } {
  const vec = ([lon, lat]: LonLat) => [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))];
  const va = vec(a), vb = vec(b);
  const om = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
  const points: LonLat[] = [], lifts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
    const v = [s1 * va[0] + s2 * vb[0], s1 * va[1] + s2 * vb[1], s1 * va[2] + s2 * vb[2]];
    points.push([(Math.atan2(v[1], v[0]) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI]);
    lifts.push(1 + 0.1 * Math.sin(Math.PI * t) * om);
  }
  return { points, lifts };
}

const RINGS = LAND.map(densify);
const ARCS = ROUTES.map((r) => greatCircle(HUB, r.at));
const GRATICULE: LonLat[][] = [];
for (let lon = -180; lon < 180; lon += 20) { const line: LonLat[] = []; for (let lat = -90; lat <= 90; lat += 4) line.push([lon, lat]); GRATICULE.push(line); }
for (let lat = -60; lat <= 60; lat += 20) { const line: LonLat[] = []; for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]); GRATICULE.push(line); }

export type GlobeFrame = { land: string; coast: string; grid: string; arcs: string[]; cities: string; hub: { x: number; y: number } | null };

// Every path of one frame, with the meridian lon0 facing the viewer
export function globeFrame(lon0: number): GlobeFrame {
  let land = "";
  for (const ring of RINGS) {
    let part = "", any = false;
    ring.forEach(([lon, lat], i) => {
      const q = projectToLimb(lon, lat, lon0);
      if (q.visible) any = true;
      part += `${i ? "L" : "M"}${q.x},${q.y}`;
    });
    if (any) land += part + "Z";
  }
  let cities = "";
  for (const r of ROUTES) {
    const q = project(r.at[0], r.at[1], lon0);
    if (q.visible) cities += `M${q.x},${q.y}h0`;
  }
  const hub = project(HUB[0], HUB[1], lon0);
  return {
    land,
    coast: RINGS.map((ring) => visibleRuns(ring, lon0)).join(""),
    grid: GRATICULE.map((line) => visibleRuns(line, lon0)).join(""),
    arcs: ARCS.map((a) => visibleRuns(a.points, lon0, a.lifts)),
    cities,
    hub: hub.visible ? { x: hub.x, y: hub.y } : null,
  };
}
