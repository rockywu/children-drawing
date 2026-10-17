<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from "vue";
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Copy, Eraser, Eye,
  Grid2X2, Hand, PaintBucket, Paintbrush, Pause, Pipette, Play, Plus, Trash2,
} from "lucide-vue-next";
import { createArtworkId } from "../artworkId";
import { cloneProject } from "../creative/project";
import { encodeGif } from "../creative/gif";
import { fillPixels, paintPixelLine, pixelColor, resizePixels } from "../creative/pixels";
import type { PixelPoint } from "../creative/pixels";
import type { CreativeEditorHandle, CreativeHistory, CreativePick, PixelFrame, PixelProject } from "../creative/types";

const props = defineProps<{
  modelValue: PixelProject;
  color: string;
  opacity: number;
  disabled?: boolean;
  pickMode?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [project: PixelProject];
  history: [history: CreativeHistory];
  busy: [value: boolean];
  pick: [value: CreativePick];
  notice: [message: string];
  cancelPick: [];
}>();
type Tool = "brush" | "eraser" | "fill" | "pick";
type Snapshot = { project: PixelProject; frame: number };
type Pointer = { x: number; y: number };
const project = ref(cloneProject(props.modelValue));
const selected = ref(0);
const tool = ref<Tool>("brush");
const grid = ref(true);
const onion = ref(true);
const panMode = ref(false);
const zoom = ref(100);
const pan = ref({ x: 0, y: 0 });
const canvas = ref<HTMLCanvasElement>();
const viewport = ref<HTMLDivElement>();
const sizeDialog = ref<HTMLDialogElement>();
const pendingSize = ref<16 | 32 | 64>();
const baseSide = ref(280);
const cursor = ref<PixelPoint>();
const keyboardCursor = ref(false);
const playing = ref(false);
const playIndex = ref(0);
const previews = ref<string[]>([]);
const isAnimation = computed(() => project.value.kind === "animation");
const frame = computed(() => project.value.frames[selected.value]!);
const locked = computed(() => Boolean(props.disabled || playing.value || pendingSize.value));
const picking = computed(() => Boolean(props.pickMode || tool.value === "pick"));
const canvasStyle = computed(() => ({
  width: `${baseSide.value * zoom.value / 100}px`,
  height: `${baseSide.value * zoom.value / 100}px`,
  transform: `translate(-50%, -50%) translate(${pan.value.x}px, ${pan.value.y}px)`,
}));
const undoStack: Snapshot[] = [], redoStack: Snapshot[] = [];
const pointers = new Map<number, Pointer>();
let active: { id: number; before: Snapshot; previous?: PixelPoint; changed: boolean } | undefined;
let moving: { id: number; point: Pointer; pan: Pointer } | undefined;
let gesture: { distance: number; center: Pointer; zoom: number; pan: Pointer } | undefined;
let gesturing = false;
let lastEmitted: PixelProject | undefined;
let resizeObserver: ResizeObserver | undefined;
let animationId = 0, lastPlayback = 0;

function snapshot(): Snapshot { return { project: cloneProject(project.value), frame: selected.value }; }
function historyState() { emit("history", { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }); }
function emitProject() {
  lastEmitted = cloneProject(project.value);
  emit("update:modelValue", lastEmitted);
  historyState();
  updatePreviews();
  render();
}
function commit(before: Snapshot) {
  // shortcut: keep 24 full undo steps to bound memory for 64 × 64, 12-frame projects.
  undoStack.push(before);
  if (undoStack.length > 24) undoStack.shift();
  redoStack.length = 0;
  emitProject();
}
function restore(state: Snapshot) {
  project.value = cloneProject(state.project);
  selected.value = Math.min(state.frame, project.value.frames.length - 1);
  cursor.value = undefined;
  emitProject();
}
function undo() {
  if (props.disabled) return;
  cancelActive(); stopPlayback();
  const before = undoStack.pop();
  if (before) { redoStack.push(snapshot()); restore(before); }
}
function redo() {
  if (props.disabled) return;
  cancelActive(); stopPlayback();
  const after = redoStack.pop();
  if (after) { undoStack.push(snapshot()); restore(after); }
}
function drawPixels(context: CanvasRenderingContext2D, pixels: readonly string[], size: number, scale: number, offset = 0) {
  for (let i = 0; i < pixels.length; i++) {
    const color = pixels[i];
    if (!color) continue;
    context.fillStyle = color;
    context.fillRect(offset + i % size * scale, Math.floor(i / size) * scale, scale, scale);
  }
}
function render() {
  const element = canvas.value;
  if (!element) return;
  const size = project.value.size, scale = 16, side = size * scale;
  if (element.width !== side) { element.width = side; element.height = side; }
  const context = element.getContext("2d")!;
  context.globalAlpha = 1;
  context.clearRect(0, 0, side, side);
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, side, side);
  context.fillStyle = "#F1F1E9";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if ((x + y) % 2) context.fillRect(x * scale, y * scale, scale, scale);
  }
  const index = playing.value ? playIndex.value : selected.value;
  if (!playing.value && isAnimation.value && onion.value && index > 0) {
    context.globalAlpha = 0.22;
    drawPixels(context, project.value.frames[index - 1]!.pixels, size, scale);
    context.globalAlpha = 1;
  }
  drawPixels(context, project.value.frames[index]!.pixels, size, scale);
  if (grid.value && !playing.value) {
    context.strokeStyle = "#56715C35";
    context.lineWidth = 0.8;
    context.beginPath();
    for (let i = 1; i < size; i++) {
      context.moveTo(i * scale, 0); context.lineTo(i * scale, side);
      context.moveTo(0, i * scale); context.lineTo(side, i * scale);
    }
    context.stroke();
  }
  if (cursor.value && !playing.value && !panMode.value) {
    const x = cursor.value.x * scale, y = cursor.value.y * scale;
    context.strokeStyle = "#FFFFFF"; context.lineWidth = 3;
    context.strokeRect(x + 1, y + 1, scale - 2, scale - 2);
    context.strokeStyle = "#315A48"; context.lineWidth = 1.5;
    context.strokeRect(x + 1, y + 1, scale - 2, scale - 2);
  }
}
function frameCanvas(item: PixelFrame, scale: number): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = output.height = project.value.size * scale;
  const context = output.getContext("2d")!;
  context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, output.width, output.height);
  drawPixels(context, item.pixels, project.value.size, scale);
  return output;
}
function updatePreviews() { previews.value = project.value.frames.map((item) => frameCanvas(item, 2).toDataURL("image/png")); }
function cellAt(event: Pointer): PixelPoint | undefined {
  const rect = canvas.value?.getBoundingClientRect();
  if (!rect) return;
  const x = Math.floor((event.x - rect.left) / rect.width * project.value.size);
  const y = Math.floor((event.y - rect.top) / rect.height * project.value.size);
  if (x < 0 || y < 0 || x >= project.value.size || y >= project.value.size) return;
  return { x, y };
}
function pick(point: PixelPoint) {
  const color = frame.value.pixels[point.y * project.value.size + point.x];
  if (!color) { emit("notice", "这里是透明格子，请选一个有颜色的格子。"); return; }
  emit("pick", { color: color.slice(0, 7), opacity: Math.round(parseInt(color.slice(7, 9) || "FF", 16) / 255 * 100) });
  if (tool.value === "pick") tool.value = "brush";
}
function apply(point: PixelPoint, previous = point): boolean {
  const color = tool.value === "eraser" ? "" : pixelColor(props.color, props.opacity);
  return tool.value === "fill"
    ? fillPixels(frame.value.pixels, project.value.size, point, color)
    : paintPixelLine(frame.value.pixels, project.value.size, previous, point, color);
}
function revertActive() {
  if (!active) return;
  project.value = cloneProject(active.before.project);
  selected.value = active.before.frame;
  active = undefined;
  render();
}
function cancelActive() {
  revertActive();
  moving = undefined; gesture = undefined; gesturing = false;
  pointers.clear();
  emit("busy", false);
}
function touchCenter(): Pointer {
  const [a, b] = [...pointers.values()];
  return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
}
function touchDistance(): number {
  const [a, b] = [...pointers.values()];
  return Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y));
}
function startGesture() {
  revertActive(); moving = undefined;
  gesturing = true;
  gesture = { distance: touchDistance(), center: touchCenter(), zoom: zoom.value, pan: { ...pan.value } };
  emit("busy", true);
}
function pointerDown(event: PointerEvent) {
  if (locked.value || (event.pointerType === "mouse" && event.button !== 0)) return;
  const point = { x: event.clientX, y: event.clientY };
  pointers.set(event.pointerId, point);
  viewport.value?.setPointerCapture(event.pointerId);
  if (pointers.size >= 2) { startGesture(); return; }
  if (gesturing) return;
  if (panMode.value) {
    moving = { id: event.pointerId, point, pan: { ...pan.value } };
    emit("busy", true); return;
  }
  const cell = cellAt(point);
  if (!cell) return;
  cursor.value = cell; keyboardCursor.value = false;
  canvas.value?.focus({ preventScroll: true });
  if (picking.value) { pick(cell); render(); return; }
  active = { id: event.pointerId, before: snapshot(), previous: cell, changed: false };
  emit("busy", true);
  active.changed = apply(cell);
  render();
}
function pointerMove(event: PointerEvent) {
  const point = { x: event.clientX, y: event.clientY };
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);
  if (gesture && pointers.size >= 2) {
    const center = touchCenter(), rect = viewport.value!.getBoundingClientRect();
    const next = Math.min(800, Math.max(100, gesture.zoom * touchDistance() / gesture.distance));
    const ratio = next / gesture.zoom;
    const middle = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    pan.value = {
      x: center.x - middle.x - (gesture.center.x - middle.x - gesture.pan.x) * ratio,
      y: center.y - middle.y - (gesture.center.y - middle.y - gesture.pan.y) * ratio,
    };
    zoom.value = Math.round(next); clampPan(); return;
  }
  if (gesturing) return;
  if (moving?.id === event.pointerId) {
    pan.value = { x: moving.pan.x + point.x - moving.point.x, y: moving.pan.y + point.y - moving.point.y };
    clampPan(); return;
  }
  const cell = cellAt(point);
  cursor.value = cell; keyboardCursor.value = false;
  if (active?.id === event.pointerId && tool.value !== "fill" && cell) {
    active.changed = apply(cell, active.previous ?? cell) || active.changed;
    active.previous = cell;
  } else if (active && !cell) active.previous = undefined;
  render();
}
function pointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
  if (gesturing) {
    if (!pointers.size) { gesture = undefined; gesturing = false; emit("busy", false); }
  } else {
    if (active?.id === event.pointerId) {
      const ended = active; active = undefined;
      if (ended.changed) commit(ended.before);
      emit("busy", false);
    }
    if (moving?.id === event.pointerId) { moving = undefined; emit("busy", false); }
  }
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId);
}
function pointerLeave() {
  if (!active && !keyboardCursor.value) { cursor.value = undefined; render(); }
}
function lostCapture(event: PointerEvent) { if (pointers.has(event.pointerId)) cancelActive(); }
function clampPan() {
  const rect = viewport.value?.getBoundingClientRect();
  if (!rect) return;
  const side = baseSide.value * zoom.value / 100;
  const maxX = Math.max(0, (side - rect.width) / 2 + 48);
  const maxY = Math.max(0, (side - rect.height) / 2 + 48);
  pan.value = { x: Math.min(maxX, Math.max(-maxX, pan.value.x)), y: Math.min(maxY, Math.max(-maxY, pan.value.y)) };
}
function setZoom(value: number) { zoom.value = Math.min(800, Math.max(100, value)); clampPan(); }
function resetView() { zoom.value = 100; pan.value = { x: 0, y: 0 }; }
function chooseTool(value: Tool) { cancelActive(); emit("cancelPick"); tool.value = value; panMode.value = false; }
function togglePan() { cancelActive(); panMode.value = !panMode.value; cursor.value = undefined; render(); }
function keyboard(event: KeyboardEvent) {
  if (locked.value || pointers.size || active || gesture || event.ctrlKey || event.metaKey || event.altKey) return;
  const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const delta = direction[event.key];
  if (delta) {
    event.preventDefault(); event.stopPropagation();
    const old = cursor.value ?? { x: 0, y: 0 }, end = project.value.size - 1;
    cursor.value = { x: Math.min(end, Math.max(0, old.x + delta[0])), y: Math.min(end, Math.max(0, old.y + delta[1])) };
    keyboardCursor.value = true; render();
  } else if (event.code === "Space" || event.key === "Enter") {
    event.preventDefault(); event.stopPropagation();
    if (event.repeat || panMode.value) return;
    const cell = cursor.value ?? { x: 0, y: 0 };
    cursor.value = cell; keyboardCursor.value = true;
    if (picking.value) pick(cell);
    else { const before = snapshot(); if (apply(cell)) commit(before); }
    render();
  } else if (event.key === "Escape") { cancelActive(); stopPlayback(); }
}
function requestSize(event: Event) {
  const select = event.target as HTMLSelectElement;
  const size = Number(select.value) as 16 | 32 | 64;
  select.value = String(project.value.size);
  if (size === project.value.size || locked.value) return;
  cancelActive(); pendingSize.value = size;
  void nextTick(() => sizeDialog.value?.showModal());
}
function cancelSize() { pendingSize.value = undefined; sizeDialog.value?.close(); }
function confirmSize() {
  const size = pendingSize.value;
  if (!size || props.disabled) return;
  const before = snapshot();
  for (const item of project.value.frames) item.pixels = resizePixels(item.pixels, project.value.size, size);
  project.value.size = size;
  cursor.value = undefined; cancelSize(); resetView(); commit(before);
  emit("notice", `已调整为 ${size} × ${size} 格，可以撤销恢复。`);
}
function selectFrame(index: number) {
  if (locked.value || index < 0 || index >= project.value.frames.length) return;
  cancelActive(); selected.value = index; render();
}
function addFrame(duplicate = false) {
  if (locked.value || project.value.frames.length >= 12) return;
  cancelActive(); const before = snapshot();
  const item: PixelFrame = { id: createArtworkId(), pixels: duplicate ? [...frame.value.pixels] : Array<string>(project.value.size ** 2).fill("") };
  project.value.frames.splice(selected.value + 1, 0, item);
  selected.value++; commit(before);
}
function deleteFrame() {
  if (locked.value || project.value.frames.length <= 1) return;
  cancelActive(); const before = snapshot();
  project.value.frames.splice(selected.value, 1);
  selected.value = Math.min(selected.value, project.value.frames.length - 1);
  commit(before); emit("notice", "这一帧已删除，可以撤销找回。");
}
function moveFrame(direction: number) {
  const target = selected.value + direction;
  if (locked.value || target < 0 || target >= project.value.frames.length) return;
  cancelActive(); const before = snapshot();
  const [item] = project.value.frames.splice(selected.value, 1);
  project.value.frames.splice(target, 0, item!); selected.value = target; commit(before);
}
function changeFps(event: Event) {
  if (locked.value) return;
  cancelActive();
  const value = Number((event.target as HTMLInputElement).value);
  if (value === project.value.fps) return;
  const before = snapshot(); project.value.fps = value; commit(before);
}
function playback(timestamp: number) {
  if (!playing.value) return;
  if (timestamp - lastPlayback >= 1000 / project.value.fps) {
    playIndex.value = (playIndex.value + 1) % project.value.frames.length;
    lastPlayback = timestamp; render();
  }
  animationId = requestAnimationFrame(playback);
}
function stopPlayback() { playing.value = false; cancelAnimationFrame(animationId); render(); }
function togglePlayback() {
  if (playing.value) { stopPlayback(); return; }
  if (props.disabled || pendingSize.value) return;
  cancelActive(); cursor.value = undefined;
  playIndex.value = selected.value; playing.value = true; lastPlayback = performance.now();
  render(); animationId = requestAnimationFrame(playback);
}
function blobFromCanvas(output: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片导出失败，请重试。")), "image/png"));
}
async function exportPng(): Promise<Blob> {
  cancelActive(); stopPlayback();
  return blobFromCanvas(frameCanvas(frame.value, 8));
}
async function exportSpriteSheet(): Promise<Blob> {
  cancelActive(); stopPlayback();
  const output = document.createElement("canvas"), size = project.value.size, scale = 8;
  output.width = size * scale * project.value.frames.length; output.height = size * scale;
  const context = output.getContext("2d")!;
  context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, output.width, output.height);
  project.value.frames.forEach((item, index) => drawPixels(context, item.pixels, size, scale, index * size * scale));
  return blobFromCanvas(output);
}
async function exportGif(): Promise<Blob> {
  if (!isAnimation.value) throw new Error("请在翻页动画中导出 GIF。");
  cancelActive(); stopPlayback();
  const frames = project.value.frames.map((item) => {
    const output = frameCanvas(item, 4);
    return output.getContext("2d")!.getImageData(0, 0, output.width, output.height);
  });
  return new Blob([new Uint8Array(encodeGif(frames, project.value.fps))], { type: "image/gif" });
}
defineExpose<CreativeEditorHandle>({ exportPng, exportGif, exportSpriteSheet, undo, redo, cancelActive });

watch(() => props.modelValue, (value) => {
  if (toRaw(value) === lastEmitted) return;
  cancelActive(); stopPlayback();
  project.value = cloneProject(value); selected.value = Math.min(selected.value, value.frames.length - 1);
  undoStack.length = 0; redoStack.length = 0;
  historyState(); updatePreviews(); render();
});
watch(() => props.disabled, (value) => { if (value) { cancelActive(); stopPlayback(); } });
watch(() => props.pickMode, (value) => { if (value) { cancelActive(); panMode.value = false; } });
watch([grid, onion, panMode], render);
onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    const rect = viewport.value?.getBoundingClientRect();
    if (rect) { baseSide.value = Math.max(96, Math.min(rect.width - 28, rect.height - 28)); clampPan(); }
  });
  if (viewport.value) resizeObserver.observe(viewport.value);
  historyState(); updatePreviews(); render();
});
onBeforeUnmount(() => { cancelActive(); cancelAnimationFrame(animationId); resizeObserver?.disconnect(); });
</script>

<template>
  <section class="pixel-editor" :aria-label="isAnimation ? '翻页动画编辑器' : '像素画编辑器'">
    <div class="pixel-tools" aria-label="像素工具">
      <button type="button" :class="{ selected: tool === 'brush' && !pickMode && !panMode }" :aria-pressed="tool === 'brush' && !pickMode && !panMode" :disabled="locked" @click="chooseTool('brush')"><Paintbrush />画笔</button>
      <button type="button" :class="{ selected: tool === 'eraser' && !pickMode && !panMode }" :aria-pressed="tool === 'eraser' && !pickMode && !panMode" :disabled="locked" @click="chooseTool('eraser')"><Eraser />橡皮</button>
      <button type="button" :class="{ selected: tool === 'fill' && !pickMode && !panMode }" :aria-pressed="tool === 'fill' && !pickMode && !panMode" :disabled="locked" @click="chooseTool('fill')"><PaintBucket />填色</button>
      <button type="button" :class="{ selected: picking && !panMode }" :aria-pressed="picking && !panMode" :disabled="locked" @click="chooseTool('pick')"><Pipette />取色</button>
      <button type="button" :class="{ selected: grid }" :aria-pressed="grid" :disabled="disabled" @click="grid = !grid"><Grid2X2 />网格</button>
      <button v-if="isAnimation" type="button" :class="{ selected: onion }" :aria-pressed="onion" :disabled="disabled || playing" title="淡淡显示上一帧，方便对齐动作" @click="onion = !onion"><Eye />前帧淡影</button>
      <label class="size-control">画布格数<select :value="project.size" :disabled="locked" aria-label="画布格数" @change="requestSize"><option :value="16">16 × 16</option><option :value="32">32 × 32</option><option :value="64">64 × 64</option></select></label>
    </div>

    <div ref="viewport" class="pixel-viewport" :class="{ 'pan-mode': panMode, playing, picking: picking && !panMode }" @pointerdown.prevent="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="cancelActive" @lostpointercapture="lostCapture" @pointerleave="pointerLeave" @contextmenu.prevent>
      <canvas ref="canvas" class="pixel-canvas" :style="canvasStyle" tabindex="0" role="img" :aria-label="`${project.size}乘${project.size}像素画布。方向键移动格子，空格或回车绘画。`" aria-describedby="pixel-keyboard-help" @keydown="keyboard" />
      <span v-if="playing" class="play-badge" role="status">播放中 · 第 {{ playIndex + 1 }} 帧</span>
    </div>

    <div class="view-tools">
      <button type="button" :class="{ selected: panMode }" :aria-pressed="panMode" :disabled="locked" @click="togglePan"><Hand />拖动画布</button>
      <label class="zoom-control"><span>缩放 {{ zoom }}%</span><input type="range" min="100" max="800" step="10" :value="zoom" :style="{ '--pixel-progress': `${(zoom - 100) / 7}%` }" :disabled="disabled" aria-label="画布缩放" @input="setZoom(Number(($event.target as HTMLInputElement).value))" /></label>
      <button type="button" :disabled="disabled" @click="resetView">复位</button>
    </div>
    <p id="pixel-keyboard-help" class="pixel-help">单指画画，双指缩放和移动。键盘方向键选格，空格绘画。</p>

    <section v-if="isAnimation" class="animation-panel" aria-label="动画帧">
      <div class="animation-top">
        <button type="button" class="play-button" :disabled="disabled" @click="togglePlayback"><Pause v-if="playing" /><Play v-else />{{ playing ? '暂停' : '播放' }}</button>
        <label class="fps-control">速度 <input type="range" min="2" max="12" step="1" :value="project.fps" :style="{ '--pixel-progress': `${(project.fps - 2) * 10}%` }" :disabled="locked" aria-label="动画每秒帧数" @change="changeFps" /><strong>{{ project.fps }} 帧/秒</strong></label>
        <span class="frame-count">{{ project.frames.length }} / 12 帧</span>
      </div>
      <div class="frame-list" aria-label="选择动画帧">
        <button v-for="(item, index) in project.frames" :key="item.id" type="button" class="frame-button" :class="{ selected: selected === index }" :aria-pressed="selected === index" :aria-label="`选择第${index + 1}帧`" :disabled="locked" @click="selectFrame(index)"><img :src="previews[index]" alt="" draggable="false" /><span>第 {{ index + 1 }} 帧</span></button>
      </div>
      <div class="frame-actions">
        <button type="button" :disabled="locked || selected === 0" aria-label="选择上一帧" @click="selectFrame(selected - 1)"><ChevronLeft />上一帧</button>
        <button type="button" :disabled="locked || selected === project.frames.length - 1" aria-label="选择下一帧" @click="selectFrame(selected + 1)"><ChevronRight />下一帧</button>
        <button type="button" :disabled="locked || project.frames.length >= 12" @click="addFrame()"><Plus />空白帧</button>
        <button type="button" :disabled="locked || project.frames.length >= 12" @click="addFrame(true)"><Copy />复制帧</button>
        <button type="button" :disabled="locked || selected === 0" @click="moveFrame(-1)"><ArrowLeft />向前移</button>
        <button type="button" :disabled="locked || selected === project.frames.length - 1" @click="moveFrame(1)"><ArrowRight />向后移</button>
        <button type="button" class="delete-frame" :disabled="locked || project.frames.length <= 1" @click="deleteFrame"><Trash2 />删除帧</button>
      </div>
      <p class="pixel-help">复制一帧后改一点点，让画面动起来。删除、换序都可以撤销。</p>
    </section>

    <dialog ref="sizeDialog" class="size-dialog" aria-labelledby="pixel-resize-title" @cancel.prevent="cancelSize" @click="($event.target === sizeDialog) && cancelSize()">
      <h3 id="pixel-resize-title">调整像素格数？</h3>
      <p>所有帧会一起变成 {{ pendingSize }} × {{ pendingSize }} 格。缩小可能减少细节，完成后可以撤销。</p>
      <div><button type="button" autofocus @click="cancelSize">先不调整</button><button type="button" class="confirm-size" :disabled="disabled" @click="confirmSize">确认调整</button></div>
    </dialog>
  </section>
</template>

<style scoped>
.pixel-editor { min-width: 0; width: 100%; color: #3f5d4b; font-size: 16px; }
.pixel-tools, .view-tools, .animation-top, .frame-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pixel-tools { margin-bottom: 12px; }
button, select { font: inherit; color: inherit; }
button { min-height: 44px; min-width: 44px; border: 1.5px solid #d7dfc9; border-radius: 14px; background: #fffef5; padding: 9px 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-weight: 700; touch-action: manipulation; }
button svg { width: 19px; height: 19px; flex: 0 0 auto; }
button:hover:not(:disabled) { background: #edf3e3; border-color: #91ad80; }
button.selected, .play-button { color: #fff; border-color: #608663; background: #608663; }
button.selected:hover:not(:disabled), .play-button:hover:not(:disabled) { background: #4e7453; }
button:disabled { cursor: default; opacity: .43; }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid #e6ad49; outline-offset: 3px; }
.size-control { display: flex; align-items: center; gap: 8px; margin-left: auto; font-size: 15px; font-weight: 700; }
select { min-height: 44px; max-width: 120px; border: 1.5px solid #d7dfc9; border-radius: 13px; padding: 7px; background: #fffef5; }
.pixel-viewport { position: relative; width: 100%; height: clamp(280px, 53vh, 560px); overflow: hidden; border: 2px solid #dbe3ce; border-radius: 22px; background: #e9eddf; touch-action: none; user-select: none; isolation: isolate; }
.pixel-canvas { position: absolute; left: 50%; top: 50%; background: #fff; box-shadow: 0 7px 22px #3f5d4b18; image-rendering: pixelated; cursor: crosshair; }
.pixel-canvas:focus-visible { outline: 3px solid #e6ad49; outline-offset: 3px; }
.pan-mode .pixel-canvas { cursor: grab; }
.pan-mode:active .pixel-canvas { cursor: grabbing; }
.picking .pixel-canvas { cursor: copy; }
.playing .pixel-canvas { cursor: default; }
.play-badge { position: absolute; left: 12px; top: 12px; z-index: 1; border-radius: 12px; background: #42684fe8; color: #fff; padding: 7px 12px; pointer-events: none; font-weight: 700; }
.view-tools { padding-top: 10px; }
.zoom-control { display: flex; align-items: center; flex: 1; gap: 10px; min-width: 170px; font-size: 15px; font-weight: 700; }
.zoom-control span { min-width: 88px; white-space: nowrap; }
input[type="range"] { appearance: none; -webkit-appearance: none; height: 44px; min-width: 70px; width: 100%; background: transparent; cursor: pointer; touch-action: pan-y; }
input[type="range"]::-webkit-slider-runnable-track { height: 8px; border-radius: 8px; background: linear-gradient(to right, #88a27a 0 var(--pixel-progress, 0%), #dce6d1 var(--pixel-progress, 0%) 100%); }
input[type="range"]::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 22px; height: 22px; margin-top: -7px; border-radius: 50%; border: 3px solid #fffef5; background: #789d78; box-shadow: 0 1px 4px #46604440; }
input[type="range"]::-moz-range-track { height: 8px; border-radius: 8px; background: #dce6d1; }
input[type="range"]::-moz-range-progress { height: 8px; border-radius: 8px; background: #88a27a; }
input[type="range"]::-moz-range-thumb { width: 17px; height: 17px; border-radius: 50%; border: 3px solid #fffef5; background: #789d78; }
.pixel-help { color: #7a8773; font-size: 13px; line-height: 1.6; margin: 8px 0 0; }
.animation-panel { margin-top: 14px; padding: 14px; border: 1.5px solid #dce3cf; border-radius: 20px; background: #f6f7e9; min-width: 0; }
.fps-control { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 180px; font-size: 15px; }
.fps-control input { flex: 1; }
.fps-control strong { white-space: nowrap; min-width: 68px; }
.frame-count { color: #7a8773; font-size: 14px; white-space: nowrap; }
.frame-list { display: flex; gap: 9px; overflow-x: auto; padding: 12px 3px; scrollbar-width: thin; overscroll-behavior-x: contain; }
.frame-button { flex-direction: column; flex: 0 0 82px; width: 82px; padding: 6px; font-size: 13px; border-width: 2px; }
.frame-button img { display: block; width: 64px; height: 64px; object-fit: contain; image-rendering: pixelated; border-radius: 6px; background: #fff; pointer-events: none; }
.frame-actions { gap: 6px; }
.frame-actions button { font-size: 14px; padding: 8px 9px; }
.delete-frame { color: #aa665b; }
.size-dialog { border: 2px solid #d9e2c9; border-radius: 24px; padding: 24px; max-width: min(420px, calc(100vw - 30px)); color: #3f5d4b; background: #fffef5; box-sizing: border-box; }
.size-dialog::backdrop { background: #25463866; }
.size-dialog h3 { margin: 0 0 10px; font-size: 22px; }
.size-dialog p { line-height: 1.7; font-size: 17px; }
.size-dialog > div { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.confirm-size { background: #608663; color: #fff; }
@media (max-width: 520px) {
  .pixel-tools { gap: 6px; }
  .pixel-tools > button { flex: 1 0 calc(25% - 6px); padding: 8px 6px; font-size: 14px; gap: 4px; }
  .pixel-tools > button svg { width: 17px; height: 17px; }
  .size-control { margin-left: 0; }
  .pixel-viewport { height: 340px; border-radius: 18px; }
  .view-tools { gap: 6px; }
  .view-tools > button { font-size: 14px; padding: 8px; }
  .zoom-control { order: 3; flex-basis: 100%; }
  .animation-panel { padding: 10px; }
  .fps-control { order: 3; flex-basis: 100%; }
  .frame-count { margin-left: auto; }
  .frame-actions button { flex: 1 0 calc(33.333% - 6px); font-size: 13px; padding: 8px 4px; gap: 3px; }
  .frame-actions button svg { width: 16px; height: 16px; }
}
</style>
