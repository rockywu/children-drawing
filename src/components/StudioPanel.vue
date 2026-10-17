<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Palette, Pin, PinOff, X } from "lucide-vue-next";

const pinned = defineModel<boolean>("pinned", { required: true });
const expanded = ref(false);
const panel = ref<HTMLElement>();
let timer: ReturnType<typeof setTimeout> | undefined;
function stayOpen() {
  clearTimeout(timer);
}
function open() {
  expanded.value = true;
  stayOpen();
}
function close() {
  if (!pinned.value) expanded.value = false;
  stayOpen();
}
function scheduleClose() {
  stayOpen();
  if (!pinned.value)
    timer = setTimeout(() => {
      if (!document.querySelector('[role="dialog"]')) close();
    }, 1800);
}
function outside(event: PointerEvent) {
  if (
    !panel.value?.contains(event.target as Node) &&
    !document.querySelector('[role="dialog"]')
  )
    close();
}
function togglePin() {
  pinned.value = !pinned.value;
  open();
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => {
  stayOpen();
  document.removeEventListener("pointerdown", outside);
});
defineExpose({ open, close });
</script>

<template>
  <aside
    ref="panel"
    class="studio-panel"
    :class="{ 'panel-pinned': pinned, 'panel-collapsed': !expanded && !pinned }"
    aria-label="调色与粗细面板"
    @pointerenter="stayOpen"
    @pointerleave="scheduleClose"
    @focusin="stayOpen"
    @focusout="scheduleClose"
    @keydown.esc="close"
  >
    <button
      v-if="!expanded && !pinned"
      class="panel-tab"
      aria-label="展开调色与粗细"
      @click="open"
    >
      <Palette :size="24" /><span>调色<br />粗细</span>
    </button>
    <div v-show="expanded || pinned" class="panel-surface">
      <div class="panel-heading">
        <span><Palette :size="19" />画画百宝盒</span>
        <div>
          <button
            class="icon-button"
            :aria-label="pinned ? '取消固定面板' : '固定面板到左侧'"
            :title="pinned ? '取消固定，恢复悬浮' : '固定到左侧'"
            :aria-pressed="pinned"
            @click="togglePin"
          >
            <PinOff v-if="pinned" :size="20" /><Pin v-else :size="20" />
          </button>
          <button
            v-if="!pinned"
            class="icon-button"
            aria-label="收起调色与粗细"
            @click="close"
          >
            <X :size="21" />
          </button>
        </div>
      </div>
      <div class="drawing-options"><slot /></div>
    </div>
  </aside>
</template>
