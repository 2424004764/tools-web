<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string';
import Codemirror from "codemirror-editor-vue3";
import "codemirror/mode/javascript/javascript.js";
import * as prettier from "prettier/standalone";
import * as parserBabel from 'prettier/parser-babel';
import { ElMessage } from 'element-plus'
import { minify } from "terser"

const info = reactive({
  title: "JS代码格式化/压缩",
  code: '',
  isParseErr: false,
  parseErr: '',
})

const cmOptions = {
  mode: "javascript",
  lineNumbers: true,
  theme: "default",
  indentUnit: 2,
  tabSize: 2,
  lineWrapping: true,
  foldGutter: true,
  gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
  autoCloseBrackets: true,
  matchBrackets: true,
  showCursorWhenSelecting: true,
  styleActiveLine: true,
  extraKeys: {
    "Ctrl-Space": "autocomplete",
    "Ctrl-/": "toggleComment",
    "Ctrl-F": "findPersistent",
    "Ctrl-H": "replace",
    "F11": function(cm: any) {
      cm.setOption("fullScreen", !cm.getOption("fullScreen"));
    },
    "Esc": function(cm: any) {
      if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
    }
  },
  hintOptions: {
    completeSingle: false
  },
  search: {
    bottom: true
  }
}

//格式化
const formatCode = async () => {
  try {
    info.isParseErr = false;
    info.parseErr = '';
    // 检查代码是否为空
    if (!info.code.trim()) {
      info.isParseErr = true;
      info.parseErr = '请输入JS代码';
      ElMessage({
        showClose: true,
        message: '请输入JS代码',
        type: 'warning',
      })
      return;
    }
    info.code = await prettier.format(info.code, { parser: "babel", plugins: [parserBabel]})
  } catch (error) {
    console.log('格式化错误:', error);
    info.isParseErr = true;
    info.parseErr = '请填入正确的JS代码';
    ElMessage({
      showClose: true,
      message: '请填入正确的JS代码',
      type: 'error',
    })
  }
}

//混淆压缩
const confuseCompress = async () => {
  try {
    info.isParseErr = false;
    info.parseErr = '';
    // 检查代码是否为空
    if (!info.code.trim()) {
      info.isParseErr = true;
      info.parseErr = '请输入JS代码';
      ElMessage({
        showClose: true,
        message: '请输入JS代码',
        type: 'warning',
      })
      return;
    }
    let res = await minify(info.code, {
      mangle: {
        toplevel: true,
      }
    })
    info.code = res.code != undefined ? res.code : info.code
  } catch(error) {
    console.log('压缩错误:', error);
    info.isParseErr = true;
    info.parseErr = '请填入正确的JS代码: ' + (error as Error).message;
    ElMessage({
      showClose: true,
      message: '请填入正确的JS代码: ' + (error as Error).message,
      type: 'error',
    })
  }
}

//清空输入框
const clear = () => {
  info.code = ''
  info.isParseErr = false;
  info.parseErr = '';
}

const copyRes = async () => {
  copy(info.code)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      
      <div>
        <Codemirror
          v-model:value="info.code"
          :options="cmOptions"
          border
          height="400"
          width="100%"
          placeholder="请输入JS代码..."
        />
      </div>
      
      <div class="mt-4 flex flex-wrap gap-2">
        <el-button type="primary" @click="formatCode">格式化</el-button>
        <el-button type="primary" @click="confuseCompress">混淆压缩</el-button>
        <el-button type="primary" @click="copyRes">复制</el-button>
        <el-button type="primary" @click="clear">清空</el-button>
      </div>

      <div class="mt-3 min-h-md bg-red-100 p-3 mb-3" v-show="info.isParseErr">
        <el-text type="danger">{{ info.parseErr }}</el-text>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        JS代码格式化/压缩工具，提供在线JS代码格式化、JS代码压缩、JS代码混淆功能。支持ES6+语法，可以帮助开发者快速格式化代码，提高代码可读性，同时提供代码压缩功能来减小文件体积。
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>