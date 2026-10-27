// Pure SVG path math for the history chart. No Next.js imports, so it is testable in plain Node.

const round1 = (n: number) => Number(n.toFixed(1));

// Maps a value to a y coordinate: higher values sit nearer the top (smaller y)
export function scaleY(value: number, height: number, domain: [min: number, max: number]): number {
  const [min, max] = domain;
  // A flat domain has no range to scale against, so it goes in the middle
  return max === min ? height / 2 : height - ((value - min) / (max - min)) * height;
}

// Maps a pointer x position to the nearest data index
export function nearestIndex(x: number, width: number, count: number): number {
  // A single point, or a zero-width box, has nothing to pick between
  if (count <= 1 || width <= 0) return 0;
  const index = Math.round((x / width) * (count - 1));
  return Math.min(count - 1, Math.max(0, index));
}

// A shared domain lets two lines be compared on the same scale
export function buildLinePath(
  values: number[],
  width: number,
  height: number,
  domain?: [min: number, max: number],
): string {
  if (values.length === 0) return "";

  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const last = values.length - 1;

  return values
    .map((v, i) => {
      // A single value has no x spacing, so it sits at the left edge
      const x = last === 0 ? 0 : (i / last) * width;
      const y = scaleY(v, height, [min, max]);
      return `${i === 0 ? "M" : "L"}${round1(x)},${round1(y)}`;
    })
    .join(" ");
}

// The line closed down to the bottom edge, for the gradient fill under it
export function buildAreaPath(
  values: number[],
  width: number,
  height: number,
  domain?: [min: number, max: number],
): string {
  if (values.length === 0) return "";

  const lastX = values.length === 1 ? 0 : width;
  const line = buildLinePath(values, width, height, domain);
  return `${line} L${lastX},${height} L0,${height} Z`;
}
