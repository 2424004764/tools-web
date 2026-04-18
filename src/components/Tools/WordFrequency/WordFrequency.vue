<script setup lang="ts">
import { reactive, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

interface WordItem {
  word: string
  count: number
  percentage: string
}

const info = reactive({
  title: '词频统计分析',
  inputText: '',
  minWordLength: 1,
  excludeCommonWords: true,
  sortBy: 'count', // 'count' | 'alpha' | 'length'
  topN: 50,
})

// 常见英文停用词
const englishStopwords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'same', 'so', 'than', 'too', 'very', 'as', 'if', 'just', 'because', 'up', 'out',
  'about', 'after', 'before', 'between', 'through', 'during', 'into', 'under', 'above', 'below'
])

// 常见中文停用词
const chineseStopwords = new Set([
  '的', '一', '是', '在', '不', '了', '有', '和', '人', '这', '中', '大', '为', '上', '个', '国',
  '我', '以', '要', '他', '时', '来', '用', '们', '生', '到', '作', '地', '于', '出', '就', '分',
  '对', '成', '会', '可', '主', '发', '年', '动', '同', '工', '也', '能', '下', '过', '民', '前',
  '面', '声', '质', '参', '站', '两', '样', '把', '好', '服', '多', '通', '用', '先', '本', '级',
  '后', '情', '命', '制', '老', '任', '其', '进', '张', '又', '法', '讲', '如', '客', '气', '更',
  '最', '立', '却', '文', '数', '科', '给', '型', '艺', '方', '式', '名', '句', '和', '着', '里'
])

const segmentedWords = computed(() => {
  const text = info.inputText.toLowerCase().trim()
  const words: string[] = []
  let currentWord = ''

  for (const char of text) {
    const code = char.charCodeAt(0)
    const isChinese = code >= 0x4e00 && code <= 0x9fff // 中文范围
    const isEnglish = /[a-z0-9]/.test(char)

    if (isChinese) {
      if (currentWord) {
        words.push(currentWord)
        currentWord = ''
      }
      words.push(char)
    } else if (isEnglish) {
      currentWord += char
    } else {
      if (currentWord) {
        words.push(currentWord)
        currentWord = ''
      }
    }
  }
  if (currentWord) {
    words.push(currentWord)
  }

  return words.filter(word => word)
})

const filteredWords = computed(() => {
  return segmentedWords.value.filter(word => {
    if (word.length < info.minWordLength) {
      return false
    }
    if (!info.excludeCommonWords) {
      return true
    }
    return !englishStopwords.has(word) && !chineseStopwords.has(word)
  })
})

const freqMap = computed(() => {
  const freq = new Map<string, number>()
  filteredWords.value.forEach(word => {
    freq.set(word, (freq.get(word) || 0) + 1)
  })
  return freq
})

const wordFrequency = computed(() => {
  if (!filteredWords.value.length) {
    return []
  }

  const total = Array.from(freqMap.value.values()).reduce((a, b) => a + b, 0)
  if (!total) {
    return []
  }

  let result: WordItem[] = Array.from(freqMap.value, ([word, count]) => ({
    word,
    count,
    percentage: ((count / total) * 100).toFixed(2),
  }))

  switch (info.sortBy) {
    case 'count':
      result.sort((a, b) => b.count - a.count)
      break
    case 'alpha':
      result.sort((a, b) => a.word.localeCompare(b.word))
      break
    case 'length':
      result.sort((a, b) => b.word.length - a.word.length)
      break
  }

  return result.slice(0, info.topN)
})

const totalWords = computed(() => filteredWords.value.length)

const uniqueWords = computed(() => freqMap.value.size)

const downloadCSV = () => {
  if (!wordFrequency.value.length) {
    return
  }

  let csv = '\uFEFF词语,频次,百分比\n'
  wordFrequency.value.forEach(item => {
    csv += `${item.word},${item.count},${item.percentage}%\n`
  })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '词频统计.csv'
  link.click()
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="mb-4">
        <div class="text-2xl font-semibold">词频统计分析</div>
        <div class="mt-1 text-sm text-slate-500">输入文本后自动分析词语出现频率，支持中英文混合。</div>
      </div>

      <div class="space-y-4">
        <!-- 文本输入 -->
        <el-form-item label="输入文本">
          <el-input
            v-model="info.inputText"
            type="textarea"
            placeholder="请输入要分析的文本..."
            :rows="8"
            show-word-limit
            maxlength="10000"
          />
        </el-form-item>

        <!-- 控制面板 -->
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" :md="6">
            <el-form-item label="最小词长">
              <el-input-number v-model="info.minWordLength" :min="1" :max="20" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="6">
            <el-form-item label="显示数量">
              <el-input-number v-model="info.topN" :min="5" :max="200" :step="5" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="6">
            <el-form-item label="排序方式">
              <el-select v-model="info.sortBy" class="w-full">
                <el-option label="按频次" value="count" />
                <el-option label="按字母" value="alpha" />
                <el-option label="按长度" value="length" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="6">
            <el-form-item label="过滤选项">
              <el-checkbox v-model="info.excludeCommonWords">排除常用词</el-checkbox>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 统计信息 -->
        <div v-if="wordFrequency.length" class="grid gap-4 grid-cols-3 md:grid-cols-6">
          <div class="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div class="text-xs text-slate-500">总词数</div>
            <div class="text-xl font-semibold text-blue-600">{{ totalWords }}</div>
          </div>
          <div class="p-3 rounded-lg bg-green-50 border border-green-200">
            <div class="text-xs text-slate-500">独特词数</div>
            <div class="text-xl font-semibold text-green-600">{{ uniqueWords }}</div>
          </div>
          <div class="p-3 rounded-lg bg-purple-50 border border-purple-200">
            <div class="text-xs text-slate-500">最高频次</div>
            <div class="text-xl font-semibold text-purple-600">{{ wordFrequency[0]?.count || 0 }}</div>
          </div>
        </div>

        <!-- 结果表格 -->
        <div v-if="wordFrequency.length" class="space-y-3">
          <div class="flex gap-2 items-center">
            <span class="text-sm font-medium">词频统计结果</span>
            <el-button size="small" type="primary" @click="downloadCSV">导出 CSV</el-button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-slate-100">
                  <th class="border border-slate-200 px-3 py-2 text-left">排名</th>
                  <th class="border border-slate-200 px-3 py-2 text-left">词语</th>
                  <th class="border border-slate-200 px-3 py-2 text-center">频次</th>
                  <th class="border border-slate-200 px-3 py-2 text-center">百分比</th>
                  <th class="border border-slate-200 px-3 py-2 w-24">可视化</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in wordFrequency" :key="idx" class="hover:bg-slate-50">
                  <td class="border border-slate-200 px-3 py-2 font-medium text-slate-600">{{ idx + 1 }}</td>
                  <td class="border border-slate-200 px-3 py-2 font-mono">{{ item.word }}</td>
                  <td class="border border-slate-200 px-3 py-2 text-center font-semibold">{{ item.count }}</td>
                  <td class="border border-slate-200 px-3 py-2 text-center">{{ item.percentage }}%</td>
                  <td class="border border-slate-200 px-3 py-2">
                    <div class="w-full bg-slate-100 rounded h-6 relative overflow-hidden">
                      <div
                        class="bg-gradient-to-r from-blue-400 to-blue-600 h-full transition-all"
                        :style="{ width: item.percentage + '%' }"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        词频统计工具可以帮助你快速分析文本中出现最频繁的词语。支持中英文混合分词，可以设置最小词长来过滤短词，勾选"排除常用词"可以忽略英文常用词和中文虚词。结果支持按频次、字母或长度排序，最后可导出为CSV文件进行进一步分析。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.el-form-item {
  margin-bottom: 0;
}
</style>
