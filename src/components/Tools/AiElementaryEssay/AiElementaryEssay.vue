<script setup lang="ts">
import { ref, reactive } from "vue";
import axios from "axios";
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";

const info = reactive({
  title: "AI小学作文",
  desc: "按年级/题材/关键词生成贴合小学生水平的作文，支持字数、风格与结构控制。",
});

const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || "");
const pollinationsProxyUrl = ref(import.meta.env.VITE_POLLINATIONS_PROXY_URL);
const pollinationsTextUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL);

const title = ref("");
const grade = ref<
  "一年级" | "二年级" | "三年级" | "四年级" | "五年级" | "六年级"
>("三年级");
const genre = ref<"写人" | "叙事" | "写景" | "状物" | "应用文">("叙事");
const tone = ref<"童趣活泼" | "真诚朴实" | "优美细腻" | "幽默轻松">("童趣活泼");
const words = ref<200 | 300 | 400 | 500>(300);
const keywords = ref("");
const customReq = ref("");
const useMetaphor = ref(true);
const usePersonification = ref(true);
const useParallel = ref(false);
const useDialogue = ref(true);
const threePart = ref(true);
const echoBeginningEnd = ref(true);
const simpleWords = ref(true);

const loading = ref(false);
const result = ref("");

const buildPrompt = () => {
  const kws = keywords.value.trim();
  const req: string[] = [];
  if (threePart.value) req.push("三段式结构");
  if (echoBeginningEnd.value) req.push("首尾呼应");
  if (useDialogue.value) req.push("包含对话");
  if (useMetaphor.value) req.push("比喻");
  if (usePersonification.value) req.push("拟人");
  if (useParallel.value) req.push("排比");
  if (simpleWords.value) req.push("用词浅显");

  const reqText = req.length ? `，要求：${req.join("、")}` : "";
  const t = title.value.trim()
    ? `，题目：《${title.value.trim()}》`
    : "，题目自拟（2-10字）";
  const kline = kws ? `，关键词：${kws}` : "";
  const extra = customReq.value.trim()
    ? `，其他要求：${customReq.value
        .trim()
        .replace(/[\r\n]+/g, " ")
        .replace(/[，。；]+/g, "，")}`
    : "";

  const s = `${grade.value}作文，约${words.value}字，${genre.value}，${tone.value}${kline}${t}${reqText}${extra}。请直接输出“标题：xxx”和“正文：...”的内容，不要附加解释。`;
  return s;
};

const generate = async () => {
  loading.value = true;
  result.value = "";
  try {
    const prompt = buildPrompt();
    const resp = await axios.get(
      `${pollinationsProxyUrl.value}?path=${encodeURIComponent(
        prompt
      )}&target=${pollinationsTextUrl.value}&params=_t=${Date.now()}`,
      { headers: { Authorization: "Bearer " + pollinationsApiKey.value } }
    );
    const text: string =
      typeof resp.data === "string" ? resp.data : String(resp.data);
    result.value = text;
  } catch (e) {
    console.error(e);
    alert("生成失败，请稍后重试");
  } finally {
    loading.value = false;
  }
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("已复制");
  } catch {
    alert("复制失败，请手动复制");
  }
};

const resetForm = () => {
  title.value = "";
  grade.value = "三年级";
  genre.value = "叙事";
  tone.value = "童趣活泼";
  words.value = 300;
  keywords.value = "";
  customReq.value = ''
  useMetaphor.value = true;
  usePersonification.value = true;
  useParallel.value = false;
  useDialogue.value = true;
  threePart.value = true;
  echoBeginningEnd.value = true;
  simpleWords.value = true;
  result.value = "";
};
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />
    <div class="p-4 rounded-2xl bg-white">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-3">
          <input
            v-model="title"
            placeholder="题目（可留空，自动生成）"
            class="w-full p-2 border rounded"
          />
          <div class="grid grid-cols-2 gap-2">
            <select v-model="grade" class="w-full p-2 border rounded">
              <option>一年级</option>
              <option>二年级</option>
              <option>三年级</option>
              <option>四年级</option>
              <option>五年级</option>
              <option>六年级</option>
            </select>
            <select v-model="genre" class="w-full p-2 border rounded">
              <option>写人</option>
              <option>叙事</option>
              <option>写景</option>
              <option>状物</option>
              <option>应用文</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <select v-model="tone" class="w-full p-2 border rounded">
              <option>童趣活泼</option>
              <option>真诚朴实</option>
              <option>优美细腻</option>
              <option>幽默轻松</option>
            </select>
            <select v-model="words" class="w-full p-2 border rounded">
              <option :value="200">约200字</option>
              <option :value="300">约300字</option>
              <option :value="400">约400字</option>
              <option :value="500">约500字</option>
            </select>
          </div>
          <textarea
            v-model="keywords"
            placeholder="关键词（用逗号/空格分隔，可留空）"
            class="w-full p-2 border rounded min-h-[80px]"
          ></textarea>
          <textarea
            v-model="customReq"
            placeholder="自定义要求（可留空），如：避免复杂成语，加入一处对话"
            class="w-full p-2 border rounded min-h-[60px]"
          ></textarea>

          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2"
              ><input type="checkbox" v-model="threePart" />三段式结构</label
            >
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                v-model="echoBeginningEnd"
              />首尾呼应</label
            >
            <label class="flex items-center gap-2"
              ><input type="checkbox" v-model="useDialogue" />包含对话</label
            >
            <label class="flex items-center gap-2"
              ><input type="checkbox" v-model="useMetaphor" />比喻</label
            >
            <label class="flex items-center gap-2"
              ><input type="checkbox" v-model="usePersonification" />拟人</label
            >
            <label class="flex items-center gap-2"
              ><input type="checkbox" v-model="useParallel" />排比</label
            >
            <label class="flex items-center gap-2"
              ><input type="checkbox" v-model="simpleWords" />用词浅显</label
            >
          </div>

          <div class="flex gap-2">
            <button
              @click="generate"
              :disabled="loading"
              class="px-4 py-2 rounded text-white"
              :class="loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'"
            >
              {{ loading ? "生成中..." : "生成作文" }}
            </button>
            <button
              @click="resetForm"
              class="px-4 py-2 rounded border hover:bg-gray-50"
            >
              重置
            </button>
            <button
              @click="copyText(result)"
              class="px-4 py-2 rounded border hover:bg-gray-50"
            >
              复制结果
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <textarea
            v-model="result"
            readonly
            class="w-full p-3 border rounded min-h-[320px] bg-gray-50"
            placeholder="生成的作文将显示在这里"
          ></textarea>
        </div>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>{{ info.desc }}</el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>
