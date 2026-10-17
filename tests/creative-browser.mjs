// Requires Playwright and system Chrome. PLAYWRIGHT_MODULE can point to an existing module.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const round = Number(process.argv[2] || 1);
const origin = process.env.TEST_URL || (round === 1 ? "http://localhost:5173" : "http://localhost:4173");
const output = process.env.TEST_OUTPUT_DIR || `/tmp/drawing-creative-round${round}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, hasTouch: true, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [], uploads = [];
page.on("pageerror", (error) => errors.push(error.message));
context.on("request", (request) => { if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) uploads.push(request.url()); });
const button = (name) => page.getByRole("button", { name, exact: true });
async function click(name) { await button(name).click(); }
async function enter(kind) {
  await page.goto(origin);
  await click("创意工坊");
  await click(`开始${{ symmetry: "对称万花筒", pixel: "像素创作", animation: "翻页动画" }[kind]}`);
  await page.locator("canvas").waitFor();
}
async function coordinates(selector, x, y, side = 16) {
  const canvas = page.locator(selector); await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox(); assert(b);
  return { x: b.x + x / side * b.width, y: b.y + y / side * b.height };
}
async function line(selector, from, to, side = 16) {
  const a = await coordinates(selector, ...from, side), b = await coordinates(selector, ...to, side);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); await page.mouse.move(2, 2);
}
async function range(label, value, event = "input") {
  await page.getByRole("slider", { name: label, exact: true }).evaluate((input, { value, event }) => {
    input.value = String(value); input.dispatchEvent(new Event(event, { bubbles: true }));
  }, { value, event });
}
async function records() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open("little-art-planet", 1);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result, t = db.transaction("artworks", "readonly"), get = t.objectStore("artworks").getAll();
      t.oncomplete = () => { db.close(); resolve(get.result.map(({ image, ...record }) => record)); };
    };
  }));
}
async function save(name) {
  await page.getByRole("textbox", { name: "创作名称", exact: true }).fill(name);
  await click("保存作品"); await page.locator(".creative-title small").filter({ hasText: "创作已保存" }).waitFor();
  const result = (await records()).find((art) => art.name === name); assert(result); return result;
}
async function download(name, target) {
  const promise = page.waitForEvent("download"); await click(name); const file = await promise;
  const path = join(output, target || file.suggestedFilename()); await file.saveAs(path); return path;
}
async function inspectImage(path, type = "image/png") {
  const data = [...await readFile(path)];
  return page.evaluate(async ({ data, type }) => {
    const bytes = new Uint8Array(data);
    const decoder = new ImageDecoder({ data: bytes, type }); await decoder.tracks.ready;
    const frame = (await decoder.decode({ frameIndex: 0 })).image;
    const c = document.createElement("canvas"); c.width = frame.displayWidth; c.height = frame.displayHeight;
    const ctx = c.getContext("2d"); ctx.drawImage(frame, 0, 0);
    const result = { width: c.width, height: c.height, frames: decoder.tracks.selectedTrack.frameCount, corner: [...ctx.getImageData(0, 0, 1, 1).data] };
    frame.close(); decoder.close(); return result;
  }, { data, type });
}
const canvasData = (selector) => page.locator(selector).evaluate((canvas) => canvas.toDataURL());
async function reopen(name) {
  await click("创意工坊"); await click("作品小屋"); await button(`继续画：${name}`).click();
  await page.locator("canvas").waitFor(); assert.equal(await page.getByRole("textbox", { name: "创作名称", exact: true }).inputValue(), name);
}
try {
  if (round === 1) {
    await page.goto(origin); await click("创意工坊");
    const subject = await page.locator(".inspiration-part strong").first().textContent();
    await click("锁定画什么"); await click("再抽一次");
    assert.equal(await page.locator(".inspiration-part strong").first().textContent(), subject);
    await click("自由画画");
    assert((await page.getByRole("textbox", { name: "作品名称", exact: true }).inputValue()).startsWith(subject));
    await click("我的画室");
    await page.screenshot({ path: join(output, "home.png"), fullPage: true });
    console.log("PASS prompt locks, ordinary drawing startup, preserved home");

    await enter("symmetry"); const sym = ".symmetry-paper canvas";
    await range("创作透明度", 50);
    await line(sym, [510, 290], [650, 360], 800);
    const first = await canvasData(sym); await click("撤销"); assert.notEqual(await canvasData(sym), first);
    await click("重做"); assert.equal(await canvasData(sym), first);
    await click("4 向"); await click("彩虹笔"); await line(sym, [480, 470], [580, 550], 800);
    await click("星星笔"); await line(sym, [510, 520], [640, 650], 800);
    let art = await save("第一轮对称作品");
    assert.equal(art.creative.strokes.length, 3); assert.equal(art.creative.strokes[0].mode, "six");
    assert.equal(art.creative.strokes[0].opacity, 50); assert.equal(art.creative.strokes[1].brush, "rainbow");
    const png = await inspectImage(await download("下载 PNG", "symmetry.png"));
    assert.deepEqual(png, { width: 800, height: 800, frames: 1, corner: [255, 255, 255, 255] });
    const backupPath = await download("备份创作文件", "symmetry.artplanet");
    const backup = JSON.parse(await readFile(backupPath, "utf8")); assert.deepEqual(backup.project, art.creative);
    await page.screenshot({ path: join(output, "symmetry-desktop.png"), fullPage: true });
    const savedCanvas = await canvasData(sym); await reopen(art.name); assert.equal(await canvasData(sym), savedCanvas);
    art = await save(art.name); assert.equal(art.creative.strokes.length, 3);
    console.log("PASS symmetry whole-stroke undo, retained modes, opacity, save/reopen, PNG and editable backup");

    await enter("pixel"); const pix = ".pixel-canvas";
    await line(pix, [.5, .5], [15.5, 15.5]);
    const pixels = await canvasData(pix); await click("撤销"); assert.notEqual(await canvasData(pix), pixels);
    await click("重做"); assert.equal(await canvasData(pix), pixels);
    await page.getByRole("combobox", { name: "画布格数" }).selectOption("32"); await click("确认调整");
    await click("撤销"); assert.equal(await page.getByRole("combobox", { name: "画布格数" }).inputValue(), "16");
    art = await save("第一轮像素作品"); assert.equal(art.creative.frames[0].pixels.filter(Boolean).length, 16);
    await click("填色"); const fill = await coordinates(pix, 14.5, .5); await page.mouse.click(fill.x, fill.y);
    await page.locator(pix).focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space");
    art = await save(art.name); assert(art.creative.frames[0].pixels.filter(Boolean).length > 16);
    const pixelPng = await inspectImage(await download("下载 PNG", "pixel.png")); assert.equal(pixelPng.width, 128);
    await reopen(art.name); assert.equal(await page.getByRole("combobox", { name: "画布格数" }).inputValue(), "16");
    console.log("PASS pixel logical line, fill, keyboard drawing, resize undo, local save/reopen and integer PNG");

    await enter("animation");
    await line(pix, [1.5, 1.5], [5.5, 5.5]); await click("复制帧");
    await button("选择颜色 #DF897C").click(); await line(pix, [8.5, 3.5], [12.5, 7.5]);
    await click("空白帧"); await click("向前移"); await click("删除帧"); await click("撤销");
    await range("动画每秒帧数", 10, "change");
    art = await save("第一轮翻页动画"); assert.equal(art.creative.frames.length, 3); assert.equal(art.creative.fps, 10);
    assert.equal(art.creative.frames[1].pixels.filter(Boolean).length, 0);
    await click("播放"); assert(await button("画笔").isDisabled()); await page.waitForTimeout(250); await click("暂停");
    const gif = await inspectImage(await download("下载 GIF", "animation.gif"), "image/gif");
    assert.deepEqual([gif.width, gif.height, gif.frames], [64, 64, 3]);
    const sheet = await inspectImage(await download("PNG 序列图", "animation-sheet.png")); assert.deepEqual([sheet.width, sheet.height], [384, 128]);
    await download("备份创作文件", "animation.artplanet");
    await reopen(art.name); assert.equal(await page.locator(".frame-button").count(), 3);
    assert.equal(await page.getByRole("slider", { name: "动画每秒帧数" }).inputValue(), "10");
    await page.screenshot({ path: join(output, "animation-desktop.png"), fullPage: true });
    console.log("PASS animation frame operations, playback locks, all-frame save/reopen, decoded GIF and sprite sheet");

    // Touch events use the browser's real touch-to-PointerEvent path rather than fabricated pointer events.
    await page.setViewportSize({ width: 820, height: 1180 });
    await enter("pixel"); const cdp = await context.newCDPSession(page);
    const touch = (id, point) => ({ id, ...point, radiusX: 2, radiusY: 2, force: 1 });
    const a = await coordinates(pix, 5.5, 5.5), b = await coordinates(pix, 10.5, 10.5);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch(1, a)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(1, { x: a.x + 8, y: a.y + 8 })] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch(1, a), touch(2, b)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(1, { x: a.x - 30, y: a.y - 30 }), touch(2, { x: b.x + 30, y: b.y + 30 })] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    art = await save("双指不留误笔"); assert.equal(art.creative.frames[0].pixels.filter(Boolean).length, 0);
    await click("复位"); const p = await coordinates(pix, 3.5, 3.5); await page.touchscreen.tap(p.x, p.y);
    art = await save(art.name); assert.equal(art.creative.frames[0].pixels.filter(Boolean).length, 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await click("调色"); const swatches = await page.locator(".creative-palette .color-grid .swatch").evaluateAll((elements) => elements.map((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
    assert(swatches.every((r) => r.w >= 44 && r.h >= 44));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(output, "touch-palette-390.png"), fullPage: true }); await click("收起调色板");
    console.log("PASS touch draw/pinch rollback, mobile palette targets and 390px overflow");
  } else {
    // Production, persistence, import validation and failure paths, separate from round 1.
    await enter("animation"); const pix = ".pixel-canvas";
    const imported = { format: "little-art-planet", name: "第二轮备份恢复", project: { version: 1, kind: "animation", size: 16, fps: 8, frames: [
      { id: "one", pixels: Array.from({ length: 256 }, (_, i) => i === 0 ? "#FF0000" : "") },
      { id: "two", pixels: Array.from({ length: 256 }, (_, i) => i === 255 ? "#0000FF80" : "") },
    ] } };
    await click("创意工坊");
    await page.locator('input[type="file"]').setInputFiles({ name: "restore.artplanet", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(imported)) });
    let art = await save(imported.name); assert.deepEqual(art.creative, imported.project);
    await page.reload(); await click("作品小屋"); await button(`继续画：${imported.name}`).click();
    assert.equal(await page.locator(".frame-button").count(), 2); assert.equal(await page.getByRole("slider", { name: "动画每秒帧数" }).inputValue(), "8");
    await click("复制帧"); await click("创意工坊"); await page.getByRole("dialog").waitFor();
    await click("继续创作"); assert.equal(await page.locator(".frame-button").count(), 3);
    await page.keyboard.press("Control+r"); await page.getByRole("dialog").waitFor(); await click("取消刷新");
    assert.equal(await page.locator(".frame-button").count(), 3);
    await click("创意工坊"); await click("保存并离开");
    await page.getByText("今天，想制作什么？", { exact: true }).waitFor();
    const saved = (await records()).find((item) => item.name === imported.name); assert.equal(saved.creative.frames.length, 3);
    // Invalid imports cannot alter an existing artwork.
    await page.locator('input[type="file"]').setInputFiles({ name: "future.artplanet", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...imported, project: { ...imported.project, version: 99 } })) });
    await page.getByRole("alert").filter({ hasText: "版本" }).waitFor(); assert.deepEqual((await records()).find((item) => item.id === saved.id).creative, saved.creative);
    console.log("PASS production import/reload, every frame/fps persists, leave/refresh cancellation and invalid-version preservation");

    // Add a malformed record with a valid cover; guarded editor must allow back, prohibit overwrite.
    await page.evaluate(async () => {
      const db = await new Promise((resolve) => { const r = indexedDB.open("little-art-planet", 1); r.onsuccess = () => resolve(r.result); });
      const c = document.createElement("canvas"); c.width = c.height = 20;
      const image = await new Promise((resolve) => c.toBlob(resolve));
      await new Promise((resolve) => { const t = db.transaction("artworks", "readwrite"); t.objectStore("artworks").put({ id: "damaged", name: "未来作品", updated: Date.now(), image, thumbnail: c.toDataURL(), theme: "", creative: { version: 99, kind: "future" } }); t.oncomplete = resolve; }); db.close();
    });
    await page.reload(); await click("作品小屋"); await button("继续画：未来作品").click();
    await page.getByText("这份创作暂时无法编辑", { exact: true }).waitFor(); assert(await button("保存作品").isDisabled());
    await click("创意工坊"); await page.getByText("今天，想制作什么？", { exact: true }).waitFor();
    console.log("PASS malformed saved project guarded and exit works");

    // A failed IndexedDB write must keep the drawing dirty and block save-and-leave.
    await enter("pixel"); await click("打开圆形调色盘"); await click("画布取色"); await click("画笔");
    assert.equal(await page.locator(".creative-pick-tip").count(), 0);
    await line(pix, [1.5, 1.5], [5.5, 5.5]);
    await page.evaluate(() => { const original = IDBObjectStore.prototype.put; window.restorePut = () => IDBObjectStore.prototype.put = original; IDBObjectStore.prototype.put = function () { throw new DOMException("quota test", "QuotaExceededError"); }; });
    await click("保存作品"); await page.getByRole("alert").filter({ hasText: "保存没有成功" }).waitFor();
    await click("创意工坊"); await click("保存并离开"); assert(await page.getByRole("dialog").isVisible());
    await click("继续创作"); await page.evaluate(() => window.restorePut());
    art = await save("失败后仍能保存"); assert.equal(art.creative.frames[0].pixels.filter(Boolean).length, 5);
    // Mixed keyboard/pointer cancellation regression: Space during a stroke cannot publish a partial project.
    const p = await coordinates(pix, 8.5, 8.5); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.keyboard.press("Space");
    await page.locator(".pixel-viewport").dispatchEvent("pointercancel", { pointerId: 1 }); await page.mouse.up();
    art = await save(art.name); assert.equal(art.creative.frames[0].pixels.filter(Boolean).length, 5);
    console.log("PASS save failure preserves dirty state; mixed pointer/keyboard cancellation keeps preview and editable data consistent");

    // Existing drawing regression: ratio, 300% zoom, cursor, eraser, palette and reference remain usable.
    await page.goto(origin); await click("开始画画"); const oldCanvas = 'canvas[aria-label="绘画画布，使用鼠标或手指绘画"]';
    await page.getByRole("combobox", { name: "画纸比例" }).selectOption("1:1");
    // Ratio menu opens confirmation only if drawing already exists; this canvas is blank.
    await range("画布缩放", 300); assert.equal(await page.getByRole("slider", { name: "画布缩放", exact: true }).inputValue(), "300");
    await range("画布缩放", 100); await line(oldCanvas, [3, 3], [10, 6]);
    await click("橡皮"); assert(await page.locator(oldCanvas).evaluate((canvas) => canvas.classList.contains("eraser-cursor")));
    await click("涂色桶"); assert(await page.locator(oldCanvas).evaluate((canvas) => getComputedStyle(canvas).cursor.includes("url(")));
    await click("画笔"); await click("撤销上一笔"); await click("重做上一笔");
    await page.getByRole("textbox", { name: "作品名称", exact: true }).fill("旧画室回归"); await click("保存作品");
    await page.getByText("作品已保存", { exact: true }).waitFor();
    await click("我的画室"); await click("作品小屋"); await button("继续画：旧画室回归").click();
    assert(await page.locator(oldCanvas).isVisible()); assert.equal((await records()).find((item) => item.name === "旧画室回归").creative, undefined);
    console.log("PASS old drawing ratio/zoom, cursor, undo/redo and old Artwork routing");

    // New modes are in the service worker precache and work without network.
    await page.goto(origin); await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 15000 });
    await context.setOffline(true); await page.reload(); await click("创意工坊"); await click("开始对称万花筒");
    await line(".symmetry-paper canvas", [500, 300], [600, 370], 800); art = await save("离线对称作品"); assert.equal(art.creative.strokes.length, 1);
    await context.setOffline(false); await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(output, "offline-symmetry-mobile.png"), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log("PASS production service-worker offline editing/local saving and mobile layout");
  }
  assert.deepEqual(errors, []); assert.deepEqual(uploads, []);
  await writeFile(join(output, "result.json"), JSON.stringify({ round, origin, browser: browser.version(), errors, uploads, passed: true }, null, 2));
  console.log(`ROUND ${round} PASSED: no page errors or upload requests; evidence ${output}`);
} catch (error) { await page.screenshot({ path: join(output, "failure.png"), fullPage: true }); console.error({ errors, uploads, text: (await page.locator("body").innerText()).slice(-2000) }); throw error; } finally { await browser.close(); }
