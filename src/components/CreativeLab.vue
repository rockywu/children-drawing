<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight, Blocks, Clapperboard, Dice5, Flower2, FolderOpen, LockKeyhole, RefreshCw, UnlockKeyhole } from "lucide-vue-next";
import { readCreativeProject } from "../creative/project";
import type { CreativeKind, CreativeProject } from "../creative/types";

defineProps<{ compact?: boolean }>();
const emit = defineEmits<{
  start: [kind: CreativeKind | "drawing", title?: string];
  open: [project: CreativeProject, title: string];
}>();
const choices = [
  { kind: "symmetry" as const, title: "对称万花筒", tag: "一笔，开出一朵花", detail: "镜像、放射、彩虹笔，设计你的纹样与徽章。", icon: Flower2, color: "purple" },
  { kind: "pixel" as const, title: "像素创作", tag: "小方格，大角色", detail: "从 16 格开始，画头像、游戏角色和奇妙道具。", icon: Blocks, color: "green" },
  { kind: "animation" as const, title: "翻页动画", tag: "让想象，动起来", detail: "复制一帧，改变一点，做一段会循环的小动画。", icon: Clapperboard, color: "yellow" },
];
const pixels = ["00110000","01111000","11221100","11221100","11111100","01111000","01001000","11001100"];
const parts = ref([
  { label: "画什么", value: "一位机器人旅行家", locked: false, options: ["一位机器人旅行家", "一只会飞的鲸鱼", "一个未来游戏角色", "一顶有故事的面具", "一只住在月球的猫", "一朵机械花", "一枚探险队徽章", "一颗跳动的星星", "一座微型城市", "一棵会发光的树", "一位穿雨衣的精灵", "一件魔法道具"] },
  { label: "在哪里", value: "雨后的城市", locked: false, options: ["雨后的城市", "云上的图书馆", "海底的车站", "没有重力的花园", "窗边的微光里", "一百年后的校园", "像素游戏的关卡", "巨人的口袋里", "一场四季交替的梦", "夜空中的小岛", "安静的太空舱", "植物占领的旧工厂"] },
  { label: "试个挑战", value: "只用三种颜色", locked: false, options: ["只用三种颜色", "让左右两边呼应", "把开心变成一种形状", "藏一个只有你知道的细节", "尝试暖色与冷色相遇", "画出变化前后的瞬间", "让主角做一个循环动作", "用大小对比讲故事", "留出一片安静的空白", "给普通物品一个超能力", "用点和线创造纹理", "让影子有自己的想法"] },
]);
const prompt = computed(() => `${parts.value[0]!.value}，在${parts.value[1]!.value}，${parts.value[2]!.value}`);
const error = ref("");
const reading = ref(false);
const fileInput = ref<HTMLInputElement>();
function shuffle() {
  for (const part of parts.value) {
    if (part.locked) continue;
    const available = part.options.filter((value) => value !== part.value);
    part.value = available[Math.floor(Math.random() * available.length)]!;
  }
}
async function openFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || reading.value) return;
  reading.value = true;
  error.value = "";
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error("创作文件超过 16MB，请选择较小的文件");
    const data: unknown = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || !("format" in data) || data.format !== "little-art-planet" || !("project" in data)) throw new Error("请选择画画星球备份的 .artplanet 创作文件");
    const project = readCreativeProject(data.project);
    const title = "name" in data && typeof data.name === "string" ? data.name.trim().slice(0, 60) : "导入的创作";
    emit("open", project, title || "导入的创作");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "文件没有打开成功，原作品不受影响";
  } finally { reading.value = false; }
}
</script>

<template>
  <section class="creative-lab" :class="{ compact }">
    <div class="lab-heading">
      <div><h2><span class="section-icon purple"><Blocks :size="23" /></span>{{ compact ? "换一种方式，玩创作" : "今天，想制作什么？" }}</h2><p>{{ compact ? "你的画室之外，还有新的想象力实验。" : "适合 8～16 岁，自由探索，没有标准答案。每件创作都只保存在本机。" }}</p></div>
      <button v-if="!compact" class="outline-button" :disabled="reading" @click="fileInput?.click()"><FolderOpen :size="20" />{{ reading ? "正在读取…" : "打开创作文件" }}</button>
    </div>
    <div class="creative-card-grid">
      <button v-for="choice in choices" :key="choice.kind" class="creative-card" :class="choice.color" :aria-label="'开始' + choice.title" @click="emit('start', choice.kind)">
        <div class="creative-card-picture">
          <svg v-if="choice.kind === 'symmetry'" viewBox="0 0 260 150" aria-hidden="true"><g transform="translate(130 75)"><ellipse v-for="i in 8" :key="i" cx="0" cy="-32" rx="14" ry="36" :transform="`rotate(${i * 45})`" :fill="i % 2 ? '#cab9df' : '#e4a9a9'" fill-opacity=".65" stroke="#967cad" stroke-width="1.5"/><circle r="12" fill="#eed48c"/><circle r="48" fill="none" stroke="#c6b8d3" stroke-dasharray="3 6"/></g></svg>
          <svg v-else-if="choice.kind === 'pixel'" viewBox="0 0 260 150" aria-hidden="true"><g transform="translate(83 20)"><template v-for="(row, y) in pixels" :key="y"><rect v-for="(cell, x) in row" :key="x" :x="x * 14" :y="y * 14" width="14" height="14" :fill="cell === '0' ? 'transparent' : cell === '2' ? '#f7f2dc' : '#80a489'"/></template></g><path d="M57 53h14m-7-7v14m126 40h14m-7-7v14" stroke="#ccae5d" stroke-width="3" stroke-linecap="round"/></svg>
          <svg v-else viewBox="0 0 260 150" aria-hidden="true"><g v-for="i in 3" :key="i" :transform="`translate(${12 + (i-1)*81} 29)`"><rect width="73" height="91" rx="12" fill="#fffdf4" stroke="#d4c597" stroke-width="2"/><circle cx="36" :cy="i === 2 ? 31 : 58" r="16" fill="#e9bf6a"/><path :d="`M29 ${i === 2 ? 33 : 60}q7 7 14 0`" fill="none" stroke="#967441" stroke-width="2"/><text x="36" y="80" font-size="10" text-anchor="middle" fill="#9e936f">{{ i }}</text></g></svg>
        </div>
        <div class="creative-card-copy"><span class="creative-card-tag"><component :is="choice.icon" :size="17" />{{ choice.tag }}</span><h3>{{ choice.title }}</h3><p>{{ choice.detail }}</p><span class="creative-card-link">开始创作<ArrowRight :size="18" /></span></div>
      </button>
    </div>
    <template v-if="!compact">
      <input ref="fileInput" class="lab-file-input" type="file" accept=".artplanet,.json,application/json" aria-label="打开本地创作文件" @change="openFile" />
      <p v-if="error" class="lab-file-error" role="alert">{{ error }}</p>
      <section class="inspiration-draw" aria-labelledby="inspiration-draw-title">
        <div class="lab-heading"><div><h2 id="inspiration-draw-title"><Dice5 :size="25" />抽一张灵感签</h2><p>锁住喜欢的部分，换掉其他想法。灵感是起点，你可以随时不按它来。</p></div><button class="outline-button" @click="shuffle"><RefreshCw :size="20" />再抽一次</button></div>
        <div class="inspiration-parts"><div v-for="part in parts" :key="part.label" class="inspiration-part"><span>{{ part.label }}</span><strong>{{ part.value }}</strong><button :aria-label="(part.locked ? '解锁' : '锁定') + part.label" :aria-pressed="part.locked" @click="part.locked = !part.locked"><LockKeyhole v-if="part.locked" :size="19" /><UnlockKeyhole v-else :size="19" />{{ part.locked ? "已锁定" : "锁住这项" }}</button></div></div>
        <div class="inspiration-start"><span>带着这张签去创作</span><button class="primary-button small" @click="emit('start','drawing',prompt)">自由画画<ArrowRight :size="17" /></button><button v-for="choice in choices" :key="choice.kind" class="outline-button" @click="emit('start',choice.kind,prompt)"><component :is="choice.icon" :size="18" />{{ choice.title }}</button></div>
      </section>
      <p class="lab-storage-note">本地保存可继续编辑；下载 .artplanet 创作文件可备份全部笔迹、帧和设置，在这台或其他电脑的工坊重新打开。PNG/GIF 是分享图片，不包含全部编辑数据。</p>
    </template>
  </section>
</template>

<style scoped>
.creative-lab{margin:10px 0 34px}.creative-lab.compact{margin:30px 0 34px}.lab-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap}.lab-heading h2{display:flex;align-items:center;gap:10px;font-size:23px}.lab-heading p{font-size:14px;color:#829078;line-height:1.8;margin-top:8px}.lab-heading button{min-height:44px}.creative-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.creative-card{background:#fffef9;border:1px solid #e5e9dc;border-radius:24px;overflow:hidden;text-align:left;padding:0;transition:box-shadow .2s,transform .2s}.creative-card:hover{box-shadow:0 8px 24px #59734e14;transform:translateY(-3px)}.creative-card-picture{height:160px;background:#f0edf5;padding:5px 8px}.creative-card.green .creative-card-picture{background:#eaf2e6}.creative-card.yellow .creative-card-picture{background:#f7f0dd}.creative-card-picture svg{width:100%;height:100%}.creative-card-copy{padding:20px}.creative-card-tag{display:flex;align-items:center;gap:6px;font-size:12px;color:#9a83ac}.green .creative-card-tag{color:#6c8a66}.yellow .creative-card-tag{color:#ab8e46}.creative-card h3{font-size:22px;margin:10px 0}.creative-card p{font-size:14px;line-height:1.85;color:#839077;min-height:52px}.creative-card-link{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;margin-top:18px;color:#53764a}.inspiration-draw{background:#f1f4e9;border:1px solid #e3e9d9;border-radius:26px;padding:26px;margin-top:32px}.inspiration-parts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.inspiration-part{display:flex;flex-direction:column;align-items:flex-start;padding:20px;background:#fffdf6;border-radius:18px;min-width:0}.inspiration-part>span{font-size:12px;color:#969d83}.inspiration-part strong{font-size:19px;line-height:1.6;margin:10px 0;font-weight:600;flex:1}.inspiration-part button{display:flex;align-items:center;gap:7px;min-height:44px;font-size:13px;color:#8a9979;border-radius:10px;padding:8px}.inspiration-part button[aria-pressed=true]{background:#e7ecd9;color:#59704e}.inspiration-start{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:24px}.inspiration-start>span{font-size:13px;color:#8b987e;width:100%;margin-bottom:2px}.inspiration-start button{font-size:14px;min-height:44px}.lab-storage-note{font-size:12px;line-height:1.9;color:#8b977e;margin:22px 4px}.lab-file-input{display:none}.lab-file-error{padding:16px;background:#f8e9df;color:#9d644c;border-radius:14px;margin-top:16px}
@media(max-width:1100px){.creative-card-grid{gap:12px}.creative-card-copy{padding:16px}.creative-card h3{font-size:20px}.creative-card-picture{height:140px}.inspiration-parts{gap:10px}.inspiration-part{padding:15px}.inspiration-part strong{font-size:17px}}
@media(max-width:740px){.lab-heading h2{font-size:21px}.lab-heading p{font-size:13px}.creative-card-grid{grid-template-columns:1fr}.creative-card{display:grid;grid-template-columns:120px minmax(0,1fr);border-radius:20px}.creative-card-picture{height:100%;min-height:170px;display:flex;align-items:center;padding:0}.creative-card-picture svg{height:auto}.creative-card-copy{padding:16px}.creative-card-tag{font-size:11px}.creative-card h3{font-size:20px;margin:7px 0}.creative-card p{font-size:14px;min-height:0}.creative-card-link{margin-top:10px;font-size:14px}.inspiration-draw{padding:18px}.inspiration-parts{grid-template-columns:1fr}.inspiration-part{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px}.inspiration-part>span{grid-column:1}.inspiration-part strong{grid-column:1;margin:0}.inspiration-part button{grid-row:1 / 3;grid-column:2}.inspiration-start button{padding:9px 12px}.lab-storage-note{font-size:12px}}
@media(prefers-reduced-motion:reduce){.creative-card{transition:none}.creative-card:hover{transform:none}}
</style>
