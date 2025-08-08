<script setup lang="ts">
import { reactive,ref,onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { escape, unescape } from 'lodash';
import { copy } from '@/utils/string'
const info = reactive({
  title: "HTML实体转义",
})

const content = ref('')
const cleanContent = ref('')

const parser = (type: string) => {
  if (type == 'toHTML') {
    //转html
    cleanContent.value = unescape(content.value)
  } else {
    //转实体
    cleanContent.value = escape(content.value)
  }
}

//清空输入框
const clear = () => {
  content.value = ''
  cleanContent.value = ''
}

// 新增：示例与填充方法
const exampleRaw = '<div class="note">Tom & Jerry > Mickey & Minnie © 2025</div>'
const exampleEntity = escape(exampleRaw)
const fillRaw = () => { content.value = exampleRaw; cleanContent.value = '' }
const fillEntity = () => { content.value = exampleEntity; cleanContent.value = '' }


onMounted(() => {
})

</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white ">
      <!-- 输入区：增加提示与示例 -->
      <div class="mb-2 text-gray-500 text-sm">
        在此输入 HTML 源码或包含实体的文本。点击下方按钮进行转换。
        <el-link type="primary" class="ml-2" @click="copy(content)">复制输入</el-link>
      </div>
      <div class="mb-1 text-xs text-gray-500 break-all">
        示例：{{ exampleRaw }}
        <el-link type="primary" class="ml-2" @click="fillRaw">填充HTML示例</el-link>
        <el-divider direction="vertical" />
        实体示例：{{ exampleEntity }}
        <el-link type="primary" class="ml-2" @click="fillEntity">填充实体示例</el-link>
      </div>
      <el-input
        v-model="content"
        :rows="10"
        type="textarea"
        placeholder="输入 HTML 或实体文本，点击下方按钮进行转换"
        @change="parser"
      />
        <div class="mt-3">
          <el-button type="primary" @click="parser('toEntity')">HTML转实体</el-button>
          <el-button type="primary" @click="parser('toHTML')">实体转HTML</el-button>
          <el-button type="primary" @click="copy(cleanContent)">复制结果</el-button>
          <el-button type="primary" @click="clear">清除</el-button>
        </div>
      </div>

      <!-- 结果区：增加说明与复制链接 -->
      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3">
        <div class="mb-2 text-gray-500 text-sm">
          转换结果
          <el-link type="primary" class="ml-2" @click="copy(cleanContent)">复制结果</el-link>
        </div>
        <el-input
          v-html="cleanContent"
          v-model="cleanContent"
          :rows="10"
          type="textarea"
        />
      </div>


      <!-- desc（替换原有简短描述） -->
      <ToolDetail title="描述">
        <div class="text-sm leading-7">
          <p class="font-bold">使用方式</p>
          <p>1) 在上方输入 HTML 源码或实体文本；点击“HTML转实体/实体转HTML”进行转换。</p>
          <p>2) 可点击“填充HTML示例/填充实体示例”快速体验。</p>
          <br>
          <p class="font-bold">常见字符映射</p>
          <ul class="list-disc ml-5">
            <li><code>&lt;</code> → <code>&amp;lt;</code></li>
            <li><code>&gt;</code> → <code>&amp;gt;</code></li>
            <li><code>&amp;</code> → <code>&amp;amp;</code></li>
            <li><code>"</code> → <code>&amp;quot;</code></li>
            <li><code>'</code> → <code>&amp;#39;</code></li>
          </ul>
        </div>
      </ToolDetail>
  </div>
</template>

<style scoped>

</style>