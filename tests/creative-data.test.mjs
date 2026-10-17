// Trust boundary and geometry invariants. Uses the project's existing build dependency.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const temp = await mkdtemp(join(tmpdir(), "drawing-data-"));
try {
  for (const name of ["project", "symmetry", "pixels"]) await build({ entryPoints: [`src/creative/${name}.ts`], outfile: join(temp, `${name}.mjs`), bundle: true, platform: "node", format: "esm" });
  const { createCreativeProject, readCreativeProject } = await import(pathToFileURL(join(temp, "project.mjs")));
  const { symmetryPoint, symmetryCount, spacedPoints } = await import(pathToFileURL(join(temp, "symmetry.mjs")));
  const { fillPixels, paintPixelLine, resizePixels } = await import(pathToFileURL(join(temp, "pixels.mjs")));
  for (const kind of ["symmetry", "pixel", "animation"]) {
    const project = createCreativeProject(kind), copy = readCreativeProject(project);
    assert.deepEqual(copy, project); assert.notEqual(copy, project);
    assert.throws(() => readCreativeProject({ ...project, version: 2 }));
    assert.throws(() => readCreativeProject({ ...project, kind: "future" }));
  }
  const pixel = createCreativeProject("pixel");
  for (const invalid of [
    { ...pixel, size: 17 }, { ...pixel, fps: 2.5 }, { ...pixel, frames: [] },
    { ...pixel, frames: [pixel.frames[0], { ...pixel.frames[0], id: "second" }] },
    { ...pixel, frames: [{ id: "one", pixels: ["#FFFFFF"] }] },
    { ...pixel, frames: [{ id: "one", pixels: Array(256).fill("javascript:invalid") }] },
  ]) assert.throws(() => readCreativeProject(invalid));
  const animation = createCreativeProject("animation");
  animation.frames = Array.from({ length: 12 }, (_, i) => ({ id: `frame-${i}`, pixels: Array(256).fill("") }));
  assert.equal(readCreativeProject(animation).frames.length, 12);
  assert.throws(() => readCreativeProject({ ...animation, frames: [...animation.frames, { ...animation.frames[0], id: "extra" }] }));
  assert.throws(() => readCreativeProject({ ...animation, frames: [animation.frames[0], animation.frames[0]] }));
  const symmetry = createCreativeProject("symmetry");
  const stroke = { color: "#3F6956", opacity: 50, size: 10, mode: "six", brush: "plain", eraser: false, points: [{ x: 100, y: 100 }] };
  assert.equal(readCreativeProject({ ...symmetry, strokes: [stroke] }).strokes.length, 1);
  for (const invalidStroke of [{ ...stroke, points: [{ x: NaN, y: 0 }] }, { ...stroke, points: [{ x: -1, y: 0 }] }, { ...stroke, opacity: 0 }, { ...stroke, size: 100 }, { ...stroke, points: Array(4097).fill({ x: 0, y: 0 }) }]) {
    assert.throws(() => readCreativeProject({ ...symmetry, strokes: [invalidStroke] }));
  }
  assert.throws(() => readCreativeProject({ ...symmetry, strokes: Array(1501).fill(stroke) }));
  const point = { x: 124, y: 286 };
  assert.deepEqual(symmetryPoint(symmetryPoint(point, "mirror", 1), "mirror", 1), point);
  for (const mode of ["four", "six", "eight"]) {
    let previous = point;
    for (let i = 0; i < symmetryCount(mode); i++) previous = symmetryPoint(previous, mode, 1);
    assert(Math.hypot(previous.x - point.x, previous.y - point.y) < 1e-8);
  }
  assert(spacedPoints(Array.from({ length: 4096 }, (_, i) => ({ x: i % 2 ? 800 : 0, y: 0 })), 6).length <= 2048);
  const grid = Array(256).fill(""); paintPixelLine(grid, 16, { x: 0, y: 0 }, { x: 15, y: 15 }, "#FF0000");
  assert.equal(grid.filter(Boolean).length, 16);
  fillPixels(grid, 16, { x: 15, y: 0 }, "#0000FF");
  assert.equal(grid.filter((color) => color === "#0000FF").length, 120);
  assert.equal(grid[15 * 16], "");
  assert.deepEqual(resizePixels(resizePixels(grid, 16, 32), 32, 16), grid);
  console.log("Project validation, independent symmetry invariants, pixel connectivity and resize preservation passed");
} finally { await rm(temp, { recursive: true, force: true }); }
