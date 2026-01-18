<script setup lang="ts">
import { reactive, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "土地亩数计算器",
  length: 0, // 长（米）
  width: 0, // 宽（米）
  unit: 'm' // 单位：m-米，km-千米
})

// 计算亩数
const mu = computed(() => {
  const { length, width, unit } = info
  if (!length || !width) return 0

  let area = length * width

  // 如果单位是千米，转换为平方米
  if (unit === 'km') {
    area = area * 1000000 // 1平方千米 = 1000000平方米
  }

  // 1亩 = 666.67平方米
  return area / 666.67
})

// 计算平方米
const squareMeters = computed(() => {
  const { length, width, unit } = info
  if (!length || !width) return 0

  let area = length * width

  // 如果单位是千米，转换为平方米
  if (unit === 'km') {
    area = area * 1000000
  }

  return area
})

// 计算公顷
const hectares = computed(() => {
  return squareMeters.value / 10000 // 1公顷 = 10000平方米
})

// 计算平方千米
const squareKilometers = computed(() => {
  return squareMeters.value / 1000000 // 1平方千米 = 1000000平方米
})

// 格式化数字
const formatNumber = (num: number, decimals: number = 2) => {
  if (!num) return '0'
  return num.toFixed(decimals)
}

// 重置
const reset = () => {
  info.length = 0
  info.width = 0
  info.unit = 'm'
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 单位选择 -->
      <div class="mb-6">
        <div class="flex items-center mb-2">
          <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
          </svg>
          <h3 class="text-sm font-bold text-gray-800">测量单位</h3>
        </div>
        <div class="flex gap-2">
          <button
            @click="info.unit = 'm'"
            :class="[
              'flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 border-2 flex items-center justify-center text-sm',
              info.unit === 'm'
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/50 scale-105'
                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
            ]"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
            米 (m)
          </button>
          <button
            @click="info.unit = 'km'"
            :class="[
              'flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 border-2 flex items-center justify-center text-sm',
              info.unit === 'km'
                ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/50 scale-105'
                : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50'
            ]"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
            千米 (km)
          </button>
        </div>
      </div>

      <!-- 尺寸输入 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
          <div class="flex items-center mb-3">
            <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
              </svg>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-0.5">土地长度</label>
              <div class="text-xs text-gray-500">请输入土地长度</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <el-input-number
              v-model="info.length"
              :min="0"
              :precision="2"
              :step="info.unit === 'm' ? 1 : 0.01"
              class="flex-1"
              placeholder="请输入长度"
            />
            <div class="text-xs text-gray-500 font-medium min-w-[40px] text-right">{{ info.unit === 'm' ? '米' : '千米' }}</div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100 shadow-sm">
          <div class="flex items-center mb-3">
            <div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
              </svg>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-0.5">土地宽度</label>
              <div class="text-xs text-gray-500">请输入土地宽度</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <el-input-number
              v-model="info.width"
              :min="0"
              :precision="2"
              :step="info.unit === 'm' ? 1 : 0.01"
              class="flex-1"
              placeholder="请输入宽度"
            />
            <div class="text-xs text-gray-500 font-medium min-w-[40px] text-right">{{ info.unit === 'm' ? '米' : '千米' }}</div>
          </div>
        </div>
      </div>

      <!-- 计算结果 -->
      <div v-if="info.length > 0 && info.width > 0" class="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-5 mb-6 shadow-md border border-blue-100">
        <div class="flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
          </svg>
          <h3 class="text-xl font-bold text-gray-800">计算结果</h3>
        </div>

        <!-- 主要结果 - 亩数 -->
        <div class="bg-white rounded-xl p-4 mb-4 shadow-sm border-2 border-blue-400">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center">
              <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
                </svg>
              </div>
              <div class="text-sm text-gray-500">土地面积（亩数）</div>
            </div>
            <div class="text-4xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-right flex-1">{{ formatNumber(mu, 2) }}</div>
            <div class="text-xl font-bold text-gray-600">亩</div>
          </div>
        </div>

        <!-- 其他单位换算 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow border-l-4 border-green-500">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center">
                <div class="w-8 h-8 bg-green-100 rounded flex items-center justify-center mr-2 flex-shrink-0">
                  <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path>
                  </svg>
                </div>
                <div class="text-xs text-gray-500">平方米</div>
              </div>
              <div class="text-lg font-bold text-green-600 text-right flex-1">{{ formatNumber(squareMeters) }}</div>
              <div class="text-xs text-gray-500">㎡</div>
            </div>
          </div>

          <div class="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow border-l-4 border-purple-500">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center">
                <div class="w-8 h-8 bg-purple-100 rounded flex items-center justify-center mr-2 flex-shrink-0">
                  <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </div>
                <div class="text-xs text-gray-500">公顷</div>
              </div>
              <div class="text-lg font-bold text-purple-600 text-right flex-1">{{ formatNumber(hectares) }}</div>
              <div class="text-xs text-gray-500">ha</div>
            </div>
          </div>

          <div class="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow border-l-4 border-orange-500">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center">
                <div class="w-8 h-8 bg-orange-100 rounded flex items-center justify-center mr-2 flex-shrink-0">
                  <svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                  </svg>
                </div>
                <div class="text-xs text-gray-500">平方千米</div>
              </div>
              <div class="text-lg font-bold text-orange-600 text-right flex-1">{{ formatNumber(squareKilometers, 4) }}</div>
              <div class="text-xs text-gray-500">km²</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <el-button type="primary" size="large" class="flex-1" @click="reset">
          重置
        </el-button>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4">
        <div>
          <h4 class="font-bold text-gray-800 mb-2">基本操作</h4>
          <ul class="space-y-1 text-sm text-gray-600">
            <li>1. 选择测量单位：根据实际情况选择"米"或"千米"作为测量单位</li>
            <li>2. 输入土地尺寸：在"土地长度"和"土地宽度"输入框中输入相应的数值</li>
            <li>3. 查看计算结果：系统会自动计算并显示亩数、平方米、公顷、平方千米等多种单位</li>
            <li>4. 重置数据：点击"重置"按钮可清空所有输入，重新开始计算</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-gray-800 mb-2">单位换算关系</h4>
          <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
            <div>• 1亩 = 666.67平方米 ≈ 666.67㎡</div>
            <div>• 1亩 = 0.066667公顷 ≈ 0.0667ha</div>
            <div>• 1亩 = 0.000666667平方千米 ≈ 0.000667km²</div>
            <div>• 1公顷 = 15亩 = 10000平方米</div>
            <div>• 1平方千米 = 1500亩 = 100公顷</div>
          </div>
        </div>

        <div>
          <h4 class="font-bold text-gray-800 mb-2">应用场景</h4>
          <ul class="space-y-1 text-sm text-gray-600">
            <li>• 农田面积计算：快速计算农田、果园、菜地的亩数</li>
            <li>• 土地测量：土地勘测、规划、评估时的面积换算</li>
            <li>• 房地产交易：宅基地、建设用地面积计算</li>
            <li>• 农业补贴：根据亩数计算农业补贴金额</li>
            <li>• 产量估算：根据亩数和亩产估算总产量</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-gray-800 mb-2">常见问题</h4>
          <div class="space-y-2 text-sm text-gray-600">
            <div class="bg-blue-50 rounded-lg p-3">
              <div class="font-medium text-blue-800 mb-1">问：如何计算不规则土地的亩数？</div>
              <div class="text-blue-700">答：可将不规则土地分割成多个规则的矩形或三角形，分别计算后相加即可。</div>
            </div>
            <div class="bg-green-50 rounded-lg p-3">
              <div class="font-medium text-green-800 mb-1">问：亩和公顷有什么区别？</div>
              <div class="text-green-700">答：亩是中国传统土地面积单位，1公顷=15亩。公顷是国际单位，常用于大面积土地。</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-3">
              <div class="font-medium text-purple-800 mb-1">问：为什么是666.67平方米？</div>
              <div class="text-purple-700">答：1亩的标准定义是60平方丈，1丈=10/3米，所以1亩=60×(10/3)²=666.67平方米。</div>
            </div>
          </div>
        </div>

        <div>
          <h4 class="font-bold text-gray-800 mb-2">计算示例</h4>
          <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-2">
            <div><strong>示例1：</strong>一块地长100米，宽50米</div>
            <div class="pl-4">面积 = 100 × 50 = 5000平方米</div>
            <div class="pl-4">亩数 = 5000 ÷ 666.67 = 7.5亩</div>
            <div class="mt-2"><strong>示例2：</strong>一块地长1千米，宽0.5千米</div>
            <div class="pl-4">面积 = 1 × 0.5 = 0.5平方千米 = 500000平方米</div>
            <div class="pl-4">亩数 = 500000 ÷ 666.67 = 750亩</div>
          </div>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>
