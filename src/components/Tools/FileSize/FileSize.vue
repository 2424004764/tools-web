<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

// 单位选项
const units = [
  { label: '字节 (B)', value: 'B', key: 'bytes', color: 'bg-blue-50 border-blue-200' },
  { label: '千字节 (KB)', value: 'KB', key: 'kb', color: 'bg-green-50 border-green-200' },
  { label: '兆字节 (MB)', value: 'MB', key: 'mb', color: 'bg-purple-50 border-purple-200' },
  { label: '吉字节 (GB)', value: 'GB', key: 'gb', color: 'bg-orange-50 border-orange-200' },
  { label: '太字节 (TB)', value: 'TB', key: 'tb', color: 'bg-red-50 border-red-200' },
  { label: '拍字节 (PB)', value: 'PB', key: 'pb', color: 'bg-indigo-50 border-indigo-200' },
  { label: '艾字节 (EB)', value: 'EB', key: 'eb', color: 'bg-pink-50 border-pink-200' },
  { label: '泽字节 (ZB)', value: 'ZB', key: 'zb', color: 'bg-yellow-50 border-yellow-200' },
  { label: '尧字节 (YB)', value: 'YB', key: 'yb', color: 'bg-teal-50 border-teal-200' },
]

// 单位转换系数（以字节为基准）
const unitFactors = {
  'B': 1,
  'KB': 1024,
  'MB': 1024 * 1024,
  'GB': 1024 * 1024 * 1024,
  'TB': 1024 * 1024 * 1024 * 1024,
  'PB': 1024 * 1024 * 1024 * 1024 * 1024,
  'EB': 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  'ZB': 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  'YB': 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
}

const info = reactive({
  title: "文件大小转换",
  // 每个单位对应的输入值，MB默认为1
  bytes: '',
  kb: '',
  mb: '1',
  gb: '',
  tb: '',
  pb: '',
  eb: '',
  zb: '',
  yb: '',
})

// 监听所有输入框的变化
const handleInputChange = (field: string, value: string) => {
  if (!value || isNaN(Number(value))) {
    // 清空所有输入框
    Object.keys(info).forEach(key => {
      if (key !== 'title') {
        info[key as keyof typeof info] = ''
      }
    })
    return
  }

  const inputNum = parseFloat(value)
  const unit = units.find(u => u.key === field)?.value || 'B'
  const bytes = inputNum * unitFactors[unit as keyof typeof unitFactors]

  // 计算其他单位的值
  units.forEach(unit => {
    if (unit.key !== field) {
      const result = bytes / unitFactors[unit.value as keyof typeof unitFactors]
      info[unit.key as keyof typeof info] = result.toFixed(6).replace(/\.?0+$/, '')
    }
  })
}

// 清空所有输入框
const clearAll = () => {
  units.forEach(unit => {
    info[unit.key as keyof typeof info] = ''
  })
}

// 组件挂载时计算初始值
onMounted(() => {
  // 以1MB为基准计算其他单位的值
  const bytes = 1 * unitFactors['MB']
  
  units.forEach(unit => {
    if (unit.key !== 'mb') {
      const result = bytes / unitFactors[unit.value as keyof typeof unitFactors]
      info[unit.key as keyof typeof info] = result.toFixed(6).replace(/\.?0+$/, '')
    }
  })
})
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm">
      <div class="max-w-6xl mx-auto">
        <!-- 输入区域 -->
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div 
              v-for="unit in units" 
              :key="unit.key"
              :class="`${unit.color} p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md`"
            >
              <label class="text-sm font-medium text-gray-700 mb-2 block">
                {{ unit.label }}
              </label>
              <el-input
                v-model="info[unit.key as keyof typeof info]"
                @input="(value) => handleInputChange(unit.key, value)"
                placeholder="0"
                type="number"
                class="w-full"
                clearable
              />
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex justify-center">
            <el-button @click="clearAll" type="info">
              清空所有
            </el-button>
          </div>
        </div>

        <!-- 常用转换示例 -->
        <div class="mt-8 border-t pt-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">常用转换示例</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 class="font-medium text-blue-900 mb-2">1 MB = 1024 KB</h4>
              <p class="text-sm text-blue-600">在MB输入框输入1，KB会自动显示1024</p>
            </div>
            <div class="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 class="font-medium text-green-900 mb-2">1 GB = 1024 MB</h4>
              <p class="text-sm text-green-600">在GB输入框输入1，MB会自动显示1024</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 class="font-medium text-purple-900 mb-2">1 TB = 1024 GB</h4>
              <p class="text-sm text-purple-600">在TB输入框输入1，GB会自动显示1024</p>
            </div>
            <div class="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 class="font-medium text-orange-900 mb-2">1 PB = 1024 TB</h4>
              <p class="text-sm text-orange-600">在PB输入框输入1，TB会自动显示1024</p>
            </div>
            <div class="bg-red-50 p-4 rounded-lg border border-red-200">
              <h4 class="font-medium text-red-900 mb-2">1 EB = 1024 PB</h4>
              <p class="text-sm text-red-600">在EB输入框输入1，PB会自动显示1024</p>
            </div>
            <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
              <h4 class="font-medium text-indigo-900 mb-2">1 ZB = 1024 EB</h4>
              <p class="text-sm text-indigo-600">在ZB输入框输入1，EB会自动显示1024</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        文件大小单位转换工具，支持多种存储单位之间的实时转换：<br><br>
        
        支持单位：字节(B)、千字节(KB)、兆字节(MB)、吉字节(GB)、太字节(TB)、拍字节(PB)、艾字节(EB)、泽字节(ZB)、尧字节(YB)<br>
        实时转换：在任意输入框输入数值，其他单位会自动计算并显示对应值<br>
        转换精度：保留6位小数，自动去除末尾的0<br>
        便捷功能：支持清空所有输入框<br><br>
        
        适用于文件大小计算、存储容量规划、数据传输估算等场景。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义样式 */
.el-input .el-input__inner {
  background-color: white;
}
</style> 