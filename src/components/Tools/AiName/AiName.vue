<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import axios from 'axios'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'

type Gender = '男' | '女'
type SurnameUsage = '父姓' | '母姓'
type GivenLen = '1' | '1-2' | '2'

const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || '')
const pollinationsProxyUrl = ref(import.meta.env.VITE_POLLINATIONS_PROXY_URL)
const pollinationsTextUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL)

const info = reactive({
  title: 'AI起名',
  desc: '输入父母姓氏，选择名的长度与性别，一键生成多个中文姓名，并给出命名理由'
})

const fatherSurname = ref('')
const motherSurname = ref('')
const surnameUsage = ref<SurnameUsage>('父姓')
const gender = ref<Gender>('男')
const givenLen = ref<GivenLen>('1-2')
const style = ref<'不限' | '古典' | '现代' | '文雅' | '阳光' | '中性' | '诗意'>('不限')
const count = ref(10)
const noCache = ref(true)
const meaning = ref('')
const meaningExamples = [
  '聪慧睿智',
  '健康平安',
  '自信阳光',
  '知书达理',
  '博学多才',
  '坚毅勇敢',
  '温婉大方',
  '心怀远志',
  '独立自强',
  '善良纯真'
]
const useMeaningExample = (m: string) => { meaning.value = m }

const isLoading = ref(false)
const results = ref<Array<{ name: string; reason: string }>>([])

const canGenerate = computed(() => {
  const useMother = surnameUsage.value === '母姓'
  const haveSelectedSurname = useMother
    ? !!motherSurname.value.trim()
    : !!fatherSurname.value.trim()
  return haveSelectedSurname && !isLoading.value && count.value > 0 && count.value <= 50
})

const examples = [
  { f: '张', m: '李' },
  { f: '王', m: '赵' },
  { f: '陈', m: '刘' },
]

const fillExample = () => {
  const i = Math.floor(Math.random() * examples.length)
  fatherSurname.value = examples[i].f
  motherSurname.value = examples[i].m
}

const buildPrompt = (overrideLen?: GivenLen, overrideCount?: number) => {
  const fs = fatherSurname.value.trim()
  const ms = motherSurname.value.trim()
  const usageText = surnameUsage.value
  const styleText = style.value === '不限' ? '不限定风格' : `${style.value}风格`
  const genderText = gender.value

  const lenChoice = overrideLen || givenLen.value
  const finalCount = overrideCount ?? count.value

  const extraLenRule =
    lenChoice === '1'
      ? '名必须为 1 个汉字，禁止 2 字名'
      : lenChoice === '2'
      ? '名必须为 2 个汉字，禁止 1 字名'
      : '名只能为 1 或 2 个汉字，且 2 字名数量不得少于 1 字名；输出顺序从 2 字名开始，然后与 1 字名交替排列（2、1、2、1...）'

  const lines: string[] = [
    `你是一位中文姓名学助理，请基于以下约束生成 ${finalCount} 个中文全名，并给出简洁的命名理由：`,
    `- 输入姓氏：父姓「${fs || '无'}」、母姓「${ms || '无'}」`,
    `- 姓氏使用：${usageText}`,
    `- 名字长度：仅名部分为 ${lenChoice === '1-2' ? '1 或 2' : lenChoice} 个汉字（不含姓氏）；${extraLenRule}`,
    `- 性别：${genderText}（注意名字读感与性别气质匹配）`,
    `- 风格：${styleText}（语义积极、读起来顺口，避免生僻与负面含义）`,
  ]
  const meaningText = meaning.value.replace(/\r?\n/g, '；').trim()
  if (meaningText) {
    lines.push(`- 寓意：${meaningText}（名字需体现或贴近该寓意）`)
  }
  lines.push(
    `- 规则：所有姓名必须以所选姓氏开头；避免多音不雅，尽量避开同音低俗；可参考寓意、音律、字形搭配、文化典故等`,
    `- 自检：逐条校验“名”的汉字个数是否满足本次设定；当设为“1-2”时，保证 2 字名数量不小于 1 字名，且尽量交替；不满足请在内部修正后再输出`,
    `- 输出：姓名和理由每行一个，破折号分割姓名和理由，不要添加序号或额外说明`
  )
  return lines.join('\n')
}

const parseLines = (text: string) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const items: Array<{ name: string; reason: string }> = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    // 允许使用 tab 或 破折号/冒号 分隔，尽量兼容
    let name = ''
    let reason = ''
    if (line.includes('\t')) {
      const [n, ...rest] = line.split('\t')
      name = (n || '').trim()
      reason = rest.join('\t').trim()
    } else if (line.includes('—') || line.includes('-') || line.includes('：') || line.includes(':')) {
      const m = line.split(/\s*[—\-：:]\s*/)
      name = (m[0] || '').trim()
      reason = (m.slice(1).join('：') || '').trim()
    } else {
      name = line
      reason = ''
    }
    if (name) items.push({ name, reason })
  }
  return items
}

function countChineseChars(s: string): number {
  if (!s) return 0
  const m = s.match(/[\u4e00-\u9fa5]/g)
  return m ? m.length : 0
}

function filterByGivenLen(items: Array<{ name: string; reason: string }>): Array<{ name: string; reason: string }>{
  const expectedSurname = (surnameUsage.value === '父姓' ? fatherSurname.value.trim() : motherSurname.value.trim()) || fatherSurname.value.trim() || motherSurname.value.trim()
  const wantLen = givenLen.value
  const ok = items.filter(it => {
    const name = (it.name || '').trim()
    if (!name) return false
    let given = name
    if (expectedSurname && name.startsWith(expectedSurname)) {
      given = name.slice(expectedSurname.length)
    }
    const len = countChineseChars(given)
    if (wantLen === '1-2') return len === 1 || len === 2
    return len === Number(wantLen)
  })
  if (wantLen !== '1-2') return ok
  // 1-2: 尝试均衡输出
  const ones = ok.filter(it => {
    const name = it.name.trim()
    const given = expectedSurname && name.startsWith(expectedSurname) ? name.slice(expectedSurname.length) : name
    return countChineseChars(given) === 1
  })
  const twos = ok.filter(it => {
    const name = it.name.trim()
    const given = expectedSurname && name.startsWith(expectedSurname) ? name.slice(expectedSurname.length) : name
    return countChineseChars(given) === 2
  })
  const half = Math.ceil(count.value / 2)
  const pick: Array<{ name: string; reason: string }> = []
  // 先各取一半，不足则回填
  for (let i = 0; i < half && i < ones.length; i++) pick.push(ones[i])
  for (let i = 0; i < half && i < twos.length; i++) pick.push(twos[i])
  // 回填剩余
  const rest = [...ones.slice(half), ...twos.slice(half)]
  for (const it of rest) {
    if (pick.length >= count.value) break
    // 避免重复
    if (!pick.find(p => p.name === it.name)) pick.push(it)
  }
  return pick
}

const generate = async () => {
  if (!canGenerate.value) return
  isLoading.value = true
  results.value = []
  try {
    // 校验所选姓氏是否填写
    if (surnameUsage.value === '母姓' && !motherSurname.value.trim()) {
      ElMessage.warning('已选择“母姓”，请先填写母姓再生成')
      isLoading.value = false
      return
    }
    if (surnameUsage.value === '父姓' && !fatherSurname.value.trim()) {
      ElMessage.warning('已选择“父姓”，请先填写父姓再生成')
      isLoading.value = false
      return
    }
    const seen = new Set<string>()
    const uniq: Array<{ name: string; reason: string }> = []

    const collect = (text: string) => {
      const items = parseLines(text)
      for (const it of items) {
        const key = it.name
        if (!key || seen.has(key)) continue
        seen.add(key)
        uniq.push(it)
        if (uniq.length >= count.value * 3) break
      }
    }

    if (givenLen.value === '1-2') {
      const needTwo = Math.ceil(count.value / 2)
      const needOne = count.value - needTwo
      const p2 = buildPrompt('2', needTwo)
      const p1 = buildPrompt('1', needOne)
      const zws2 = '\u200b'.repeat(1 + Math.floor(Math.random() * 3))
      const zws1 = '\u200b'.repeat(1 + Math.floor(Math.random() * 3))
      const [resp2, resp1] = await Promise.all([
        axios.get(
          `${pollinationsProxyUrl.value}?path=${encodeURIComponent(noCache.value ? (p2 + zws2) : p2)}&target=${pollinationsTextUrl.value}&params=_t=${Date.now()}`,
          { headers: { Authorization: 'Bearer ' + pollinationsApiKey.value } }
        ),
        axios.get(
          `${pollinationsProxyUrl.value}?path=${encodeURIComponent(noCache.value ? (p1 + zws1) : p1)}&target=${pollinationsTextUrl.value}&params=_t=${Date.now()+1}`,
          { headers: { Authorization: 'Bearer ' + pollinationsApiKey.value } }
        )
      ])
      collect(typeof resp2.data === 'string' ? resp2.data : String(resp2.data))
      collect(typeof resp1.data === 'string' ? resp1.data : String(resp1.data))
    } else {
      const p = buildPrompt(givenLen.value)
      const zws = '\u200b'.repeat(1 + Math.floor(Math.random() * 3))
      const promptToSend = noCache.value ? (p + zws) : p
      const resp = await axios.get(
        `${pollinationsProxyUrl.value}?path=${encodeURIComponent(promptToSend)}&target=${pollinationsTextUrl.value}&params=_t=${Date.now()}`,
        { headers: { Authorization: 'Bearer ' + pollinationsApiKey.value } }
      )
      collect(typeof resp.data === 'string' ? resp.data : String(resp.data))
    }

    const filtered = filterByGivenLen(uniq)
    results.value = filtered.slice(0, count.value)
  } catch (e) {
    console.error('生成失败:', e)
    alert('生成失败，请稍后重试')
  } finally {
    isLoading.value = false
  }
}

const copyOne = (s: string) => copy(s)
const copyAll = () => results.value.length && copy(results.value.map(i => `${i.name}\t${i.reason}`).join('\n'))
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />
    <div class="p-4 rounded-2xl bg-white">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <label class="block text-sm text-gray-700">父姓 / 母姓</label>
            <button class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded" @click="fillExample">示例</button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <input v-model="fatherSurname" maxlength="2" placeholder="父姓，如 张" class="w-full p-2 border rounded-lg" />
            <input v-model="motherSurname" maxlength="2" placeholder="母姓，如 李（可选）" class="w-full p-2 border rounded-lg" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm text-gray-700 mb-1">姓氏使用</label>
              <select v-model="surnameUsage" class="w-full p-2 border rounded-lg">
                <option value="父姓">父姓</option>
                <option value="母姓">母姓</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">性别</label>
              <select v-model="gender" class="w-full p-2 border rounded-lg">
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm text-gray-700 mb-1">名的长度</label>
              <select v-model="givenLen" class="w-full p-2 border rounded-lg">
                <option value="1">1</option>
                <option value="1-2">1-2（默认）</option>
                <option value="2">2</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">风格</label>
              <select v-model="style" class="w-full p-2 border rounded-lg">
                <option value="不限">不限</option>
                <option value="古典">古典</option>
                <option value="现代">现代</option>
                <option value="文雅">文雅</option>
                <option value="阳光">阳光</option>
                <option value="中性">中性</option>
                <option value="诗意">诗意</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">数量</label>
              <input v-model.number="count" type="number" min="1" max="50" class="w-full p-2 border rounded-lg" />
            </div>
          </div>

          <!-- 寓意输入 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm w-40 text-gray-700">寓意（可选）</label>
              <div class="flex flex-wrap gap-2 text-xs">
                <button
                  v-for="m in meaningExamples"
                  :key="m"
                  class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                  @click="useMeaningExample(m)"
                >{{ m }}</button>
              </div>
            </div>
            <textarea v-model="meaning" rows="3" maxlength="200" placeholder="例如：聪慧睿智 / 健康平安 / 自信阳光\n可分行填写多个侧重点" class="w-full p-2 border rounded-lg min-h-[80px]"></textarea>
          </div>

          <button
            @click="generate"
            :disabled="!canGenerate"
            :class="[
              'py-3 px-6 rounded-lg w-full transition',
              !canGenerate ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            ]"
          >
            {{ isLoading ? '生成中...' : '生成姓名' }}
          </button>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-600">生成结果</div>
            <button class="px-3 py-1 text-sm bg-emerald-500 text-white rounded" :disabled="!results.length" @click="copyAll">复制全部</button>
          </div>
          <div class="min-h-[220px] border rounded-lg p-3 bg-gray-50">
            <div v-if="isLoading" class="text-gray-500">生成中...</div>
            <ul v-else class="space-y-2">
              <li v-for="(r, i) in results" :key="i" class="flex items-start justify-between bg-white p-3 rounded border">
                <div class="pr-3">
                  <div class="font-medium">{{ r.name }}</div>
                  <div class="text-gray-600 text-sm mt-1" v-if="r.reason">{{ r.reason }}</div>
                </div>
                <button class="px-2 py-1 text-xs bg-blue-500 text-white rounded h-fit" @click="copyOne(r.name)">复制</button>
              </li>
              <div v-if="!results.length" class="text-gray-400 text-sm">暂无结果</div>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>{{ info.desc }}</el-text>
    </ToolDetail>
  </div>
  </template>

<style scoped>
</style>


