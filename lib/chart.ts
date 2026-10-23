// Pure SVG path math for the history chart. No Next.js imports, so it is testable in plain Node.

const round1 = (n: number) => Number(n.toFixed(1));

export function buildLinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values.length - 1;

  return values
    .map((v, i) => {
      // A single value has no x spacing, so it sits at the left edge
      const x = last === 0 ? 0 : (i / last) * width;
      // A flat line has no range to scale against, so it goes in the middle
      const y = max === min ? height / 2 : height - ((v - min) / (max - min)) * height;
      return `${i === 0 ? "M" : "L"}${round1(x)},${round1(y)}`;
    })
    .join(" ");
}
