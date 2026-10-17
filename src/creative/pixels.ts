export interface PixelPoint { x: number; y: number }

export function pixelColor(color: string, opacity: number): string {
  return color.slice(0, 7).toUpperCase() + Math.round(Math.min(100, Math.max(0, opacity)) * 2.55)
    .toString(16).padStart(2, "0").toUpperCase();
}

// Connect crossed cells so quick mouse or pen movements do not leave gaps.
export function paintPixelLine(pixels: string[], size: number, from: PixelPoint, to: PixelPoint, color: string): boolean {
  let { x, y } = from;
  const dx = Math.abs(to.x - x), sx = x < to.x ? 1 : -1;
  const dy = -Math.abs(to.y - y), sy = y < to.y ? 1 : -1;
  let error = dx + dy, changed = false;
  while (true) {
    if (x >= 0 && y >= 0 && x < size && y < size && pixels[y * size + x] !== color) {
      pixels[y * size + x] = color;
      changed = true;
    }
    if (x === to.x && y === to.y) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return changed;
}

export function fillPixels(pixels: string[], size: number, point: PixelPoint, color: string): boolean {
  const start = point.y * size + point.x;
  const target = pixels[start];
  if (target === undefined || target === color) return false;
  const queue = [start];
  pixels[start] = color;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]!;
    const x = index % size, y = Math.floor(index / size);
    for (const next of [x > 0 ? index - 1 : -1, x < size - 1 ? index + 1 : -1,
      y > 0 ? index - size : -1, y < size - 1 ? index + size : -1]) {
      if (next >= 0 && pixels[next] === target) { pixels[next] = color; queue.push(next); }
    }
  }
  return true;
}

export function resizePixels(pixels: readonly string[], from: number, to: number): string[] {
  return Array.from({ length: to * to }, (_, index) =>
    pixels[Math.floor(Math.floor(index / to) * from / to) * from + Math.floor((index % to) * from / to)] ?? "");
}
