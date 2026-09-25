<script setup lang="ts">
import { reactive, ref, shallowRef, onBeforeUnmount, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import html2canvas from "html2canvas";
import '@wangeditor/editor/dist/css/style.css' // 引入富文本 css
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'  //富文本组件
// import { copy } from '@/utils/string'
const info = reactive({
  title: "文本转图片",
  mode: 'default',
  convasWidth: 860,
  convasBackgroundColor: '#fff',
  downExt: '.png',
  downExts: [
    {
      value: '.png',
      label: '.png'
    },
    {
      value: '.jpg',
      label: '.jpg'
    },
  ]
})
// 编辑器实例，必须用 shallowRef
const editorRef = shallowRef()

// 内容 HTML
const valueHtml = ref(`文字转图片演示😀
拥有丰富的样式选择
可自由调整宽度背景色
支持一键导出为长图
`)

// 工具栏配置
const toolbarConfig = {
  excludeKeys: [
    "uploadImage",
    "group-video",
    "insertLink",
  ]
}

//编辑器配置
const editorConfig = { placeholder: '请输入内容...' }

const handleCreated = (editor) => {
  editorRef.value = editor // 记录 editor 实例，重要！
}

const goDown = async () => {
  const exportNode = document.createElement('div')
  exportNode.innerHTML = valueHtml.value
  Object.assign(exportNode.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${info.convasWidth}px`,
    minHeight: '1px',
    padding: '16px',
    boxSizing: 'border-box',
    color: '#18181b',
    backgroundColor: info.convasBackgroundColor,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: '16px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  })
  document.body.appendChild(exportNode)

  try {
    await nextTick()
    const canvas = await html2canvas(exportNode, {
      backgroundColor: info.convasBackgroundColor,
      useCORS: true,
      width: info.convasWidth,
      windowWidth: info.convasWidth,
      scale: window.devicePixelRatio || 1,
    })
    const isJpeg = info.downExt === '.jpg'
    const mime = isJpeg ? 'image/jpeg' : 'image/png'
    const baseImg = canvas.toDataURL(mime, isJpeg ? 0.92 : undefined)
    const save = document.createElement('a')
    save.href = baseImg
    save.download = `text-to-image${info.downExt}`
    save.click()
  } finally {
    exportNode.remove()
  }
}


// 组件销毁时，也及时销毁编辑器
onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor == null) return
  editor.destroy()
})

//copy
// const copyRes = async (resStr: string) => {
//   copy(resStr)
// }
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white dark:bg-surface-0 border border-transparent dark:border-border-default">
      <div>
        <div class="">
          
          <div class="flex items-center">
            <el-text class="w-20">宽度：</el-text>
            <el-slider v-model="info.convasWidth" show-input size="large" :min="260" :max="1920"/>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <div class="">
            <el-text>背景颜色：</el-text>
            <el-color-picker v-model="info.convasBackgroundColor" size="large" />
          </div>
          <div class="flex">
            <el-select v-model="info.downExt" class="downext-select" placeholder="Select">
              <el-option
                v-for="item in info.downExts"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-button type="primary" class="ml-2"  @click="goDown">下载</el-button> 
          </div>
        </div>
      </div>
      <div class="border border-border-default relative z-10 mt-3">
        <Toolbar
          class="border-b"
          :editor="editorRef"
          :defaultConfig="toolbarConfig"
          :mode="info.mode"
        />
        <Editor
          v-model="valueHtml"
          :defaultConfig="editorConfig"
          :mode="info.mode"
          @onCreated="handleCreated"
        />
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        把文本转换成图片，生成长图，富文本自定义文字排版，可导出png，jpeg格式，可更换背景图，设置宽度，是好用的文本转图片工具
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
.downext-select{
  @apply w-24
}
</style>