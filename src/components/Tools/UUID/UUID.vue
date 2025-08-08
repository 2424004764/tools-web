<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'
import { v4 as uuidv4 } from 'uuid'
// src/components/Tools/UUID/UUID.vue
// 1) state 增加格式字段
const info = reactive({
  title: "UUID生成器",
  resStr: '',
  pwNum: 5,
  autosize: {
    minRows: 5
  },
  format: 'lower', // 新增：lower | upper | lowerNoHyphen | upperNoHyphen
})

//生成
const gen = () => {
  //生成数量验证
  if (info.pwNum > 100) {
    ElMessage({
      message: "生成数量范围在1~100",
      type: "warning",
      duration: 1500
    })
    return
  }
  //清空旧数据
  info.resStr = ''

  //按数量生成密码
  for (let i = 1; i <= info.pwNum; i++) {
    let ext = '\n'
    if (i == info.pwNum) {
      ext = ''
    }
    // 3) 生成处应用格式化
    // 替换原来的：info.resStr += uuidv4() + ext
    const raw = uuidv4()
    info.resStr += formatUuid(raw) + ext
  }
}

//copy
const copyRes = async (resStr: string) => {
  copy(resStr)
}

// 2) 新增：格式化函数
const formatUuid = (u: string) => {
  let s = u
  if (info.format === 'upper' || info.format === 'upperNoHyphen') {
    s = s.toUpperCase()
  } else {
    s = s.toLowerCase()
  }
  if (info.format === 'lowerNoHyphen' || info.format === 'upperNoHyphen') {
    s = s.replace(/-/g, '')
  }
  return s
}

// src/components/Tools/UUID/UUID.vue
// 在脚本中增加预设数组

// 挂载后自动生成
onMounted(() => {
  gen()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div>
        <el-text>生成数量: {{ info.pwNum }}</el-text>
        <el-slider v-model="info.pwNum" :min="1" :max="100" :step="1" />
      </div>
      <!-- 将“格式”行改为：添加 flex 对齐与固定宽度标签 -->
      <div class="mt-3 flex items-center">
        <span class="mr-2 inline-block w-20 text-right">格式:</span>
        <el-radio-group v-model="info.format" size="large">
          <el-radio-button label="lower">小写</el-radio-button>
          <el-radio-button label="upper">大写</el-radio-button>
          <el-radio-button label="lowerNoHyphen">去掉-小写</el-radio-button>
          <el-radio-button label="upperNoHyphen">去掉-大写</el-radio-button>
        </el-radio-group>
      </div>
      <div class="mt-3 mb-3">
        <el-button type="primary" @click="gen">生成UUID</el-button>
        <el-button type="primary" @click="copyRes(info.resStr)">复制全部</el-button>
      </div>
      <!-- res -->
      <div>
        <el-input type="textarea" :autosize="info.autosize" v-model="info.resStr" readonly></el-input>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        在线UUID批量生成
      </el-text> 
    </ToolDetail>

  </div>
</template>

<style scoped>

</style>