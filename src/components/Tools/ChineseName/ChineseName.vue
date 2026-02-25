<script setup lang="ts">
import { onMounted, reactive, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'

// 常见中文姓氏（按使用频率排序）
const surnames = [
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗',
  '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
  '彭', '曾', '萧', '田', '董', '袁', '潘', '于', '蒋', '蔡',
  '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈',
  '姚', '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金',
  '石', '廖', '贾', '夏', '韦', '付', '方', '白', '邹', '孟',
  '熊', '秦', '邱', '江', '尹', '薛', '闫', '段', '雷', '侯',
  '龙', '史', '陶', '黎', '贺', '顾', '毛', '郝', '龚', '邵'
]

// 常见名字用字
const nameChars = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀', '霞', '平',
  '刚', '桂', '辉', '玲', '萍', '飞', '宇航', '金', '鑫', '建华',
  '建国', '春', '玉兰', '晓', '红', '梅', '海', '波', '文', '成',
  '婷', '雪', '宁', '慧', '巧', '兰', '云', '萍', '秀英', '玉珍',
  '雯', '晶', '欣', '荣', '华', '俊', '浩', '宇', '梓', '轩',
  '雨', '梓', '萱', '子', '墨', '一', '诺', '涵', '诗', '雅',
  '晴', '佳', '梦', '怡', '思', '妍', '语', '心', '悦', '依',
  '嘉', '若', '林', '晨', '言', '之', '博', '瑞', '锦', '辰',
  '昊', '天', '铭', '凯', '泽', '荣', '春', '恒', '旭', '尧'
]

// 女孩专用字
const femaleChars = [
  '娜', '敏', '静', '丽', '芳', '艳', '娟', '秀', '霞', '玲',
  '萍', '婷', '雪', '慧', '巧', '兰', '云', '雯', '晶', '欣',
  '萱', '雅', '妍', '语', '心', '悦', '依', '若', '思', '怡',
  '佳', '梦', '月', '花', '燕', '红', '梅', '琴', '珠', '珍',
  '莉', '莎', '菲', '薇', '蓉', '倩', '瑶', '瑛', '琳', '黛玉'
]

// 男孩专用字
const maleChars = [
  '伟', '强', '磊', '军', '洋', '勇', '杰', '涛', '明', '超',
  '刚', '建华', '建国', '飞', '海', '波', '文', '成', '浩', '俊',
  '宇', '博', '瑞', '锦', '辰', '昊', '天', '铭', '凯', '泽',
  '恒', '旭', '尧', '嘉', '林', '晨', '言', '之', '荣', '春',
  '龙', '虎', '豹', '彪', '峰', '峻', '岩', '松', '柏', '楠'
]

// 复姓
const compoundSurnames = [
  '欧阳', '太史', '端木', '上官', '司马', '东方', '独孤', '南宫',
  '万俟', '闻人', '夏侯', '诸葛', '尉迟', '公羊', '赫连', '澹台',
  '皇甫', '宗政', '濮阳', '公纯', '太叔', '申屠', '公孙', '慕容',
  '仲孙', '钟离', '长孙', '宇文', '司徒', '鲜于', '司空', '闾丘',
  '子车', '亓官', '司寇', '巫马', '公西', '颛孙', '壤驷', '公良',
  '漆雕', '乐正', '宰父', '谷梁', '拓跋', '夹谷', '轩辕', '令狐'
]

const info = reactive({
  title: "随机中文人名生成",
  count: 10,
  surnameMode: 'randomSingle', // randomSingle, randomCompound, randomAll, custom, specified
  gender: 'all', // all, male, female
  nameLength: 'random', // random, 1, 2
  customSurname: '', // 自定义姓氏
  specifiedSurnames: [] as string[], // 指定的姓氏列表
  resultNames: [] as string[],
})

// 生成人名
const generateName = (): string => {
  // 选择姓氏
  let surname: string = ''

  switch (info.surnameMode) {
    case 'custom':
      // 自定义姓氏
      surname = info.customSurname || ''
      break
    case 'specified':
      // 指定姓氏列表
      if (info.specifiedSurnames.length > 0) {
        surname = info.specifiedSurnames[Math.floor(Math.random() * info.specifiedSurnames.length)]
      } else {
        surname = surnames[Math.floor(Math.random() * surnames.length)]
      }
      break
    case 'randomCompound':
      // 仅复姓
      surname = compoundSurnames[Math.floor(Math.random() * compoundSurnames.length)]
      break
    case 'randomAll':
      // 单姓+复姓混合
      if (Math.random() < 0.2) {
        surname = compoundSurnames[Math.floor(Math.random() * compoundSurnames.length)]
      } else {
        surname = surnames[Math.floor(Math.random() * surnames.length)]
      }
      break
    case 'randomSingle':
    default:
      // 仅单姓
      surname = surnames[Math.floor(Math.random() * surnames.length)]
      break
  }

  // 确定名字长度
  let nameLen: number
  if (info.nameLength === 'random') {
    nameLen = Math.random() < 0.7 ? 2 : 1 // 70% 双字名，30% 单字名
  } else {
    nameLen = parseInt(info.nameLength)
  }

  // 选择名字用字
  let givenName = ''
  for (let i = 0; i < nameLen; i++) {
    let charPool = nameChars

    if (info.gender === 'female') {
      charPool = femaleChars
    } else if (info.gender === 'male') {
      charPool = maleChars
    } else {
      // 随机性别，混合池
      if (Math.random() < 0.5) {
        charPool = femaleChars
      } else {
        charPool = maleChars
      }
    }

    const char = charPool[Math.floor(Math.random() * charPool.length)]
    givenName += char
  }

  return surname + givenName
}

// 批量生成
const generate = () => {
  if (info.count < 1 || info.count > 1000) {
    ElMessage({
      message: "生成数量范围在1~1000",
      type: "warning",
      duration: 1500
    })
    return
  }

  info.resultNames = []
  for (let i = 0; i < info.count; i++) {
    info.resultNames.push(generateName())
  }
}

// 复制单个名字
const copySingle = async (name: string) => {
  await copy(name)
  ElMessage.success('已复制')
}

// 复制全部
const copyAll = async () => {
  await copy(info.resultNames.join('\n'))
  ElMessage.success('已复制全部人名')
}

// 全选/取消全选姓氏
const toggleAllSurnames = (type: 'single' | 'compound') => {
  const targetList = type === 'single' ? surnames : compoundSurnames
  const allSelected = targetList.every(s => info.specifiedSurnames.includes(s))

  if (allSelected) {
    // 取消全选
    info.specifiedSurnames = info.specifiedSurnames.filter(s => !targetList.includes(s))
  } else {
    // 全选
    const newSurnames = [...info.specifiedSurnames]
    targetList.forEach(s => {
      if (!newSurnames.includes(s)) {
        newSurnames.push(s)
      }
    })
    info.specifiedSurnames = newSurnames
  }
  generate()
}

// 生成结果文本
const resultText = computed(() => {
  return info.resultNames.join('\n')
})

onMounted(() => {
  generate()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 配置区域 -->
      <div class="space-y-4">
        <!-- 姓氏模式 -->
        <div>
          <el-text class="mb-2">姓氏模式</el-text>
          <el-radio-group v-model="info.surnameMode" @change="generate">
            <el-radio label="randomSingle">单姓（王、李、张等）</el-radio>
            <el-radio label="randomCompound">复姓（欧阳、司马等）</el-radio>
            <el-radio label="randomAll">单姓+复姓混合</el-radio>
            <el-radio label="specified">指定姓氏</el-radio>
            <el-radio label="custom">自定义姓氏</el-radio>
          </el-radio-group>
        </div>

        <!-- 指定姓氏多选 -->
        <div v-if="info.surnameMode === 'specified'">
          <el-text class="mb-2">选择要使用的姓氏（{{ info.specifiedSurnames.length }}个已选）</el-text>
          <el-select
            v-model="info.specifiedSurnames"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择姓氏"
            @change="generate"
            style="width: 100%"
          >
            <el-option label="单姓（全部选中）" value="all-single">
              <template #default>
                <div @click.stop="toggleAllSurnames('single')" class="w-full text-center cursor-pointer">
                  全选单姓 ({{ surnames.length }}个)
                </div>
              </template>
            </el-option>
            <el-option label="复姓（全部选中）" value="all-compound">
              <template #default>
                <div @click.stop="toggleAllSurnames('compound')" class="w-full text-center cursor-pointer">
                  全选复姓 ({{ compoundSurnames.length }}个)
                </div>
              </template>
            </el-option>
            <el-divider style="margin: 4px 0" />
            <el-option
              v-for="s in [...surnames, ...compoundSurnames]"
              :key="s"
              :label="s"
              :value="s"
            />
          </el-select>
        </div>

        <!-- 自定义姓氏输入 -->
        <div v-if="info.surnameMode === 'custom'">
          <el-text class="mb-2">自定义姓氏</el-text>
          <el-input
            v-model="info.customSurname"
            placeholder="请输入姓氏（如：李、欧阳）"
            clearable
            @input="generate"
            maxlength="4"
            show-word-limit
          />
        </div>

        <!-- 性别选择 -->
        <div>
          <el-text class="mb-2">性别</el-text>
          <el-radio-group v-model="info.gender" @change="generate">
            <el-radio label="all">不限</el-radio>
            <el-radio label="male">男性</el-radio>
            <el-radio label="female">女性</el-radio>
          </el-radio-group>
        </div>

        <!-- 名字长度 -->
        <div>
          <el-text class="mb-2">名字长度</el-text>
          <el-radio-group v-model="info.nameLength" @change="generate">
            <el-radio label="random">随机</el-radio>
            <el-radio label="2">双字名（如：子轩）</el-radio>
            <el-radio label="1">单字名（如：伟）</el-radio>
          </el-radio-group>
        </div>

        <!-- 生成数量 -->
        <div>
          <el-text>生成数量: {{ info.count }}</el-text>
          <el-slider v-model="info.count" :min="1" :max="1000" :step="1" @change="generate" />
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2">
          <el-button type="primary" @click="generate" class="flex-1 c-xs:w-auto">
            生成人名
          </el-button>
          <el-button
            v-if="info.resultNames.length > 0"
            @click="copyAll"
            plain
            class="flex-1 c-xs:w-auto"
          >
            复制全部
          </el-button>
        </div>
      </div>

      <!-- 结果展示 -->
      <div v-if="info.resultNames.length > 0" class="mt-4">
        <el-divider />
        <el-text class="mb-2">生成结果 ({{ info.resultNames.length }}个)</el-text>

        <!-- 网格展示 -->
        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mb-4">
          <div
            v-for="(name, index) in info.resultNames"
            :key="index"
            class="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-warm-400 hover:bg-warm-50 transition-all cursor-pointer group"
            @click="copySingle(name)"
          >
            <el-text class="font-mono truncate">{{ name }}</el-text>
            <el-icon class="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <DocumentCopy />
            </el-icon>
          </div>
        </div>

        <!-- 文本展示 -->
        <el-input
          v-model="resultText"
          type="textarea"
          :rows="5"
          readonly
          placeholder="生成的人名将显示在这里"
          class="mt-2 result-textarea"
        />
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <el-text>
        随机生成中文人名工具，支持单姓和复姓，可按性别筛选，支持自定义名字长度和生成数量。
        生成的姓名来源于中国常见姓氏和名字用字，适合用于测试数据、小说创作、游戏角色命名等场景。
      </el-text>
      <el-text class="block mt-2">
        支持的复姓包括：欧阳、司马、上官、东方、独孤、南宫、诸葛、尉迟、夏侯、皇甫等。
      </el-text>
    </ToolDetail>
  </div>
</template>

<script lang="ts">
import { DocumentCopy } from '@element-plus/icons-vue'
export default {
  components: {
    DocumentCopy
  }
}
</script>

<style scoped>
/* 手机端增加编辑区高度 */
@media (max-width: 768px) {
  :deep(.result-textarea .el-textarea__inner) {
    min-height: 150px !important;
  }
}
</style>
