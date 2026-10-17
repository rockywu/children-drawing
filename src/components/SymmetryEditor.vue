<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from "vue";
import { Check, Crosshair, Eraser, Hand, Palette, Paintbrush, Pipette, Rainbow, RotateCcw, SlidersHorizontal, Sparkles, Star, Trash2, ZoomIn } from "lucide-vue-next";
import type { CreativeBrush, CreativeEditorHandle, CreativeHistory, CreativePick, CreativePoint, SymmetryMode, SymmetryProject, SymmetryStroke } from "../creative/types";
import { MAX_STROKE_POINTS, MAX_SYMMETRY_POINTS, MAX_SYMMETRY_STROKES, renderSymmetryStroke, SYMMETRY_SIDE, symmetryCount } from "../creative/symmetry";

const props = withDefaults(defineProps<{
  modelValue: SymmetryProject;
  color: string;
  opacity: number;
  disabled?: boolean;
  pickMode?: boolean;
}>(), { disabled: false, pickMode: false });
const emit = defineEmits<{
  "update:modelValue": [value: SymmetryProject];
  history: [value: CreativeHistory];
  busy: [value: boolean];
  pick: [value: CreativePick];
  notice: [message: string];
  cancelPick: [];
}>();
const project = shallowRef<SymmetryProject>(JSON.parse(JSON.stringify(props.modelValue)));
const viewport = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();
const tool = ref<"brush" | "eraser" | "pick">("brush");
const size = ref(10);
const guides = ref(true);
const clearDialog = ref(false);
const drawing = ref(false);
const zoom = ref(100);
const pan = ref<CreativePoint>({ x: 0, y: 0 });
const paperSide = ref(360);
const panMode = ref(false);
const panning = ref(false);
const eraserPoint = ref<CreativePoint>();
const controlsDisabled = computed(() => props.disabled || drawing.value);
const pointCount = computed(() => project.value.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0));
const modes: { id: SymmetryMode; label: string }[] = [
  { id: "mirror", label: "左右对称" }, { id: "four", label: "4 向" },
  { id: "six", label: "6 向" }, { id: "eight", label: "8 向" },
];
const brushes = [
  { id: "plain" as CreativeBrush, label: "普通笔", icon: Paintbrush },
  { id: "rainbow" as CreativeBrush, label: "彩虹笔", icon: Rainbow },
  { id: "stars" as CreativeBrush, label: "星星笔", icon: Star },
];
const guideLines = computed(() => {
  if (project.value.mode === "mirror") return [{ x1: 400, y1: 0, x2: 400, y2: 800 }];
  return Array.from({ length: symmetryCount(project.value.mode) }, (_, i) => {
    const angle = i * Math.PI * 2 / symmetryCount(project.value.mode) - Math.PI / 2;
    return { x1: 400, y1: 400, x2: 400 + Math.cos(angle) * 566, y2: 400 + Math.sin(angle) * 566 };
  });
});
let committed: HTMLCanvasElement | undefined;
let temporary: HTMLCanvasElement | undefined;
let active: SymmetryStroke | undefined;
let activePointer: number | undefined;
let pickPointer: number | undefined;
let panPointer: { id: number; point: CreativePoint } | undefined;
let pinch: { distance: number; midpoint: CreativePoint; zoom: number; pan: CreativePoint } | undefined;
let pinching = false;
let frame = 0;
let observer: ResizeObserver | undefined;
let limitNotice = false;
const touches = new Map<number, CreativePoint>();
const captures = new Set<number>();
let history: SymmetryStroke[][] = [project.value.strokes];
let historyIndex = 0;

function emitHistory() {
  emit("history", { canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 });
}
function publish(next: SymmetryProject) {
  project.value = next;
  emit("update:modelValue", next);
}
function checkpoint(strokes: SymmetryStroke[]) {
  history = history.slice(0, historyIndex + 1);
  history.push(strokes);
  if (history.length > 41) history.shift();
  historyIndex = history.length - 1;
  publish({ ...project.value, strokes });
  emitHistory();
}
function configure(mode: SymmetryMode, brush: CreativeBrush) {
  if (controlsDisabled.value || mode === project.value.mode && brush === project.value.brush) return;
  publish({ ...project.value, mode, brush });
}
function setTool(value: typeof tool.value) {
  if (controlsDisabled.value) return;
  emit("cancelPick");
  tool.value = value;
  panMode.value = false;
  eraserPoint.value = undefined;
}
function redraw() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  const context = canvas.value?.getContext("2d");
  if (!context || !committed || !temporary) return;
  context.clearRect(0, 0, SYMMETRY_SIDE, SYMMETRY_SIDE);
  context.drawImage(committed, 0, 0);
  if (active) renderSymmetryStroke(context, active, temporary);
}
function scheduleDraw() {
  if (!frame) frame = requestAnimationFrame(redraw);
}
function replay() {
  if (!committed || !temporary) return;
  const context = committed.getContext("2d")!;
  context.clearRect(0, 0, SYMMETRY_SIDE, SYMMETRY_SIDE);
  project.value.strokes.forEach((stroke) => renderSymmetryStroke(context, stroke, temporary!));
  redraw();
}
function setDrawing(value: boolean) {
  if (drawing.value === value) return;
  drawing.value = value;
  emit("busy", value);
}
function cancelStroke() {
  active = undefined;
  activePointer = undefined;
  setDrawing(false);
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  redraw();
}
function cancelActive() {
  cancelStroke();
  touches.clear();
  pickPointer = undefined;
  panPointer = undefined;
  pinch = undefined;
  pinching = false;
  panning.value = false;
  eraserPoint.value = undefined;
  const ids = [...captures];
  captures.clear();
  ids.forEach((id) => {
    if (viewport.value?.hasPointerCapture(id)) viewport.value.releasePointerCapture(id);
  });
}
function undo() {
  if (props.disabled || clearDialog.value) return;
  if (active) { cancelActive(); return; }
  if (historyIndex <= 0) return;
  publish({ ...project.value, strokes: history[--historyIndex]! });
  replay();
  emitHistory();
}
function redo() {
  if (props.disabled || clearDialog.value) return;
  if (active) { cancelActive(); return; }
  if (historyIndex >= history.length - 1) return;
  publish({ ...project.value, strokes: history[++historyIndex]! });
  replay();
  emitHistory();
}
function clear() {
  if (props.disabled) return;
  cancelActive();
  checkpoint([]);
  replay();
  clearDialog.value = false;
  emit("notice", "画纸已清空，可以点撤销找回来");
}
function setView(value: number, offset: CreativePoint) {
  zoom.value = Math.max(100, Math.min(300, value));
  const box = viewport.value;
  if (!box) return;
  const x = Math.max(0, (paperSide.value * zoom.value / 100 - box.clientWidth) / 2);
  const y = Math.max(0, (paperSide.value * zoom.value / 100 - box.clientHeight) / 2);
  pan.value = { x: Math.max(-x, Math.min(x, offset.x)), y: Math.max(-y, Math.min(y, offset.y)) };
}
function changeZoom(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  const scale = value / zoom.value;
  setView(value, { x: pan.value.x * scale, y: pan.value.y * scale });
}
function fitPaper() {
  if (!viewport.value) return;
  paperSide.value = Math.max(1, Math.min(viewport.value.clientWidth - 24, viewport.value.clientHeight - 24));
  setView(zoom.value, pan.value);
}
function point(event: PointerEvent): CreativePoint {
  const box = canvas.value!.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(800, (event.clientX - box.left) * 800 / box.width)),
    y: Math.max(0, Math.min(800, (event.clientY - box.top) * 800 / box.height)),
  };
}
function geometry() {
  const [first, second] = [...touches.values()] as [CreativePoint, CreativePoint];
  const box = viewport.value!.getBoundingClientRect();
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    midpoint: { x: (first.x + second.x) / 2 - box.left - box.width / 2, y: (first.y + second.y) / 2 - box.top - box.height / 2 },
  };
}
function capture(id: number) {
  viewport.value!.setPointerCapture(id);
  captures.add(id);
}
function pick(event: PointerEvent) {
  if (!committed) return;
  const location = point(event);
  const rgba = committed.getContext("2d")!.getImageData(Math.min(799, Math.floor(location.x)), Math.min(799, Math.floor(location.y)), 1, 1).data;
  const color = rgba[3] ? "#" + [rgba[0]!, rgba[1]!, rgba[2]!].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase() : "#FFFFFF";
  emit("pick", { color, opacity: rgba[3] ? Math.max(10, Math.round(rgba[3] / 255 * 10) * 10) : 100 });
  tool.value = "brush";
  emit("notice", "颜色已选好，可以继续画画");
}
function pointerDown(event: PointerEvent) {
  if (props.disabled || clearDialog.value || event.pointerType === "mouse" && event.button !== 0) return;
  if (event.pointerType === "touch") {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capture(event.pointerId);
    if (touches.size >= 2) {
      cancelStroke();
      pickPointer = undefined;
      panPointer = undefined;
      pinching = true;
      panning.value = true;
      eraserPoint.value = undefined;
      pinch = { ...geometry(), zoom: zoom.value, pan: { ...pan.value } };
      return;
    }
    if (pinching) return;
  }
  if (activePointer !== undefined || panPointer || pickPointer !== undefined) return;
  if (panMode.value) {
    panPointer = { id: event.pointerId, point: { x: event.clientX, y: event.clientY } };
    panning.value = true;
    capture(event.pointerId);
    return;
  }
  if (event.target !== canvas.value) return;
  capture(event.pointerId);
  if (tool.value === "pick") {
    pickPointer = event.pointerId;
    return;
  }
  if (project.value.strokes.length >= MAX_SYMMETRY_STROKES || pointCount.value >= MAX_SYMMETRY_POINTS) {
    emit("notice", "这幅画的笔迹已经很多了，请先保存或下载，再开启新的创作");
    return;
  }
  activePointer = event.pointerId;
  limitNotice = false;
  active = {
    points: [point(event)], color: props.color, opacity: props.opacity,
    size: size.value, eraser: tool.value === "eraser", mode: project.value.mode, brush: project.value.brush,
  };
  if (active.eraser) eraserPoint.value = active.points[0];
  setDrawing(true);
  scheduleDraw();
}
function pointerMove(event: PointerEvent) {
  if (props.disabled) return;
  if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinching) {
    if (!pinch || touches.size < 2) return;
    const current = geometry();
    const value = Math.max(100, Math.min(300, pinch.zoom * current.distance / pinch.distance));
    const scale = value / pinch.zoom;
    setView(value, { x: current.midpoint.x - (pinch.midpoint.x - pinch.pan.x) * scale, y: current.midpoint.y - (pinch.midpoint.y - pinch.pan.y) * scale });
    return;
  }
  if (panPointer?.id === event.pointerId) {
    setView(zoom.value, { x: pan.value.x + event.clientX - panPointer.point.x, y: pan.value.y + event.clientY - panPointer.point.y });
    panPointer.point = { x: event.clientX, y: event.clientY };
    return;
  }
  if (tool.value === "eraser" && !panMode.value && event.pointerType !== "touch") {
    const box = canvas.value!.getBoundingClientRect();
    eraserPoint.value = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom ? point(event) : undefined;
  }
  if (!active || activePointer !== event.pointerId) return;
  const next = point(event), last = active.points[active.points.length - 1]!;
  if (Math.hypot(next.x - last.x, next.y - last.y) < 0.8) return;
  if (active.points.length >= MAX_STROKE_POINTS || pointCount.value + active.points.length >= MAX_SYMMETRY_POINTS) {
    if (!limitNotice) emit("notice", "这一笔已经很长啦，抬起手后可以继续画下一笔");
    limitNotice = true;
    return;
  }
  active.points.push(next);
  if (active.eraser) eraserPoint.value = next;
  scheduleDraw();
}
function pointerEnd(event: PointerEvent) {
  touches.delete(event.pointerId);
  if (pinching) {
    pinch = touches.size >= 2 ? { ...geometry(), zoom: zoom.value, pan: { ...pan.value } } : undefined;
    if (!touches.size) { pinching = false; panning.value = false; }
  } else if (panPointer?.id === event.pointerId) {
    panPointer = undefined;
    panning.value = false;
  } else if (pickPointer === event.pointerId) {
    pickPointer = undefined;
    if (event.type === "pointerup") pick(event);
  } else if (activePointer === event.pointerId) {
    const finished = active;
    if (event.type === "pointerup" && finished && committed && temporary) {
      active = undefined;
      activePointer = undefined;
      renderSymmetryStroke(committed.getContext("2d")!, finished, temporary);
      checkpoint([...project.value.strokes, finished]);
      setDrawing(false);
      redraw();
    } else cancelStroke();
  }
  if (event.pointerType === "touch" || event.type !== "pointerup") eraserPoint.value = undefined;
  captures.delete(event.pointerId);
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId);
}
async function exportPng(): Promise<Blob> {
  if (active || !committed) throw new Error("请先完成这一笔，再保存作品");
  const output = document.createElement("canvas");
  output.width = output.height = SYMMETRY_SIDE;
  const context = output.getContext("2d")!;
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, SYMMETRY_SIDE, SYMMETRY_SIDE);
  context.drawImage(committed, 0, 0);
  return new Promise((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error("图片生成失败，请再试一次")), "image/png"));
}
watch(() => props.modelValue, (value) => {
  if (toRaw(value) === toRaw(project.value)) return;
  cancelActive();
  project.value = JSON.parse(JSON.stringify(value)) as SymmetryProject;
  history = [project.value.strokes];
  historyIndex = 0;
  replay();
  emitHistory();
});
watch(() => props.disabled, (value) => { if (value) cancelActive(); });
watch(() => props.pickMode, (value) => {
  cancelActive();
  if (value) { tool.value = "pick"; panMode.value = false; }
  else if (tool.value === "pick") tool.value = "brush";
}, { immediate: true });
onMounted(async () => {
  committed = document.createElement("canvas");
  temporary = document.createElement("canvas");
  committed.width = committed.height = temporary.width = temporary.height = SYMMETRY_SIDE;
  replay();
  await nextTick();
  if (!viewport.value) return;
  observer = new ResizeObserver(fitPaper);
  observer.observe(viewport.value!);
  fitPaper();
  emitHistory();
  emit("busy", false);
});
onBeforeUnmount(() => { cancelActive(); observer?.disconnect(); committed = undefined; temporary = undefined; });
defineExpose({ exportPng, undo, redo, cancelActive } satisfies CreativeEditorHandle);
</script>

<template>
  <section class="symmetry-editor" aria-label="对称万花筒画板">
    <div class="symmetry-options">
      <div class="symmetry-group" role="group" aria-label="对称方式">
        <span class="symmetry-label"><Sparkles :size="18" />对称</span>
        <button v-for="mode in modes" :key="mode.id" :disabled="controlsDisabled" :class="{ selected: project.mode === mode.id }" :aria-pressed="project.mode === mode.id" @click="configure(mode.id, project.brush)">{{ mode.label }}</button>
      </div>
      <div class="symmetry-group" role="group" aria-label="创意画笔">
        <button v-for="brush in brushes" :key="brush.id" :disabled="controlsDisabled" :class="{ selected: project.brush === brush.id && tool === 'brush' }" :aria-pressed="project.brush === brush.id && tool === 'brush'" @click="configure(project.mode, brush.id); setTool('brush')"><component :is="brush.icon" :size="18" />{{ brush.label }}</button>
      </div>
    </div>
    <div class="symmetry-options symmetry-tools">
      <div class="symmetry-group" role="group" aria-label="画板工具">
        <button :disabled="controlsDisabled" :class="{ selected: tool === 'eraser' && !panMode }" :aria-pressed="tool === 'eraser' && !panMode" @click="setTool('eraser')"><Eraser :size="18" />橡皮</button>
        <button :disabled="controlsDisabled" :class="{ selected: tool === 'pick' && !panMode }" :aria-pressed="tool === 'pick' && !panMode" @click="setTool('pick')"><Pipette :size="18" />取色</button>
        <button :disabled="controlsDisabled" :class="{ selected: guides }" :aria-pressed="guides" @click="guides = !guides"><Crosshair :size="18" />辅助线</button>
        <button :disabled="controlsDisabled || !project.strokes.length" @click="clearDialog = true"><Trash2 :size="18" />清空</button>
      </div>
      <label class="symmetry-size"><SlidersHorizontal :size="18" />粗细 <input v-model.number="size" class="drawing-range" :style="{ '--range-progress': `${(size - 2) / 30 * 100}%` }" type="range" min="2" max="32" step="2" :disabled="controlsDisabled" aria-label="万花筒画笔粗细" /><output>{{ size }}</output></label>
    </div>
    <div ref="viewport" class="symmetry-viewport" :class="{ 'pan-mode': panMode, panning }" @pointerdown.prevent="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerEnd" @pointerleave="eraserPoint = undefined">
      <div class="symmetry-paper" :style="{ width: `${paperSide}px`, height: `${paperSide}px`, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})` }">
        <canvas ref="canvas" width="800" height="800" :class="{ 'eraser-mode': tool === 'eraser', 'pick-mode': tool === 'pick' }" aria-label="在这里用鼠标、画笔或手指画出对称图案"></canvas>
        <svg v-if="guides" class="symmetry-guides" viewBox="0 0 800 800" aria-hidden="true"><line v-for="(line, index) in guideLines" :key="index" v-bind="line" /><circle cx="400" cy="400" r="4" /></svg>
        <svg v-if="tool === 'eraser' && eraserPoint && !panning" class="symmetry-eraser" viewBox="0 0 800 800" aria-hidden="true"><circle :cx="eraserPoint.x" :cy="eraserPoint.y" :r="size * 1.25" stroke="white" stroke-width="3" /><circle :cx="eraserPoint.x" :cy="eraserPoint.y" :r="size * 1.25" stroke="#466347" stroke-width="1" /></svg>
      </div>
      <div v-if="!project.strokes.length && !drawing" class="symmetry-tip"><Palette :size="26" /><span>画一笔，看看对称的惊喜</span><small>双指可以缩放和移动画纸</small></div>
    </div>
    <div class="symmetry-bottom">
      <span class="symmetry-hint">{{ tool === 'pick' ? '点一下画纸，选取你喜欢的颜色' : panMode ? '按住拖动画纸，再点手掌继续画画' : '每一笔都会变成你的独特花纹' }}</span>
      <div class="symmetry-view">
        <label><ZoomIn :size="18" /><span>缩放</span><input class="drawing-range" :style="{ '--range-progress': `${(zoom - 100) / 2}%` }" type="range" min="100" max="300" step="10" :value="zoom" :disabled="controlsDisabled" aria-label="万花筒画纸缩放" @input="changeZoom" /><output>{{ Math.round(zoom) }}%</output></label>
        <button :disabled="controlsDisabled" :class="{ selected: panMode }" :aria-pressed="panMode" @click="panMode = !panMode"><Hand :size="18" />拖动</button>
        <button :disabled="controlsDisabled" @click="setView(100, { x: 0, y: 0 })"><RotateCcw :size="18" />复位</button>
      </div>
    </div>
    <div v-if="clearDialog" class="modal-backdrop" @click.self="clearDialog = false" @keydown.esc="clearDialog = false">
      <section v-dialog-focus class="modal" role="dialog" aria-modal="true" aria-labelledby="symmetry-clear-title">
        <span class="modal-illustration coral"><Trash2 :size="32" /></span><h2 id="symmetry-clear-title">要清空这张画纸吗？</h2><p>清空后，也可以用撤销找回这一幅图案。</p>
        <div class="modal-actions"><button class="outline-button" autofocus @click="clearDialog = false">继续画</button><button class="primary-button" :disabled="disabled" @click="clear"><Check :size="19" />确认清空</button></div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.symmetry-editor{display:flex;flex-direction:column;min-height:0;flex:1;gap:10px;color:#57714f;width:100%}
.symmetry-options{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;flex-shrink:0}
.symmetry-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.symmetry-label{display:flex;align-items:center;gap:5px;font-size:15px;margin-right:5px}
.symmetry-editor button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;min-height:44px;padding:9px 12px;border:1px solid #dce4ce;border-radius:13px;color:#5c7753;background:#fffef8;font:inherit;font-size:14px;line-height:1.4}
.symmetry-editor button.selected{background:#e4edd9;border-color:#95af7f;color:#41673f;box-shadow:inset 0 0 0 1px #adc29a}
.symmetry-editor button:hover:not(:disabled){background:#edf2e3}
.symmetry-editor button:disabled{opacity:.5;cursor:default}
.symmetry-size{display:flex;align-items:center;gap:8px;font-size:14px;white-space:nowrap}
.symmetry-size input{width:120px}
.symmetry-editor input[type=range]{min-height:44px;accent-color:#789d68;cursor:pointer}
.symmetry-editor input[type=range]:disabled{cursor:default}
.symmetry-size output{min-width:25px;text-align:center;font-variant-numeric:tabular-nums}
.symmetry-viewport{position:relative;display:flex;align-items:center;justify-content:center;flex:1;min-height:clamp(300px,55dvh,720px);overflow:hidden;border:1px solid #e1e7d4;border-radius:22px;background:#eef0e5;touch-action:none;user-select:none}
.symmetry-paper{position:relative;flex-shrink:0;transform-origin:center;background:#fff;box-shadow:0 5px 26px #4c65421a}
.symmetry-paper canvas{display:block;width:100%;height:100%;touch-action:none;cursor:crosshair}
.symmetry-paper canvas.eraser-mode{cursor:none}
.symmetry-paper canvas.pick-mode{cursor:crosshair}
.symmetry-viewport.pan-mode,.symmetry-viewport.pan-mode canvas{cursor:grab}
.symmetry-viewport.panning,.symmetry-viewport.panning canvas{cursor:grabbing}
.symmetry-guides,.symmetry-eraser{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;fill:none}
.symmetry-guides line{stroke:#a7b89a;stroke-width:1;stroke-dasharray:6 9}
.symmetry-guides circle{fill:#b5c4a8;stroke:#fff;stroke-width:2}
.symmetry-eraser circle{vector-effect:non-scaling-stroke}
.symmetry-tip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:11px;text-align:center;pointer-events:none;color:#9ba98c;width:min(270px,80%);font-size:18px}
.symmetry-tip small{font-size:13px;color:#a6b09a}
.symmetry-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;flex-shrink:0}
.symmetry-hint{font-size:13px;color:#89977b}
.symmetry-view,.symmetry-view label{display:flex;align-items:center;gap:7px}
.symmetry-view label{font-size:14px}
.symmetry-view input{width:120px}
.symmetry-view output{min-width:47px;text-align:right;font-variant-numeric:tabular-nums}
.symmetry-editor .modal-backdrop{z-index:130}
.symmetry-editor .modal-actions button{min-height:50px}
@media(max-width:740px){.symmetry-editor{gap:8px}.symmetry-options{gap:7px}.symmetry-editor button{padding:8px 10px;font-size:13px}.symmetry-label{font-size:13px}.symmetry-size{width:100%;justify-content:flex-end}.symmetry-size input{flex:1;max-width:200px}.symmetry-hint{display:none}.symmetry-bottom{justify-content:flex-end}.symmetry-view{width:100%;justify-content:flex-end;gap:5px}.symmetry-view label{flex:1;gap:5px}.symmetry-view input{min-width:55px;width:100%;flex:1}.symmetry-view label>span{display:none}.symmetry-viewport{border-radius:16px;min-height:clamp(280px,45dvh,520px)}}
</style>
