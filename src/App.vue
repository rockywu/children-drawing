<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Flower2,
  House,
  Images,
  Leaf,
  Lightbulb,
  Paintbrush,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Trash2,
  X,
} from "lucide-vue-next";
import ArtScene from "./components/ArtScene.vue";
import PaintStudio from "./components/PaintStudio.vue";
import FullscreenButton from "./components/FullscreenButton.vue";
import { deleteArtwork, listArtworks } from "./storage";
import type { Artwork } from "./storage";

type Page = "home" | "inspiration" | "gallery";
const page = ref<Page>("home");
const painting = ref(false);
const selectedArtwork = ref<Artwork>();
const selectedTheme = ref("");
const artworks = ref<Artwork[]>([]);
const loading = ref(true);
const storageError = ref("");
const showHelp = ref(false);
const deleting = ref<Artwork>();
const deleteBusy = ref(false);
const toast = ref("");
let toastTimer: ReturnType<typeof setTimeout>;

const themes = [
  {
    id: "garden",
    title: "森林里的小伙伴",
    subtitle: "和小动物一起，发现春天",
    tag: "自然奇遇",
    color: "green",
  },
  {
    id: "space",
    title: "宇宙奇妙旅行",
    subtitle: "坐上火箭，去看看星星",
    tag: "天马行空",
    color: "purple",
  },
  {
    id: "ocean",
    title: "海底的秘密",
    subtitle: "大海里，藏着什么惊喜？",
    tag: "探索世界",
    color: "blue",
  },
  {
    id: "magic",
    title: "住进童话里",
    subtitle: "一座只属于你的魔法小屋",
    tag: "奇思妙想",
    color: "pink",
  },
];

const pageInfo = computed(
  () =>
    ({
      home: {
        title: "我的画室",
        subtitle: "让每一个小小的想法，都有大大的世界。",
      },
      inspiration: {
        title: "灵感乐园",
        subtitle: "不知道画什么？来这里捡一颗灵感种子。",
      },
      gallery: {
        title: "作品小屋",
        subtitle: "你的想象力，都好好收藏在这里。",
      },
    })[page.value],
);

async function refresh() {
  loading.value = true;
  try {
    artworks.value = await listArtworks();
    storageError.value = "";
  } catch {
    storageError.value =
      "作品暂时无法读取。你仍然可以画画并下载 PNG，请检查浏览器是否允许本地存储。";
  } finally {
    loading.value = false;
  }
}

function start(theme = "", artwork?: Artwork) {
  selectedTheme.value = theme;
  selectedArtwork.value = artwork;
  painting.value = true;
}

async function leaveStudio() {
  painting.value = false;
  await refresh();
}
function notify(message: string) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 3500);
}

async function confirmDelete() {
  if (!deleting.value || deleteBusy.value) return;
  deleteBusy.value = true;
  try {
    await deleteArtwork(deleting.value.id);
    deleting.value = undefined;
    await refresh();
    notify("作品已删除");
  } catch {
    notify("删除失败，作品还在，请再试一次");
  } finally {
    deleteBusy.value = false;
  }
}

function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
}

onMounted(refresh);
</script>

<template>
  <PaintStudio
    v-if="painting"
    :artwork="selectedArtwork"
    :theme="selectedTheme"
    @back="leaveStudio"
    @saved="refresh"
  />
  <div v-else class="app-shell">
    <aside class="sidebar">
      <a
        class="brand"
        href="#"
        aria-label="画画星球首页"
        @click.prevent="page = 'home'"
      >
        <span class="brand-icon"
          ><Palette :size="30" :stroke-width="1.7" /><span class="brand-spark"
            >✦</span
          ></span
        >
        <span>画画星球<small>LITTLE ART PLANET</small></span>
      </a>
      <div class="sidebar-label">我的创作天地</div>
      <nav class="main-nav" aria-label="主导航">
        <button :class="{ active: page === 'home' }" @click="page = 'home'">
          <House :size="23" /><span>我的画室</span
          ><span v-if="page === 'home'" class="nav-dot"></span>
        </button>
        <button
          :class="{ active: page === 'inspiration' }"
          @click="page = 'inspiration'"
        >
          <Lightbulb :size="23" /><span>灵感乐园</span
          ><span v-if="page === 'inspiration'" class="nav-dot"></span>
        </button>
        <button
          :class="{ active: page === 'gallery' }"
          @click="page = 'gallery'"
        >
          <Images :size="23" /><span>作品小屋</span
          ><span v-if="page === 'gallery'" class="nav-dot"></span>
        </button>
      </nav>
      <div class="sidebar-note">
        <div class="mini-flower">
          <Flower2 :size="49" :stroke-width="1.3" /><span class="flower-leaf"
            >✧</span
          >
        </div>
        <p>不必画得“很像”<br />画出你的想象就好</p>
        <span class="note-line"></span>
        <small>每一笔，都是你的独一无二</small>
      </div>
      <div class="sidebar-bottom">
        <button @click="showHelp = true">
          <CircleHelp :size="20" />画室使用指南<ChevronRight
            :size="16"
          /></button
        ><span><ShieldCheck :size="15" />安心创作，自由想象</span>
      </div>
    </aside>

    <main class="main-content">
      <header class="page-header">
        <div>
          <h1>
            {{ pageInfo.title
            }}<Sprout v-if="page === 'home'" class="title-sprout" :size="25" />
          </h1>
          <p>{{ pageInfo.subtitle }}</p>
        </div>
        <div class="page-header-actions">
          <FullscreenButton />
          <div class="little-artist">
            <span class="avatar"><Palette :size="25" /></span
            ><span>你好，小画家<small>今天也有好多奇妙想法！</small></span
            ><span class="hello-star">✦</span>
          </div>
        </div>
      </header>

      <template v-if="page === 'home'">
        <section class="welcome-banner">
          <div class="banner-copy">
            <span class="eyebrow"><span></span>给想象力一点自由</span>
            <h2>
              小小画笔，<br />画出<span
                >大大世界<svg viewBox="0 0 220 14" aria-hidden="true">
                  <path
                    d="M4 10Q104-4 215 7"
                    fill="none"
                    stroke="#D5AD56"
                    stroke-width="6"
                    stroke-linecap="round"
                  /></svg></span
              >。
            </h2>
            <p>
              森林、星空，或是一个全新的世界，<br />这里的每一种可能，都由你来创造。
            </p>
            <button class="primary-button start-button" @click="start()">
              <Paintbrush :size="22" />开始画画<ArrowRight :size="20" /></button
            ><span class="banner-footnote">不用准备好，想画就出发</span>
          </div>
          <ArtScene hero />
          <span class="banner-doodle doodle-one">✧</span
          ><span class="banner-doodle doodle-two">✦</span>
        </section>

        <section class="themes-section">
          <div class="section-heading">
            <div>
              <h2>
                <span class="section-icon yellow"><Lightbulb :size="23" /></span
                >找一点小灵感<span class="heading-caption">让好奇心带路</span>
              </h2>
            </div>
            <button class="text-button" @click="page = 'inspiration'">
              逛逛灵感乐园<ArrowRight :size="18" />
            </button>
          </div>
          <div class="theme-grid">
            <button
              v-for="theme in themes"
              :key="theme.id"
              class="theme-card"
              @click="start(theme.id)"
            >
              <div class="theme-image">
                <ArtScene :kind="theme.id" /><span
                  class="theme-tag"
                  :class="theme.color"
                  >{{ theme.tag }}</span
                ><span class="theme-hover"
                  ><Paintbrush :size="20" />画画这个世界</span
                >
              </div>
              <div class="theme-details">
                <h3>{{ theme.title }}</h3>
                <p>{{ theme.subtitle }}</p>
                <span class="theme-arrow"><ArrowRight :size="18" /></span>
              </div>
            </button>
          </div>
        </section>
      </template>

      <template v-if="page === 'inspiration'">
        <section class="inspiration-intro">
          <span class="intro-icon"><Sparkles :size="32" /></span>
          <div>
            <h2>每一个“如果”，都是一幅画的开始</h2>
            <p>选一个喜欢的世界，参考小插画，把故事画成你自己的样子。</p>
          </div>
          <span class="intro-star">✦</span>
        </section>
        <div class="theme-grid inspiration-grid">
          <button
            v-for="theme in themes"
            :key="theme.id"
            class="theme-card"
            @click="start(theme.id)"
          >
            <div class="theme-image">
              <ArtScene :kind="theme.id" /><span
                class="theme-tag"
                :class="theme.color"
                >{{ theme.tag }}</span
              ><span class="theme-hover"
                ><Paintbrush :size="20" />画画这个世界</span
              >
            </div>
            <div class="theme-details">
              <h3>{{ theme.title }}</h3>
              <p>{{ theme.subtitle }}</p>
              <span class="theme-arrow"><ArrowRight :size="20" /></span>
            </div>
          </button>
        </div>
        <div class="inspiration-bottom">
          <Leaf :size="25" />
          <p>灵感只是一个起点，你也可以完全不按它来。</p>
          <button class="text-button" @click="start()">
            我想自由画<ArrowRight :size="19" />
          </button>
        </div>
      </template>

      <section v-if="page !== 'inspiration'" class="artworks-section">
        <div class="section-heading">
          <h2>
            <span class="section-icon green"><BookOpen :size="22" /></span
            >{{ page === "gallery" ? "我的所有作品" : "最近的小创作"
            }}<span v-if="artworks.length" class="artwork-count">{{
              artworks.length
            }}</span
            ><span v-else class="heading-caption">把想象好好收藏</span>
          </h2>
          <button
            v-if="page === 'home' && artworks.length"
            class="text-button"
            @click="page = 'gallery'"
          >
            全部作品<ArrowRight :size="18" /></button
          ><button
            v-if="page === 'gallery'"
            class="primary-button small"
            @click="start()"
          >
            <Plus :size="21" />画一幅新的</button
          ><span v-if="page === 'home' && !artworks.length" class="local-label"
            ><ShieldCheck :size="15" />作品保存在本浏览器</span
          >
        </div>
        <p v-if="storageError" class="storage-error" role="alert">
          {{ storageError
          }}<button class="text-button" @click="refresh">重新读取</button>
        </p>
        <p v-else-if="loading" class="loading-message">正在打开你的作品小屋…</p>
        <div v-else-if="!artworks.length" class="empty-artworks">
          <div class="empty-sketch">
            <svg viewBox="0 0 146 110" fill="none" aria-hidden="true">
              <rect
                x="28"
                y="13"
                width="82"
                height="87"
                rx="8"
                transform="rotate(-9 28 13)"
                fill="#E3EBD9"
              />
              <rect
                x="35"
                y="11"
                width="80"
                height="88"
                rx="8"
                transform="rotate(7 35 11)"
                fill="#FFFDF6"
                stroke="#BBCBB2"
                stroke-width="2"
              />
              <path
                d="M51 77L67 56L80 68L91 53L105 83"
                stroke="#B3C59F"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="63" cy="39" r="8" fill="#EED393" />
              <path
                d="M121 25L126 36L138 39L126 43L121 54L117 43L105 39L117 36Z"
                fill="#E1B870"
              />
              <path
                d="M17 70L12 77M21 80L12 83"
                stroke="#A6B797"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div>
            <h3>这里，等着你的第一幅大作</h3>
            <p>随手画一画，把今天的奇思妙想留下来。</p>
          </div>
          <button class="outline-button" @click="start()">
            <Plus :size="21" />画第一幅作品
          </button>
        </div>
        <div v-else class="artwork-grid">
          <article
            v-for="art in page === 'home' ? artworks.slice(0, 3) : artworks"
            :key="art.id"
            class="artwork-card"
          >
            <button
              class="artwork-open"
              :aria-label="'继续画：' + art.name"
              @click="start(art.theme, art)"
            >
              <img :src="art.thumbnail" :alt="art.name" /><span
                class="artwork-overlay"
                ><Paintbrush :size="20" />继续画画</span
              >
            </button>
            <div class="artwork-details">
              <button @click="start(art.theme, art)">
                <h3>{{ art.name }}</h3>
                <span>{{ dateLabel(art.updated) }} · 创意已收藏</span></button
              ><button
                class="icon-button delete-art"
                :aria-label="'删除作品：' + art.name"
                @click="deleting = art"
              >
                <Trash2 :size="19" />
              </button>
            </div>
          </article>
        </div>
        <p v-if="page === 'gallery' && artworks.length" class="gallery-note">
          <ArrowDownToLine :size="17" />打开作品后，可以下载 PNG
          图片。作品仅存于当前浏览器，清理浏览器数据会删除作品。
        </p>
      </section>
      <footer class="page-footer">
        <span>✧</span> 每一个天马行空的想法，都值得被画下来。<span>✧</span>
      </footer>
    </main>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message" role="status">
        <Check :size="21" />{{ toast }}
      </div></Transition
    >

    <div
      v-if="showHelp"
      class="modal-backdrop"
      @click.self="showHelp = false"
      @keydown.esc="showHelp = false"
    >
      <section
        v-dialog-focus
        class="modal help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <button
          class="icon-button modal-close"
          aria-label="关闭使用指南"
          autofocus
          @click="showHelp = false"
        >
          <X :size="23" /></button
        ><span class="modal-illustration"><Palette :size="40" /></span>
        <h2 id="help-title">欢迎来到你的画画星球</h2>
        <p>不用注册，也没有标准答案。<br />选一支画笔，就可以出发啦。</p>
        <div class="help-steps">
          <div>
            <span>1</span>
            <p>
              <strong>想怎么画，就怎么画</strong
              >画笔、颜色、形状和贴纸都可以试试。
            </p>
          </div>
          <div>
            <span>2</span>
            <p>
              <strong>画错了也没关系</strong>点撤销，回到上一笔。还能再重做。
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              <strong>把喜欢的画留下来</strong
              >点“保存作品”，下次在作品小屋继续。<br />也可以下载
              PNG，把画带到别的地方。
            </p>
          </div>
        </div>
        <p class="help-storage">
          <ShieldCheck
            :size="18"
          />作品存在本浏览器中。清理浏览器数据前，记得下载备份。
        </p>
        <button class="primary-button" @click="showHelp = false">
          知道啦<Star :size="19" />
        </button>
      </section>
    </div>
    <div
      v-if="deleting"
      class="modal-backdrop"
      @click.self="!deleteBusy && (deleting = undefined)"
    >
      <section
        v-dialog-focus
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <span class="modal-illustration coral"><Trash2 :size="32" /></span>
        <h2 id="delete-title">要和这幅画说再见吗？</h2>
        <p>“{{ deleting.name }}”删除后就找不回来了。</p>
        <div class="modal-actions">
          <button
            class="outline-button"
            :disabled="deleteBusy"
            autofocus
            @click="deleting = undefined"
          >
            留下它</button
          ><button
            class="danger-button"
            :disabled="deleteBusy"
            @click="confirmDelete"
          >
            {{ deleteBusy ? "正在删除…" : "确认删除" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
