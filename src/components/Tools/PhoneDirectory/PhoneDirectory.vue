<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const info = reactive({
  title: "号码一览",
})

// 电话号码数据
const phoneData = ref([
  {
    category: '紧急救援',
    items: [
      { name: '报警电话', number: '110', desc: '刑事、治安案件及交通肇事' },
      { name: '火警电话', number: '119', desc: '火灾、抢险救援' },
      { name: '医疗急救', number: '120', desc: '医疗急救、救护车' },
      { name: '交通事故', number: '122', desc: '交通事故报警' },
      { name: '森林火警', number: '12119', desc: '森林火灾报警' },
    ]
  },
  {
    category: '政府服务',
    items: [
      { name: '市长热线', number: '12345', desc: '政府服务热线' },
      { name: '消费者投诉', number: '12315', desc: '消费者权益保护' },
      { name: '环保举报', number: '12369', desc: '环境污染举报' },
      { name: '税务服务', number: '12366', desc: '税务咨询举报' },
      { name: '社保服务', number: '12333', desc: '人力资源和社会保障' },
      { name: '住房公积金', number: '12329', desc: '住房公积金服务' },
      { name: '质量监督', number: '12365', desc: '质量技术监督' },
      { name: '价格举报', number: '12358', desc: '价格违法行为举报' },
    ]
  },
  {
    category: '公共服务',
    items: [
      { name: '天气预报', number: '12121', desc: '天气预报查询' },
      { name: '供电服务', number: '95598', desc: '国家电网客服' },
      { name: '供水服务', number: '12319', desc: '城市管理服务' },
      { name: '燃气服务', number: '12319', desc: '燃气服务热线' },
      { name: '邮政服务', number: '11183', desc: '中国邮政客服' },
      { name: '快递查询', number: '11183', desc: '快递物流查询' },
    ]
  },
  {
    category: '金融服务',
    items: [
      { name: '工商银行', number: '95588', desc: '中国工商银行客服' },
      { name: '建设银行', number: '95533', desc: '中国建设银行客服' },
      { name: '农业银行', number: '95599', desc: '中国农业银行客服' },
      { name: '中国银行', number: '95566', desc: '中国银行客服' },
      { name: '交通银行', number: '95559', desc: '交通银行客服' },
      { name: '招商银行', number: '95555', desc: '招商银行客服' },
      { name: '民生银行', number: '95568', desc: '民生银行客服' },
      { name: '中信银行', number: '95558', desc: '中信银行客服' },
    ]
  },
  {
    category: '通信服务',
    items: [
      { name: '中国移动', number: '10086', desc: '中国移动客服' },
      { name: '中国联通', number: '10010', desc: '中国联通客服' },
      { name: '中国电信', number: '10000', desc: '中国电信客服' },
      { name: '中国广电', number: '10099', desc: '中国广电客服' },
    ]
  },
  {
    category: '交通运输',
    items: [
      { name: '铁路客服', number: '12306', desc: '中国铁路客服' },
      { name: '民航客服', number: '12326', desc: '民航服务质量监督' },
      { name: '高速公路', number: '12122', desc: '高速公路救援' },
      { name: '出租车投诉', number: '12328', desc: '交通运输服务监督' },
    ]
  },
  {
    category: '教育服务',
    items: [
      { name: '教育部', number: '12391', desc: '教育部服务热线' },
      { name: '高考咨询', number: '12391', desc: '高考政策咨询' },
      { name: '学历查询', number: '12391', desc: '学历学位查询' },
    ]
  },
  {
    category: '其他服务',
    items: [
      { name: '红十字会', number: '999', desc: '中国红十字会' },
      { name: '地震咨询', number: '12322', desc: '地震信息咨询' },
      { name: '气象服务', number: '12121', desc: '气象信息查询' },
      { name: '旅游投诉', number: '12301', desc: '国家旅游服务热线' },
    ]
  }
])

// 搜索关键词
const searchKeyword = ref('')

// 过滤后的数据
const filteredData = computed(() => {
  if (!searchKeyword.value) return phoneData.value
  
  return phoneData.value.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.name.includes(searchKeyword.value) || 
      item.number.includes(searchKeyword.value) ||
      item.desc.includes(searchKeyword.value)
    )
  })).filter(category => category.items.length > 0)
})

// 复制电话号码
const copyPhone = async (phone: string) => {
  await copy(phone)
}

// 拨打电话（移动端）
const callPhone = (phone: string) => {
  if (navigator.userAgent.match(/Mobile|Android|iPhone|iPad/)) {
    window.location.href = `tel:${phone}`
  } else {
    ElMessage.info('请在移动设备上使用拨号功能')
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 搜索框 -->
      <div class="mb-6">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索机构名称、电话号码或描述..."
          clearable
          size="large"
          class="search-input"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 电话号码列表 -->
      <div class="phone-directory">
        <div 
          v-for="category in filteredData" 
          :key="category.category"
          class="category-section mb-8"
        >
          <h3 class="category-title">{{ category.category }}</h3>
          <div class="phone-grid">
            <div 
              v-for="item in category.items" 
              :key="item.number"
              class="phone-card"
            >
              <div class="phone-info">
                <div class="phone-name">{{ item.name }}</div>
                <div class="phone-desc">{{ item.desc }}</div>
              </div>
              <div class="phone-actions">
                <div class="phone-number">{{ item.number }}</div>
                <div class="action-buttons">
                  <el-button 
                    type="primary" 
                    size="small" 
                    @click="copyPhone(item.number)"
                    class="action-btn"
                  >
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </el-button>
                  <el-button 
                    type="success" 
                    size="small" 
                    @click="callPhone(item.number)"
                    class="action-btn"
                  >
                    <el-icon><Phone /></el-icon>
                    拨打
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 无搜索结果 -->
        <div v-if="filteredData.length === 0" class="no-results">
          <el-empty description="未找到相关电话号码" />
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="功能说明">
      <el-text>
        提供各种国家机构、公共服务、紧急救援等常用电话号码查询服务。
        支持搜索、复制电话号码，在移动设备上可直接拨打。
        包含政府服务、金融服务、通信服务、交通运输、教育服务等多个分类。
      </el-text> 
    </ToolDetail>

    <ToolDetail title="使用说明">
      <el-text>
        1. 使用搜索框可以快速查找特定的机构或电话号码<br/>
        2. 点击"复制"按钮可以将电话号码复制到剪贴板<br/>
        3. 在移动设备上点击"拨打"按钮可以直接拨打电话<br/>
        4. 电话号码按分类整理，便于快速查找
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
.search-input {
  max-width: 500px;
}

.phone-directory {
  /* 移除滚动条相关样式 */
}

.category-section {
  margin-bottom: 2rem;
}

.category-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.phone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.phone-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.phone-card:hover {
  background: #f3f4f6;
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.phone-info {
  margin-bottom: 0.75rem;
}

.phone-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.phone-desc {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.4;
}

.phone-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.phone-number {
  font-size: 1.125rem;
  font-weight: 700;
  color: #3b82f6;
  font-family: 'Courier New', monospace;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.no-results {
  text-align: center;
  padding: 2rem;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .phone-grid {
    grid-template-columns: 1fr;
  }
  
  .phone-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-buttons {
    justify-content: center;
  }
  
  /* 移除移动端的滚动限制 */
}

/* 毛玻璃效果 */
.phone-card {
  backdrop-filter: blur(10px);
  background: rgba(249, 250, 251, 0.8);
}

.phone-card:hover {
  background: rgba(243, 244, 246, 0.9);
}
</style>
