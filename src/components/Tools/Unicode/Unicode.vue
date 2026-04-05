<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import Codemirror from "codemirror-editor-vue3";
import "codemirror/mode/javascript/javascript.js";

const info = reactive({
  title: "Unicode转中文",
  content: '\\u4f60\\u597d\\u4e16\\u754c',
  tranRes: '',
})

const cmOptions = {
  mode: "text/plain",
  lineNumbers: true,
  theme: "default",
  indentUnit: 2,
  tabSize: 2,
  lineWrapping: true,
  foldGutter: true,
  gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
}

const clearRes = () => {
  info.tranRes = ''
}

//to zh
//值转换中文
const toZH = () => {
  //clear
  clearRes()
  let str = info.content
  str = str.replace(/\\/g, "%");
  // 转换中文
  str = unescape(str);
  info.tranRes = str
}
//to unicode
const toUnicode = () => {
  //clear
  clearRes()
  //只转换中文
  for (let i = 0; i < info.content.length; i++) {
    if (/^[\u4E00-\u9FA5\uF900-\uFA2D]+$/.test(info.content[i])) {
      let code = info.content.charCodeAt(i).toString(16)
      info.tranRes += '\\u' + code
    } else {
      info.tranRes += info.content[i]
    }
  }
}

//copy
const copyRes = async () => {
  copy(info.tranRes)
}

//清空输入框
const clear = () => {
  info.content = ''
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      
      <div>
        <Codemirror
          v-model:value="info.content"
          :options="cmOptions"
          border
          height="200"
          width="100%"
          placeholder="请输入要转换的文本..."
        />
      </div>
      
      <div class="mt-4">
        <el-button type="primary" @click="toZH">unicode转中文</el-button>
        <el-button type="primary" @click="toUnicode">中文转unicode</el-button>
        <el-button type="primary" @click="copyRes">复制结果</el-button>
        <el-button type="primary" @click="clear">清空</el-button>
      </div>

      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3">
        <el-input type="textarea" :rows="8" v-model="info.tranRes" placeholder="转换结果将显示在这里..."></el-input>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="使用说明">
      <el-text>
        <p>Unicode（统一码）是计算机科学领域的国际编码标准，为世界上几乎所有的文字系统中的每个字符分配了唯一的数字编号，确保不同平台和程序之间能够一致地处理和显示文本。</p>
        <p class="mt-2">本工具支持 Unicode 编码与中文之间的双向转换：</p>
        <ul class="list-disc pl-6 mt-1">
          <li><strong>Unicode 转中文</strong>：将 <code>\u4f60\u597d</code> 格式的 Unicode 编码转换为对应的中文字符，适用于解码 JSON 数据、网页源码、API 返回值等场景中的中文乱码。</li>
          <li><strong>中文转 Unicode</strong>：将中文字符转换为 <code>\uXXXX</code> 格式的 Unicode 编码，常用于前端开发、国际化处理、数据传输等需要对中文进行编码的场景。</li>
        </ul>
        <p class="mt-2">使用方法：在输入框中粘贴需要转换的内容，点击对应按钮即可完成转换，支持一键复制结果。</p>
      </el-text>
    </ToolDetail>

  </div>
</template>

<style scoped>
</style>