/** Encode small, opaque animation frames locally; transparent pixels use white paper. */
export function encodeGif(frames: readonly ImageData[], fps: number): Uint8Array {
  if (!Array.isArray(frames) || frames.length < 1 || frames.length > 12) {
    throw new RangeError("GIF 需要 1～12 帧画面");
  }
  if (!Number.isInteger(fps) || fps < 2 || fps > 12) {
    throw new RangeError("GIF 播放速度需要为 2～12 的整数");
  }
  const width = frames[0]?.width;
  const height = frames[0]?.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > 256 || height > 256) {
    throw new RangeError("GIF 画面宽高需要在 1～256 像素之间");
  }
  const pixelCount = width * height;
  for (const frame of frames) {
    if (!frame || frame.width !== width || frame.height !== height ||
        !(frame.data instanceof Uint8ClampedArray) || frame.data.length !== pixelCount * 4) {
      throw new RangeError("GIF 每帧需要尺寸一致、完整的 RGBA 画面");
    }
  }

  // shortcut: fixed 3-3-2 palette and literal LZW suit small frames; add quantization/compression for larger exports.
  const codeCount = pixelCount + Math.ceil(pixelCount / 200) + 1;
  const compressedSize = Math.ceil(codeCount * 9 / 8);
  const output = new Uint8Array(801 + frames.length *
    (20 + compressedSize + Math.ceil(compressedSize / 255)));
  let offset = 0;
  const byte = (value: number) => { output[offset++] = value; };
  const word = (value: number) => { byte(value & 255); byte(value >> 8); };
  const text = (value: string) => {
    for (const character of value) byte(character.charCodeAt(0));
  };
  text("GIF89a");
  word(width);
  word(height);
  byte(0xf7);
  byte(255);
  byte(0);
  for (let color = 0; color < 256; color++) {
    byte(Math.round((color >> 5) * 255 / 7));
    byte(Math.round(((color >> 2) & 7) * 255 / 7));
    byte((color & 3) * 85);
  }
  byte(0x21); byte(0xff); byte(11);
  text("NETSCAPE2.0");
  byte(3); byte(1); word(0); byte(0);

  for (const frame of frames) {
    byte(0x21); byte(0xf9); byte(4);
    byte(4); // Keep the previous frame; every new frame completely replaces it.
    word(Math.round(100 / fps));
    byte(0); byte(0);
    byte(0x2c);
    word(0); word(0); word(width); word(height);
    byte(0);
    byte(8);

    const compressed = new Uint8Array(compressedSize);
    let compressedOffset = 0;
    let bits = 0;
    let bitCount = 0;
    const code = (value: number) => {
      bits |= value << bitCount;
      bitCount += 9;
      while (bitCount >= 8) {
        compressed[compressedOffset++] = bits & 255;
        bits >>>= 8;
        bitCount -= 8;
      }
    };
    code(256);
    for (let pixel = 0; pixel < pixelCount; pixel++) {
      const index = pixel * 4;
      const alpha = frame.data[index + 3] / 255;
      const white = 255 * (1 - alpha);
      const red = Math.round(frame.data[index] * alpha + white) >> 5;
      const green = Math.round(frame.data[index + 1] * alpha + white) >> 5;
      const blue = Math.round(frame.data[index + 2] * alpha + white) >> 6;
      code((red << 5) | (green << 2) | blue);
      // Clear before the decoder dictionary can grow beyond 9-bit codes.
      if ((pixel + 1) % 200 === 0 && pixel + 1 < pixelCount) code(256);
    }
    code(257);
    if (bitCount) compressed[compressedOffset++] = bits & 255;
    for (let start = 0; start < compressedOffset; start += 255) {
      const block = compressed.subarray(start, Math.min(start + 255, compressedOffset));
      byte(block.length);
      output.set(block, offset);
      offset += block.length;
    }
    byte(0);
  }
  byte(0x3b);
  return output.subarray(0, offset);
}
