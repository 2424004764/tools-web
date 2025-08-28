<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "物品辐射量示例",
})

// 辐射量数据
const radiationData = ref([
  // 日常生活
  { category: '日常生活', item: '看电视1小时', radiation: '0.001', unit: 'mSv', desc: '每小时接触电视机产生的辐射' },
  { category: '日常生活', item: '使用电脑1小时', radiation: '0.0001', unit: 'mSv', desc: '使用显示器和电脑设备' },
  { category: '日常生活', item: '手机通话1小时', radiation: '0.0001', unit: 'mSv', desc: '移动电话产生的辐射' },
  { category: '日常生活', item: '微波炉使用', radiation: '0.001', unit: 'mSv', desc: '正常使用微波炉加热食物' },
  { category: '日常生活', item: 'WiFi路由器24小时', radiation: '0.00001', unit: 'mSv', desc: '家用无线路由器全天运行' },
  { category: '日常生活', item: '电吹风使用10分钟', radiation: '0.0001', unit: 'mSv', desc: '使用电吹风干发' },
  { category: '日常生活', item: '电磁炉使用1小时', radiation: '0.0005', unit: 'mSv', desc: '使用电磁炉烹饪' },
  { category: '日常生活', item: '电热毯使用8小时', radiation: '0.0002', unit: 'mSv', desc: '整夜使用电热毯' },
  { category: '日常生活', item: '荧光灯使用1小时', radiation: '0.00001', unit: 'mSv', desc: '日光灯管照明' },
  { category: '日常生活', item: '使用蓝牙耳机1小时', radiation: '0.000001', unit: 'mSv', desc: '无线蓝牙耳机通话' },
  
  // 医疗检查
  { category: '医疗检查', item: '胸部X光检查', radiation: '0.1', unit: 'mSv', desc: '标准胸部X射线检查' },
  { category: '医疗检查', item: 'CT扫描头部', radiation: '2', unit: 'mSv', desc: '头部CT扫描检查' },
  { category: '医疗检查', item: 'CT扫描胸部', radiation: '7', unit: 'mSv', desc: '胸部CT扫描检查' },
  { category: '医疗检查', item: '乳房X光检查', radiation: '0.4', unit: 'mSv', desc: '乳腺X射线摄影' },
  { category: '医疗检查', item: '牙科X光', radiation: '0.005', unit: 'mSv', desc: '单次牙科X射线检查' },
  { category: '医疗检查', item: 'CT扫描腹部', radiation: '10', unit: 'mSv', desc: '腹部CT扫描检查' },
  { category: '医疗检查', item: '骨密度检查', radiation: '0.001', unit: 'mSv', desc: 'DEXA骨密度扫描' },
  { category: '医疗检查', item: 'PET-CT扫描', radiation: '25', unit: 'mSv', desc: '正电子发射计算机断层扫描' },
  { category: '医疗检查', item: '心脏造影', radiation: '15', unit: 'mSv', desc: '冠状动脉造影术' },
  { category: '医疗检查', item: '钡餐检查', radiation: '3', unit: 'mSv', desc: '消化道X光造影' },
  { category: '医疗检查', item: '核医学骨扫描', radiation: '6', unit: 'mSv', desc: '放射性同位素骨扫描' },
  
  // 航空旅行
  { category: '航空旅行', item: '北京到上海飞行', radiation: '0.005', unit: 'mSv', desc: '国内航班高空辐射' },
  { category: '航空旅行', item: '跨太平洋航班', radiation: '0.1', unit: 'mSv', desc: '长距离国际航班' },
  { category: '航空旅行', item: '飞行员年辐射量', radiation: '2-5', unit: 'mSv', desc: '职业飞行员年平均辐射' },
  { category: '航空旅行', item: '北京到欧洲航班', radiation: '0.08', unit: 'mSv', desc: '洲际长途航班' },
  { category: '航空旅行', item: '空乘人员年辐射', radiation: '2-3', unit: 'mSv', desc: '航空乘务员年平均辐射' },
  { category: '航空旅行', item: '高频商务旅行者年辐射', radiation: '1', unit: 'mSv', desc: '频繁飞行的商务人士' },
  
  // 自然环境
  { category: '自然环境', item: '年平均自然辐射', radiation: '2.4', unit: 'mSv', desc: '全球平均自然背景辐射' },
  { category: '自然环境', item: '香蕉（食用1根）', radiation: '0.0001', unit: 'mSv', desc: '香蕉含钾-40天然放射性' },
  { category: '自然环境', item: '住在科罗拉多1年', radiation: '1', unit: 'mSv', desc: '高海拔地区额外辐射' },
  { category: '自然环境', item: '巴西坚果（1颗）', radiation: '0.000014', unit: 'mSv', desc: '含天然放射性镭' },
  { category: '自然环境', item: '抽烟1包/天（年剂量）', radiation: '13', unit: 'mSv', desc: '香烟含天然放射性钋-210' },
  { category: '自然环境', item: '在花岗岩建筑中1年', radiation: '0.07', unit: 'mSv', desc: '花岗岩含天然放射性元素' },
  { category: '自然环境', item: '食用磷肥种植蔬菜1年', radiation: '0.02', unit: 'mSv', desc: '磷肥含天然放射性物质' },
  { category: '自然环境', item: '温泉浴1小时', radiation: '0.0001', unit: 'mSv', desc: '天然温泉含氡气' },
  { category: '自然环境', item: '住在砖房1年', radiation: '0.05', unit: 'mSv', desc: '砖块含天然放射性元素' },
  
  // 职业暴露
  { category: '职业暴露', item: '核电站工人年限值', radiation: '20', unit: 'mSv', desc: '职业辐射年剂量限值' },
  { category: '职业暴露', item: '医务人员年限值', radiation: '20', unit: 'mSv', desc: '放射科医务人员年限值' },
  { category: '职业暴露', item: 'X光技师年平均', radiation: '0.5-2', unit: 'mSv', desc: 'X光机操作人员年平均' },
  { category: '职业暴露', item: '放射治疗师年平均', radiation: '1-5', unit: 'mSv', desc: '放射治疗操作人员' },
  { category: '职业暴露', item: '核材料工人年平均', radiation: '2-10', unit: 'mSv', desc: '核材料处理人员' },
  { category: '职业暴露', item: '地质勘探工人年平均', radiation: '1-3', unit: 'mSv', desc: '铀矿勘探作业人员' },
  
  // 食物和物品
  { category: '食物和物品', item: '土豆（100g）', radiation: '0.000017', unit: 'mSv', desc: '含天然放射性钾-40' },
  { category: '食物和物品', item: '牛奶（1升）', radiation: '0.000035', unit: 'mSv', desc: '含天然放射性钾-40和碳-14' },
  { category: '食物和物品', item: '胡萝卜（100g）', radiation: '0.000025', unit: 'mSv', desc: '含天然放射性钾-40' },
  { category: '食物和物品', item: '啤酒（1升）', radiation: '0.000027', unit: 'mSv', desc: '含天然放射性钾-40和碳-14' },
  { category: '食物和物品', item: '夜光表（佩戴1年）', radiation: '0.02', unit: 'mSv', desc: '夜光涂料含放射性氚' },
  { category: '食物和物品', item: '火灾报警器（1个）', radiation: '0.0001', unit: 'mSv/年', desc: '电离型烟雾探测器含镅-241' },
  { category: '食物和物品', item: '瓷器餐具使用1年', radiation: '0.002', unit: 'mSv', desc: '陶瓷釉料含天然放射性' },
  { category: '食物和物品', item: '彩色玻璃窗1年', radiation: '0.01', unit: 'mSv', desc: '彩色玻璃含铀化合物' },
  
  // 事故参考
  { category: '事故参考', item: '核医学治疗', radiation: '10-100', unit: 'mSv', desc: '放射性碘治疗甲状腺' },
  { category: '事故参考', item: '急性辐射病阈值', radiation: '1000', unit: 'mSv', desc: '短时间大剂量辐射影响' },
  { category: '事故参考', item: '切尔诺贝利撤离区居民', radiation: '350', unit: 'mSv', desc: '事故后撤离区域剂量' },
  { category: '事故参考', item: '福岛核事故工人最高', radiation: '250', unit: 'mSv', desc: '应急情况下临时提高限值' },
  { category: '事故参考', item: '核事故应急人员限值', radiation: '100', unit: 'mSv', desc: '紧急情况下救援人员限值' },
  
  // 宇宙空间
  { category: '宇宙空间', item: '国际空间站1天', radiation: '0.4', unit: 'mSv', desc: '宇航员在轨道上的日剂量' },
  { category: '宇宙空间', item: '宇航员年平均', radiation: '150', unit: 'mSv', desc: '长期在轨宇航员年剂量' },
  { category: '宇宙空间', item: '登月任务', radiation: '6', unit: 'mSv', desc: '阿波罗登月任务总剂量' },
  { category: '宇宙空间', item: '火星任务预估', radiation: '660', unit: 'mSv', desc: '往返火星的预估辐射剂量' },
  { category: '宇宙空间', item: '太阳风暴期间空间站', radiation: '2', unit: 'mSv/天', desc: '太阳活动期间的高剂量' },
  
  // 工业应用
  { category: '工业应用', item: '无损检测工人年平均', radiation: '1-5', unit: 'mSv', desc: '工业射线检测操作员' },
  { category: '工业应用', item: '核材料运输工人', radiation: '2-8', unit: 'mSv/年', desc: '放射性材料运输人员' },
  { category: '工业应用', item: '放射源使用工人', radiation: '3-15', unit: 'mSv/年', desc: '工业放射源操作人员' },
  { category: '工业应用', item: '核研究人员年平均', radiation: '1-10', unit: 'mSv', desc: '核科学研究人员' }
])

// 筛选分类
const categories = [...new Set(radiationData.value.map(item => item.category))]
const selectedCategory = ref('全部')

// 筛选数据
const filteredData = computed(() => {
  if (selectedCategory.value === '全部') {
    return radiationData.value
  }
  return radiationData.value.filter(item => item.category === selectedCategory.value)
})

// 辐射等级颜色
const getRadiationColor = (radiation: string) => {
  const value = parseFloat(radiation.split('-')[0])
  if (value < 0.01) return 'text-green-600'
  if (value < 0.1) return 'text-blue-600'
  if (value < 1) return 'text-yellow-600'
  if (value < 10) return 'text-orange-600'
  return 'text-red-600'
}

// 获取辐射等级
const getRadiationLevel = (radiation: string) => {
  const value = parseFloat(radiation.split('-')[0])
  if (value < 0.01) return '极低'
  if (value < 0.1) return '很低'
  if (value < 1) return '低'
  if (value < 10) return '中'
  return '高'
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-3 md:p-4 rounded-2xl bg-white mb-4">
      <div class="mb-4">
        <h3 class="text-base md:text-lg font-semibold mb-2">辐射量单位说明</h3>
        <div class="bg-blue-50 p-2 md:p-3 rounded-lg">
          <p class="text-xs md:text-sm text-blue-800 mb-2">
            <strong>mSv (毫希沃特)</strong>：衡量辐射对人体影响的单位，考虑了不同类型辐射的生物效应
          </p>
          <p class="text-xs md:text-sm text-blue-800">
            <strong>参考标准</strong>：国际原子能机构建议公众年辐射限值为1mSv，职业人员为20mSv
          </p>
        </div>
      </div>

      <!-- 分类筛选 -->
      <div class="mb-4">
        <div class="flex flex-wrap gap-1 md:gap-2">
          <button 
            v-for="category in ['全部', ...categories]" 
            :key="category"
            @click="selectedCategory = category"
            :class="[
              'px-2 md:px-3 py-1 text-xs md:text-sm rounded-full transition-all',
              selectedCategory === category 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <!-- 桌面端表格 -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full border-collapse border border-gray-300">
          <thead>
            <tr class="bg-gray-50">
              <th class="border border-gray-300 px-4 py-2 text-left">类别</th>
              <th class="border border-gray-300 px-4 py-2 text-left">物品/活动</th>
              <th class="border border-gray-300 px-4 py-2 text-left">辐射量</th>
              <th class="border border-gray-300 px-4 py-2 text-left">等级</th>
              <th class="border border-gray-300 px-4 py-2 text-left">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in filteredData" :key="index" class="hover:bg-gray-50">
              <td class="border border-gray-300 px-4 py-2">
                <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                  {{ item.category }}
                </span>
              </td>
              <td class="border border-gray-300 px-4 py-2 font-medium">{{ item.item }}</td>
              <td class="border border-gray-300 px-4 py-2">
                <span :class="getRadiationColor(item.radiation)" class="font-semibold">
                  {{ item.radiation }} {{ item.unit }}
                </span>
              </td>
              <td class="border border-gray-300 px-4 py-2">
                <span 
                  :class="[
                    'px-2 py-1 text-xs rounded-full',
                    getRadiationLevel(item.radiation) === '极低' ? 'bg-green-100 text-green-800' :
                    getRadiationLevel(item.radiation) === '很低' ? 'bg-blue-100 text-blue-800' :
                    getRadiationLevel(item.radiation) === '低' ? 'bg-yellow-100 text-yellow-800' :
                    getRadiationLevel(item.radiation) === '中' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  ]"
                >
                  {{ getRadiationLevel(item.radiation) }}
                </span>
              </td>
              <td class="border border-gray-300 px-4 py-2 text-sm text-gray-600">{{ item.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 手机端卡片 -->
      <div class="md:hidden space-y-3">
        <div 
          v-for="(item, index) in filteredData" 
          :key="index" 
          class="bg-gray-50 rounded-lg p-3 border border-gray-200"
        >
          <div class="flex items-start justify-between mb-2">
            <h4 class="font-medium text-sm text-gray-900 flex-1 pr-2">{{ item.item }}</h4>
            <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex-shrink-0">
              {{ item.category }}
            </span>
          </div>
          
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-2">
              <span :class="getRadiationColor(item.radiation)" class="font-semibold text-sm">
                {{ item.radiation }} {{ item.unit }}
              </span>
              <span 
                :class="[
                  'px-2 py-1 text-xs rounded-full',
                  getRadiationLevel(item.radiation) === '极低' ? 'bg-green-100 text-green-800' :
                  getRadiationLevel(item.radiation) === '很低' ? 'bg-blue-100 text-blue-800' :
                  getRadiationLevel(item.radiation) === '低' ? 'bg-yellow-100 text-yellow-800' :
                  getRadiationLevel(item.radiation) === '中' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                ]"
              >
                {{ getRadiationLevel(item.radiation) }}
              </span>
            </div>
          </div>
          
          <p class="text-xs text-gray-600">{{ item.desc }}</p>
        </div>
      </div>

      <!-- 安全提示 -->
      <div class="mt-4 md:mt-6 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 class="text-base md:text-lg font-semibold text-yellow-800 mb-2">安全提示</h4>
        <ul class="text-xs md:text-sm text-yellow-700 space-y-1">
          <li>• 以上数据仅供参考，实际辐射量可能因设备、环境等因素而有所差异</li>
          <li>• 短期少量辐射暴露一般不会对健康造成显著影响</li>
          <li>• 孕妇和儿童对辐射更敏感，应避免不必要的医疗辐射检查</li>
          <li>• 如有辐射安全疑问，请咨询相关专业人员</li>
        </ul>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="工具说明">
      <el-text>
        本工具提供常见物品和活动的辐射量参考数据，帮助您了解日常生活中的辐射水平。数据来源于国际原子能机构、世界卫生组织等权威机构的公开资料，仅供科普参考使用。
      </el-text>
    </ToolDetail>

  </div>
</template>

<style scoped>
/* 移除原有的简单响应式样式，新的布局已经通过Tailwind类实现 */
</style>
