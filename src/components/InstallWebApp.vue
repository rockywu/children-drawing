<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, X } from "lucide-vue-next";
import { installPrompt, webAppInstalled } from "../pwa";

const desktop = !!window.desktop;
const showGuide = ref(false);
const busy = ref(false);
const result = ref("");
const secure = window.isSecureContext;
const agent = navigator.userAgent;
const ios =
  /iPad|iPhone|iPod/.test(agent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const android = /Android/.test(agent);
const mac = /Mac/.test(navigator.platform);
const edge = /Edg\//.test(agent);
const safari =
  /Safari/.test(agent) && !/Chrome|Chromium|CriOS|Edg|Android/.test(agent);
const guide = computed(() => {
  if (ios)
    return {
      title: "iPhone / iPad",
      steps: [
        "用 Safari 打开这个网页，点击“共享”按钮。",
        "选择“添加到主屏幕”；找不到时向下滚动或检查共享菜单。",
        "名称保留“画画星球”，点击“添加”。若显示“作为 Web App 打开”，保持开启。",
      ],
    };
  if (android)
    return {
      title: "Android 平板 / 手机",
      steps: [
        "用 Chrome 或 Edge 打开这个网页。",
        "点击浏览器右上角菜单，选择“安装应用”或“添加到主屏幕”。",
        "按系统提示确认；以后从主屏幕打开画画星球。",
      ],
    };
  if (mac && safari)
    return {
      title: "Mac Safari",
      steps: [
        "在 Safari 菜单栏点击“文件”。",
        "选择“添加到程序坞”，确认名称后点击“添加”。",
        "如果没有此项，请用新版 Chrome 或 Edge 打开并安装。",
      ],
    };
  if (edge)
    return {
      title: "Microsoft Edge",
      steps: [
        "点击浏览器右上角“⋯”菜单。",
        "选择“应用”→“将此站点作为应用安装”，也可点击地址栏内的安装图标。",
        "确认名称并点击“安装”；可按系统提示固定到桌面或任务栏。",
      ],
    };
  return {
    title: "电脑浏览器",
    steps: [
      "用 Chrome 或 Edge 打开这个网页。",
      "点击地址栏的安装图标，或在浏览器菜单中查找“安装画画星球 / 将网页安装为应用”。Chrome 中可能位于“投放、保存和分享”。",
      "在系统确认窗口点击“安装”；以后可从系统应用列表打开。",
    ],
  };
});

watch(webAppInstalled, (value) => {
  if (value) showGuide.value = false;
});
async function install() {
  if (busy.value) return;
  result.value = "";
  const prompt = installPrompt.value;
  if (!prompt || !secure) {
    showGuide.value = true;
    return;
  }
  busy.value = true;
  installPrompt.value = undefined;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "dismissed") {
      result.value = "这次没有安装。也可以按下面的步骤手动添加。";
      showGuide.value = true;
    }
  } catch {
    result.value = "浏览器未能打开安装确认，请按下面的步骤添加。";
    showGuide.value = true;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button
    v-if="!desktop && !webAppInstalled"
    class="install-webapp-button"
    :disabled="busy"
    aria-label="保存为 Web App"
    title="保存为 Web App"
    @click="install"
  >
    <Download :size="20" /><span>{{
      busy ? "正在打开安装…" : "保存为 Web App"
    }}</span>
  </button>
  <Teleport to="body">
    <div
      v-if="showGuide && !desktop && !webAppInstalled"
      class="modal-backdrop"
      @click.self="showGuide = false"
      @keydown.esc="showGuide = false"
    >
      <section
        v-dialog-focus
        class="modal install-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
      >
        <button
          class="icon-button modal-close"
          aria-label="关闭安装说明"
          @click="showGuide = false"
        >
          <X :size="22" />
        </button>
        <span class="modal-illustration"><Download :size="30" /></span>
        <h2 id="install-guide-title">保存为 Web App</h2>
        <p>把画画星球放到桌面或主屏幕，下次一点就能开始画画。</p>
        <p v-if="result" class="install-guide-result" role="status">
          {{ result }}
        </p>
        <p v-if="!secure" class="install-guide-note">
          当前地址使用 HTTP，浏览器会限制安装与离线功能。请先使用部署后的 HTTPS
          地址；本机 localhost 可用于预览。
        </p>
        <div class="install-guide-steps">
          <h3>{{ guide.title }}</h3>
          <ol>
            <li v-for="step in guide.steps" :key="step">{{ step }}</li>
          </ol>
        </div>
        <p class="install-guide-footnote">
          如果在应用内置浏览器中，请先用系统浏览器打开。安装项被系统或管理员禁用时，需要调整设备权限，网页无法代为授权。
        </p>
        <p class="install-guide-footnote">
          作品保存在当前设备本地。添加 Web App
          不会上传或同步作品；重要作品仍建议下载 PNG 备份。
        </p>
        <div class="modal-actions">
          <button class="outline-button" autofocus @click="showGuide = false">
            知道了</button
          ><button
            v-if="installPrompt && secure"
            class="primary-button"
            :disabled="busy"
            @click="install"
          >
            开始安装
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.install-guide {
  max-height: 90dvh;
  overflow: auto;
  width: min(530px, 100%);
}
.install-guide-steps {
  text-align: left;
  margin-top: 20px;
  padding: 18px 20px;
  border-radius: 17px;
  background: #f0f4e7;
}
.install-guide-steps h3 {
  font-size: 17px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #587349;
}
.install-guide-steps ol {
  margin: 0;
  padding-left: 22px;
}
.install-guide-steps li {
  padding-left: 3px;
  margin: 10px 0;
  font-size: 15px;
  line-height: 1.9;
  color: #6e8062;
}
.install-guide .install-guide-footnote {
  font-size: 12px;
  text-align: left;
  line-height: 1.9;
  margin-top: 14px;
}
.install-guide .install-guide-note,
.install-guide .install-guide-result {
  padding: 12px;
  border-radius: 12px;
  background: #fff1d8;
  color: #966c2d;
  font-size: 13px;
  text-align: left;
}
</style>
