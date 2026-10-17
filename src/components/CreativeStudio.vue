<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { ArrowDownToLine, ArrowLeft, Check, LoaderCircle, Palette, Redo2, Save, Undo2 } from "lucide-vue-next";
import ColorPalette from "./ColorPalette.vue";
import FullscreenButton from "./FullscreenButton.vue";
import SymmetryEditor from "./SymmetryEditor.vue";
import PixelEditor from "./PixelEditor.vue";
import { createArtworkId } from "../artworkId";
import { saveArtwork } from "../storage";
import type { Artwork } from "../storage";
import { cloneProject, createCreativeProject, readCreativeProject } from "../creative/project";
import { creativeNames } from "../creative/types";
import type { CreativeEditorHandle, CreativeHistory, CreativeKind, CreativePick, CreativeProject, PixelProject, SymmetryProject } from "../creative/types";

const props = defineProps<{ kind: CreativeKind; artwork?: Artwork; initialName?: string; initialProject?: CreativeProject }>();
const emit = defineEmits<{ back: []; saved: [] }>();
const project = shallowRef<CreativeProject>(createCreativeProject(props.kind));
const loadError = ref("");
try {
  if (props.artwork || props.initialProject) {
    project.value = readCreativeProject(props.artwork?.creative ?? props.initialProject);
    if (project.value.kind !== props.kind) throw new Error("作品类型和编辑器不一致");
  }
} catch (error) {
  loadError.value = error instanceof Error ? error.message : "作品暂时无法打开";
}
const id = props.artwork?.id ?? createArtworkId();
const name = ref(props.artwork?.name ?? props.initialName ?? `我的${creativeNames[props.kind]}`);
const savedName = ref(name.value);
const modified = ref(!!props.initialProject);
const hasSaved = ref(!!props.artwork);
const editor = ref<CreativeEditorHandle>();
const history = ref<CreativeHistory>({ canUndo: false, canRedo: false });
const strokeBusy = ref(false);
const saving = ref(false);
const exporting = ref(false);
const color = ref("#3F6956");
const opacity = ref(100);
const customSelected = ref(false);
const pickMode = ref(false);
const paletteOpen = ref(false);
const error = ref("");
const notice = ref("");
const dialog = ref<"leave" | "refresh">();
const dirty = computed(() => modified.value || name.value !== savedName.value);
const locked = computed(() => saving.value || exporting.value || !!loadError.value);
let timer: ReturnType<typeof setTimeout>;
let previewUrl: string | undefined;
const preview = props.artwork ? (previewUrl = URL.createObjectURL(props.artwork.image)) : "";

function change(value: CreativeProject) {
  if (locked.value) return;
  project.value = value;
  modified.value = true;
}
function announce(message: string) {
  notice.value = message;
  clearTimeout(timer);
  timer = setTimeout(() => notice.value = "", 3500);
}
function pick(value: CreativePick) {
  color.value = value.color;
  opacity.value = value.opacity;
  customSelected.value = false;
  pickMode.value = false;
  announce("颜色已选好，可以继续创作");
}
async function thumbnail(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = Math.max(1, Math.round(320 * image.height / image.width));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = props.kind === "symmetry";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}
async function save(): Promise<boolean> {
  if (locked.value || strokeBusy.value || !editor.value) return false;
  saving.value = true;
  pickMode.value = false;
  error.value = "";
  try {
    const snapshot = readCreativeProject(cloneProject(project.value));
    const image = await editor.value.exportPng();
    const artwork: Artwork = {
      id, name: name.value.trim() || `我的${creativeNames[props.kind]}`,
      updated: Date.now(), image, thumbnail: await thumbnail(image), theme: "",
      width: snapshot.kind === "symmetry" ? 800 : snapshot.size * 8,
      height: snapshot.kind === "symmetry" ? 800 : snapshot.size * 8,
      creative: snapshot,
    };
    await saveArtwork(artwork);
    name.value = artwork.name;
    savedName.value = artwork.name;
    modified.value = false;
    hasSaved.value = true;
    announce("创作已收藏到作品小屋，所有编辑内容都保存在本浏览器");
    emit("saved");
    return true;
  } catch {
    error.value = "保存没有成功，创作还在这里。请重试，或先下载创作文件备份。";
    return false;
  } finally { saving.value = false; }
}
function download(blob: Blob, extension: string, suffix = "") {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.value.trim() || creativeNames[props.kind]}${suffix}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function exportFile(format: "png" | "gif" | "sheet" | "project") {
  if (locked.value || strokeBusy.value || !editor.value) return;
  exporting.value = true;
  error.value = "";
  try {
    if (format === "project") {
      download(new Blob([JSON.stringify({ format: "little-art-planet", name: name.value, project: readCreativeProject(project.value) })], { type: "application/json" }), "artplanet");
    } else {
      const blob = format === "gif" ? await editor.value.exportGif!() :
        format === "sheet" ? await editor.value.exportSpriteSheet!() : await editor.value.exportPng();
      download(blob, format === "gif" ? "gif" : "png", format === "sheet" ? "-序列图" : "");
    }
    announce("下载已开始，创作内容只在本机处理");
  } catch {
    error.value = "文件没有生成成功，创作内容仍在这里，请再试一次。";
  } finally { exporting.value = false; }
}
function back() {
  if (saving.value || exporting.value) return;
  if (loadError.value) { emit("back"); return; }
  editor.value?.cancelActive();
  if (dirty.value) dialog.value = "leave";
  else emit("back");
}
async function saveAndContinue() {
  const action = dialog.value;
  if (!await save()) return;
  dialog.value = undefined;
  if (action === "refresh") window.location.reload();
  else emit("back");
}
function leaveWithoutSaving() {
  if (locked.value) return;
  const action = dialog.value;
  dialog.value = undefined;
  if (action === "refresh") window.location.reload();
  else emit("back");
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value || strokeBusy.value) {
    event.preventDefault(); event.returnValue = "";
  }
}
function keydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;
  if ((key === "f5" || (command && key === "r")) && (dirty.value || saving.value || strokeBusy.value)) {
    event.preventDefault(); editor.value?.cancelActive(); dialog.value = "refresh"; return;
  }
  if ((event.target as HTMLElement)?.matches("input,textarea,select") || document.querySelector('[role="dialog"]') || locked.value || strokeBusy.value) return;
  if (command && key === "s") { event.preventDefault(); void save(); }
  if (command && key === "z") { event.preventDefault(); event.shiftKey ? editor.value?.redo() : editor.value?.undo(); }
  if (key === "escape") { pickMode.value = false; paletteOpen.value = false; }
}
onMounted(() => {
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("keydown", keydown);
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  window.removeEventListener("beforeunload", beforeUnload);
  window.removeEventListener("keydown", keydown);
});
</script>

<template>
  <div class="creative-studio">
    <header class="creative-header">
      <button class="back-button" :disabled="saving || exporting" @click="back"><ArrowLeft :size="22" /><span>创意工坊</span></button>
      <div class="creative-title">
        <input v-model="name" maxlength="60" aria-label="创作名称" :disabled="locked" />
        <small>{{ creativeNames[kind] }} · {{ saving ? "正在保存…" : dirty ? "有新的创意还未保存" : hasSaved ? "创作已保存" : "只在本机创作，自由试试看" }}</small>
      </div>
      <div class="creative-header-actions">
        <FullscreenButton />
        <button class="outline-button creative-palette-toggle" :aria-pressed="paletteOpen" @click="paletteOpen = !paletteOpen"><Palette :size="20" />调色</button>
        <button class="primary-button" :disabled="locked || strokeBusy" @click="save"><LoaderCircle v-if="saving" :size="20" class="spin" /><Save v-else :size="20" />{{ saving ? "正在保存" : "保存作品" }}</button>
      </div>
    </header>
    <div v-if="loadError" class="creative-load-error" role="alert">
      <h2>这份创作暂时无法编辑</h2><p>{{ loadError }}。原作品没有被修改。</p>
      <img v-if="preview" :src="preview" alt="原作品预览" />
      <button v-if="artwork" class="outline-button" @click="download(artwork.image, 'png', '-预览')"><ArrowDownToLine :size="20" />下载原预览图</button>
    </div>
    <div v-else class="creative-layout" :class="{ 'palette-open': paletteOpen }">
      <main class="creative-workspace">
        <div class="creative-actions">
          <button :disabled="!history.canUndo || locked || strokeBusy" @click="editor?.undo()"><Undo2 :size="20" />撤销</button>
          <button :disabled="!history.canRedo || locked || strokeBusy" @click="editor?.redo()"><Redo2 :size="20" />重做</button>
          <span class="creative-action-spacer"></span>
          <button :disabled="locked || strokeBusy" @click="exportFile('png')"><ArrowDownToLine :size="19" />下载 PNG</button>
          <button v-if="kind === 'animation'" :disabled="locked || strokeBusy" @click="exportFile('gif')"><ArrowDownToLine :size="19" />下载 GIF</button>
          <button v-if="kind === 'animation'" :disabled="locked || strokeBusy" @click="exportFile('sheet')"><ArrowDownToLine :size="19" />PNG 序列图</button>
          <button :disabled="locked || strokeBusy" @click="exportFile('project')"><ArrowDownToLine :size="19" />备份创作文件</button>
        </div>
        <p v-if="pickMode" class="creative-pick-tip" role="status">点一下作品取色，按 Esc 或点取消返回。<button @click="pickMode = false">取消取色</button></p>
        <SymmetryEditor v-if="kind === 'symmetry'" ref="editor" :model-value="project as SymmetryProject" :color="color" :opacity="opacity" :disabled="locked" :pick-mode="pickMode" @update:model-value="change" @history="history = $event" @busy="strokeBusy = $event" @pick="pick" @cancel-pick="pickMode = false" @notice="announce" />
        <PixelEditor v-else ref="editor" :model-value="project as PixelProject" :color="color" :opacity="opacity" :disabled="locked" :pick-mode="pickMode" @update:model-value="change" @history="history = $event" @busy="strokeBusy = $event" @pick="pick" @cancel-pick="pickMode = false" @notice="announce" />
        <p v-if="error" class="creative-error" role="alert">{{ error }}</p>
        <p v-if="notice" class="creative-notice" role="status"><Check :size="18" />{{ notice }}</p>
        <p class="creative-privacy">作品、动画和创作文件都只在本浏览器处理与保存，不会上传。下载创作文件可完整备份并在工坊重新打开。</p>
      </main>
      <aside class="creative-palette" aria-label="创作调色板">
        <button class="creative-palette-close" @click="paletteOpen = false">收起调色板</button>
        <fieldset :disabled="locked || strokeBusy">
          <ColorPalette v-model="color" v-model:opacity="opacity" v-model:custom-selected="customSelected" @pick-canvas="pickMode = true; paletteOpen = false" />
          <label class="creative-opacity">透明度 <output>{{ opacity }}%</output><input v-model.number="opacity" class="drawing-range" type="range" min="10" max="100" step="10" aria-label="创作透明度" :style="{ '--range-progress': `${(opacity - 10) / .9}%` }" /></label>
        </fieldset>
      </aside>
    </div>
    <div v-if="dialog" class="modal-backdrop" @click.self="!saving && (dialog = undefined)">
      <section v-dialog-focus class="modal" role="dialog" aria-modal="true" aria-labelledby="creative-leave-title">
        <h2 id="creative-leave-title">{{ dialog === 'refresh' ? "刷新前，把创作留下来？" : "离开前，把创作留下来？" }}</h2>
        <p>新的创意还没保存。可以保存后继续，也可以留在这里。</p>
        <p v-if="error" class="creative-error" role="alert">{{ error }}</p>
        <div class="modal-actions"><button class="outline-button" autofocus :disabled="saving" @click="dialog = undefined">{{ dialog === 'refresh' ? "取消刷新" : "继续创作" }}</button><button class="primary-button" :disabled="saving || strokeBusy" @click="saveAndContinue">{{ saving ? "正在保存…" : dialog === 'refresh' ? "保存并刷新" : "保存并离开" }}</button></div>
        <button v-if="dialog === 'leave'" class="creative-discard" :disabled="saving" @click="leaveWithoutSaving">不保存，离开</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.creative-header-actions .creative-palette-toggle{display:none}
.creative-palette :deep(.color-grid){grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 8px}.creative-palette :deep(.color-grid .swatch){width:44px;height:44px;min-width:44px;min-height:44px}.creative-palette :deep(.custom-color){min-height:44px;font-size:14px}.creative-palette :deep(.custom-palette h3){font-size:14px}.creative-palette :deep(.custom-palette h3 span){font-size:12px}.creative-palette :deep(.palette-hint),.creative-palette :deep(.palette-empty){font-size:12px}.creative-palette :deep(.custom-color-grid){row-gap:20px}
.creative-studio{min-height:100dvh;background:var(--cream)}
.creative-header{display:flex;align-items:center;gap:20px;padding:20px 28px;background:#fffef9;border-bottom:1px solid var(--line);flex-wrap:wrap}
.creative-title{flex:1;min-width:180px}.creative-title input{font-size:23px;font-weight:700;width:100%;max-width:500px;background:transparent;border:1px solid transparent;border-radius:10px;padding:5px 8px;color:var(--ink)}.creative-title input:focus{border-color:#b9cbae}.creative-title small{display:block;font-size:13px;color:var(--muted);margin:4px 8px}.creative-header-actions{display:flex;gap:10px;align-items:center}
.creative-layout{display:grid;grid-template-columns:minmax(0,1fr) 244px;gap:20px;padding:20px}.creative-workspace{min-width:0}.creative-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}.creative-actions button{display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #dce5d3;background:#fffef9;min-height:44px;padding:8px 12px;border-radius:12px;font-size:15px}.creative-action-spacer{flex:1}.creative-palette{padding:22px 18px;background:#fffef9;border:1px solid var(--line);border-radius:22px;align-self:start}.creative-palette fieldset{border:0;padding:0;margin:0;min-width:0}.creative-palette-close{display:none}.creative-opacity{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-top:20px;font-size:15px}.creative-opacity input{width:100%;height:44px}.creative-privacy{font-size:12px;color:var(--muted);line-height:1.8;margin:16px 4px}.creative-error{padding:14px;border-radius:14px;background:#fcece3;color:#9d4c33;font-size:15px}.creative-notice{display:flex;gap:7px;align-items:center;color:#4d7445;font-size:15px;padding:10px 4px}.creative-pick-tip{padding:12px;background:#fff0ce;border-radius:12px;font-size:15px}.creative-pick-tip button{text-decoration:underline;padding:8px}.creative-discard{min-height:44px;margin-top:15px;color:#9e6c57;font-size:15px}.creative-load-error{max-width:700px;margin:50px auto;padding:24px;text-align:center}.creative-load-error p{margin:20px}.creative-load-error img{display:block;width:min(100%,400px);max-height:400px;object-fit:contain;margin:20px auto}
@media(max-width:1000px){.creative-header-actions .creative-palette-toggle{display:flex}.creative-layout{grid-template-columns:minmax(0,1fr)}.creative-palette{display:none;position:fixed;right:16px;top:120px;bottom:20px;width:260px;overflow:auto;z-index:40;box-shadow:0 12px 40px #314d3d25}.palette-open .creative-palette{display:block}.creative-palette-close{display:block;min-height:44px;width:100%;margin-bottom:12px;background:#edf3e5;border-radius:10px}.creative-header{gap:12px;padding:14px 18px}.creative-title input{font-size:20px}.creative-header-actions{margin-left:auto}}
@media(max-width:600px){.creative-header{gap:8px;padding:12px}.creative-header .back-button{font-size:15px}.creative-title{flex-basis:calc(100% - 140px);min-width:0}.creative-title input{font-size:18px}.creative-header-actions{width:100%;justify-content:flex-end}.creative-header-actions button{min-height:44px;font-size:14px;padding:9px 12px}.creative-layout{padding:12px;gap:10px}.creative-actions{gap:6px}.creative-actions button{font-size:13px;padding:7px 9px}.creative-action-spacer{display:none}.creative-privacy{font-size:11px}.creative-palette{top:160px;right:12px;max-height:calc(100dvh - 180px)}}
</style>
