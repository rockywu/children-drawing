<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Grip,
  ImageUp,
  Images,
  Layers2,
  MoveDiagonal2,
  X,
  ZoomIn,
} from "lucide-vue-next";
import ArtScene from "./ArtScene.vue";

const props = defineProps<{
  theme: string;
  title: string;
  disabled: boolean;
}>();
const image = defineModel<Blob>();
const tracing = defineModel<boolean>("tracing", { required: true });
const visible = ref(!!props.theme || !!image.value);
const enlarged = ref(false);
const source = ref("");
const hasReference = computed(() => !!image.value || !!props.theme);
const windowVisible = computed(() => visible.value && hasReference.value);
const fileInput = ref<HTMLInputElement>();
const uploadError = ref("");
const pos = ref({ x: 140, y: 168 });
const size = ref({ width: 236, height: 260 });
let drag:
  { id: number; x: number; y: number; left: number; top: number } | undefined;
let resize:
  | { id: number; x: number; y: number; width: number; height: number }
  | undefined;
let uploadVersion = 0;
const title = computed(() =>
  image.value ? "我的临摹图片" : props.title || "临摹小窗",
);
watch(
  image,
  (value) => {
    if (source.value) URL.revokeObjectURL(source.value);
    source.value = value ? URL.createObjectURL(value) : "";
    if (value) visible.value = true;
  },
  { immediate: true },
);
function clamp() {
  size.value = {
    width: Math.min(size.value.width, window.innerWidth - 16),
    height: Math.min(size.value.height, window.innerHeight - 104),
  };
  pos.value = {
    x: Math.max(
      8,
      Math.min(pos.value.x, window.innerWidth - size.value.width - 8),
    ),
    y: Math.max(
      88,
      Math.min(pos.value.y, window.innerHeight - size.value.height - 8),
    ),
  };
}
function startDrag(event: PointerEvent) {
  if ((event.pointerType === "mouse" && event.button !== 0) || drag || resize)
    return;
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: pos.value.x,
    top: pos.value.y,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function moveDrag(event: PointerEvent) {
  if (drag?.id !== event.pointerId) return;
  pos.value = {
    x: drag.left + event.clientX - drag.x,
    y: drag.top + event.clientY - drag.y,
  };
  clamp();
}
function endDrag() {
  drag = undefined;
}
function startResize(event: PointerEvent) {
  if ((event.pointerType === "mouse" && event.button !== 0) || resize || drag)
    return;
  resize = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    ...size.value,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function setSize(width: number, height: number) {
  size.value = {
    width: Math.max(164, Math.min(width, window.innerWidth - pos.value.x - 8)),
    height: Math.max(
      216,
      Math.min(height, window.innerHeight - pos.value.y - 8),
    ),
  };
  clamp();
}
function moveResize(event: PointerEvent) {
  if (resize?.id !== event.pointerId) return;
  setSize(
    resize.width + event.clientX - resize.x,
    resize.height + event.clientY - resize.y,
  );
}
function endResize() {
  resize = undefined;
}
function keyResize(event: KeyboardEvent) {
  const delta: Record<string, [number, number]> = {
    ArrowRight: [20, 0],
    ArrowLeft: [-20, 0],
    ArrowDown: [0, 20],
    ArrowUp: [0, -20],
  };
  const step = delta[event.key];
  if (step) {
    event.preventDefault();
    setSize(size.value.width + step[0], size.value.height + step[1]);
  }
}
function toggle() {
  if (!hasReference.value) fileInput.value?.click();
  else visible.value = !visible.value;
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || props.disabled) return;
  const version = ++uploadVersion;
  uploadError.value = "";
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
    uploadError.value = "请选择 20MB 以内的图片。";
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const preview = new Image();
    preview.src = url;
    await preview.decode();
    if (version !== uploadVersion || props.disabled) return;
    if (preview.naturalWidth * preview.naturalHeight > 25000000)
      throw new Error("large image");
    image.value = file;
    visible.value = true;
    clamp();
  } catch {
    if (version === uploadVersion)
      uploadError.value =
        "这张图片暂时打不开，请换一张 JPG、PNG 或 WebP 图片。";
  } finally {
    URL.revokeObjectURL(url);
  }
}
onMounted(() => {
  clamp();
  window.addEventListener("resize", clamp);
});
onBeforeUnmount(() => {
  uploadVersion++;
  if (source.value) URL.revokeObjectURL(source.value);
  window.removeEventListener("resize", clamp);
});
</script>

<template>
  <div class="reference-tools">
    <button
      class="history-button"
      :class="{ selected: windowVisible }"
      aria-label="显示或隐藏临摹小窗"
      :aria-pressed="windowVisible"
      :disabled="disabled && !hasReference"
      @click="toggle"
    >
      <Images :size="20" /><span>临摹</span>
    </button>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="reference-file"
      aria-label="选择临摹图片文件"
      @change="upload"
    />
    <p v-if="uploadError" class="reference-upload-error" role="alert">
      {{ uploadError
      }}<button aria-label="关闭图片错误提示" @click="uploadError = ''">
        <X :size="17" />
      </button>
    </p>
  </div>
  <section
    v-if="windowVisible"
    class="reference-float"
    :style="{
      left: pos.x + 'px',
      top: pos.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px',
    }"
    aria-label="临摹图片小窗"
  >
    <header>
      <button
        class="reference-drag"
        aria-label="拖动临摹小窗"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
      >
        <Grip :size="18" /><span>临摹小窗</span>
      </button>
      <button
        class="icon-button reference-replace"
        aria-label="替换临摹图片"
        title="替换上传临摹图片"
        :disabled="disabled"
        @click="fileInput?.click()"
      >
        <ImageUp :size="20" />
      </button>
      <button
        class="icon-button"
        aria-label="收起临摹小窗"
        @click="visible = false"
      >
        <X :size="18" />
      </button>
    </header>
    <button
      class="reference-thumbnail"
      aria-label="放大查看临摹图片"
      @click="enlarged = true"
    >
      <img v-if="source" :src="source" :alt="title" @load="clamp" /><ArtScene
        v-else
        :kind="theme"
      /><span><ZoomIn :size="16" />点击放大</span>
    </button>
    <p>{{ title }}</p>
    <footer class="reference-actions">
      <button
        class="reference-trace-toggle"
        :aria-label="tracing ? '移除画布底图' : '铺到画布临摹'"
        :class="{ selected: tracing }"
        :aria-pressed="tracing"
        :disabled="disabled"
        @click="tracing = !tracing"
      >
        <Layers2 /><span>{{ tracing ? "移除底图" : "铺到画布" }}</span>
      </button>
    </footer>
    <button
      class="reference-resize"
      aria-label="调整临摹窗口大小"
      title="拖动调整大小，方向键也可以调整"
      @pointerdown.stop="startResize"
      @pointermove.stop="moveResize"
      @pointerup.stop="endResize"
      @pointercancel.stop="endResize"
      @lostpointercapture="endResize"
      @keydown="keyResize"
    >
      <MoveDiagonal2 :size="16" />
    </button>
  </section>
  <Teleport to="body">
    <div
      v-if="enlarged"
      class="modal-backdrop reference-backdrop"
      @click.self="enlarged = false"
      @keydown.esc="enlarged = false"
    >
      <section
        v-dialog-focus
        class="reference-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-viewer-title"
      >
        <header>
          <h2 id="reference-viewer-title">{{ title }}</h2>
          <button
            autofocus
            class="icon-button"
            aria-label="关闭临摹大图"
            @click="enlarged = false"
          >
            <X :size="24" />
          </button>
        </header>
        <img v-if="source" :src="source" :alt="title" /><ArtScene
          v-else
          :kind="theme"
        />
        <p>看看细节，再回画布试一试。</p>
      </section>
    </div>
  </Teleport>
</template>
