<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Check, Pipette, Replace, X } from "lucide-vue-next";

const props = defineProps<{
  color: string;
  opacity: number;
  canReplace: boolean;
  full: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  apply: [color: string, opacity: number, action: "add" | "replace"];
  pickCanvas: [];
}>();
const wheel = ref<HTMLCanvasElement>();
const hue = ref(0);
const saturation = ref(0);
const brightness = ref(100);
const opacity = ref(props.opacity);
const message = ref("");
const screenPickerSupported = !!window.EyeDropper;
let activePointer: number | undefined;

function hsvToRgb(h: number, s: number, v: number): number[] {
  const c = v * s;
  const part = h / 60;
  const x = c * (1 - Math.abs((part % 2) - 1));
  const rgb =
    part < 1
      ? [c, x, 0]
      : part < 2
        ? [x, c, 0]
        : part < 3
          ? [0, c, x]
          : part < 4
            ? [0, x, c]
            : part < 5
              ? [x, 0, c]
              : [c, 0, x];
  return rgb.map((value) => Math.round((value + v - c) * 255));
}
function setRgb(rgb: number[]) {
  const [r, g, b] = rgb.map((value) => value / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta)
    hue.value =
      ((max === r
        ? (g - b) / delta
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4) *
        60 +
        360) %
      360;
  saturation.value = max ? delta / max : 0;
  brightness.value = max * 100;
}
setRgb(
  [1, 3, 5].map((index) => parseInt(props.color.slice(index, index + 2), 16)),
);
const rgb = computed(() =>
  hsvToRgb(hue.value, saturation.value, brightness.value / 100),
);
const hex = computed(
  () =>
    "#" +
    rgb.value
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase(),
);
const marker = computed(() => ({
  left: `${50 + Math.cos((hue.value * Math.PI) / 180) * saturation.value * 48}%`,
  top: `${50 + Math.sin((hue.value * Math.PI) / 180) * saturation.value * 48}%`,
  background: hex.value,
}));

function pick(event: PointerEvent) {
  const bounds = wheel.value!.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  const y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
  hue.value = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  saturation.value = Math.min(1, Math.hypot(x, y) / 0.96);
}
function start(event: PointerEvent) {
  if (
    activePointer !== undefined ||
    (event.pointerType === "mouse" && event.button !== 0)
  )
    return;
  activePointer = event.pointerId;
  wheel.value!.setPointerCapture(event.pointerId);
  pick(event);
}
function move(event: PointerEvent) {
  if (event.pointerId === activePointer) pick(event);
}
function end(event: PointerEvent) {
  if (event.pointerId !== activePointer) return;
  activePointer = undefined;
  if (wheel.value?.hasPointerCapture(event.pointerId))
    wheel.value.releasePointerCapture(event.pointerId);
}
function keyboard(event: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
    return;
  event.preventDefault();
  if (event.key === "ArrowLeft" || event.key === "ArrowRight")
    hue.value = (hue.value + (event.key === "ArrowRight" ? 5 : -5) + 360) % 360;
  else
    saturation.value = Math.max(
      0,
      Math.min(1, saturation.value + (event.key === "ArrowUp" ? 0.05 : -0.05)),
    );
}
function updateChannel(channel: number, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (!value.trim() || !Number.isFinite(Number(value))) return;
  const next = [...rgb.value];
  next[channel] = Math.max(0, Math.min(255, Math.round(Number(value))));
  setRgb(next);
}
async function pickScreen() {
  if (!window.EyeDropper) return;
  try {
    const result = await new window.EyeDropper().open();
    setRgb(
      [1, 3, 5].map((index) =>
        parseInt(result.sRGBHex.slice(index, index + 2), 16),
      ),
    );
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError"))
      message.value = "屏幕取色暂时不可用，可以使用画布取色。";
  }
}
onMounted(() => {
  const ctx = wheel.value!.getContext("2d")!;
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const dx = x - 127.5;
      const dy = y - 127.5;
      const radius = Math.hypot(dx, dy) / 123;
      if (radius > 1) continue;
      const color = hsvToRgb(
        ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360,
        radius,
        1,
      );
      const at = (y * 256 + x) * 4;
      for (let k = 0; k < 3; k++) image.data[at + k] = color[k]!;
      image.data[at + 3] = Math.min(255, (1 - radius) * 123 * 255);
    }
  ctx.putImageData(image, 0, 0);
});
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <section
        v-dialog-focus
        class="modal color-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="color-picker-title"
      >
        <button
          class="icon-button modal-close"
          aria-label="关闭调色盘"
          @click="emit('close')"
        >
          <X :size="22" />
        </button>
        <h2 id="color-picker-title">找到你的颜色</h2>
        <p class="picker-subtitle">在圆盘上点一点，或用手指轻轻滑动</p>
        <div class="color-wheel">
          <canvas
            ref="wheel"
            width="256"
            height="256"
            tabindex="0"
            role="slider"
            aria-label="圆形调色盘"
            aria-valuemin="0"
            aria-valuemax="360"
            :aria-valuenow="Math.round(hue)"
            :aria-valuetext="hex"
            :style="{ filter: `brightness(${brightness}%)` }"
            @pointerdown="start"
            @pointermove="move"
            @pointerup="end"
            @pointercancel="end"
            @lostpointercapture="end"
            @keydown="keyboard"
          ></canvas
          ><span class="wheel-marker" :style="marker"></span>
        </div>
        <label class="picker-slider-label"
          ><span>明暗</span
          ><input
            v-model.number="brightness"
            type="range"
            min="0"
            max="100"
            step="1"
            aria-label="颜色明暗"
          /><span>{{ Math.round(brightness) }}%</span></label
        >
        <div class="rgb-inputs">
          <label v-for="(label, index) in ['R', 'G', 'B']" :key="label"
            ><span>{{ label }}</span
            ><input
              type="number"
              :aria-label="label + ' 色值'"
              min="0"
              max="255"
              step="1"
              :value="rgb[index]"
              @input="updateChannel(index, $event)"
              @change="
                ($event.target as HTMLInputElement).value = String(rgb[index])
              " /></label
          ><span class="color-preview"
            ><span :style="{ background: hex, opacity: opacity / 100 }"></span
          ></span>
        </div>
        <label class="picker-slider-label opacity-picker"
          ><span>透明度</span
          ><input
            v-model.number="opacity"
            type="range"
            min="10"
            max="100"
            step="10"
            aria-label="选色透明度"
          /><span>{{ opacity }}%</span></label
        >
        <div class="picker-tools">
          <button class="outline-button" @click="emit('pickCanvas')">
            <Pipette :size="18" />画布取色</button
          ><button
            v-if="screenPickerSupported"
            class="outline-button"
            @click="pickScreen"
          >
            <Pipette :size="18" />屏幕取色
          </button>
        </div>
        <p v-if="message" class="picker-message" role="status">{{ message }}</p>
        <p v-if="error" class="picker-message" role="alert">{{ error }}</p>
        <div class="picker-actions">
          <button
            v-if="canReplace || full"
            class="primary-button replace-color"
            @click="emit('apply', hex, opacity, 'replace')"
          >
            <Replace :size="20" />替换
          </button>
          <button
            v-if="!full"
            class="primary-button apply-color"
            @click="emit('apply', hex, opacity, 'add')"
          >
            <Check :size="20" />{{ canReplace ? "新增" : "用这个颜色" }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.color-picker-modal {
  width: 410px;
  padding: 27px 30px;
}
.color-picker-modal h2 {
  font-size: 24px;
}
.color-picker-modal .picker-subtitle {
  font-size: 12px;
  margin-top: 8px;
}
.color-wheel {
  width: 238px;
  height: 238px;
  position: relative;
  margin: 14px auto 12px;
}
.color-wheel canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  border-radius: 50%;
  cursor: crosshair;
}
.wheel-marker {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 3px solid white;
  box-shadow:
    0 0 0 1.5px #30473280,
    0 2px 6px #0003;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.picker-slider-label {
  display: flex;
  align-items: center;
  gap: 13px;
  color: #7c8c6c;
  font-size: 13px;
}
.picker-slider-label > span:last-child {
  width: 40px;
  font-size: 12px;
  text-align: right;
}
.picker-slider-label input {
  flex: 1;
  min-width: 0;
  accent-color: #6e925b;
  cursor: pointer;
  height: 30px;
}
.rgb-inputs {
  display: flex;
  align-items: end;
  gap: 11px;
  margin: 15px 0;
}
.rgb-inputs label {
  flex: 1;
  min-width: 0;
}
.rgb-inputs label span {
  display: block;
  text-align: left;
  color: #8f9a80;
  font-size: 12px;
  margin-bottom: 6px;
}
.rgb-inputs input {
  width: 100%;
  border: 1px solid #d6e1c8;
  background: #f6f8ee;
  border-radius: 11px;
  height: 42px;
  text-align: center;
  font-size: 17px;
  color: #45633e;
  padding-left: 8px;
}
.color-preview {
  background: repeating-conic-gradient(#e1e5d8 0 25%, #fff 0 50%) 50% / 12px
    12px;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #dce4d0;
  flex-shrink: 0;
}
.color-preview > span {
  display: block;
  width: 100%;
  height: 100%;
}
.picker-tools {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.picker-tools button {
  flex: 1;
  font-size: 13px;
  min-height: 42px;
  padding: 9px;
}
.picker-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}
.picker-actions button {
  flex: 1;
  min-width: 0;
  font-size: 17px;
  padding: 12px;
}
.replace-color {
  background: #e6b65e;
  color: #684818;
  box-shadow: 0 4px 0 #a47b2910;
}
.replace-color:hover:not(:disabled) {
  background: #dca84a;
  box-shadow: 0 4px 12px #a47b2920;
}
.color-picker-modal .picker-message {
  font-size: 12px;
  color: #af7b5a;
}
@media (pointer: coarse) {
  .picker-slider-label input,
  .picker-tools button {
    min-height: 44px;
  }
}
@media (max-width: 480px) {
  .color-picker-modal {
    padding: 24px;
  }
  .color-wheel {
    width: 216px;
    height: 216px;
  }
  .color-picker-modal h2 {
    font-size: 22px;
  }
  .picker-slider-label {
    font-size: 12px;
  }
  .rgb-inputs {
    gap: 8px;
  }
}
</style>
