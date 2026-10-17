// Fill connected pixels, then replace the old background in the antialiased fringe.
// The fringe is never added to the flood queue, so it cannot spill across a thin line.
export function fillRegion(
  image: ImageData,
  x: number,
  y: number,
  hex: string,
  opacity = 1,
): boolean {
  const { width, height, data } = image;
  const original = new Uint8ClampedArray(data);
  const visible = (pixel: number): number[] => {
    const at = pixel * 4;
    const alpha = original[at + 3]! / 255;
    return [0, 1, 2].map(
      (channel) => original[at + channel]! * alpha + 255 * (1 - alpha),
    );
  };
  const start = Math.floor(y) * width + Math.floor(x);
  const target = visible(start);
  const replacement = [1, 3, 5].map((index) =>
    parseInt(hex.slice(index, index + 2), 16),
  );
  if (
    opacity === 1 &&
    target.every(
      (value, channel) => Math.abs(value - replacement[channel]!) < 1,
    )
  )
    return false;

  const count = width * height;
  const filled = new Uint8Array(count);
  const edge = new Uint8Array(count);
  const queue = new Int32Array(count);
  const boundary: number[] = [];
  let read = 0;
  let write = 1;
  queue[0] = start;
  filled[start] = 1;
  const matches = (pixel: number) =>
    visible(pixel).every(
      (value, channel) => Math.abs(value - target[channel]!) < 25,
    );

  while (read < write) {
    const pixel = queue[read++]!;
    const at = pixel * 4;
    for (let channel = 0; channel < 3; channel++)
      data[at + channel] = replacement[channel]!;
    data[at + 3] = Math.round(opacity * 255);
    const px = pixel % width;
    const neighbors = [
      px > 0 ? pixel - 1 : -1,
      px < width - 1 ? pixel + 1 : -1,
      pixel >= width ? pixel - width : -1,
      pixel < count - width ? pixel + width : -1,
    ];
    for (const next of neighbors) {
      if (next < 0 || filled[next]) continue;
      if (matches(next)) {
        filled[next] = 1;
        queue[write++] = next;
      } else if (!edge[next]) {
        edge[next] = 1;
        boundary.push(next);
      }
    }
  }

  for (const pixel of boundary) {
    const at = pixel * 4;
    const alpha = original[at + 3]! / 255;
    if (original[start * 4 + 3]! < 15 && alpha < 1) {
      // Retain the original stroke coverage and put the new fill beneath it.
      const combinedAlpha = alpha + opacity * (1 - alpha);
      for (let channel = 0; channel < 3; channel++)
        data[at + channel] =
          (original[at + channel]! * alpha +
            replacement[channel]! * opacity * (1 - alpha)) /
          combinedAlpha;
      data[at + 3] = Math.round(combinedAlpha * 255);
      continue;
    }

    // Reopened PNGs have an opaque white background. Estimate edge coverage from
    // the nearby solid stroke, and remove the old background rather than blurring it.
    const value = visible(pixel);
    const vector = value.map((v, channel) => v - target[channel]!);
    const distance = vector.reduce((total, v) => total + v * v, 0);
    let coverage = 1;
    const px = pixel % width;
    const py = Math.floor(pixel / width);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (filled[neighbor]) continue;
        const stroke = visible(neighbor).map(
          (v, channel) => v - target[channel]!,
        );
        const length = stroke.reduce((total, v) => total + v * v, 0);
        if (length <= distance) continue;
        const fraction =
          vector.reduce(
            (total, v, channel) => total + v * stroke[channel]!,
            0,
          ) / length;
        const residual = vector.reduce(
          (total, v, channel) => total + (v - fraction * stroke[channel]!) ** 2,
          0,
        );
        if (fraction > 0 && fraction < coverage && residual < 36)
          coverage = fraction;
      }
    if (coverage >= 0.98) continue;
    const combinedAlpha = coverage + opacity * (1 - coverage);
    for (let channel = 0; channel < 3; channel++)
      data[at + channel] =
        (value[channel]! -
          (1 - coverage) * target[channel]! +
          (1 - coverage) * opacity * replacement[channel]!) /
        combinedAlpha;
    data[at + 3] = Math.round(combinedAlpha * 255);
  }
  return true;
}
