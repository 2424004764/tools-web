<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

type Row = { key: string; value: string }

const info = reactive({
  title: 'URL 参数解析/构造',
})

const state = reactive({
  raw: '',
  base: '',
  autoEncode: true,
  resultQuery: '',
  resultFull: '',
})

const rows = ref<Row[]>([{ key: '', value: '' }])

const enc = (s: string) => (state.autoEncode ? encodeURIComponent(s) : s)

const parse = () => {
  let s = (state.raw || '').trim()
  // 去掉 hash
  const hashIdx = s.indexOf('#')
  if (hashIdx >= 0) s = s.slice(0, hashIdx)

  let base = ''
  let qs = s
  const qIdx = s.indexOf('?')
  if (qIdx >= 0) {
    base = s.slice(0, qIdx)
    qs = s.slice(qIdx + 1)
  }
  if (qs.startsWith('?')) qs = qs.slice(1)

  state.base = base

  if (!qs) {
    rows.value = [{ key: '', value: '' }]
    build()
    return
  }

  // 仅替换 parse 内的解析段（保留前面的 base/qs 提取）
  // 原来：
  // const segs = qs.split('&').filter(Boolean)
  // const next: Row[] = segs.map(seg => {
  //   const eq = seg.indexOf('=')
  //   if (eq === -1) return { key: dec(seg), value: '' }
  //   const k = seg.slice(0, eq)
  //   const v = seg.slice(eq + 1)
  //   return { key: dec(k), value: dec(v) }
  // })

  // 替换为：
  const sp = new URLSearchParams(qs)
  const next: Row[] = []
  sp.forEach((value, key) => {
    next.push({ key, value })
  })
  rows.value = next.length ? next : [{ key: '', value: '' }]
  build()
}

const build = () => {
  const segs = rows.value
    .filter(r => r.key !== '')
    .map(r => `${enc(r.key)}=${enc(r.value ?? '')}`)
  const qs = segs.join('&')
  state.resultQuery = qs ? `?${qs}` : ''
  state.resultFull = state.base ? `${state.base}${state.resultQuery}` : state.resultQuery
}

const addRow = () => rows.value.push({ key: '', value: '' })
const removeRow = (idx: number) => rows.value.splice(idx, 1)

const clearAll = () => {
  state.raw = ''
  state.base = ''
  state.resultQuery = ''
  state.resultFull = ''
  rows.value = [{ key: '', value: '' }]
}

const copyQuery = () => copy(state.resultQuery)
const copyFull = () => copy(state.resultFull)

const fillExample = () => {
  state.raw = 'https://example.com/path?a=1&b=2&name=%E5%BC%A0%E4%B8%89%20Lee&empty=&flag'
}

watch(rows, build, { deep: true })
watch(() => state.autoEncode, build)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <div class="mb-2 text-sm text-gray-500">
        输入完整 URL 或查询串（如：?a=1&b=2），点击“解析”即可在下方编辑后重新拼接。
        <el-link class="ml-2" type="primary" @click="fillExample">填充示例</el-link>
      </div>
      <el-input
        type="textarea"
        :rows="3"
        v-model="state.raw"
        placeholder="输入 URL 或 ?a=1&b=2 形式的查询串"
      />

      <div class="mt-3 flex flex-wrap items-center gap-2 button-container">
        <el-button type="primary" @click="parse">解析</el-button>
        <el-button @click="build">重新拼接</el-button>
        <el-switch
          v-model="state.autoEncode"
          active-text="自动编码"
          inactive-text="保持原样"
        />
        <el-button type="danger" @click="clearAll">清空</el-button>
      </div>

      <div class="mt-4">
        <div class="text-sm text-gray-600 mb-2">基础 URL（解析时自动提取，可手动调整）：</div>
        <el-input v-model="state.base" placeholder="示例：https://example.com/path" />
      </div>

      <div class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm text-gray-600">参数列表</div>
          <el-button size="small" @click="addRow">添加参数</el-button>
        </div>

        <div class="space-y-2">
          <div v-for="(r, idx) in rows" :key="idx" class="flex gap-2 items-center">
            <div class="shrink basis-[28%] md:basis-[22%] lg:basis-[18%]">
              <el-input v-model="r.key" placeholder="key" />
            </div>
            <div class="grow basis-0 min-w-0">
              <el-input v-model="r.value" placeholder="value" />
            </div>
            <el-button type="danger" link @click="removeRow(idx)">删除</el-button>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <div class="text-sm text-gray-600 mb-1">拼接结果（仅查询串）：</div>
        <el-input v-model="state.resultQuery" readonly />
        <div class="mt-2">
          <el-button type="primary" @click="copyQuery">复制查询串</el-button>
        </div>
      </div>

      <div class="mt-4">
        <div class="text-sm text-gray-600 mb-1">拼接结果（完整 URL）：</div>
        <el-input v-model="state.resultFull" readonly />
        <div class="mt-2">
          <el-button type="primary" @click="copyFull">复制完整 URL</el-button>
        </div>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>
        一键解析 URL 查询参数，支持编辑参数后重新拼接；支持是否自动进行 URL 编码；可复制查询串或完整 URL。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.button-container .el-button {
  margin-right: 12px;
  margin-left: 0px;
}
</style>