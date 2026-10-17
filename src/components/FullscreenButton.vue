<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Maximize, Minimize } from "lucide-vue-next";

const fullscreen = ref(false);
const busy = ref(false);
const error = ref("");
let unsubscribe: (() => void) | undefined;
const updateBrowser = () => {
  fullscreen.value = !!document.fullscreenElement;
};

onMounted(async () => {
  if (window.desktop) {
    unsubscribe = window.desktop.onFullscreenChange((value) => {
      fullscreen.value = value;
    });
    try {
      fullscreen.value = await window.desktop.getFullscreen();
    } catch {
      error.value = "暂时无法读取窗口状态，请再试一次。";
    }
  } else {
    updateBrowser();
    document.addEventListener("fullscreenchange", updateBrowser);
  }
});
onBeforeUnmount(() => {
  unsubscribe?.();
  document.removeEventListener("fullscreenchange", updateBrowser);
});

async function toggle() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (window.desktop) await window.desktop.toggleFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    error.value = "当前预览窗口不支持全屏，请用系统浏览器或桌面版体验。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <span class="fullscreen-control">
    <button
      class="outline-button fullscreen-button"
      :disabled="busy"
      :aria-label="fullscreen ? '退出全屏' : '全屏'"
      :title="fullscreen ? '退出全屏（Esc）' : '全屏'"
      :aria-pressed="fullscreen"
      @click="toggle"
    >
      <Minimize v-if="fullscreen" :size="20" /><Maximize
        v-else
        :size="20"
      /><span>{{ fullscreen ? "退出全屏" : "全屏" }}</span>
    </button>
    <span v-if="error" class="fullscreen-error" role="status">{{ error }}</span>
  </span>
</template>

<style scoped>
.fullscreen-control {
  display: inline-flex;
  flex-shrink: 0;
  position: relative;
}
.fullscreen-button {
  font-size: 15px;
  padding: 10px 14px;
  min-height: 46px;
}
.fullscreen-error {
  position: absolute;
  right: 0;
  top: calc(100% + 9px);
  background: #fff9eb;
  border: 1px solid #e1d5b5;
  border-radius: 12px;
  padding: 10px 13px;
  width: 250px;
  font-size: 12px;
  line-height: 1.8;
  z-index: 25;
  color: #8a7656;
  box-shadow: 0 6px 18px #344b2b10;
}
@media (max-width: 740px) {
  .fullscreen-button {
    padding: 9px;
    gap: 0;
  }
  .fullscreen-button span {
    display: none;
  }
}
</style>
