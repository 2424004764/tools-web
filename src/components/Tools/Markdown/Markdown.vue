<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import VueMarkdownEditor from '@kangc/v-md-editor'
import '@kangc/v-md-editor/lib/style/base-editor.css'
import vuepressTheme from '@kangc/v-md-editor/lib/theme/vuepress.js'
import '@kangc/v-md-editor/lib/theme/style/vuepress.css'
import Prism from 'prismjs'

VueMarkdownEditor.use(vuepressTheme, { Prism })

const info = reactive({
  title: "在线markdown编辑器",
  content: '',
})


//copy
// const copyRes = async (resStr: string) => {
//   copy(resStr)
// }
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="">
      <v-md-editor v-model="info.content" height="500px"></v-md-editor>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        在线编辑markdown
      </el-text> 
    </ToolDetail>

  </div>
</template>

<style scoped>

</style>