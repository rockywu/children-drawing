// Run from the repository root: node tests/gif.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";

const require = createRequire(resolve("package.json"));
const { build } = require("esbuild");
const temporary = await mkdtemp(join(tmpdir(), "drawing-gif-test-"));
try {
  const bundle = join(temporary, "gif.mjs");
  await build({
    entryPoints: [fileURLToPath(new URL("../src/creative/gif.ts", import.meta.url))],
    bundle: true, format: "esm", platform: "node", outfile: bundle,
  });
  const { encodeGif } = await import(pathToFileURL(bundle));
  function frame(width, height, rgba) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) data.set(rgba, pixel * 4);
    return { width, height, data };
  }
  const frames = [
    frame(17, 13, [255, 0, 0, 255]),
    frame(17, 13, [0, 255, 0, 255]),
    frame(17, 13, [0, 0, 255, 255]),
    frame(17, 13, [255, 255, 255, 255]),
  ];
  frames[3].data.set([255, 0, 0, 0], 0);
  frames[3].data.set([255, 0, 0, 128], 4);
  const gif = encodeGif(frames, 10);
  assert.equal(new TextDecoder().decode(gif.subarray(0, 6)), "GIF89a");
  assert.equal(gif.at(-1), 0x3b);
  await writeFile(join(temporary, "samples.gif"), gif);
  await writeFile(join(temporary, "single.gif"), encodeGif([frame(1, 1, [0, 0, 0, 0])], 2));

  const maximum = Array.from({ length: 12 }, (_, frameIndex) => {
    const result = frame(256, 256, [0, 0, 0, 255]);
    for (let pixel = 0; pixel < 256 * 256; pixel++) {
      const color = (pixel + frameIndex * 17) & 255;
      result.data.set([Math.round((color >> 5) * 255 / 7),
        Math.round(((color >> 2) & 7) * 255 / 7), (color & 3) * 85, 255], pixel * 4);
    }
    return result;
  });
  const start = performance.now();
  const maximumGif = encodeGif(maximum, 12);
  const elapsed = performance.now() - start;
  assert.ok(maximumGif.length < 1_000_000, "Bounded export must remain under 1 MB");
  await writeFile(join(temporary, "maximum.gif"), maximumGif);

  for (const invalid of [[], Array(13).fill(frames[0]), null]) {
    assert.throws(() => encodeGif(invalid, 8), RangeError);
  }
  for (const invalid of [0, 1, 13, 2.5, NaN, Infinity]) {
    assert.throws(() => encodeGif(frames, invalid), RangeError);
  }
  for (const invalid of [0, -1, 257, 1.5, NaN]) {
    assert.throws(() => encodeGif([{ ...frames[0], width: invalid }], 8), RangeError);
    assert.throws(() => encodeGif([{ ...frames[0], height: invalid }], 8), RangeError);
  }
  assert.throws(() => encodeGif([frames[0], frame(16, 13, [0, 0, 0, 255])], 8), RangeError);
  assert.throws(() => encodeGif([{ ...frames[0], data: new Uint8ClampedArray(1) }], 8), RangeError);
  assert.throws(() => encodeGif([{ ...frames[0], data: [] }], 8), RangeError);
  assert.throws(() => encodeGif([null], 8), RangeError);

  // Pillow independently decodes the real bitstream, including dictionary resets and frame disposal.
  const decoded = spawnSync("python3", ["-c", `
from PIL import Image
from pathlib import Path
import sys
directory = Path(sys.argv[1])
image = Image.open(directory / 'samples.gif')
assert image.n_frames == 4 and image.size == (17, 13)
assert image.info['loop'] == 0
for index, expected in enumerate([(255,0,0),(0,255,0),(0,0,255),(255,255,255)]):
    image.seek(index)
    assert image.info['duration'] == 100
    assert image.convert('RGB').getpixel((0,0)) == expected
image.seek(3)
assert image.convert('RGB').getpixel((1,0)) == (255,109,85)
single = Image.open(directory / 'single.gif')
assert single.size == (1,1) and single.n_frames == 1
assert single.info['duration'] == 500
assert single.convert('RGB').getpixel((0,0)) == (255,255,255)
maximum = Image.open(directory / 'maximum.gif')
assert maximum.size == (256,256) and maximum.n_frames == 12
for index in range(12):
    maximum.seek(index)
    assert maximum.info['duration'] == 80
    pixels = maximum.convert('RGB').load()
    for offset in range(256*256):
        color = (offset + index*17) & 255
        expected = (round((color >> 5)*255/7),round(((color >> 2)&7)*255/7),(color&3)*85)
        assert pixels[offset % 256, offset // 256] == expected
print('Pillow: frame order, RGB, transparency matte, timing, loop and all maximum-frame pixels passed')
`, temporary], { encoding: "utf8", timeout: 30_000 });
  assert.equal(decoded.status, 0, decoded.stderr || decoded.error?.message);
  console.log(decoded.stdout.trim());
  console.log(`GIF validation passed; maximum ${maximumGif.length} bytes, encoded in ${elapsed.toFixed(1)} ms`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
