<script setup lang="ts">
import { reactive, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "JSON/YAML 格式化对比",
  input: `{
  "name": "tools-web",
  "version": "1.0.0",
  "features": [
    "JSON处理",
    "YAML转换",
    "格式对比"
  ]
}`,
  output: '',
  format: 'json' as 'json' | 'yaml',
  error: '',
})

const sampleJson = `{
  "name": "张三",
  "age": 25,
  "address": {
    "city": "北京",
    "district": "朝阳区"
  },
  "skills": ["JavaScript", "Python", "Go"]
}`

const sampleYaml = `name: 李四
age: 30
address:
  city: 上海
  district: 浦东新区
skills:
  - JavaScript
  - TypeScript
  - Rust`

const convert = () => {
  info.error = ''
  info.output = ''

  if (!info.input.trim()) {
    return
  }

  try {
    if (info.format === 'json') {
      // JSON -> YAML
      const obj = JSON.parse(info.input)
      const yamlLines: string[] = []

      const toYaml = (obj: any, indent: number = 0): string[] => {
        const spaces = '  '.repeat(indent)

        if (Array.isArray(obj)) {
          const lines: string[] = []
          for (const item of obj) {
            if (typeof item === 'object' && item !== null) {
              lines.push(`${spaces}-`)
              lines.push(...toYaml(item, indent + 1))
            } else {
              lines.push(`${spaces}- ${JSON.stringify(item)}`)
            }
          }
          return lines
        }

        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
              yamlLines.push(`${spaces}${key}:`)
              yamlLines.push(...toYaml(value, indent + 1))
            } else if (Array.isArray(value)) {
              yamlLines.push(`${spaces}${key}:`)
              yamlLines.push(...toYaml(value, indent))
            } else if (typeof value === 'string') {
              yamlLines.push(`${spaces}${key}: "${value}"`)
            } else {
              yamlLines.push(`${spaces}${key}: ${JSON.stringify(value)}`)
            }
          }
        }

        return yamlLines
      }

      toYaml(obj)
      info.output = yamlLines.join('\n')
    } else {
      // YAML -> JSON (简化实现)
      const lines = info.input.split('\n')
      const result: any = {}
      const stack: any[] = [result]
      const indentStack: number[] = [0]

      for (const line of lines) {
        if (!line.trim()) continue

        const indent = line.search(/\S/)
        const content = line.trim()

        // 缩进处理
        while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]) {
          stack.pop()
          indentStack.pop()
        }

        if (content.startsWith('- ')) {
          // 数组元素
          const value = content.slice(2).trim()
          const parent = stack[stack.length - 1]
          if (!Array.isArray(parent)) {
            const arr: any[] = []
            const key = `__array_${Date.now()}`
            parent[key] = arr
            stack.push(arr)
            indentStack.push(indent)
          }
          const arr = stack[stack.length - 1]
          if (value.startsWith('"') || value.startsWith("'")) {
            arr.push(value.slice(1, -1))
          } else if (value === 'true' || value === 'false') {
            arr.push(value === 'true')
          } else if (value === 'null') {
            arr.push(null)
          } else if (!isNaN(Number(value))) {
            arr.push(Number(value))
          } else {
            arr.push(value)
          }
        } else if (content.includes(':')) {
          const colonIdx = content.indexOf(':')
          const key = content.slice(0, colonIdx).trim()
          let value: any = content.slice(colonIdx + 1).trim()

          // 解析值
          if (value === '' || value === 'null') {
            value = null
          } else if (value === 'true' || value === 'false') {
            value = value === 'true'
          } else if (!isNaN(Number(value))) {
            value = Number(value)
          } else if ((value.startsWith('"') && value.endsWith('"')) ||
                     (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }

          const parent = stack[stack.length - 1]
          parent[key] = value

          if (value === null || (typeof value === 'string' && value === '')) {
            // 空值，可能是对象
            const newObj: any = {}
            parent[key] = newObj
            stack.push(newObj)
            indentStack.push(indent)
          }
        }
      }

      info.output = JSON.stringify(result, null, 2)
    }
  } catch (e: any) {
    info.error = e.message
  }
}

// 监听输入变化，自动转换
watch(() => info.input, convert, { immediate: true })
watch(() => info.format, convert)

// 初始化时转换一次
convert()

const loadSample = (type: 'json' | 'yaml') => {
  info.input = type === 'json' ? sampleJson : sampleYaml
  info.format = type === 'json' ? 'yaml' : 'json'
  // loadSample 会触发 watch 自动转换
}

const swapInputOutput = () => {
  const temp = info.input
  info.input = info.output
  info.output = temp
  info.format = info.format === 'json' ? 'yaml' : 'json'
  info.error = ''
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <!-- 操作按钮 -->
      <div class="flex items-center flex-wrap gap-2">
        <span class="text-sm text-gray-500">示例：</span>
        <el-button size="small" @click="loadSample('json')">JSON示例</el-button>
        <el-button size="small" @click="loadSample('yaml')">YAML示例</el-button>
        <el-button size="small" @click="swapInputOutput">交换输入/输出</el-button>

        <div class="flex items-center gap-2 ml-auto">
          <span class="text-sm text-gray-500">转换方向：</span>
          <el-radio-group v-model="info.format" size="small">
            <el-radio-button value="json">JSON → YAML</el-radio-button>
            <el-radio-button value="yaml">YAML → JSON</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- 输入输出区域 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium text-gray-700 mb-1 block">
            {{ info.format === 'json' ? 'JSON 输入' : 'YAML 输入' }}
          </label>
          <el-input
            v-model="info.input"
            type="textarea"
            :rows="12"
            :placeholder="info.format === 'json' ? '输入 JSON...' : '输入 YAML...'"
            class="font-mono text-sm"
          />
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700 mb-1 block">
            {{ info.format === 'json' ? 'YAML 输出' : 'JSON 输出' }}
          </label>
          <el-input
            v-model="info.output"
            type="textarea"
            :rows="12"
            readonly
            placeholder="转换结果..."
            class="font-mono text-sm"
          />
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="info.error" class="text-red-500 text-sm bg-red-50 p-3 rounded">
        {{ info.error }}
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <div class="text-sm leading-7 space-y-2">
        <p class="font-bold">功能说明</p>
        <p>JSON/YAML 格式化对比工具，支持两种格式之间的相互转换。</p>
        <ul class="list-disc ml-5">
          <li><strong>JSON → YAML</strong>：将 JSON 格式转换为 YAML 格式</li>
          <li><strong>YAML → JSON</strong>：将 YAML 格式转换为 JSON 格式</li>
          <li><strong>交换</strong>：一键交换输入和输出内容</li>
          <li><strong>示例</strong>：提供 JSON 和 YAML 示例数据</li>
        </ul>
        <br>
        <p class="font-bold">使用场景</p>
        <ul class="list-disc ml-5">
          <li>配置文件格式转换（docker-compose.yaml ↔ config.json）</li>
          <li>API 文档格式转换</li>
          <li>数据导入导出格式兼容</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>