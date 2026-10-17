import { createArtworkId } from "../artworkId";
import type { CreativeKind, CreativeProject, PixelProject, SymmetryProject } from "./types";

export function createCreativeProject(kind: CreativeKind): CreativeProject {
  if (kind === "symmetry") return {
    version: 1, kind, width: 800, height: 800, mode: "six", brush: "plain", strokes: [],
  };
  return {
    version: 1, kind, size: 16, fps: 6,
    frames: [{ id: createArtworkId(), pixels: Array<string>(256).fill("") }],
  };
}

export function cloneProject<T extends CreativeProject>(project: T): T {
  return JSON.parse(JSON.stringify(project)) as T;
}

const colorPattern = /^#[\da-f]{6}([\da-f]{2})?$/i;
const modes = ["mirror", "four", "six", "eight"];
const brushes = ["plain", "rainbow", "stars"];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("创作文件格式不正确");
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

// Validate persistent or imported data before any editor can replace a saved work.
export function readCreativeProject(value: unknown): CreativeProject {
  const p = object(value);
  if (p.version !== 1) throw new Error("暂不支持这个创作文件版本，请保留原文件");
  if (p.kind === "symmetry") {
    if (p.width !== 800 || p.height !== 800 || !modes.includes(p.mode as string) ||
        !brushes.includes(p.brush as string) || !Array.isArray(p.strokes) || p.strokes.length > 1500)
      throw new Error("万花筒数据不完整");
    let totalPoints = 0;
    for (const raw of p.strokes) {
      const stroke = object(raw);
      if (!Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > 4096 ||
          !colorPattern.test(String(stroke.color)) || !number(stroke.opacity, 10, 100) ||
          !number(stroke.size, 2, 32) || typeof stroke.eraser !== "boolean" ||
          !modes.includes(stroke.mode as string) || !brushes.includes(stroke.brush as string))
        throw new Error("万花筒笔迹数据不正确");
      totalPoints += stroke.points.length;
      if (totalPoints > 300000) throw new Error("笔迹过多，请先导出 PNG 备份");
      for (const point of stroke.points) {
        const xy = object(point);
        if (!number(xy.x, 0, 800) || !number(xy.y, 0, 800)) throw new Error("笔迹坐标不正确");
      }
    }
    return cloneProject(p as unknown as SymmetryProject);
  }
  if (p.kind === "pixel" || p.kind === "animation") {
    if (![16, 32, 64].includes(p.size as number) || !number(p.fps, 2, 12) ||
        !Number.isInteger(p.fps) || !Array.isArray(p.frames) || !p.frames.length ||
        p.frames.length > (p.kind === "pixel" ? 1 : 12)) throw new Error("像素或动画数据不完整");
    const ids = new Set<string>();
    for (const raw of p.frames) {
      const frame = object(raw);
      if (typeof frame.id !== "string" || !frame.id || frame.id.length > 100 || ids.has(frame.id) ||
          !Array.isArray(frame.pixels) || frame.pixels.length !== Number(p.size) ** 2 ||
          frame.pixels.some((color) => color !== "" && (typeof color !== "string" || !colorPattern.test(color))))
        throw new Error("像素帧数据不正确");
      ids.add(frame.id);
    }
    return cloneProject(p as unknown as PixelProject);
  }
  throw new Error("暂不支持这种创作，请先下载预览图备份");
}
