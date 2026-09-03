<script setup lang="ts">
import { onMounted, onUnmounted, nextTick, reactive, ref,computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { UploadProps,UploadRawFile,genFileId, ElMessage } from 'element-plus'
import Download from '~icons/ep/download'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import JSZip from 'jszip'
import { fetchMyGenerationRecordImage } from '@/api/me'

const info = reactive({
  title: "图片切割",
})

// 行数/列数的 localStorage 键名
const LINE_NUM_KEY = 'imgcut_lineNum'

const fileList = ref()
const lineNum = ref(3)
const image = ref({} as any)
const cutImg = ref([] as string[])
const dataFileRef = ref()
const splitMode = ref<'grid' | 'horizontal' | 'vertical'>('grid')

//上传
// 返回 Promise，在 <img> onload 后才 resolve，让 await 调用方能准确知道「图真的渲染好了」
// —— 这样跳转带 URL 自动加载时，loading 蒙层可以卡到图片就绪再消失，不闪屏
const updateDataFile = (params): Promise<void> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(reader.error || new Error('FileReader 失败'))
  reader.onload = () => {
    const imageTmp = new Image()
    imageTmp.onload = () => {
      image.value = imageTmp
      cut()
      resolve()
    }
    imageTmp.onerror = () => reject(new Error('图片解码失败'))
    imageTmp.src = reader.result as string
  }
  reader.readAsDataURL(params.file)
})

//当超出限制时，执行的钩子函数
//这里覆盖前一个文件
const handleExceed: UploadProps['onExceed'] = (files) => {
  dataFileRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  dataFileRef.value!.handleStart(file)
  dataFileRef.value!.submit()
}

//切割
const cut = () => {
  if (!image.value.src) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = image.value;

  const wpiece = Math.floor(img.naturalWidth / lineNum.value);
  const hpiece = Math.floor(img.naturalHeight / lineNum.value);
  const results = [] as string[];

  canvas.width = wpiece;
  canvas.height = hpiece;

  for (let r = 0; r < lineNum.value; r++) {
      for (let c = 0; c < lineNum.value; c++) {
          ctx?.drawImage(
              img,
              c * wpiece,
              r * hpiece,
              wpiece,
              hpiece,
              0,
              0,
              wpiece,
              hpiece
          );
          results.push(canvas.toDataURL());
      }
  }
  cutImg.value = results;
  splitMode.value = 'grid';
}

//水平拆分 - 上下两半（横向切割，从中间分割）
const splitHorizontal = () => {
  if (!image.value.src) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = image.value;

  const wpiece = img.naturalWidth;
  const hpiece = Math.floor(img.naturalHeight / 2);
  const results = [] as string[];

  canvas.width = wpiece;
  canvas.height = hpiece;

  // 上半部分
  ctx?.drawImage(img, 0, 0, wpiece, hpiece, 0, 0, wpiece, hpiece);
  results.push(canvas.toDataURL());

  // 下半部分
  ctx?.drawImage(img, 0, hpiece, wpiece, hpiece, 0, 0, wpiece, hpiece);
  results.push(canvas.toDataURL());

  cutImg.value = results;
  splitMode.value = 'horizontal';
}

//垂直拆分 - 左右两半（竖向切割，从中间分割）
const splitVertical = () => {
  if (!image.value.src) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = image.value;

  const wpiece = Math.floor(img.naturalWidth / 2);
  const hpiece = img.naturalHeight;
  const results = [] as string[];

  canvas.width = wpiece;
  canvas.height = hpiece;

  // 左半部分
  ctx?.drawImage(img, 0, 0, wpiece, hpiece, 0, 0, wpiece, hpiece);
  results.push(canvas.toDataURL());

  // 右半部分
  ctx?.drawImage(img, wpiece, 0, wpiece, hpiece, 0, 0, wpiece, hpiece);
  results.push(canvas.toDataURL());

  cutImg.value = results;
  splitMode.value = 'vertical';
}

//计算切割样式（仅控制网格，不再设置固定宽度）
const cutImgStyle = computed(() => {
  if (splitMode.value === 'horizontal') {
    // 水平拆分（上下两半）：2 行 1 列
    return 'grid-template-rows: repeat(2, 1fr); grid-template-columns: 1fr;';
  }
  if (splitMode.value === 'vertical') {
    // 垂直拆分（左右两半）：1 行 2 列
    return 'grid-template-rows: 1fr; grid-template-columns: repeat(2, 1fr);';
  }
  return `grid: repeat(${lineNum.value}, 1fr) / repeat(${lineNum.value}, 1fr);`;
})

//下载单个图片
const downloadSingle = (src: string, index: number) => {
  const link = document.createElement('a');
  link.href = src;
  link.download = `cut_${index + 1}.png`;
  link.click();
}

//下载所有图片
const downloadAll = async () => {
  if (cutImg.value.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder('cut_images');

  // 如果文件夹创建失败，直接返回
  if (!folder) return;

  // 将所有 base64 图片添加到 zip
  cutImg.value.forEach((src, index) => {
    // 移除 data:image/png;base64, 前缀
    const base64Data = src.split(',')[1];
    folder.file(`cut_${index + 1}.png`, base64Data, { base64: true });
  });

  // 生成 zip 文件并下载
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = 'cut_images.zip';
  link.click();
  URL.revokeObjectURL(link.href);
}

watch(cutImgStyle, () => {
  if (fileList.value && splitMode.value === 'grid') cut();
})

// 监听行数列数变化，持久化到 localStorage
watch(lineNum, (val) => {
  try {
    localStorage.setItem(LINE_NUM_KEY, String(val))
  } catch (e) {
    // localStorage 不可用时静默忽略
  }
})

// ============ 从 URL query 自动加载源图（由 AI 图片编辑工具跳转过来） ============
// 第三方图床通常没有 CORS 头，前端直接 fetch 会失败。
// 统一走后端 /api/image-proxy 代理拿 blob：浏览器视角下响应来自同源，没有跨域问题，
// canvas drawImage 也能正常拿到像素数据。后端代理内部做了白名单 + SSRF 防护。
const route = useRoute()
const isLoadingFromUrl = ref(false)

// 加载源图时的自转 spinner —— 用 requestAnimationFrame 直接改 transform，
// 避开 CSS 动画 / prefers-reduced-motion / scoped keyframes 注入失败等问题。
const urlLoadingSpinnerRef = ref<HTMLDivElement | null>(null)
let urlSpinnerRafId = 0
let urlSpinnerAngle = 0
const startUrlSpinner = () => {
  if (!urlLoadingSpinnerRef.value || urlSpinnerRafId) return
  const tick = () => {
    urlSpinnerAngle = (urlSpinnerAngle + 6) % 360
    if (urlLoadingSpinnerRef.value) {
      urlLoadingSpinnerRef.value.style.transform = `rotate(${urlSpinnerAngle}deg)`
    }
    urlSpinnerRafId = requestAnimationFrame(tick)
  }
  tick()
}
const stopUrlSpinner = () => {
  if (urlSpinnerRafId) {
    cancelAnimationFrame(urlSpinnerRafId)
    urlSpinnerRafId = 0
  }
}
watch(isLoadingFromUrl, async (val) => {
  if (val) {
    // 等到 v-if 真的把 spinner div 渲染出来再启动 rAF
    await nextTick()
    startUrlSpinner()
  } else {
    stopUrlSpinner()
  }
})

const loadFromUrl = async () => {
  const url = typeof route.query.url === 'string' ? route.query.url : ''
  const recordId = typeof route.query.recordId === 'string' ? route.query.recordId : ''
  if (!url && !recordId) return

  isLoadingFromUrl.value = true
  try {
    // 优先用 recordId 走「生成记录图片代理」：同源、不受第三方图床 CORS 限制，
    // 且后端能把 data: base64 图也解出来（image-proxy 只认 http/https，data: 图
    // 从 AI 图片编辑跳过来时只能靠这条路）。
    if (recordId) {
      const { blob } = await fetchMyGenerationRecordImage(recordId)
      const file = new File([blob], 'imgcut-source.png', { type: blob.type || 'image/png' })
      // 复用 el-upload 的 http-request 流程：FileReader → Image onload → cut()
      await updateDataFile({ file })
      ElMessage.success('已加载源图，可调整行/列数开始切割')
      return
    }

    // 无 recordId（极少见的历史/外链场景）：退回通用图片代理
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`
    const resp = await fetch(proxyUrl)
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status}${text ? `: ${text}` : ''}`)
    }
    const blob = await resp.blob()
    // 优先用上游 Content-Type 给个合理后缀名
    const contentType = resp.headers.get('Content-Type') || 'image/png'
    const ext = contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'png'
    const filename = `imgcut-source.${ext}`
    const file = new File([blob], filename, { type: contentType })
    await updateDataFile({ file })
    ElMessage.success('已加载源图，可调整行/列数开始切割')
  } catch (err) {
    console.error('[imgcut] loadFromUrl failed', err)
    ElMessage.error('加载源图失败：' + ((err as Error)?.message || '未知错误'))
  } finally {
    isLoadingFromUrl.value = false
  }
}

onMounted(() => {
  // 从 localStorage 恢复行数/列数设置
  try {
    const saved = localStorage.getItem(LINE_NUM_KEY)
    if (saved !== null) {
      const parsed = Number(saved)
      // 校验范围（与 el-input-number 的 min/max 保持一致）
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 10) {
        lineNum.value = parsed
      }
    }
  } catch (e) {
    // localStorage 不可用时静默忽略
  }
  // 如果是从 AI 图片编辑跳转过来的（带 url 参数），自动加载源图
  loadFromUrl()
})

// 卸载时停掉 spinner rAF，避免内存泄漏
onUnmounted(() => {
  stopUrlSpinner()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <el-upload
        v-model:file-list="fileList"
        class="dataFileRef flex flex-col md:flex-row gap-2 md:gap-3 w-full"
        ref="dataFileRef"
        accept="image/*"
        :http-request="updateDataFile"
        :on-exceed="handleExceed"
        :limit="1"
      >
        <el-button type="primary">请上传需要切割的图片</el-button>
        <span v-if="isLoadingFromUrl" class="self-center text-caption text-gray-500 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 018-8M20 12a8 8 0 01-8 8" />
          </svg>
          正在加载源图…
        </span>
      </el-upload>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center">
          <el-text>行数和列数</el-text>
          <el-input-number v-model="lineNum" :min="1" :max="10" class="ml-3"/>
        </div>
        <el-button type="success" :disabled="!image.src" @click="splitHorizontal">
          水平拆分
        </el-button>
        <el-button type="warning" :disabled="!image.src" @click="splitVertical">
          垂直拆分
        </el-button>
      </div>


      <!-- 包裹图片预览区域，加载源图时整块覆盖半透明蒙层 + spinner，
           同时兼容「空状态」和「已有图被替换」两种情况 -->
      <div class="relative">
        <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3 flex flex-col md:flex-row gap-4 items-start" v-if="image.src">
          <!-- 预览 -->
          <div class="w-full md:w-1/2">
            <div class="flex justify-between items-center mb-2">
              <el-text>预览: (点击图片可单独下载)</el-text>
              <el-button type="primary" size="small" @click="downloadAll" :disabled="cutImg.length === 0">
                <el-icon class="mr-1"><Download /></el-icon>
                下载所有
              </el-button>
            </div>
            <div :style="cutImgStyle" class="grid gap-2 w-full items-stretch justify-items-center">
              <!-- w-full + max-h-[320px] + object-contain：
                   - 宽按 cell 撑满，高度由 max-h 兜底
                   - object-contain 在高度被截断时按比例缩放，不变形
                   - 水平/垂直拆分下 cell 较宽的部分由 object-contain 自动留白居中
                   - 1x1、3x3 网格时图片大约 320px 高，整体不会溢出视口 -->
              <img v-for="(src,index) in cutImg" :key="index" :src="src" alt="结果" class="w-full max-h-[320px] h-auto object-contain rounded-md cursor-pointer hover:opacity-80 transition-opacity bg-white" @click="downloadSingle(src, index)"/>
            </div>
          </div>

          <!-- 原图 -->
          <div class="w-full md:w-1/2">
            <el-text>原图: </el-text>
            <div class="w-full">
              <img :src="image.src" alt="原图" v-if="image.src" class="max-w-full max-h-[480px] h-auto block rounded-md bg-white"/>
            </div>
          </div>
        </div>
        <div v-else-if="!isLoadingFromUrl">
          <el-empty :image-size="200" description="无预览"/>
        </div>

        <!-- 加载源图蒙层：覆盖整个图片区，await updateDataFile 解析（即 img.onload）后才隐藏。
             min-h-md 保证「image 还没加载出来」时空状态也有合理高度，蒙层不会塌成 0 -->
        <div
          v-if="isLoadingFromUrl"
          class="absolute inset-0 z-10 min-h-md flex flex-col items-center justify-center gap-3 rounded-lg bg-white/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <!-- 自转 spinner：JS rAF 驱动，绕开 prefers-reduced-motion -->
          <div ref="urlLoadingSpinnerRef" class="url-loading-spinner" aria-hidden="true"></div>
          <span class="text-body-sm text-gray-600 tracking-wider">正在加载源图…</span>
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        将图片分割成四宫格、九宫格、十六宫格，支持自定义行与列；<br>
        还支持水平拆分（上下两半）与垂直拆分（左右两半），快速将图片从中间一分为二。<br>
        比如：九宫格切图广泛应用于微信朋友圈，微博等社交媒体。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
:deep(.el-upload-list__item){
  width: 100%;
}
:deep(.el-upload-list__item-name){
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

/* ============ URL 自动加载源图：自转 spinner ============
   旋转由 JS rAF 直接改 style.transform，不写 animation——
   避开 prefers-reduced-motion / scoped keyframes 注入失败等问题。 */
.url-loading-spinner {
  display: block;
  width: 36px;
  height: 36px;
  border: 3px solid #e0e7ff;
  border-top-color: #6366f1;
  border-radius: 50%;
  will-change: transform;
}
</style>