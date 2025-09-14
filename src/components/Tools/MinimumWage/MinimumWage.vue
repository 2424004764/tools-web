<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { Search } from '@element-plus/icons-vue'

const info = reactive({
  title: "最低工资标准查询",
})

// 搜索关键词
const searchKeyword = ref('')

// 最低工资标准数据
const minimumWageData = reactive([
  { region: '北京', monthly1: '2420', monthly2: '', monthly3: '', monthly4: '', hourly1: '26.4', hourly2: '', hourly3: '', hourly4: '' },
  { region: '天津', monthly1: '2320', monthly2: '', monthly3: '', monthly4: '', hourly1: '24.4', hourly2: '', hourly3: '', hourly4: '' },
  { region: '河北', monthly1: '2200', monthly2: '2000', monthly3: '1800', monthly4: '', hourly1: '22', hourly2: '20', hourly3: '18', hourly4: '' },
  { region: '山西', monthly1: '2150', monthly2: '2050', monthly3: '1950', monthly4: '', hourly1: '23.2', hourly2: '22.1', hourly3: '20.9', hourly4: '' },
  { region: '内蒙古', monthly1: '2270', monthly2: '2200', monthly3: '2140', monthly4: '', hourly1: '22.4', hourly2: '21.7', hourly3: '21.1', hourly4: '' },
  { region: '辽宁', monthly1: '2100', monthly2: '1900', monthly3: '1700', monthly4: '', hourly1: '21', hourly2: '19', hourly3: '17', hourly4: '' },
  { region: '吉林', monthly1: '2120', monthly2: '1920', monthly3: '1780', monthly4: '', hourly1: '21', hourly2: '19.5', hourly3: '18', hourly4: '' },
  { region: '黑龙江', monthly1: '2080', monthly2: '1850', monthly3: '1750', monthly4: '', hourly1: '19', hourly2: '17', hourly3: '16.5', hourly4: '' },
  { region: '上海', monthly1: '2740', monthly2: '', monthly3: '', monthly4: '', hourly1: '25', hourly2: '', hourly3: '', hourly4: '' },
  { region: '江苏', monthly1: '2490', monthly2: '2260', monthly3: '2010', monthly4: '', hourly1: '24', hourly2: '22', hourly3: '20', hourly4: '' },
  { region: '浙江', monthly1: '2490', monthly2: '2260', monthly3: '2010', monthly4: '', hourly1: '24', hourly2: '22', hourly3: '20', hourly4: '' },
  { region: '安徽', monthly1: '2060', monthly2: '1930', monthly3: '1870', monthly4: '1780', hourly1: '21', hourly2: '20', hourly3: '19', hourly4: '18' },
  { region: '福建', monthly1: '2265', monthly2: '2195', monthly3: '2045', monthly4: '1895', hourly1: '23.5', hourly2: '23', hourly3: '21.5', hourly4: '20' },
  { region: '江西', monthly1: '2000', monthly2: '1870', monthly3: '1740', monthly4: '', hourly1: '20', hourly2: '18.7', hourly3: '17.4', hourly4: '' },
  { region: '山东', monthly1: '2200', monthly2: '2010', monthly3: '1820', monthly4: '', hourly1: '22', hourly2: '20', hourly3: '18', hourly4: '' },
  { region: '河南', monthly1: '2100', monthly2: '2000', monthly3: '1800', monthly4: '', hourly1: '20.6', hourly2: '19.6', hourly3: '17.6', hourly4: '' },
  { region: '湖北', monthly1: '2210', monthly2: '1950', monthly3: '1800', monthly4: '', hourly1: '22', hourly2: '19.5', hourly3: '18', hourly4: '' },
  { region: '湖南', monthly1: '2100', monthly2: '1900', monthly3: '1700', monthly4: '', hourly1: '21', hourly2: '19', hourly3: '17', hourly4: '' },
  { region: '广东', monthly1: '2500', monthly2: '2080', monthly3: '1850', monthly4: '1750', hourly1: '23.7', hourly2: '19.8', hourly3: '18.3', hourly4: '17.4' },
  { region: '深圳', monthly1: '2520', monthly2: '', monthly3: '', monthly4: '', hourly1: '23.7', hourly2: '', hourly3: '', hourly4: '' },
  { region: '广西', monthly1: '2200', monthly2: '2040', monthly3: '1870', monthly4: '', hourly1: '22.4', hourly2: '20.7', hourly3: '19', hourly4: '' },
  { region: '海南', monthly1: '2010', monthly2: '1850', monthly3: '', monthly4: '', hourly1: '17.9', hourly2: '16.3', hourly3: '', hourly4: '' },
  { region: '重庆', monthly1: '2330', monthly2: '2200', monthly3: '', monthly4: '', hourly1: '23', hourly2: '22', hourly3: '', hourly4: '' },
  { region: '四川', monthly1: '2330', monthly2: '2200', monthly3: '', monthly4: '', hourly1: '23', hourly2: '22', hourly3: '', hourly4: '' },
  { region: '贵州', monthly1: '2130', monthly2: '1980', monthly3: '1890', monthly4: '', hourly1: '22.4', hourly2: '20.8', hourly3: '19.8', hourly4: '' },
  { region: '云南', monthly1: '2070', monthly2: '1920', monthly3: '1770', monthly4: '', hourly1: '20', hourly2: '19', hourly3: '18', hourly4: '' },
  { region: '西藏', monthly1: '2100', monthly2: '', monthly3: '', monthly4: '', hourly1: '20', hourly2: '', hourly3: '', hourly4: '' },
  { region: '陕西', monthly1: '2160', monthly2: '2050', monthly3: '1950', monthly4: '', hourly1: '21', hourly2: '20', hourly3: '19', hourly4: '' },
  { region: '甘肃', monthly1: '2020', monthly2: '1960', monthly3: '1910', monthly4: '1850', hourly1: '21', hourly2: '20.5', hourly3: '20', hourly4: '19.5' },
  { region: '青海', monthly1: '2080', monthly2: '', monthly3: '', monthly4: '', hourly1: '20', hourly2: '', hourly3: '', hourly4: '' },
  { region: '宁夏', monthly1: '2050', monthly2: '1900', monthly3: '', monthly4: '', hourly1: '20', hourly2: '18', hourly3: '', hourly4: '' },
  { region: '新疆', monthly1: '2070', monthly2: '1890', monthly3: '1750', monthly4: '', hourly1: '20.7', hourly2: '18.9', hourly3: '17.5', hourly4: '' },
])

// 过滤数据
const filteredData = computed(() => {
  if (!searchKeyword.value) {
    return minimumWageData
  }
  return minimumWageData.filter(item => 
    item.region.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 清空搜索
const clearSearch = () => {
  searchKeyword.value = ''
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 数据更新时间提示 -->
      <div class="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-blue-700">
              <strong>数据更新时间：</strong>截至2025年7月1日
            </p>
            <p class="text-xs text-blue-600 mt-1">
              数据来源：<a 
                href="https://www.mohrss.gov.cn/SYrlzyhshbzb/laodongguanxi_/fwyd/202507/t20250715_549132.html" 
                target="_blank" 
                rel="noopener noreferrer"
                class="hover:underline"
              >
                人力资源和社会保障部
              </a>
            </p>
          </div>
        </div>
      </div>

      <!-- 搜索框 -->
      <div class="mb-4">
        <el-input
          v-model="searchKeyword"
          placeholder="请输入地区名称进行搜索"
          :prefix-icon="Search"
          clearable
          @clear="clearSearch"
          class="max-w-md"
        />
      </div>

      <!-- 数据表格 -->
      <el-table :data="filteredData" class="w-full" border stripe>
        <el-table-column prop="region" label="地区" width="100" align="center" fixed />
        
        <!-- 月最低工资标准 -->
        <el-table-column label="月最低工资标准（元）" align="center">
          <el-table-column prop="monthly1" label="第一档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.monthly1" class="font-medium text-blue-600">{{ row.monthly1 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="monthly2" label="第二档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.monthly2" class="font-medium text-green-600">{{ row.monthly2 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="monthly3" label="第三档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.monthly3" class="font-medium text-orange-600">{{ row.monthly3 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="monthly4" label="第四档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.monthly4" class="font-medium text-red-600">{{ row.monthly4 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
        </el-table-column>

        <!-- 小时最低工资标准 -->
        <el-table-column label="小时最低工资标准（元）" align="center">
          <el-table-column prop="hourly1" label="第一档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.hourly1" class="font-medium text-blue-600">{{ row.hourly1 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="hourly2" label="第二档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.hourly2" class="font-medium text-green-600">{{ row.hourly2 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="hourly3" label="第三档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.hourly3" class="font-medium text-orange-600">{{ row.hourly3 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="hourly4" label="第四档" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.hourly4" class="font-medium text-red-600">{{ row.hourly4 }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>

      <!-- 统计信息 -->
      <div class="mt-4 p-3 bg-gray-50 rounded-lg">
        <div class="text-sm text-gray-600">
          <p class="mb-2"><strong>数据说明：</strong></p>
          <ul class="list-disc list-inside space-y-1">
            <li>本表数据时间截至2025年7月1日</li>
            <li>数据为最新全国各地区最低工资标准</li>
            <li>月最低工资标准适用于全日制就业劳动者</li>
            <li>小时最低工资标准适用于非全日制就业劳动者</li>
            <li>不同档次适用于不同经济发展水平的地区</li>
            <li>"-" 表示该地区未设置该档次标准</li>
          </ul>
          
          <div class="mt-3 pt-3 border-t border-gray-200">
            <p class="mb-2"><strong>数据来源：</strong></p>
            <p class="text-xs text-gray-500 break-all">
              <a 
                href="https://www.mohrss.gov.cn/SYrlzyhshbzb/laodongguanxi_/fwyd/202507/t20250715_549132.html" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 hover:underline"
              >
                人力资源和社会保障部 - 全国各地区最低工资标准情况
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        全国各省市最低工资标准查询工具，提供最新的月最低工资标准和小时最低工资标准数据。支持按地区搜索，帮助了解各地区劳动者最低工资保障水平。数据包含全国31个省、自治区、直辖市的最低工资标准信息，按不同档次分类显示。
      </el-text> 
    </ToolDetail>

  </div>
</template>

<style scoped>
:deep(.el-table th) {
  background-color: #f8fafc;
}

:deep(.el-table--border .el-table__inner-wrapper::after) {
  width: 0;
}
</style>
