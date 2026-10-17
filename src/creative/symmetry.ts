import type { CreativePoint, SymmetryMode, SymmetryStroke } from "./types";

export const SYMMETRY_SIDE = 800;
export const MAX_SYMMETRY_STROKES = 1500;
export const MAX_STROKE_POINTS = 4096;
export const MAX_SYMMETRY_POINTS = 300000;

export function symmetryCount(mode: SymmetryMode): number {
  return mode === "mirror" ? 2 : { four: 4, six: 6, eight: 8 }[mode];
}

export function symmetryPoint(point: CreativePoint, mode: SymmetryMode, copy: number): CreativePoint {
  if (mode === "mirror") return { x: copy ? SYMMETRY_SIDE - point.x : point.x, y: point.y };
  const angle = copy * Math.PI * 2 / symmetryCount(mode);
  const x = point.x - SYMMETRY_SIDE / 2;
  const y = point.y - SYMMETRY_SIDE / 2;
  return {
    x: SYMMETRY_SIDE / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    y: SYMMETRY_SIDE / 2 + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

// Space the stars by distance, so event frequency does not change their density.
export function spacedPoints(points: readonly CreativePoint[], spacing: number, limit = 2048): CreativePoint[] {
  if (!points.length) return [];
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  const step = Math.max(1, spacing, length / Math.max(1, limit - 1));
  const output = [{ ...points[0]! }];
  let carried = 0;
  for (let i = 1; i < points.length && output.length < limit; i++) {
    const from = points[i - 1]!, to = points[i]!;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (!distance) continue;
    for (let position = step - carried; position <= distance && output.length < limit; position += step) {
      output.push({ x: from.x + (to.x - from.x) * position / distance, y: from.y + (to.y - from.y) * position / distance });
    }
    carried = (carried + distance) % step;
  }
  return output;
}

function path(context: CanvasRenderingContext2D, points: CreativePoint[]) {
  const first = points[0]!, last = points[points.length - 1]!;
  context.moveTo(first.x, first.y);
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i]!, next = points[i + 1]!;
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  context.lineTo(last.x, last.y);
}

function star(context: CanvasRenderingContext2D, point: CreativePoint, radius: number) {
  context.moveTo(point.x, point.y - radius);
  for (let i = 1; i < 10; i++) {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const r = i % 2 ? radius * 0.45 : radius;
    context.lineTo(point.x + Math.cos(angle) * r, point.y + Math.sin(angle) * r);
  }
  context.closePath();
}

export function renderSymmetryStroke(
  target: CanvasRenderingContext2D,
  stroke: SymmetryStroke,
  temporary: HTMLCanvasElement,
) {
  if (!stroke.points.length) return;
  const context = temporary.getContext("2d")!;
  context.clearRect(0, 0, SYMMETRY_SIDE, SYMMETRY_SIDE);
  context.save();
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.lineWidth = stroke.size * (stroke.eraser ? 2.5 : 1);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.fillStyle = stroke.eraser ? "#000000" : stroke.color;
  context.strokeStyle = context.fillStyle;
  const points = stroke.brush === "stars" && !stroke.eraser
    ? spacedPoints(stroke.points, Math.max(6, stroke.size * 2)) : stroke.points;
  const copies = symmetryCount(stroke.mode);
  context.beginPath();
  for (let copy = 0; copy < copies; copy++) {
    const transformed = points.map((point) => symmetryPoint(point, stroke.mode, copy));
    if (stroke.brush === "rainbow" && !stroke.eraser) {
      const first = transformed[0]!, last = transformed[transformed.length - 1]!;
      const gradient = context.createLinearGradient(first.x - stroke.size, first.y, last.x + stroke.size, last.y);
      ["#DF698B", "#E8A35C", "#F1CD6C", "#789D78", "#759CB8", "#A68BBE", "#DF698B"]
        .forEach((color, index) => gradient.addColorStop(index / 6, color));
      context.strokeStyle = gradient;
      context.fillStyle = gradient;
      context.beginPath();
    }
    if (stroke.brush === "stars" && !stroke.eraser) {
      transformed.forEach((point) => star(context, point, stroke.size));
    } else if (transformed.length === 1) {
      const point = transformed[0]!;
      context.moveTo(point.x + context.lineWidth / 2, point.y);
      context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
    } else path(context, transformed);
    if (stroke.brush === "rainbow" && !stroke.eraser) {
      if (transformed.length === 1) context.fill();
      else context.stroke();
    }
  }
  if (stroke.brush !== "rainbow" || stroke.eraser) {
    if (stroke.brush === "stars" && !stroke.eraser || points.length === 1) context.fill();
    else context.stroke();
  }
  context.restore();
  // Composite opacity once for the entire mirrored stroke, including its center.
  target.save();
  target.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
  target.globalAlpha = stroke.opacity / 100;
  target.drawImage(temporary, 0, 0);
  target.restore();
}
