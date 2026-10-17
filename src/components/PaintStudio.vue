<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  Circle,
  Diamond,
  Droplets,
  Eraser,
  Hand,
  Heart,
  Hexagon,
  LoaderCircle,
  Minus,
  PaintBucket,
  Paintbrush,
  Pentagon,
  Redo2,
  RotateCw,
  Save,
  Shapes,
  Smile,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Triangle,
  Undo2,
  ZoomIn,
} from "lucide-vue-next";
import StudioPanel from "./StudioPanel.vue";
import FloatingReference from "./FloatingReference.vue";
import ArtScene from "./ArtScene.vue";
import ColorPalette from "./ColorPalette.vue";
import FullscreenButton from "./FullscreenButton.vue";
import { saveArtwork } from "../storage";
import { createArtworkId } from "../artworkId";
import type { Artwork } from "../storage";
import { fillRegion } from "../fill";

const props = defineProps<{ artwork?: Artwork; theme: string }>();
const emit = defineEmits<{ back: []; saved: [] }>();
type Tool =
  "brush" | "marker" | "eraser" | "fill" | "shape" | "sticker" | "eyedropper";
type Point = { x: number; y: number };
const WIDTH = ref(props.artwork?.width ?? 1000);
const HEIGHT = ref(props.artwork?.height ?? (props.artwork ? 680 : 750));
const ratios = [
  "1:1",
  "9:16",
  "16:9",
  "5:4",
  "4:5",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
];
const selectedRatio = computed(
  () =>
    ratios.find((value) => {
      const [w, h] = value.split(":").map(Number);
      return Math.abs(WIDTH.value / HEIGHT.value - w! / h!) < 0.002;
    }) ?? "original",
);
const panelPinned = ref(false);
const panel = ref<InstanceType<typeof StudioPanel>>();
const referenceImage = ref<Blob | undefined>(props.artwork?.referenceImage);
const tracing = ref(props.artwork?.tracing ?? false);
const savedTracing = ref(tracing.value);
const referenceSource = ref("");
watch(
  referenceImage,
  (value) => {
    if (referenceSource.value) URL.revokeObjectURL(referenceSource.value);
    referenceSource.value = value ? URL.createObjectURL(value) : "";
  },
  { immediate: true },
);
const referenceModified = ref(false);
watch(referenceImage, () => {
  referenceModified.value = true;
});
const canvas = ref<HTMLCanvasElement>();
const canvasHolder = ref<HTMLDivElement>();
const canvasPaper = ref<HTMLDivElement>();
const zoom = ref(100);
const pan = ref<Point>({ x: 0, y: 0 });
const panMode = ref(false);
const panning = ref(false);
const touches = new Map<number, Point>();
let panPointer: { id: number; point: Point } | undefined;
let pinch:
  { distance: number; midpoint: Point; zoom: number; pan: Point } | undefined;
let pinching = false;
let pendingTouch: number | undefined;
let viewObserver: ResizeObserver | undefined;
const tool = ref<Tool>("brush");
const color = ref("#3F6956");
const customColorSelected = ref(false);
const opacity = ref(100);
const size = ref(10);
const eraserDiameter = computed(() => size.value * 2.5);
const eraserPoint = ref<Point>();
const customSize = ref(16);
const customSizeSelected = ref(false);
function changeSize(event: Event) {
  customSize.value = Number((event.target as HTMLInputElement).value);
  customSizeSelected.value = true;
  size.value = customSize.value;
}
const shapeOptions = [
  { id: "circle", label: "椭圆", icon: Circle },
  { id: "square", label: "长方形", icon: Square },
  { id: "line", label: "直线", icon: Minus },
  { id: "triangle", label: "三角形", icon: Triangle },
  { id: "star", label: "五角星", icon: Star },
  { id: "heart", label: "爱心", icon: Heart },
  { id: "diamond", label: "菱形", icon: Diamond },
  { id: "pentagon", label: "五边形", icon: Pentagon },
  { id: "hexagon", label: "六边形", icon: Hexagon },
] as const;
const shape = ref<(typeof shapeOptions)[number]["id"]>("circle");
const sticker = ref("🌼");
const stickers = [
  "🌼",
  "🌈",
  "⭐",
  "🦋",
  "🌱",
  "🍄",
  "🐰",
  "🐱",
  "🐳",
  "🚀",
  "❤️",
  "☁️",
];
const themeNames: Record<string, string> = {
  garden: "森林里的小伙伴",
  space: "宇宙奇妙旅行",
  ocean: "海底的秘密",
  magic: "住进童话里",
};
const name = ref(
  props.artwork?.name ?? (themeNames[props.theme] || "我的奇妙世界"),
);
const savedName = ref(name.value);
const id = props.artwork?.id ?? createArtworkId();
const saving = ref(false);
const loading = ref(true);
const showTip = ref(true);
const notice = ref("");
const error = ref("");
const loadError = ref(false);
const dialog = ref<"leave" | "clear" | "refresh">();
const history = ref<ImageData[]>([]);
const position = ref(-1);
const savedSnapshot = ref<ImageData>();
let pointerId: number | undefined;
let points: Point[] = [];
let baseline: ImageData | undefined;
let noticeTimer: ReturnType<typeof setTimeout>;
const hasSaved = ref(!!props.artwork);
const modified = ref(false);
const dirty = computed(
  () =>
    modified.value ||
    referenceModified.value ||
    tracing.value !== savedTracing.value ||
    name.value !== savedName.value,
);
const canUndo = computed(() => position.value > 0);
const canRedo = computed(() => position.value < history.value.length - 1);
const tools = [
  { id: "brush" as Tool, label: "画笔", icon: Paintbrush },
  { id: "marker" as Tool, label: "彩色笔", icon: Droplets },
  { id: "eraser" as Tool, label: "橡皮", icon: Eraser },
  { id: "fill" as Tool, label: "涂色桶", icon: PaintBucket },
  { id: "shape" as Tool, label: "形状", icon: Shapes },
  { id: "sticker" as Tool, label: "贴纸", icon: Smile },
];
const activeToolLabel = computed(() =>
  panMode.value
    ? "拖动画布"
    : tool.value === "eyedropper"
      ? "画布取色"
      : tools.find((item) => item.id === tool.value)?.label,
);
const toolHint = computed(() =>
  panMode.value
    ? "按住画布拖动，再点手掌按钮继续画画"
    : {
        brush: "按住鼠标或用手指，画下你的想象",
        marker: "半透明的彩色笔，叠出新的颜色",
        eraser: "轻轻擦掉不想要的地方",
        fill: "点一下，把连在一起的区域涂上颜色",
        shape: "按住并拖动，画一个形状",
        sticker: "选一个贴纸，再点一下画布",
        eyedropper: "点一下画布，取出你喜欢的颜色",
      }[tool.value],
);

function context() {
  return canvas.value!.getContext("2d", { willReadFrequently: true })!;
}
function announce(message: string) {
  notice.value = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = "";
  }, 2800);
}

function checkpoint() {
  const image = context().getImageData(0, 0, WIDTH.value, HEIGHT.value);
  history.value = history.value.slice(0, position.value + 1);
  history.value.push(image);
  if (history.value.length > 16) history.value.shift();
  position.value = history.value.length - 1;
  modified.value = image !== savedSnapshot.value;
}

async function undo() {
  if (
    canUndo.value &&
    !saving.value &&
    !loading.value &&
    pointerId === undefined
  ) {
    position.value--;
    await restoreSnapshot(history.value[position.value]!);
    modified.value = history.value[position.value] !== savedSnapshot.value;
  }
}
async function redo() {
  if (
    canRedo.value &&
    !saving.value &&
    !loading.value &&
    pointerId === undefined
  ) {
    position.value++;
    await restoreSnapshot(history.value[position.value]!);
    modified.value = history.value[position.value] !== savedSnapshot.value;
  }
}
async function restoreSnapshot(image: ImageData) {
  const resized = WIDTH.value !== image.width || HEIGHT.value !== image.height;
  loading.value = true;
  eraserPoint.value = undefined;
  WIDTH.value = image.width;
  HEIGHT.value = image.height;
  await nextTick();
  if (!canvas.value) return;
  context().clearRect(0, 0, WIDTH.value, HEIGHT.value);
  context().putImageData(image, 0, 0);
  if (resized) setView(100, { x: 0, y: 0 });
  loading.value = false;
}
async function changeRatio(event: Event) {
  if (
    loading.value ||
    saving.value ||
    pointerId !== undefined ||
    touches.size ||
    loadError.value
  )
    return;
  const value = (event.target as HTMLSelectElement).value;
  if (!ratios.includes(value)) return;
  const [w, h] = value.split(":").map(Number);
  const width = Math.round(1000 * Math.min(1, w! / h!));
  const height = Math.round(1000 * Math.min(1, h! / w!));
  if (width === WIDTH.value && height === HEIGHT.value) return;
  const original = document.createElement("canvas");
  original.width = WIDTH.value;
  original.height = HEIGHT.value;
  original.getContext("2d")!.drawImage(canvas.value!, 0, 0);
  loading.value = true;
  eraserPoint.value = undefined;
  WIDTH.value = width;
  HEIGHT.value = height;
  await nextTick();
  if (!canvas.value) return;
  const scale = Math.min(width / original.width, height / original.height);
  const dw = original.width * scale,
    dh = original.height * scale;
  context().drawImage(original, (width - dw) / 2, (height - dh) / 2, dw, dh);
  checkpoint();
  setView(100, { x: 0, y: 0 });
  loading.value = false;
  announce("画纸比例已调整，原来的笔迹完整保留；可撤销");
}
function chooseTool(value: Tool) {
  tool.value = value;
  panMode.value = false;
  if (value === "shape" || value === "sticker") panel.value?.open();
}

function getPoint(event: PointerEvent): Point {
  const box = canvas.value!.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        WIDTH.value - 1,
        ((event.clientX - box.left) * WIDTH.value) / box.width,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        HEIGHT.value - 1,
        ((event.clientY - box.top) * HEIGHT.value) / box.height,
      ),
    ),
  };
}

function setView(percent: number, offset: Point) {
  zoom.value = Math.max(100, Math.min(300, percent));
  const holder = canvasHolder.value!;
  const paper = canvasPaper.value!;
  const limitX = Math.max(
    0,
    ((paper.offsetWidth * zoom.value) / 100 - holder.clientWidth) / 2,
  );
  const limitY = Math.max(
    0,
    ((paper.offsetHeight * zoom.value) / 100 - holder.clientHeight) / 2,
  );
  pan.value = {
    x: Math.max(-limitX, Math.min(limitX, offset.x)),
    y: Math.max(-limitY, Math.min(limitY, offset.y)),
  };
}
function changeZoom(event: Event) {
  const percent = Number((event.target as HTMLInputElement).value);
  const ratio = percent / zoom.value;
  setView(percent, { x: pan.value.x * ratio, y: pan.value.y * ratio });
}
function touchGeometry() {
  const [first, second] = [...touches.values()] as [Point, Point];
  const box = canvasHolder.value!.getBoundingClientRect();
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    midpoint: {
      x: (first.x + second.x) / 2 - box.left - box.width / 2,
      y: (first.y + second.y) / 2 - box.top - box.height / 2,
    },
  };
}
function cancelStroke() {
  if (baseline) context().putImageData(baseline, 0, 0);
  pointerId = undefined;
  baseline = undefined;
  points = [];
}
function updateEraser(event: PointerEvent) {
  if (tool.value !== "eraser" || panMode.value || panning.value) {
    eraserPoint.value = undefined;
    return;
  }
  const box = canvas.value!.getBoundingClientRect();
  const inside =
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom;
  eraserPoint.value =
    inside || pointerId === event.pointerId ? getPoint(event) : undefined;
}
function pointerDown(event: PointerEvent) {
  if (
    loading.value ||
    saving.value ||
    loadError.value ||
    (event.pointerType === "mouse" && event.button !== 0)
  )
    return;
  updateEraser(event);
  const point = { x: event.clientX, y: event.clientY };
  if (event.pointerType === "touch") {
    touches.set(event.pointerId, point);
    canvasHolder.value!.setPointerCapture(event.pointerId);
    if (touches.size >= 2) {
      cancelStroke();
      pendingTouch = undefined;
      panPointer = undefined;
      pinching = true;
      panning.value = true;
      pinch = { ...touchGeometry(), zoom: zoom.value, pan: { ...pan.value } };
      return;
    }
    if (pinching) return;
  }
  if (pointerId !== undefined || panPointer) return;
  if (panMode.value) {
    panPointer = { id: event.pointerId, point };
    panning.value = true;
    canvasHolder.value!.setPointerCapture(event.pointerId);
    return;
  }
  if (event.target !== canvas.value) return;
  canvasHolder.value!.setPointerCapture(event.pointerId);
  // Defer one-tap tools until release so a second finger cannot fill or stamp.
  if (
    event.pointerType === "touch" &&
    ["fill", "sticker", "eyedropper"].includes(tool.value)
  ) {
    pendingTouch = event.pointerId;
    return;
  }
  startDrawing(event);
}
function pointerMove(event: PointerEvent) {
  updateEraser(event);
  if (touches.has(event.pointerId)) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  if (pinching) {
    if (!pinch || touches.size < 2) return;
    const current = touchGeometry();
    const percent = Math.max(
      100,
      Math.min(300, (pinch.zoom * current.distance) / pinch.distance),
    );
    const ratio = percent / pinch.zoom;
    setView(percent, {
      x: current.midpoint.x - (pinch.midpoint.x - pinch.pan.x) * ratio,
      y: current.midpoint.y - (pinch.midpoint.y - pinch.pan.y) * ratio,
    });
    return;
  }
  if (panPointer?.id === event.pointerId) {
    setView(zoom.value, {
      x: pan.value.x + event.clientX - panPointer.point.x,
      y: pan.value.y + event.clientY - panPointer.point.y,
    });
    panPointer.point = { x: event.clientX, y: event.clientY };
    return;
  }
  moveDrawing(event);
}
function pointerEnd(event: PointerEvent) {
  if (event.pointerType === "touch" || event.type === "pointercancel")
    eraserPoint.value = undefined;
  touches.delete(event.pointerId);
  if (pinching) {
    pinch =
      touches.size >= 2
        ? { ...touchGeometry(), zoom: zoom.value, pan: { ...pan.value } }
        : undefined;
    if (!touches.size) {
      pinching = false;
      panning.value = false;
    }
  } else if (panPointer?.id === event.pointerId) {
    panPointer = undefined;
    panning.value = false;
  } else {
    if (pendingTouch === event.pointerId) {
      pendingTouch = undefined;
      if (event.type === "pointerup") startDrawing(event);
    }
    endDrawing(event);
  }
  if (canvasHolder.value?.hasPointerCapture(event.pointerId))
    canvasHolder.value.releasePointerCapture(event.pointerId);
}

function drawPath() {
  if (!baseline || !points.length) return;
  const ctx = context();
  ctx.putImageData(baseline, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation =
    tool.value === "eraser" ? "destination-out" : "source-over";
  ctx.globalAlpha =
    ((tool.value === "marker" ? 0.38 : 1) * opacity.value) / 100;
  ctx.strokeStyle = color.value;
  ctx.fillStyle = color.value;
  ctx.lineWidth =
    tool.value === "eraser"
      ? eraserDiameter.value
      : tool.value === "marker"
        ? size.value * 2
        : size.value;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  ctx.beginPath();
  if (tool.value === "shape") {
    if (shape.value === "circle") {
      const rx = Math.abs(last.x - first.x) / 2;
      const ry = Math.abs(last.y - first.y) / 2;
      ctx.ellipse(
        (first.x + last.x) / 2,
        (first.y + last.y) / 2,
        Math.max(rx, 0.1),
        Math.max(ry, 0.1),
        0,
        0,
        Math.PI * 2,
      );
    } else if (shape.value === "square")
      ctx.rect(first.x, first.y, last.x - first.x, last.y - first.y);
    else if (shape.value === "line") {
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
    } else {
      const left = Math.min(first.x, last.x);
      const top = Math.min(first.y, last.y);
      const width = Math.abs(last.x - first.x);
      const height = Math.abs(last.y - first.y);
      const cx = left + width / 2;
      const cy = top + height / 2;
      if (shape.value === "heart") {
        ctx.moveTo(cx, top + height * 0.25);
        ctx.bezierCurveTo(
          cx - width * 0.3,
          top - height * 0.1,
          left,
          top,
          left,
          top + height * 0.3,
        );
        ctx.bezierCurveTo(
          left,
          top + height * 0.6,
          cx - width * 0.1,
          top + height * 0.9,
          cx,
          top + height,
        );
        ctx.bezierCurveTo(
          cx + width * 0.1,
          top + height * 0.9,
          left + width,
          top + height * 0.6,
          left + width,
          top + height * 0.3,
        );
        ctx.bezierCurveTo(
          left + width,
          top,
          cx + width * 0.3,
          top - height * 0.1,
          cx,
          top + height * 0.25,
        );
      } else if (shape.value === "triangle") {
        ctx.moveTo(cx, top);
        ctx.lineTo(left + width, top + height);
        ctx.lineTo(left, top + height);
      } else {
        const sides = { star: 10, diamond: 4, pentagon: 5, hexagon: 6 }[
          shape.value
        ];
        for (let i = 0; i < sides; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / sides;
          const radius = shape.value === "star" && i % 2 ? 0.45 : 1;
          const x = cx + Math.cos(angle) * width * 0.5 * radius;
          const y = cy + Math.sin(angle) * height * 0.5 * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
    }
    ctx.stroke();
  } else if (
    points.every(
      (point) => Math.hypot(point.x - first.x, point.y - first.y) < 0.25,
    )
  ) {
    ctx.arc(first.x, first.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i]!;
      const next = points[i + 1]!;
      ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
    }
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.restore();
}

function fillAt(point: Point) {
  const ctx = context();
  const image = ctx.getImageData(0, 0, WIDTH.value, HEIGHT.value);
  if (fillRegion(image, point.x, point.y, color.value, opacity.value / 100)) {
    ctx.putImageData(image, 0, 0);
    checkpoint();
  }
}

function startDrawing(event: PointerEvent) {
  if (
    loading.value ||
    saving.value ||
    loadError.value ||
    pointerId !== undefined ||
    (event.pointerType === "mouse" && event.button !== 0)
  )
    return;
  showTip.value = false;
  error.value = "";
  const point = getPoint(event);
  if (tool.value === "eyedropper") {
    customColorSelected.value = false;
    const pixel = context().getImageData(
      Math.floor(point.x),
      Math.floor(point.y),
      1,
      1,
    ).data;
    color.value = pixel[3]
      ? "#" +
        [pixel[0]!, pixel[1]!, pixel[2]!]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      : "#FFFFFF";
    opacity.value = pixel[3]
      ? Math.max(10, Math.round((pixel[3]! / 255) * 10) * 10)
      : 100;
    tool.value = "brush";
    announce("已取到颜色，可以继续画啦");
    return;
  }
  if (tool.value === "fill") {
    fillAt(point);
    return;
  }
  if (tool.value === "sticker") {
    const ctx = context();
    ctx.save();
    ctx.globalAlpha = opacity.value / 100;
    ctx.font = `${size.value * 3 + 28}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sticker.value, point.x, point.y);
    ctx.restore();
    checkpoint();
    return;
  }
  pointerId = event.pointerId;
  baseline = context().getImageData(0, 0, WIDTH.value, HEIGHT.value);
  points = [point];
  drawPath();
}
function moveDrawing(event: PointerEvent) {
  if (pointerId !== event.pointerId) return;
  points.push(getPoint(event));
  drawPath();
}
function endDrawing(event: PointerEvent) {
  if (pointerId !== event.pointerId) return;
  if (event.type !== "pointerup") {
    cancelStroke();
    return;
  }
  points.push(getPoint(event));
  drawPath();
  pointerId = undefined;
  checkpoint();
  baseline = undefined;
  points = [];
}

function flattened() {
  const output = document.createElement("canvas");
  output.width = WIDTH.value;
  output.height = HEIGHT.value;
  const ctx = output.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, WIDTH.value, HEIGHT.value);
  ctx.drawImage(canvas.value!, 0, 0);
  return output;
}

async function save() {
  if (
    saving.value ||
    loading.value ||
    loadError.value ||
    pointerId !== undefined
  )
    return false;
  saving.value = true;
  error.value = "";
  try {
    const output = flattened();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.value!.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("图片生成失败"))),
        "image/png",
      ),
    );
    const thumbnail = document.createElement("canvas");
    thumbnail.width = Math.round(400 * Math.min(1, WIDTH.value / HEIGHT.value));
    thumbnail.height = Math.round(
      400 * Math.min(1, HEIGHT.value / WIDTH.value),
    );
    thumbnail
      .getContext("2d")!
      .drawImage(output, 0, 0, thumbnail.width, thumbnail.height);
    const artwork: Artwork = {
      id,
      name: name.value.trim() || "我的奇妙世界",
      updated: Date.now(),
      image: blob,
      thumbnail: thumbnail.toDataURL("image/png"),
      theme: props.theme,
      width: WIDTH.value,
      height: HEIGHT.value,
      referenceImage: referenceImage.value,
      tracing: tracing.value,
    };
    await saveArtwork(artwork);
    name.value = artwork.name;
    savedName.value = artwork.name;
    savedSnapshot.value = history.value[position.value];
    modified.value = false;
    referenceModified.value = false;
    savedTracing.value = tracing.value;
    hasSaved.value = true;
    announce("作品已收藏到作品小屋");
    emit("saved");
    return true;
  } catch {
    error.value =
      "保存没有成功，画还在这里。请再试一次，或先下载 PNG 留个备份。";
    return false;
  } finally {
    saving.value = false;
  }
}

async function download() {
  if (loading.value || loadError.value) return;
  const blob = await new Promise<Blob | null>((resolve) =>
    flattened().toBlob(resolve, "image/png"),
  );
  if (!blob) {
    error.value = "图片没有生成成功，请再试一次。";
    return;
  }
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${name.value.trim() || "我的奇妙世界"}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  announce("PNG 下载已开始，记得也点一下保存作品");
}

function requestBack() {
  if (dirty.value) dialog.value = "leave";
  else emit("back");
}
async function saveAndLeave() {
  if (await save()) {
    dialog.value = undefined;
    emit("back");
  }
}
async function saveAndRefresh() {
  if (await save()) {
    dialog.value = undefined;
    window.location.reload();
  }
}
function clear() {
  context().clearRect(0, 0, WIDTH.value, HEIGHT.value);
  checkpoint();
  dialog.value = undefined;
  announce("画布已清空，也可以点撤销找回来");
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value || pointerId !== undefined) {
    event.preventDefault();
    event.returnValue = "";
  }
}
function keydown(event: KeyboardEvent) {
  if (
    event.key === "F5" ||
    ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")
  ) {
    if (dirty.value || saving.value || pointerId !== undefined) {
      event.preventDefault();
      dialog.value = "refresh";
    }
    return;
  }
  if (
    (event.target as HTMLElement)?.matches("input, textarea, select") ||
    dialog.value ||
    loading.value
  )
    return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void save();
  }
}

onMounted(async () => {
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("keydown", keydown);
  await nextTick();
  viewObserver = new ResizeObserver(() => setView(zoom.value, pan.value));
  viewObserver.observe(canvasHolder.value!);
  viewObserver.observe(canvasPaper.value!);
  if (props.artwork) {
    const url = URL.createObjectURL(props.artwork.image);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!canvas.value) return;
      context().clearRect(0, 0, WIDTH.value, HEIGHT.value);
      context().drawImage(image, 0, 0, WIDTH.value, HEIGHT.value);
      showTip.value = false;
    } catch {
      loadError.value = true;
      error.value = "这幅作品没有打开成功，请返回画室再试。原作品没有被修改。";
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!canvas.value) return;
  checkpoint();
  savedSnapshot.value = history.value[0];
  modified.value = false;
  loading.value = false;
});
onBeforeUnmount(() => {
  if (referenceSource.value) URL.revokeObjectURL(referenceSource.value);
  viewObserver?.disconnect();
  window.removeEventListener("beforeunload", beforeUnload);
  window.removeEventListener("keydown", keydown);
  clearTimeout(noticeTimer);
});
</script>

<template>
  <div class="studio">
    <header class="studio-header">
      <button class="back-button" :disabled="saving" @click="requestBack">
        <ArrowLeft :size="22" /><span>我的画室</span></button
      ><span class="header-divider"></span>
      <div class="drawing-title">
        <input
          v-model="name"
          maxlength="30"
          aria-label="作品名称"
          :disabled="saving || loading"
        /><span :class="{ unsaved: dirty }"
          ><span></span
          >{{
            saving
              ? "正在保存…"
              : dirty
                ? "有新的创意还未保存"
                : hasSaved
                  ? "作品已保存"
                  : "新画布，尽情发挥吧"
          }}</span
        >
      </div>
      <div class="studio-header-actions">
        <FullscreenButton />
        <button
          class="outline-button download-button"
          :disabled="loading || loadError"
          @click="download"
        >
          <ArrowDownToLine :size="20" /><span>下载 PNG</span></button
        ><button
          class="primary-button"
          :disabled="saving || loading || loadError"
          @click="save"
        >
          <LoaderCircle v-if="saving" class="spin" :size="21" /><Save
            v-else
            :size="21"
          />{{ saving ? "正在保存" : "保存作品" }}
        </button>
      </div>
    </header>

    <div class="studio-body" :class="{ 'settings-pinned': panelPinned }">
      <aside class="drawing-tools">
        <div class="tools-caption">画画工具</div>
        <button
          v-for="item in tools"
          :key="item.id"
          :class="['tool-button', { selected: !panMode && tool === item.id }]"
          :aria-pressed="!panMode && tool === item.id"
          :disabled="loading || loadError"
          @click="chooseTool(item.id)"
        >
          <component :is="item.icon" :size="26" :stroke-width="1.7" /><span>{{
            item.label
          }}</span>
        </button>
      </aside>

      <main class="drawing-workspace">
        <div class="canvas-topbar">
          <div class="history-buttons">
            <button
              class="history-button"
              aria-label="撤销上一笔"
              :disabled="!canUndo || saving"
              title="撤销（⌘ / Ctrl + Z）"
              @click="undo"
            >
              <Undo2 :size="22" /><span>撤销</span></button
            ><button
              class="history-button"
              aria-label="重做上一笔"
              :disabled="!canRedo || saving"
              title="重做（⌘ / Ctrl + Shift + Z）"
              @click="redo"
            >
              <Redo2 :size="22" /><span>重做</span>
            </button>
          </div>
          <label class="canvas-ratio"
            ><span>画纸比例</span
            ><select
              aria-label="画纸比例"
              :value="selectedRatio"
              :disabled="loading || saving || loadError"
              @change="changeRatio"
            >
              <option v-if="selectedRatio === 'original'" value="original">
                原画纸
              </option>
              <option v-for="ratio in ratios" :key="ratio" :value="ratio">
                {{ ratio }}
              </option>
            </select></label
          >
          <FloatingReference
            v-model="referenceImage"
            v-model:tracing="tracing"
            :theme="theme"
            :title="themeNames[theme] || ''"
            :disabled="saving || loading || loadError"
          /><button
            class="history-button clear-button"
            :disabled="loading || saving || loadError"
            @click="dialog = 'clear'"
          >
            <Trash2 :size="19" /><span>清空</span>
          </button>
        </div>
        <div
          ref="canvasHolder"
          class="canvas-holder"
          :class="{ 'pan-mode': panMode, panning }"
          @pointerdown="pointerDown"
          @pointermove="pointerMove"
          @pointerup="pointerEnd"
          @pointercancel="pointerEnd"
          @lostpointercapture="pointerEnd"
          @pointerleave="eraserPoint = undefined"
        >
          <div
            ref="canvasPaper"
            class="canvas-paper"
            :style="{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
              '--paper-ratio': WIDTH / HEIGHT,
              aspectRatio: `${WIDTH} / ${HEIGHT}`,
            }"
          >
            <div
              v-if="tracing && (referenceSource || theme)"
              class="canvas-reference-underlay"
              aria-hidden="true"
            >
              <img
                v-if="referenceSource"
                :src="referenceSource"
                alt=""
              /><ArtScene v-else :kind="theme" />
            </div>
            <canvas
              ref="canvas"
              :width="WIDTH"
              :height="HEIGHT"
              :class="{
                'eraser-cursor': tool === 'eraser',
                'brush-cursor': tool === 'brush' || tool === 'marker',
                'stamp-cursor': tool === 'sticker',
                'fill-cursor': tool === 'fill',
              }"
              aria-label="绘画画布，使用鼠标或手指绘画"
            ></canvas>
            <svg
              v-if="
                eraserPoint &&
                tool === 'eraser' &&
                !panMode &&
                !panning &&
                !loading &&
                !loadError
              "
              class="eraser-outline"
              aria-hidden="true"
              viewBox="0 0 100 100"
              :style="{
                left: `${(eraserPoint.x / WIDTH) * 100}%`,
                top: `${(eraserPoint.y / HEIGHT) * 100}%`,
                width: `${(eraserDiameter / WIDTH) * 100}%`,
              }"
            >
              <circle
                cx="50"
                cy="50"
                r="50"
                fill="none"
                stroke="white"
                stroke-width="3"
                vector-effect="non-scaling-stroke"
              />
              <circle
                cx="50"
                cy="50"
                r="50"
                fill="none"
                stroke="#314d3d"
                stroke-width="1"
                vector-effect="non-scaling-stroke"
              />
            </svg>
            <div v-if="loading" class="canvas-loading">
              <LoaderCircle class="spin" :size="32" />正在展开画纸…
            </div>
            <div v-else-if="showTip && !tracing" class="canvas-first-tip">
              <span>✧</span>
              <p>第一笔，从哪里开始都可以</p>
              <small>选好喜欢的颜色，画画看吧</small>
            </div>
          </div>
        </div>
        <div class="canvas-view-controls" aria-label="画布查看工具">
          <label class="canvas-zoom">
            <ZoomIn :size="20" /><span>缩放</span>
            <input
              class="drawing-range"
              type="range"
              min="100"
              max="300"
              step="10"
              :value="zoom"
              :style="{ '--range-progress': `${(zoom - 100) / 2}%` }"
              aria-label="画布缩放"
              title="100%～300%"
              @input="changeZoom"
            />
            <output>{{ Math.round(zoom) }}%</output>
          </label>
          <button
            :class="['canvas-pan-toggle', { selected: panMode }]"
            :aria-pressed="panMode"
            aria-label="拖动画布"
            :title="panMode ? '取消拖拽模式，继续画画' : '开启拖拽模式'"
            @click="panMode = !panMode"
          >
            <Hand :size="21" /><span>拖动</span>
          </button>
        </div>
        <div class="canvas-bottom">
          <span>{{ toolHint }}</span
          ><span
            >{{ WIDTH }} × {{ HEIGHT }}
            <span class="paper-size">· 自由画纸</span></span
          >
        </div>
        <p v-if="error" class="studio-error" role="alert">{{ error }}</p>
      </main>

      <StudioPanel ref="panel" v-model:pinned="panelPinned">
        <ColorPalette
          v-model="color"
          v-model:custom-selected="customColorSelected"
          v-model:opacity="opacity"
          @pick-canvas="
            tool = 'eyedropper';
            panMode = false;
          "
        />
        <section class="option-section size-section">
          <h2>
            {{ tool === "sticker" ? "贴纸大小" : "画笔粗细"
            }}<span class="size-preview">{{ size }}</span>
          </h2>
          <div class="size-choices">
            <button
              v-for="value in [4, 10, 20]"
              :key="value"
              :class="{ selected: !customSizeSelected && size === value }"
              :aria-label="'选择粗细 ' + value"
              :aria-pressed="!customSizeSelected && size === value"
              @click="
                size = value;
                customSizeSelected = false;
              "
            >
              <span
                :style="{
                  width: value * 0.55 + 4 + 'px',
                  height: value * 0.55 + 4 + 'px',
                }"
              ></span>
            </button>
            <button
              :class="{ selected: customSizeSelected }"
              aria-label="自定义粗细"
              :aria-pressed="customSizeSelected"
              :title="'自定义粗细 ' + customSize"
              @click="
                customSizeSelected = true;
                size = customSize;
              "
            >
              <SlidersHorizontal :size="19" />
            </button>
          </div>
          <div class="size-labels"><span>细一点</span><span>粗一点</span></div>
          <label class="custom-size-control">
            <span
              >自定义粗细 <output>{{ customSize }}</output></span
            >
            <input
              class="drawing-range"
              type="range"
              min="2"
              max="32"
              step="2"
              :value="customSize"
              :style="{
                '--range-progress': `${((customSize - 2) / 30) * 100}%`,
              }"
              aria-label="自定义画笔粗细"
              @input="changeSize"
            />
          </label>
        </section>
        <section v-if="tool === 'shape'" class="option-section">
          <h2>选一个形状</h2>
          <div class="shape-choices">
            <button
              v-for="option in shapeOptions"
              :key="option.id"
              :class="{ selected: shape === option.id }"
              :aria-label="option.label"
              :title="option.label"
              :aria-pressed="shape === option.id"
              @click="shape = option.id"
            >
              <component :is="option.icon" :size="25" />
            </button>
          </div>
        </section>
        <section v-if="tool === 'sticker'" class="option-section">
          <h2>小小贴纸<span>点一点</span></h2>
          <div class="sticker-grid">
            <button
              v-for="item in stickers"
              :key="item"
              :class="{ selected: sticker === item }"
              :aria-label="'选择贴纸 ' + item"
              :aria-pressed="sticker === item"
              @click="sticker = item"
            >
              {{ item }}
            </button>
          </div>
        </section>
        <div class="active-tool-note">
          <span :style="{ background: color }"></span>正在使用{{
            activeToolLabel
          }}
        </div>
      </StudioPanel>
    </div>
    <Transition name="toast"
      ><div v-if="notice" class="toast-message" role="status">
        <Check :size="20" />{{ notice }}
      </div></Transition
    >
    <div
      v-if="dialog"
      class="modal-backdrop"
      :class="{ 'refresh-guard': dialog === 'refresh' }"
      @click.self="!saving && (dialog = undefined)"
      @keydown.esc="!saving && (dialog = undefined)"
    >
      <section
        v-dialog-focus
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-dialog-title"
      >
        <span class="modal-illustration"
          ><RotateCw v-if="dialog === 'refresh'" :size="34" /><Paintbrush
            v-else-if="dialog === 'leave'"
            :size="34" /><Trash2 v-else :size="32"
        /></span>
        <h2 id="studio-dialog-title">
          {{
            dialog === "refresh"
              ? "先保存作品，再刷新？"
              : dialog === "leave"
                ? "把新画下的想象留下来？"
                : "换一张干净的画纸？"
          }}
        </h2>
        <p>
          {{
            dialog === "refresh"
              ? "这幅画有未保存的修改。可以保存后刷新，或取消刷新继续画画。"
              : dialog === "leave"
                ? "这次的新创意还没有保存，先收藏再离开吧。"
                : "当前画面会被清空。清空后，仍然可以撤销。"
          }}
        </p>
        <p v-if="error" class="dialog-error" role="alert">{{ error }}</p>
        <div class="modal-actions">
          <button
            class="outline-button"
            :disabled="saving"
            autofocus
            @click="dialog = undefined"
          >
            {{
              dialog === "refresh"
                ? "取消刷新"
                : dialog === "leave"
                  ? "继续画画"
                  : "再想一想"
            }}</button
          ><button
            class="primary-button"
            :disabled="saving"
            @click="
              dialog === 'refresh'
                ? saveAndRefresh()
                : dialog === 'leave'
                  ? saveAndLeave()
                  : clear()
            "
          >
            {{
              saving
                ? "正在保存…"
                : dialog === "refresh"
                  ? "保存并刷新"
                  : dialog === "leave"
                    ? "保存并离开"
                    : "清空画布"
            }}
          </button>
        </div>
        <button
          v-if="dialog === 'leave'"
          class="discard-button"
          :disabled="saving"
          @click="emit('back')"
        >
          放弃这次修改，离开
        </button>
      </section>
    </div>
  </div>
</template>
