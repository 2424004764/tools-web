<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

interface MatchResult {
  start: number
  end: number
  text: string
  group?: string
}

const info = reactive({
  title: "正则表达式可视化",
  pattern: '',
  testString: 'Hello World! Email: demo@163.com Phone: 13800138000',
  matchResults: [] as MatchResult[],
  error: '',
  stepIndex: 0,
  isPlaying: false,
  playInterval: null as any,
  tokens: [] as { type: string, value: string, desc: string }[],
})

// 简单的正则词法分析器
const tokenize = (pattern: string) => {
  const tokens: { type: string, value: string, desc: string }[] = []
  let i = 0

  while (i < pattern.length) {
    const char = pattern[i]
    const next = pattern[i + 1]

    // 转义字符
    if (char === '\\' && i + 1 < pattern.length) {
      const escaped = pattern[i + 1]
      const desc = {
        'd': '数字 [0-9]',
        'D': '非数字',
        'w': '单词字符 [a-zA-Z0-9_]',
        'W': '非单词字符',
        's': '空白字符',
        'S': '非空白字符',
        'b': '单词边界',
        'B': '非单词边界',
        'n': '换行符',
        't': '制表符',
        '.': '点号 .',
        '^': '脱字符 ^',
        '$': '美元符 $',
        '*': '星号 *',
        '+': '加号 +',
        '?': '问号 ?',
      }[escaped] || `转义 ${escaped}`
      tokens.push({ type: 'escape', value: '\\' + escaped, desc })
      i += 2
      continue
    }

    // 量词
    if (char === '*') {
      tokens.push({ type: 'quantifier', value: '*', desc: '零次或多次 (贪婪)' })
      i++
      continue
    }
    if (char === '+') {
      tokens.push({ type: 'quantifier', value: '+', desc: '一次或多次 (贪婪)' })
      i++
      continue
    }
    if (char === '?') {
      tokens.push({ type: 'quantifier', value: '?', desc: '零次或一次' })
      i++
      continue
    }

    // 花括号量词 {n,m}
    if (char === '{') {
      let end = pattern.indexOf('}', i)
      if (end !== -1) {
        const quantifier = pattern.slice(i, end + 1)
        tokens.push({ type: 'quantifier', value: quantifier, desc: `重复 ${pattern.slice(i + 1, end)} 次` })
        i = end + 1
        continue
      }
    }

    // 字符类 [...]
    if (char === '[') {
      let end = pattern.indexOf(']', i)
      if (end !== -1) {
        const charClass = pattern.slice(i, end + 1)
        tokens.push({ type: 'char-class', value: charClass, desc: '字符类' })
        i = end + 1
        continue
      }
    }

    // 分组
    if (char === '(') {
      if (next === '?') {
        if (pattern[i + 2] === ':') {
          tokens.push({ type: 'group', value: '(?:', desc: '非捕获组' })
          i += 3
          continue
        }
        if (pattern[i + 2] === '=') {
          tokens.push({ type: 'group', value: '(?=', desc: '正向前瞻' })
          i += 3
          continue
        }
        if (pattern[i + 2] === '!') {
          tokens.push({ type: 'group', value: '(?!', desc: '负向前瞻' })
          i += 3
          continue
        }
        if (pattern[i + 2] === '<') {
          if (pattern[i + 3] === '=') {
            tokens.push({ type: 'group', value: '(?<=', desc: '正向后顾' })
            i += 4
            continue
          }
          if (pattern[i + 3] === '!') {
            tokens.push({ type: 'group', value: '(?<!', desc: '负向后顾' })
            i += 4
            continue
          }
        }
      }
      tokens.push({ type: 'group', value: '(', desc: '捕获组开始' })
      i++
      continue
    }
    if (char === ')') {
      tokens.push({ type: 'group', value: ')', desc: '分组结束' })
      i++
      continue
    }

    // 管道
    if (char === '|') {
      tokens.push({ type: 'alternation', value: '|', desc: '或' })
      i++
      continue
    }

    // 锚点
    if (char === '^') {
      tokens.push({ type: 'anchor', value: '^', desc: '字符串开始' })
      i++
      continue
    }
    if (char === '$') {
      tokens.push({ type: 'anchor', value: '$', desc: '字符串结束' })
      i++
      continue
    }
    if (char === '.') {
      tokens.push({ type: 'metachar', value: '.', desc: '任意字符' })
      i++
      continue
    }

    // 普通字符
    tokens.push({ type: 'literal', value: char, desc: `字符 "${char}"` })
    i++
  }

  return tokens
}

// 执行匹配并收集结果
const execMatch = () => {
  info.error = ''
  info.matchResults = []

  if (!info.pattern) {
    info.error = '请输入正则表达式'
    return
  }

  try {
    const regex = new RegExp(info.pattern, 'g')
    let match
    const results: MatchResult[] = []

    while ((match = regex.exec(info.testString)) !== null) {
      results.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        group: match.length > 1 ? match.slice(1).join(', ') : undefined
      })
      // 防止无限循环
      if (match[0].length === 0) {
        regex.lastIndex++
      }
    }

    info.matchResults = results
    info.tokens = tokenize(info.pattern)
  } catch (e: any) {
    info.error = e.message
  }
}

// 高亮文本HTML
const highlightedText = computed(() => {
  if (!info.testString || info.matchResults.length === 0) {
    return info.testString.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  let result = ''
  let lastIndex = 0

  // 按start排序
  const sorted = [...info.matchResults].sort((a, b) => a.start - b.start)

  for (const match of sorted) {
    // 未匹配部分
    result += escapeHtml(info.testString.slice(lastIndex, match.start))
    // 匹配部分
    result += `<mark class="bg-yellow-200 text-gray-800 rounded px-0.5">${escapeHtml(match.text)}</mark>`
    lastIndex = match.end
  }

  // 尾部
  result += escapeHtml(info.testString.slice(lastIndex))

  return result
})

const escapeHtml = (str: string) => {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 播放动画
const play = () => {
  if (info.isPlaying) {
    stop()
    return
  }

  if (info.matchResults.length === 0) {
    execMatch()
  }

  if (info.matchResults.length === 0) return

  info.isPlaying = true
  info.stepIndex = 0

  info.playInterval = setInterval(() => {
    info.stepIndex++
    if (info.stepIndex >= info.matchResults.length) {
      info.stepIndex = 0
    }
  }, 1000)
}

const stop = () => {
  info.isPlaying = false
  if (info.playInterval) {
    clearInterval(info.playInterval)
    info.playInterval = null
  }
  info.stepIndex = 0
}

// 当前高亮的匹配
// const currentHighlight = computed(() => {
//   if (!info.isPlaying || info.matchResults.length === 0) return null
//   return info.matchResults[info.stepIndex]
// })

// 清理
watch(() => info.pattern, () => {
  stop()
})

// 预设示例
const examples = [
  { name: '邮箱', pattern: '\\w[-\\w.+]*@([A-Za-z0-9][-A-Za-z0-9]+\\.)+[A-Za-z]{2,14}' },
  { name: '手机号', pattern: '1[3-9]\\d{9}' },
  { name: 'URL', pattern: 'https?:\\/\\/[^\\s]+' },
  { name: 'IP', pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' },
]
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <!-- 示例快捷按钮 -->
      <div class="flex items-center flex-wrap gap-2">
        <span class="text-sm text-gray-500">示例：</span>
        <el-button
          v-for="ex in examples"
          :key="ex.name"
          size="small"
          @click="info.pattern = ex.pattern; execMatch()"
        >
          {{ ex.name }}
        </el-button>
      </div>

      <!-- 正则输入 -->
      <div class="flex items-center gap-3">
        <el-input
          v-model="info.pattern"
          placeholder="输入正则表达式，如：\w+@\w+\.\w+"
          class="flex-1 font-mono"
          @keyup.enter="execMatch"
        />
        <el-button type="primary" @click="execMatch">测试</el-button>
        <el-button :type="info.isPlaying ? 'danger' : 'success'" @click="play">
          {{ info.isPlaying ? '停止' : '播放匹配' }}
        </el-button>
      </div>

      <!-- 错误提示 -->
      <div v-if="info.error" class="text-red-500 text-sm bg-red-50 p-2 rounded">
        {{ info.error }}
      </div>

      <!-- 测试文本 -->
      <div>
        <label class="text-sm font-medium text-gray-700 mb-1 block">测试文本</label>
        <el-input
          v-model="info.testString"
          type="textarea"
          :rows="3"
          placeholder="输入要匹配的文本..."
          @input="execMatch"
        />
      </div>

      <!-- 可视化匹配结果 -->
      <div>
        <label class="text-sm font-medium text-gray-700 mb-1 block">匹配结果</label>
        <div
          class="font-mono text-sm p-3 bg-gray-50 rounded-lg border min-h-[60px] leading-relaxed whitespace-pre-wrap"
          v-html="highlightedText"
        />
      </div>

      <!-- 匹配详情列表 -->
      <div v-if="info.matchResults.length > 0" class="bg-blue-50 rounded-lg p-3">
        <div class="text-sm font-medium text-blue-700 mb-2">
          共找到 {{ info.matchResults.length }} 处匹配：
        </div>
        <div class="space-y-2">
          <div
            v-for="(match, idx) in info.matchResults"
            :key="idx"
            class="flex items-start gap-3 text-sm"
            :class="{ 'bg-yellow-100 rounded p-2': info.isPlaying && idx === info.stepIndex }"
          >
            <span class="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
              {{ idx + 1 }}
            </span>
            <div>
              <div class="font-mono text-gray-800">{{ match.text }}</div>
              <div class="text-gray-500 text-xs">
                位置: {{ match.start }}-{{ match.end }}
                <span v-if="match.group"> | 分组: {{ match.group }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 语法分解 -->
      <div v-if="info.tokens.length > 0">
        <label class="text-sm font-medium text-gray-700 mb-1 block">语法分解</label>
        <div class="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
          <div
            v-for="(token, idx) in info.tokens"
            :key="idx"
            class="relative group"
          >
            <span
              class="px-2 py-1 rounded text-sm font-mono"
              :class="{
                'bg-green-100 text-green-800': token.type === 'literal',
                'bg-purple-100 text-purple-800': token.type === 'metachar',
                'bg-orange-100 text-orange-800': token.type === 'quantifier',
                'bg-blue-100 text-blue-800': token.type === 'escape',
                'bg-red-100 text-red-800': token.type === 'anchor',
                'bg-pink-100 text-pink-800': token.type === 'group',
                'bg-yellow-100 text-yellow-800': token.type === 'char-class',
                'bg-indigo-100 text-indigo-800': token.type === 'alternation',
              }"
            >
              {{ token.value }}
            </span>
            <!-- tooltip -->
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              {{ token.desc }}
            </div>
          </div>
        </div>
      </div>

      <!-- 图例 -->
      <div class="text-xs text-gray-500 flex flex-wrap gap-3">
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-green-100 rounded inline-block"></span>字面字符
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-purple-100 rounded inline-block"></span>元字符
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-orange-100 rounded inline-block"></span>量词
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-blue-100 rounded inline-block"></span>转义序列
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-red-100 rounded inline-block"></span>锚点
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-pink-100 rounded inline-block"></span>分组
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-yellow-100 rounded inline-block"></span>字符类
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-indigo-100 rounded inline-block"></span>选择
        </span>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <div class="text-sm leading-7 space-y-2">
        <p class="font-bold">功能说明</p>
        <p>正则表达式可视化工具，通过颜色标记和逐步播放帮助理解正则匹配过程。</p>
        <ul class="list-disc ml-5">
          <li><strong>智能解析</strong>：自动分析正则表达式的语法结构</li>
          <li><strong>颜色标记</strong>：不同语法成分用不同颜色区分</li>
          <li><strong>逐个高亮</strong>：播放模式下逐个显示匹配结果</li>
          <li><strong>位置信息</strong>：显示每个匹配的起止位置</li>
          <li><strong>分组捕获</strong>：显示捕获组的内容</li>
        </ul>
        <br>
        <p class="font-bold">语法色彩说明</p>
        <ul class="list-disc ml-5">
          <li><span class="inline-block px-1 bg-green-100 rounded">绿色</span> 字面字符</li>
          <li><span class="inline-block px-1 bg-purple-100 rounded">紫色</span> 元字符 (.任意字符)</li>
          <li><span class="inline-block px-1 bg-orange-100 rounded">橙色</span> 量词 (*+?{})</li>
          <li><span class="inline-block px-1 bg-blue-100 rounded">蓝色</span> 转义序列 (\d\w\s)</li>
          <li><span class="inline-block px-1 bg-red-100 rounded">红色</span> 锚点 (^$)</li>
          <li><span class="inline-block px-1 bg-pink-100 rounded">粉色</span> 分组 (())</li>
          <li><span class="inline-block px-1 bg-yellow-100 rounded">黄色</span> 字符类 ([])</li>
          <li><span class="inline-block px-1 bg-indigo-100 rounded">靛色</span> 选择 (|)</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>