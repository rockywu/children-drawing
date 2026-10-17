<script setup lang="ts">
import { ref } from "vue";
import { Check, Trash2 } from "lucide-vue-next";
import ColorPicker from "./ColorPicker.vue";

const color = defineModel<string>({ required: true });
const opacity = defineModel<number>("opacity", { required: true });
const customSelected = defineModel<boolean>("customSelected", { required: true });
const emit = defineEmits<{ pickCanvas: [] }>();
const showPicker = ref(false);
const storageKey = "little-art-planet.custom-colors";
const colors = [
  "#3F6956",
  "#789D78",
  "#A8C591",
  "#F1CD6C",
  "#E8A35C",
  "#DF897C",
  "#CC6874",
  "#A68BBE",
  "#759CB8",
  "#82BDB7",
  "#67554D",
  "#FFFFFF",
];
const customColors = ref<string[]>([]);
const pickerError = ref("");
const message = ref("");
const storageError = ref("");
const deletingColor = ref<string>();

try {
  const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
  if (!Array.isArray(stored)) throw new Error("Invalid palette");
  customColors.value = [
    ...new Set(
      stored
        .filter(
          (item): item is string =>
            typeof item === "string" && /^#[\da-f]{6}$/i.test(item),
        )
        .map((item) => item.toUpperCase()),
    ),
  ].slice(0, 8);
} catch {
  storageError.value = "自定义颜色暂时无法读取，仍可使用基础颜色。";
}

function selectColor(value: string, custom = false) {
  color.value = value;
  customSelected.value = custom;
  message.value = "";
}

function applyColor(value: string, alpha: number, action: "add" | "replace") {
  const next = [...customColors.value];
  const index = customSelected.value
    ? next.indexOf(color.value)
    : next.length >= 8 ? 7 : -1;
  if (action === "replace" && index !== -1) {
    next[index] = value;
  } else if (!next.includes(value)) {
    if (next.length >= 8) {
      pickerError.value = "已收集 8 个颜色，请先删除一个再新增。";
      return;
    }
    next.push(value);
  }
  if (!persist([...new Set(next)])) {
    pickerError.value = storageError.value;
    return;
  }
  selectColor(value, true);
  opacity.value = alpha;
  message.value = action === "replace" ? "这个自定义颜色已更新。" : "颜色已收藏并选中。";
  showPicker.value = false;
}
function pickCanvas() {
  showPicker.value = false;
  emit("pickCanvas");
}

function persist(next: string[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    customColors.value = next;
    storageError.value = "";
    return true;
  } catch {
    storageError.value = "调色板没有保存成功，请允许浏览器存储后再试。";
    return false;
  }
}

function removeColor() {
  if (!deletingColor.value) return;
  if (
    persist(customColors.value.filter((item) => item !== deletingColor.value))
  ) {
    if (color.value === deletingColor.value) customSelected.value = false;
    deletingColor.value = undefined;
    message.value = "颜色已从调色板移除，画布上的颜色不受影响。";
  }
}

function checkColor(value: string) {
  const channels = [1, 3, 5].map((index) =>
    parseInt(value.slice(index, index + 2), 16),
  );
  return channels[0]! * 0.299 + channels[1]! * 0.587 + channels[2]! * 0.114 >
    165
    ? "#314D3D"
    : "#FFFFFF";
}
</script>

<template>
  <section
    class="option-section palette"
    aria-label="我的调色盘"
  >
    <h2>我的调色盘<span>✧</span></h2>
    <div class="color-grid" aria-label="基础颜色">
      <button
        v-for="swatch in colors"
        :key="swatch"
        :style="{ background: swatch }"
        :class="['swatch', { chosen: !customSelected && color === swatch }]"
        :aria-label="'选择颜色 ' + swatch"
        :title="swatch"
        :aria-pressed="!customSelected && color === swatch"
        @click="selectColor(swatch)"
      >
        <Check
          v-if="!customSelected && color === swatch"
          :size="19"
          :style="{ color: checkColor(swatch) }"
        />
      </button>
    </div>

    <div class="custom-palette">
      <h3>
        自定义调色板<span>{{ customColors.length }} / 8</span>
      </h3>
      <div
        v-if="customColors.length"
        class="color-grid custom-color-grid"
        aria-label="自定义颜色"
      >
        <span
          v-for="swatch in customColors"
          :key="swatch"
          class="custom-swatch"
        >
          <button
            :style="{ background: swatch }"
            :class="['swatch', { chosen: customSelected && color === swatch }]"
            :aria-label="'使用自定义颜色 ' + swatch"
            :title="swatch"
            :aria-pressed="customSelected && color === swatch"
            @click="selectColor(swatch, true)"
          >
            <Check
              v-if="customSelected && color === swatch"
              :size="19"
              :style="{ color: checkColor(swatch) }"
            />
          </button>
          <button
            class="remove-custom-color"
            :aria-label="'删除自定义颜色 ' + swatch"
            title="删除这个颜色"
            @click="deletingColor = swatch"
          >
            <Trash2 :size="13" />
          </button>
        </span>
      </div>
      <p v-else class="palette-empty">把喜欢的颜色收集在这里</p>
      <div class="add-color-row">
        <button
          class="custom-color"
          aria-label="打开圆形调色盘"
          @click="
            pickerError = '';
            showPicker = true;
          "
        >
          <span
            class="rainbow-swatch"
            :style="{ background: color }"
          ></span
          ><span>选一个颜色</span>
        </button>
      </div>
      <p class="palette-hint">
        {{
          customColors.length >= 8
            ? customSelected
              ? "已满 8 个，选色后替换当前色块"
              : "已满 8 个，选色后替换第 8 个颜色"
            : customSelected
              ? "打开选色后可替换或新增，点右上角可删除"
              : "选好颜色后自动收藏，点色块可以再次使用"
        }}
      </p>
    </div>
    <p v-if="storageError" class="palette-error" role="alert">
      {{ storageError }}
    </p>
    <p v-else-if="message" class="palette-message" role="status">
      {{ message }}
    </p>
  </section>
  <ColorPicker
    v-if="showPicker"
    :color="color"
    :opacity="opacity"
    :can-replace="customSelected && customColors.includes(color)"
    :full="customColors.length >= 8"
    :error="pickerError"
    @close="showPicker = false"
    @apply="applyColor"
    @pick-canvas="pickCanvas"
  />
  <Teleport to="body">
    <div
      v-if="deletingColor"
      class="modal-backdrop"
      @click.self="deletingColor = undefined"
    >
      <section
        v-dialog-focus
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-color-title"
      >
        <span class="modal-illustration coral"><Trash2 :size="32" /></span>
        <h2 id="delete-color-title">要移除这个颜色吗？</h2>
        <span
          class="delete-color-preview"
          :style="{ background: deletingColor }"
        ></span>
        <p>只从自定义调色板移除，<br />画布上的颜色会保留。</p>
        <p v-if="storageError" class="palette-error" role="alert">
          {{ storageError }}
        </p>
        <div class="modal-actions">
          <button
            class="outline-button"
            autofocus
            @click="deletingColor = undefined"
          >
            留下它</button
          ><button class="danger-button" @click="removeColor">确认删除</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.custom-palette {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #e3e9d9;
}
.custom-palette h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
}
.custom-palette h3 span {
  font-size: 12px;
  color: #8b9a7b;
  white-space: nowrap;
}
.custom-color-grid {
  row-gap: 14px;
}
.palette-empty {
  font-size: 12px;
  color: #96a187;
  line-height: 1.8;
}
.add-color-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
}
.custom-color {
  flex: 1;
  min-width: 0;
  margin: 0;
  gap: 7px;
  padding: 9px 7px;
  min-height: 43px;
}
.custom-color:focus-within {
  outline: 2px solid #c29a46;
  outline-offset: 3px;
}
.rainbow-swatch {
  border: 1px solid #00000010;
}
.remove-custom-color {
  position: absolute;
  top: -9px;
  right: -9px;
  width: 23px;
  height: 23px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: #a87867;
  border-radius: 50%;
  background: #fffaf1;
  border: 1px solid #e8d6c6;
  z-index: 1;
}
.remove-custom-color:hover {
  background: #f7ece2;
}
.custom-swatch {
  position: relative;
  display: inline-flex;
}
.delete-color-preview {
  display: block;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  margin: 20px auto 0;
  border: 1px solid #00000010;
}
.palette-hint,
.palette-message,
.palette-error {
  font-size: 11px;
  line-height: 1.8;
  margin-top: 10px;
  color: #929f81;
}
.palette-message {
  color: #648351;
}
.palette-error {
  color: #ae6f59;
}
@media (max-width: 740px) {
  .remove-custom-color {
    top: -14px;
    right: -12px;
    width: 22px;
    height: 22px;
  }
  .custom-palette {
    margin-top: 16px;
    padding-top: 12px;
  }
  .custom-palette h3 {
    font-size: 11px;
    margin-bottom: 12px;
  }
  .custom-palette h3 span {
    font-size: 10px;
  }
  .custom-color-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .add-color-row {
    flex-wrap: nowrap;
    margin-top: 12px;
    gap: 6px;
  }
  .custom-color {
    font-size: 10px;
    min-height: 34px;
    padding: 6px;
    flex-basis: auto;
  }
  .palette-hint,
  .palette-message,
  .palette-error {
    font-size: 10px;
  }
}
</style>
