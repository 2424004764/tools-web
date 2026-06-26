<script setup lang="ts">
import { reactive, ref, watch, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import Codemirror from "codemirror-editor-vue3";
import "codemirror/mode/javascript/javascript.js";

const info = reactive({
  title: "文本对比",
  leftTxt: 'apple\nbanana\ncherry\ndate',
  rightTxt: 'apple\nblueberry\ncherry\nelderberry'
})

const cmOptions = {
  mode: "text/plain",
  lineNumbers: true,
  theme: "default",
  lineWrapping: true,
}

const leftRef = ref<any>(null)
const rightRef = ref<any>(null)

let leftMarks: any[] = []
let rightMarks: any[] = []

const clearAll = () => {
  const leftCm = leftRef.value?.cminstance
  const rightCm = rightRef.value?.cminstance
  if (leftCm) leftMarks.forEach(m => { try { m.clear() } catch (e) {} })
  if (rightCm) rightMarks.forEach(m => { try { m.clear() } catch (e) {} })
  leftMarks = []
  rightMarks = []
}

const markLine = (cm: any, lineNum: number, css: string, marks: any[]) => {
  if (lineNum >= cm.lineCount()) return
  const lineLen = cm.getLine(lineNum)?.length ?? 0
  const mark = cm.markText(
    { line: lineNum, ch: 0 },
    { line: lineNum, ch: lineLen },
    { css }
  )
  marks.push(mark)
}

// 用 LCS 算法找到两边都有的行
const findCommonLines = (left: string[], right: string[]): Set<string> => {
  const m = left.length
  const n = right.length
  // dp[i][j] = left[0..i] 和 right[0..j] 的 LCS 长度
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (left[i - 1] === right[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  // 回溯找出 LCS 中的行内容（保留重复行）
  const common: string[] = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      common.unshift(left[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return new Set(common)
}

const doHighlight = () => {
  const leftCm = leftRef.value?.cminstance
  const rightCm = rightRef.value?.cminstance
  if (!leftCm || !rightCm) return

  clearAll()

  const leftLines = info.leftTxt.split('\n')
  const rightLines = info.rightTxt.split('\n')
  const commonLines = findCommonLines(leftLines, rightLines)

  // 左边中"独有"的行 -> 红色（删除）
  leftLines.forEach((line, idx) => {
    if (!commonLines.has(line)) {
      markLine(leftCm, idx, 'background:#fecaca;color:#991b1b;text-decoration:line-through;', leftMarks)
    }
  })

  // 右边中"独有"的行 -> 绿色（新增）
  rightLines.forEach((line, idx) => {
    if (!commonLines.has(line)) {
      markLine(rightCm, idx, 'background:#bbf7d0;color:#166534;', rightMarks)
    }
  })
}

const onReady = () => {
  nextTick(() => doHighlight())
}

watch([() => info.leftTxt, () => info.rightTxt], () => {
  nextTick(() => doHighlight())
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="flex justify-between">
        <div class="flex-1">
          <div class="mb-1 text-sm text-gray-600">旧文本</div>
          <Codemirror
            ref="leftRef"
            v-model:value="info.leftTxt"
            :options="cmOptions"
            border
            height="450"
            width="100%"
            placeholder="请输入旧文本..."
            @ready="onReady"
          />
        </div>
        <div class="flex-1 ml-3">
          <div class="mb-1 text-sm text-gray-600">新文本</div>
          <Codemirror
            ref="rightRef"
            v-model:value="info.rightTxt"
            :options="cmOptions"
            border
            height="450"
            width="100%"
            placeholder="请输入新文本..."
            @ready="onReady"
          />
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        在线文本差异比对支持中文、英文、代码比对，不限制字数轻松比对文本。红色行表示旧文本中独有的行（删除），绿色行表示新文本中独有的行（新增）。
      </el-text>
    </ToolDetail>

  </div>
</template>

<style scoped>
</style>