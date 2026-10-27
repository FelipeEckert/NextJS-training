import { describe, expect, it } from "vitest";
import { GLOBE, HUB, ROUTES, globeFrame, greatCircle, project, projectToLimb, visibleRuns } from "./globe";

describe("project", () => {
  it("puts the view centre at the sub-viewer point", () => {
    expect(project(GLOBE.start, GLOBE.lat0, GLOBE.start)).toEqual({ x: GLOBE.cx, y: GLOBE.cy, visible: true });
  });
  it("hides points on the far side", () => {
    expect(project(GLOBE.start + 180, -GLOBE.lat0, GLOBE.start).visible).toBe(false);
  });
});

describe("projectToLimb", () => {
  it("slides far-side points onto the silhouette", () => {
    const q = projectToLimb(GLOBE.start + 180, 0, GLOBE.start);
    expect(Math.abs(Math.hypot(q.x - GLOBE.cx, q.y - GLOBE.cy) - GLOBE.r)).toBeLessThan(1);
    expect(q.visible).toBe(false);
  });
});

describe("greatCircle", () => {
  const { points, lifts } = greatCircle(HUB, [-74, 40.7]);
  it("has 29 points from start to end", () => {
    expect(points).toHaveLength(29);
    expect(points[0][0]).toBeCloseTo(HUB[0], 6);
    expect(points[0][1]).toBeCloseTo(HUB[1], 6);
    expect(points[28][0]).toBeCloseTo(-74, 6);
    expect(points[28][1]).toBeCloseTo(40.7, 6);
  });
  it("lifts the arc off the surface toward the middle", () => {
    expect(lifts[0]).toBe(1);
    expect(lifts[28]).toBe(1);
    expect(lifts[14]).toBeGreaterThan(1);
  });
});

describe("visibleRuns", () => {
  it("returns an empty path when every point is on the far side", () => {
    expect(visibleRuns([[GLOBE.start + 180, 0], [GLOBE.start + 170, 0]], GLOBE.start)).toBe("");
  });
  it("starts a path with M when points face the viewer", () => {
    expect(visibleRuns([[GLOBE.start, 0], [GLOBE.start + 10, 0]], GLOBE.start).startsWith("M")).toBe(true);
  });
});

describe("globeFrame", () => {
  it("shows the hub and all arcs at the start meridian", () => {
    const f = globeFrame(GLOBE.start);
    expect(f.hub).not.toBeNull();
    expect(f.arcs).toHaveLength(ROUTES.length);
    expect(f.land).not.toBe("");
    expect(f.coast).not.toBe("");
    expect(f.grid).not.toBe("");
  });
  it("hides the hub on the far side", () => {
    expect(globeFrame(GLOBE.start + 180).hub).toBeNull();
  });
});
