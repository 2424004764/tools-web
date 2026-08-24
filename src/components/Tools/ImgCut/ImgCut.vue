<script setup lang="ts">
import { onMounted, reactive, ref,computed, watch } from 'vue'
import { UploadProps,UploadRawFile,genFileId } from 'element-plus'
import Download from '~icons/ep/download'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import JSZip from 'jszip'

const info = reactive({
  title: "图片切割",
})

const fileList = ref()
const lineNum = ref(3)
const image = ref({} as any)
const cutImg = ref([] as string[])
const dataFileRef = ref()
const splitMode = ref<'grid' | 'horizontal' | 'vertical'>('grid')

//上传
const updateDataFile = async (params) => {
  let reader = new FileReader();
  reader.readAsDataURL(params.file);
  reader.addEventListener(
      'load',
      async () => {
          const imageTmp = new Image();
          imageTmp.onload = () => {
            image.value = imageTmp;
            cut();
          };
          imageTmp.src = reader.result as string;
      },
      false
  );
}

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

onMounted(() => {

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
          <div :style="cutImgStyle" class="grid gap-2 w-full">
            <img v-for="(src,index) in cutImg" :key="index" :src="src" alt="结果" class="w-full h-auto block cursor-pointer hover:opacity-80 transition-opacity" @click="downloadSingle(src, index)"/>
          </div>
        </div>

        <!-- 原图 -->
        <div class="w-full md:w-1/2">
          <el-text>原图: </el-text>
          <div class="w-full">
            <img :src="image.src" alt="原图" v-if="image.src" class="max-w-full h-auto block"/>
          </div>
        </div>
      </div>
      <div v-else>
        <el-empty :image-size="200" description="无预览"/>
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
</style>