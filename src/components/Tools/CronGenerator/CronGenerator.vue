<script setup lang="ts">
import { reactive, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { CronExpressionParser } from 'cron-parser'

const info = reactive({
  title: "Cron表达式生成器",
  cronExpression: '',
  cronDescription: '',
  nextExecutions: [] as string[],
  executionCount: 10,
  selectedType: 'second',
  cronConfig: {
    second: {
      type: 'every',
      value: '*',
      start: 0,
      end: 59,
      step: 1,
      specific: [] as number[],
      selectedValues: [] as number[],
      range: { start: 0, end: 59 }
    },
    minute: {
      type: 'every',
      value: '*',
      start: 0,
      end: 59,
      step: 1,
      specific: [] as number[],
      selectedValues: [] as number[],
      range: { start: 0, end: 59 }
    },
    hour: {
      type: 'every',
      value: '*',
      start: 0,
      end: 23,
      step: 1,
      specific: [] as number[],
      selectedValues: [] as number[],
      range: { start: 0, end: 23 }
    },
    day: {
      type: 'every',
      value: '*',
      start: 1,
      end: 31,
      step: 1,
      specific: [] as number[],
      selectedValues: [] as number[],
      range: { start: 1, end: 31 }
    },
    month: {
      type: 'every',
      value: '*',
      start: 1,
      end: 12,
      step: 1,
      specific: [] as number[],
      selectedValues: [] as number[],
      range: { start: 1, end: 12 }
    },
    week: {
      type: 'every',
      value: '?',
      start: 1,
      end: 7,
      step: 1,
      specific: [] as number[],
      selectedValues: [] as number[],
      range: { start: 1, end: 7 }
    }
  },
  presetExamples: [
    {
      name: '每秒执行',
      cron: '* * * * * ?',
      desc: '每秒执行一次'
    },
    {
      name: '每分钟执行',
      cron: '0 * * * * ?',
      desc: '每分钟的第0秒执行'
    },
    {
      name: '每小时执行',
      cron: '0 0 * * * ?',
      desc: '每小时的第0分0秒执行'
    },
    {
      name: '每天凌晨执行',
      cron: '0 0 0 * * ?',
      desc: '每天凌晨0点0分0秒执行'
    },
    {
      name: '每周一执行',
      cron: '0 0 0 ? * MON',
      desc: '每周一凌晨0点执行'
    },
    {
      name: '每月1号执行',
      cron: '0 0 0 1 * ?',
      desc: '每月1号凌晨0点执行'
    },
    {
      name: '每5秒执行',
      cron: '*/5 * * * * ?',
      desc: '每5秒执行一次'
    },
    {
      name: '每10分钟执行',
      cron: '0 */10 * * * ?',
      desc: '每10分钟执行一次'
    },
    {
      name: '每2小时执行',
      cron: '0 0 */2 * * ?',
      desc: '每2小时执行一次'
    },
    {
      name: '指定时间范围',
      cron: '* * 1-2 * * ?',
      desc: '每天1点到2点每秒执行'
    },
    {
      name: '指定多个时间',
      cron: '0 0 8,12,18 * * ?',
      desc: '每天8点、12点、18点执行'
    },
    {
      name: '工作日执行',
      cron: '0 0 9 ? * MON-FRI',
      desc: '工作日9点执行'
    }
  ]
})

// 手机端Tab相关
const currentTabIndex = ref(0)
const tabList = [
  { name: 'second', label: '秒' },
  { name: 'minute', label: '分' },
  { name: 'hour', label: '时' },
  { name: 'day', label: '日' },
  { name: 'month', label: '月' },
  { name: 'week', label: '周' }
]

// 使用cron-parser计算最近执行时间
const calculateNextExecutions = () => {
  if (!info.cronExpression) {
    info.nextExecutions = []
    return
  }
  
  try {
    const interval = CronExpressionParser.parse(info.cronExpression)
    const executions: string[] = []
    
    for (let i = 0; i < info.executionCount; i++) {
      const next = interval.next()
      const date = next.toDate()
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const weekday = weekdays[date.getDay()]
      const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')} (${weekday})`
      executions.push(formatted)
    }
    
    info.nextExecutions = executions
  } catch (error) {
    console.error('Cron表达式解析错误:', error)
    info.nextExecutions = []
  }
}

// 生成cron表达式
const generateCron = () => {
  const config = info.cronConfig
  const cron = [
    config.second.value,
    config.minute.value,
    config.hour.value,
    config.day.value,
    config.month.value,
    config.week.value
  ].join(' ')
  
  info.cronExpression = cron
  generateDescription()
  calculateNextExecutions()
}

// 生成描述
const generateDescription = () => {
  const parts = info.cronExpression.split(' ')
  let desc = '表达式含义：'
  
  // 秒
  if (parts[0] === '*') {
    desc += '每秒'
  } else if (parts[0].includes('/')) {
    const step = parts[0].split('/')[1]
    desc += `每${step}秒`
  } else if (parts[0] === '0') {
    desc += '在0秒'
  } else {
    desc += `在${parts[0]}秒`
  }
  
  // 分
  if (parts[1] === '*') {
    desc += '每分'
  } else if (parts[1].includes('/')) {
    const step = parts[1].split('/')[1]
    desc += `每${step}分`
  } else if (parts[1] === '0') {
    desc += '在0分'
  } else {
    desc += `在${parts[1]}分`
  }
  
  // 时
  if (parts[2] === '*') {
    desc += '每时'
  } else if (parts[2].includes('/')) {
    const step = parts[2].split('/')[1]
    desc += `每${step}时`
  } else if (parts[2] === '0') {
    desc += '在0时'
  } else {
    desc += `在${parts[2]}时`
  }
  
  // 日
  if (parts[3] === '*') {
    desc += '每日'
  } else if (parts[3].includes('/')) {
    const step = parts[3].split('/')[1]
    desc += `每${step}日`
  } else if (parts[3] === '1') {
    desc += '在1日'
  } else {
    desc += `在${parts[3]}日`
  }
  
  // 月
  if (parts[4] === '*') {
    desc += '每月'
  } else if (parts[4].includes('/')) {
    const step = parts[4].split('/')[1]
    desc += `每${step}月`
  } else if (parts[4] === '1') {
    desc += '在1月'
  } else {
    desc += `在${parts[4]}月`
  }
  
  // 周
  if (parts[5] === '?') {
    desc += ''
  } else if (parts[5] === 'MON') {
    desc += '在周一'
  } else if (parts[5] === '*') {
    desc += '每周'
  } else {
    desc += `在周${parts[5]}`
  }
  
  desc += '执行'
  info.cronDescription = desc
}

// 更新配置函数，修复类型问题
const updateConfig = (field: string, type: string, value: any) => {
  const config = info.cronConfig[field as keyof typeof info.cronConfig]
  if (config) {
    config.type = type
    if (type === 'specific') {
      if (config.selectedValues.length > 0) {
        config.value = config.selectedValues.join(',')
      } else {
        config.value = '*'
      }
    } else if (type === 'range') {
      const range = config.range
      config.value = `${range.start}-${range.end}`
    } else if (type === 'step') {
      config.value = `*/${config.step}`
    } else {
      config.value = value
    }
    generateCron()
  }
}

// 处理间隔范围变化
const handleRangeStartChange = (field: string) => {
  const config = info.cronConfig[field as keyof typeof info.cronConfig]
  if (config && config.type === 'range') {
    const range = config.range
    
    if (range.start > range.end) {
      range.end = range.start
    }
    
    config.value = `${range.start}-${range.end}`
    generateCron()
  }
}

const handleRangeEndChange = (field: string) => {
  const config = info.cronConfig[field as keyof typeof info.cronConfig]
  if (config && config.type === 'range') {
    const range = config.range
    
    if (range.end < range.start) {
      range.start = range.end
    }
    
    config.value = `${range.start}-${range.end}`
    generateCron()
  }
}

// 处理多选值变化
const handleMultiSelectChange = (field: string, values: any[]) => {
  const config = info.cronConfig[field as keyof typeof info.cronConfig]
  if (config) {
    config.selectedValues = values
    config.value = values.join(',')
    generateCron()
  }
}

// 使用预设
const usePreset = (cron: string) => {
  info.cronExpression = cron
  parseCronToConfig(cron)
  generateDescription()
  calculateNextExecutions()
}

// 复制结果
const copyResult = async () => {
  if (info.cronExpression) {
    await copy(info.cronExpression)
  }
}

// 处理Cron表达式输入
const onCronInput = () => {
  parseCronToConfig(info.cronExpression)
  generateDescription()
  calculateNextExecutions()
}

// 解析Cron表达式到配置项
const parseCronToConfig = (cronExpression: string) => {
  const parts = cronExpression.split(' ')
  if (parts.length < 6) return
  
  const [second, minute, hour, day, month, weekday] = parts
  
  // 解析秒
  if (second === '*') {
    info.cronConfig.second.type = 'every'
    info.cronConfig.second.value = '*'
    info.cronConfig.second.selectedValues = []
    info.cronConfig.second.range = { start: 0, end: 59 }
  } else if (second.includes('/')) {
    const step = second.split('/')[1]
    info.cronConfig.second.type = 'step'
    info.cronConfig.second.step = parseInt(step)
    info.cronConfig.second.value = second
    info.cronConfig.second.selectedValues = []
    info.cronConfig.second.range = { start: 0, end: 59 }
  } else if (second.includes(',')) {
    info.cronConfig.second.type = 'specific'
    const values = second.split(',').map(v => parseInt(v))
    info.cronConfig.second.selectedValues = values
    info.cronConfig.second.value = second
    info.cronConfig.second.range = { start: 0, end: 59 }
  } else if (second.includes('-')) {
    info.cronConfig.second.type = 'range'
    const [start, end] = second.split('-').map(v => parseInt(v))
    info.cronConfig.second.range = { start, end }
    info.cronConfig.second.value = second
    info.cronConfig.second.selectedValues = []
  } else {
    info.cronConfig.second.type = 'specific'
    info.cronConfig.second.selectedValues = [parseInt(second)]
    info.cronConfig.second.value = second
    info.cronConfig.second.range = { start: 0, end: 59 }
  }
  
  // 解析分
  if (minute === '*') {
    info.cronConfig.minute.type = 'every'
    info.cronConfig.minute.value = '*'
    info.cronConfig.minute.selectedValues = []
    info.cronConfig.minute.range = { start: 0, end: 59 }
  } else if (minute.includes('/')) {
    const step = minute.split('/')[1]
    info.cronConfig.minute.type = 'step'
    info.cronConfig.minute.step = parseInt(step)
    info.cronConfig.minute.value = minute
    info.cronConfig.minute.selectedValues = []
    info.cronConfig.minute.range = { start: 0, end: 59 }
  } else if (minute.includes(',')) {
    info.cronConfig.minute.type = 'specific'
    const values = minute.split(',').map(v => parseInt(v))
    info.cronConfig.minute.selectedValues = values
    info.cronConfig.minute.value = minute
    info.cronConfig.minute.range = { start: 0, end: 59 }
  } else if (minute.includes('-')) {
    info.cronConfig.minute.type = 'range'
    const [start, end] = minute.split('-').map(v => parseInt(v))
    info.cronConfig.minute.range = { start, end }
    info.cronConfig.minute.value = minute
    info.cronConfig.minute.selectedValues = []
  } else {
    info.cronConfig.minute.type = 'specific'
    info.cronConfig.minute.selectedValues = [parseInt(minute)]
    info.cronConfig.minute.value = minute
    info.cronConfig.minute.range = { start: 0, end: 59 }
  }
  
  // 解析时
  if (hour === '*') {
    info.cronConfig.hour.type = 'every'
    info.cronConfig.hour.value = '*'
    info.cronConfig.hour.selectedValues = []
    info.cronConfig.hour.range = { start: 0, end: 23 }
  } else if (hour.includes('/')) {
    const step = hour.split('/')[1]
    info.cronConfig.hour.type = 'step'
    info.cronConfig.hour.step = parseInt(step)
    info.cronConfig.hour.value = hour
    info.cronConfig.hour.selectedValues = []
    info.cronConfig.hour.range = { start: 0, end: 23 }
  } else if (hour.includes(',')) {
    info.cronConfig.hour.type = 'specific'
    const values = hour.split(',').map(v => parseInt(v))
    info.cronConfig.hour.selectedValues = values
    info.cronConfig.hour.value = hour
    info.cronConfig.hour.range = { start: 0, end: 23 }
  } else if (hour.includes('-')) {
    info.cronConfig.hour.type = 'range'
    const [start, end] = hour.split('-').map(v => parseInt(v))
    info.cronConfig.hour.range = { start, end }
    info.cronConfig.hour.value = hour
    info.cronConfig.hour.selectedValues = []
  } else {
    info.cronConfig.hour.type = 'specific'
    info.cronConfig.hour.selectedValues = [parseInt(hour)]
    info.cronConfig.hour.value = hour
    info.cronConfig.hour.range = { start: 0, end: 23 }
  }
  
  // 解析日
  if (day === '*') {
    info.cronConfig.day.type = 'every'
    info.cronConfig.day.value = '*'
    info.cronConfig.day.selectedValues = []
    info.cronConfig.day.range = { start: 1, end: 31 }
  } else if (day.includes('/')) {
    const step = day.split('/')[1]
    info.cronConfig.day.type = 'step'
    info.cronConfig.day.step = parseInt(step)
    info.cronConfig.day.value = day
    info.cronConfig.day.selectedValues = []
    info.cronConfig.day.range = { start: 1, end: 31 }
  } else if (day.includes(',')) {
    info.cronConfig.day.type = 'specific'
    const values = day.split(',').map(v => parseInt(v))
    info.cronConfig.day.selectedValues = values
    info.cronConfig.day.value = day
    info.cronConfig.day.range = { start: 1, end: 31 }
  } else if (day.includes('-')) {
    info.cronConfig.day.type = 'range'
    const [start, end] = day.split('-').map(v => parseInt(v))
    info.cronConfig.day.range = { start, end }
    info.cronConfig.day.value = day
    info.cronConfig.day.selectedValues = []
  } else {
    info.cronConfig.day.type = 'specific'
    info.cronConfig.day.selectedValues = [parseInt(day)]
    info.cronConfig.day.value = day
    info.cronConfig.day.range = { start: 1, end: 31 }
  }
  
  // 解析月
  if (month === '*') {
    info.cronConfig.month.type = 'every'
    info.cronConfig.month.value = '*'
    info.cronConfig.month.selectedValues = []
    info.cronConfig.month.range = { start: 1, end: 12 }
  } else if (month.includes('/')) {
    const step = month.split('/')[1]
    info.cronConfig.month.type = 'step'
    info.cronConfig.month.step = parseInt(step)
    info.cronConfig.month.value = month
    info.cronConfig.month.selectedValues = []
    info.cronConfig.month.range = { start: 1, end: 12 }
  } else if (month.includes(',')) {
    info.cronConfig.month.type = 'specific'
    const values = month.split(',').map(v => parseInt(v))
    info.cronConfig.month.selectedValues = values
    info.cronConfig.month.value = month
    info.cronConfig.month.range = { start: 1, end: 12 }
  } else if (month.includes('-')) {
    info.cronConfig.month.type = 'range'
    const [start, end] = month.split('-').map(v => parseInt(v))
    info.cronConfig.month.range = { start, end }
    info.cronConfig.month.value = month
    info.cronConfig.month.selectedValues = []
  } else {
    info.cronConfig.month.type = 'specific'
    info.cronConfig.month.selectedValues = [parseInt(month)]
    info.cronConfig.month.value = month
    info.cronConfig.month.range = { start: 1, end: 12 }
  }
  
  // 解析周
  if (weekday === '?') {
    info.cronConfig.week.type = 'every'
    info.cronConfig.week.value = '?'
    info.cronConfig.week.selectedValues = []
    info.cronConfig.week.range = { start: 1, end: 7 }
  } else if (weekday === '*') {
    info.cronConfig.week.type = 'every'
    info.cronConfig.week.value = '*'
    info.cronConfig.week.selectedValues = []
    info.cronConfig.week.range = { start: 1, end: 7 }
  } else if (weekday.includes(',')) {
    info.cronConfig.week.type = 'specific'
    const values = weekday.split(',').map(v => parseInt(v))
    info.cronConfig.week.selectedValues = values
    info.cronConfig.week.value = weekday
    info.cronConfig.week.range = { start: 1, end: 7 }
  } else if (weekday.includes('-')) {
    info.cronConfig.week.type = 'range'
    const [start, end] = weekday.split('-').map(v => parseInt(v))
    info.cronConfig.week.range = { start, end }
    info.cronConfig.week.value = weekday
    info.cronConfig.week.selectedValues = []
  } else {
    info.cronConfig.week.type = 'specific'
    info.cronConfig.week.selectedValues = [parseInt(weekday)]
    info.cronConfig.week.value = weekday
    info.cronConfig.week.range = { start: 1, end: 7 }
  }
}

// 初始化
generateCron()
</script>

<template>

    <div class="flex flex-col mt-3 flex-1">
      <DetailHeader :title="info.title"></DetailHeader>
  
      <!-- 自定义配置区，使用Tab切换 -->
      <div class="p-4 rounded-2xl bg-white mb-6">
        <el-text class="font-bold text-lg mb-3 block">自定义配置：</el-text>
        
        <!-- 桌面端显示完整tabs -->
        <div class="hidden md:block">
          <el-tabs 
            v-model="info.selectedType" 
            type="card"
            class="custom-tabs"
          >
            <el-tab-pane label="秒" name="second">
              <el-radio-group v-model="info.cronConfig.second.type" @change="(val) => updateConfig('second', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每秒</el-radio>
                <el-radio value="specific">指定秒</el-radio>
                <el-radio value="step">间隔秒</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定秒配置 -->
              <div v-if="info.cronConfig.second.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择秒数（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.second.selectedValues"
                  @change="handleMultiSelectChange('second', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 60" 
                    :key="i - 1" 
                    :label="i - 1"
                    class="w-16"
                  >
                    {{ i - 1 }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔秒配置 -->
              <div v-if="info.cronConfig.second.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.second.step" 
                  :min="1" 
                  :max="59"
                  @change="updateConfig('second', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">秒执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.second.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.second.range.start" 
                      :min="0" 
                      :max="59"
                      @change="handleRangeStartChange('second')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.second.range.end" 
                      :min="0" 
                      :max="59"
                      @change="handleRangeEndChange('second')"
                    />
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="分" name="minute">
              <el-radio-group v-model="info.cronConfig.minute.type" @change="(val) => updateConfig('minute', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每分</el-radio>
                <el-radio value="specific">指定分</el-radio>
                <el-radio value="step">间隔分</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定分配置 -->
              <div v-if="info.cronConfig.minute.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择分钟（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.minute.selectedValues"
                  @change="handleMultiSelectChange('minute', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 60" 
                    :key="i - 1" 
                    :label="i - 1"
                    class="w-16"
                  >
                    {{ i - 1 }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔分配置 -->
              <div v-if="info.cronConfig.minute.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.minute.step" 
                  :min="1" 
                  :max="59"
                  @change="updateConfig('minute', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">分执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.minute.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.minute.range.start" 
                      :min="0" 
                      :max="59"
                      @change="handleRangeStartChange('minute')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.minute.range.end" 
                      :min="0" 
                      :max="59"
                      @change="handleRangeEndChange('minute')"
                    />
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="时" name="hour">
              <el-radio-group v-model="info.cronConfig.hour.type" @change="(val) => updateConfig('hour', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每时</el-radio>
                <el-radio value="specific">指定时</el-radio>
                <el-radio value="step">间隔时</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定时配置 -->
              <div v-if="info.cronConfig.hour.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择小时（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.hour.selectedValues"
                  @change="handleMultiSelectChange('hour', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 24" 
                    :key="i - 1" 
                    :label="i - 1"
                    class="w-16"
                  >
                    {{ i - 1 }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔时配置 -->
              <div v-if="info.cronConfig.hour.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.hour.step" 
                  :min="1" 
                  :max="23"
                  @change="updateConfig('hour', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">时执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.hour.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.hour.range.start" 
                      :min="0" 
                      :max="23"
                      @change="handleRangeStartChange('hour')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.hour.range.end" 
                      :min="0" 
                      :max="23"
                      @change="handleRangeEndChange('hour')"
                    />
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="日" name="day">
              <el-radio-group v-model="info.cronConfig.day.type" @change="(val) => updateConfig('day', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每日</el-radio>
                <el-radio value="specific">指定日</el-radio>
                <el-radio value="step">间隔日</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定日配置 -->
              <div v-if="info.cronConfig.day.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择日期（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.day.selectedValues"
                  @change="handleMultiSelectChange('day', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 31" 
                    :key="i" 
                    :label="i"
                    class="w-16"
                  >
                    {{ i }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔日配置 -->
              <div v-if="info.cronConfig.day.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.day.step" 
                  :min="1" 
                  :max="31"
                  @change="updateConfig('day', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">日执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.day.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.day.range.start" 
                      :min="1" 
                      :max="31"
                      @change="handleRangeStartChange('day')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.day.range.end" 
                      :min="1" 
                      :max="31"
                      @change="handleRangeEndChange('day')"
                    />
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="月" name="month">
              <el-radio-group v-model="info.cronConfig.month.type" @change="(val) => updateConfig('month', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每月</el-radio>
                <el-radio value="specific">指定月</el-radio>
                <el-radio value="step">间隔月</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定月配置 -->
              <div v-if="info.cronConfig.month.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择月份（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.month.selectedValues"
                  @change="handleMultiSelectChange('month', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 12" 
                    :key="i" 
                    :label="i"
                    class="w-16"
                  >
                    {{ i }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔月配置 -->
              <div v-if="info.cronConfig.month.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.month.step" 
                  :min="1" 
                  :max="12"
                  @change="updateConfig('month', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">月执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.month.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.month.range.start" 
                      :min="1" 
                      :max="12"
                      @change="handleRangeStartChange('month')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.month.range.end" 
                      :min="1" 
                      :max="12"
                      @change="handleRangeEndChange('month')"
                    />
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="周" name="week">
              <el-radio-group v-model="info.cronConfig.week.type" @change="(val) => updateConfig('week', typeof val === 'string' ? val : 'every', '?')">
                <el-radio value="every">不指定</el-radio>
                <el-radio value="specific">指定星期</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定星期配置 -->
              <div v-if="info.cronConfig.week.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择星期（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.week.selectedValues"
                  @change="handleMultiSelectChange('week', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox label="SUN">周日</el-checkbox>
                  <el-checkbox label="MON">周一</el-checkbox>
                  <el-checkbox label="TUE">周二</el-checkbox>
                  <el-checkbox label="WED">周三</el-checkbox>
                  <el-checkbox label="THU">周四</el-checkbox>
                  <el-checkbox label="FRI">周五</el-checkbox>
                  <el-checkbox label="SAT">周六</el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.week.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.week.range.start" 
                      :min="1" 
                      :max="7"
                      @change="handleRangeStartChange('week')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.week.range.end" 
                      :min="1" 
                      :max="7"
                      @change="handleRangeEndChange('week')"
                    />
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        
        <!-- 手机端显示滑动tabs -->
        <div class="block md:hidden">
          <div class="flex justify-between items-center mb-3">
            <el-button 
              :disabled="currentTabIndex === 0"
              @click="currentTabIndex--"
              size="small"
            >
              上一页
            </el-button>
            <el-text class="text-sm">{{ currentTabIndex + 1 }} / {{ tabList.length }}</el-text>
            <el-button 
              :disabled="currentTabIndex === tabList.length - 1"
              @click="currentTabIndex++"
              size="small"
            >
              下一页
            </el-button>
          </div>
          
          <el-tabs v-model="info.selectedType" type="card">
            <el-tab-pane 
              v-for="tab in tabList"
              :key="tab.name"
              :label="tab.label" 
              :name="tab.name"
            >
              <div v-if="tab.name === 'second'">
                <el-radio-group v-model="info.cronConfig.second.type" @change="(val) => updateConfig('second', typeof val === 'string' ? val : 'every', '*')">
                  <el-radio value="every">每秒</el-radio>
                  <el-radio value="specific">指定秒</el-radio>
                  <el-radio value="step">间隔秒</el-radio>
                  <el-radio value="range">间隔范围</el-radio>
                </el-radio-group>
                
                <!-- 指定秒配置 -->
                <div v-if="info.cronConfig.second.type === 'specific'" class="mt-3">
                  <el-text class="text-sm text-gray-600 mb-2 block">选择秒数（可多选）：</el-text>
                  <el-checkbox-group 
                    v-model="info.cronConfig.second.selectedValues"
                    @change="handleMultiSelectChange('second', $event)"
                    class="flex flex-wrap gap-2"
                  >
                    <el-checkbox 
                      v-for="i in 60" 
                      :key="i - 1" 
                      :label="i - 1"
                      class="w-16"
                    >
                      {{ i - 1 }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
                
                <!-- 间隔秒配置 -->
                <div v-if="info.cronConfig.second.type === 'step'" class="mt-3">
                  <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                  <el-input-number 
                    v-model="info.cronConfig.second.step" 
                    :min="1" 
                    :max="59"
                    @change="updateConfig('second', 'step', '*')"
                  />
                  <el-text class="text-sm text-gray-600">秒执行</el-text>
                </div>
                
                <!-- 间隔范围配置 -->
                <div v-if="info.cronConfig.second.type === 'range'" class="mt-3">
                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                      <el-text>从</el-text>
                      <el-input-number 
                        v-model="info.cronConfig.second.range.start" 
                        :min="0" 
                        :max="59"
                        @change="handleRangeStartChange('second')"
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <el-text>到</el-text>
                      <el-input-number 
                        v-model="info.cronConfig.second.range.end" 
                        :min="0" 
                        :max="59"
                        @change="handleRangeEndChange('second')"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else-if="tab.name === 'minute'">
                <el-radio-group v-model="info.cronConfig.minute.type" @change="(val) => updateConfig('minute', typeof val === 'string' ? val : 'every', '*')">
                  <el-radio value="every">每分</el-radio>
                  <el-radio value="specific">指定分</el-radio>
                  <el-radio value="step">间隔分</el-radio>
                  <el-radio value="range">间隔范围</el-radio>
                </el-radio-group>
                
                <!-- 指定分配置 -->
                <div v-if="info.cronConfig.minute.type === 'specific'" class="mt-3">
                  <el-text class="text-sm text-gray-600 mb-2 block">选择分钟（可多选）：</el-text>
                  <el-checkbox-group 
                    v-model="info.cronConfig.minute.selectedValues"
                    @change="handleMultiSelectChange('minute', $event)"
                    class="flex flex-wrap gap-2"
                  >
                    <el-checkbox 
                      v-for="i in 60" 
                      :key="i - 1" 
                      :label="i - 1"
                      class="w-16"
                    >
                      {{ i - 1 }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
                
                <!-- 间隔分配置 -->
                <div v-if="info.cronConfig.minute.type === 'step'" class="mt-3">
                  <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                  <el-input-number 
                    v-model="info.cronConfig.minute.step"                   :min="1" 
                  :max="59"
                  @change="updateConfig('minute', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">分执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.minute.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.minute.range.start" 
                      :min="0" 
                      :max="59"
                      @change="handleRangeStartChange('minute')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.minute.range.end" 
                      :min="0" 
                      :max="59"
                      @change="handleRangeEndChange('minute')"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else-if="tab.name === 'hour'">
              <el-radio-group v-model="info.cronConfig.hour.type" @change="(val) => updateConfig('hour', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每时</el-radio>
                <el-radio value="specific">指定时</el-radio>
                <el-radio value="step">间隔时</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定时配置 -->
              <div v-if="info.cronConfig.hour.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择小时（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.hour.selectedValues"
                  @change="handleMultiSelectChange('hour', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 24" 
                    :key="i - 1" 
                    :label="i - 1"
                    class="w-16"
                  >
                    {{ i - 1 }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔时配置 -->
              <div v-if="info.cronConfig.hour.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.hour.step" 
                  :min="1" 
                  :max="23"
                  @change="updateConfig('hour', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">时执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.hour.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.hour.range.start" 
                      :min="0" 
                      :max="23"
                      @change="handleRangeStartChange('hour')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.hour.range.end" 
                      :min="0" 
                      :max="23"
                      @change="handleRangeEndChange('hour')"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else-if="tab.name === 'day'">
              <el-radio-group v-model="info.cronConfig.day.type" @change="(val) => updateConfig('day', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每日</el-radio>
                <el-radio value="specific">指定日</el-radio>
                <el-radio value="step">间隔日</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定日配置 -->
              <div v-if="info.cronConfig.day.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择日期（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.day.selectedValues"
                  @change="handleMultiSelectChange('day', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 31" 
                    :key="i" 
                    :label="i"
                    class="w-16"
                  >
                    {{ i }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔日配置 -->
              <div v-if="info.cronConfig.day.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.day.step" 
                  :min="1" 
                  :max="31"
                  @change="updateConfig('day', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">日执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.day.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.day.range.start" 
                      :min="1" 
                      :max="31"
                      @change="handleRangeStartChange('day')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.day.range.end" 
                      :min="1" 
                      :max="31"
                      @change="handleRangeEndChange('day')"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else-if="tab.name === 'month'">
              <el-radio-group v-model="info.cronConfig.month.type" @change="(val) => updateConfig('month', typeof val === 'string' ? val : 'every', '*')">
                <el-radio value="every">每月</el-radio>
                <el-radio value="specific">指定月</el-radio>
                <el-radio value="step">间隔月</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定月配置 -->
              <div v-if="info.cronConfig.month.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择月份（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.month.selectedValues"
                  @change="handleMultiSelectChange('month', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox 
                    v-for="i in 12" 
                    :key="i" 
                    :label="i"
                    class="w-16"
                  >
                    {{ i }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔月配置 -->
              <div v-if="info.cronConfig.month.type === 'step'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">每</el-text>
                <el-input-number 
                  v-model="info.cronConfig.month.step" 
                  :min="1" 
                  :max="12"
                  @change="updateConfig('month', 'step', '*')"
                />
                <el-text class="text-sm text-gray-600">月执行</el-text>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.month.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.month.range.start" 
                      :min="1" 
                      :max="12"
                      @change="handleRangeStartChange('month')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.month.range.end" 
                      :min="1" 
                      :max="12"
                      @change="handleRangeEndChange('month')"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else-if="tab.name === 'week'">
              <el-radio-group v-model="info.cronConfig.week.type" @change="(val) => updateConfig('week', typeof val === 'string' ? val : 'every', '?')">
                <el-radio value="every">不指定</el-radio>
                <el-radio value="specific">指定星期</el-radio>
                <el-radio value="range">间隔范围</el-radio>
              </el-radio-group>
              
              <!-- 指定星期配置 -->
              <div v-if="info.cronConfig.week.type === 'specific'" class="mt-3">
                <el-text class="text-sm text-gray-600 mb-2 block">选择星期（可多选）：</el-text>
                <el-checkbox-group 
                  v-model="info.cronConfig.week.selectedValues"
                  @change="handleMultiSelectChange('week', $event)"
                  class="flex flex-wrap gap-2"
                >
                  <el-checkbox label="SUN">周日</el-checkbox>
                  <el-checkbox label="MON">周一</el-checkbox>
                  <el-checkbox label="TUE">周二</el-checkbox>
                  <el-checkbox label="WED">周三</el-checkbox>
                  <el-checkbox label="THU">周四</el-checkbox>
                  <el-checkbox label="FRI">周五</el-checkbox>
                  <el-checkbox label="SAT">周六</el-checkbox>
                </el-checkbox-group>
              </div>
              
              <!-- 间隔范围配置 -->
              <div v-if="info.cronConfig.week.type === 'range'" class="mt-3">
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2">
                    <el-text>从</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.week.range.start" 
                      :min="1" 
                      :max="7"
                      @change="handleRangeStartChange('week')"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <el-text>到</el-text>
                    <el-input-number 
                      v-model="info.cronConfig.week.range.end" 
                      :min="1" 
                      :max="7"
                      @change="handleRangeEndChange('week')"
                    />
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- 结果区域 -->
    <div class="p-4 rounded-2xl bg-white mb-6">
      <el-text class="font-bold text-lg mb-3 block">生成的Cron表达式：</el-text>
      <div class="flex items-center gap-3 mb-3">
        <el-input 
          v-model="info.cronExpression" 
          class="flex-1"
          placeholder="Cron表达式将在这里显示"
          @input="onCronInput"
        />
        <el-button type="primary" @click="copyResult">复制</el-button>
      </div>
      
      <!-- 执行次数配置 -->
      <div class="flex items-center gap-3 mb-3">
        <el-text>显示最近</el-text>
        <el-input-number 
          v-model="info.executionCount" 
          :min="1" 
          :max="200"
          @change="calculateNextExecutions"
        />
        <el-text>次执行时间（最大200次）</el-text>
      </div>
      
      <el-text class="text-sm text-gray-600 mb-3 block">{{ info.cronDescription }}</el-text>
      
      <div v-if="info.nextExecutions.length > 0">
        <el-text class="font-bold text-lg mb-3 block">最近{{ info.executionCount }}次执行时间：</el-text>
        <div class="space-y-2">
          <div 
            v-for="(execution, index) in info.nextExecutions" 
            :key="index"
            class="p-2 bg-gray-50 rounded"
          >
            {{ index + 1 }}. {{ execution }}
          </div>
        </div>
      </div>
    </div>

    <!-- 预设示例 -->
    <div class="mb-6">
      <el-text class="font-bold text-lg mb-3 block">常用示例：</el-text>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <el-card 
          v-for="(example, index) in info.presetExamples" 
          :key="index"
          class="cursor-pointer hover:shadow-lg transition-shadow"
          @click="usePreset(example.cron)"
        >
          <template #header>
            <div class="flex justify-between items-center">
              <span class="font-bold">{{ example.name }}</span>
            </div>
          </template>
          <div class="text-sm text-gray-600 mb-2">{{ example.desc }}</div>
          <div class="text-xs text-gray-500 font-mono">{{ example.cron }}</div>
        </el-card>
      </div>
    </div>

    <!-- 使用文档 -->
    <div class="mb-6">
      <el-text class="font-bold text-lg mb-3 block">使用说明：</el-text>
      <div class="space-y-4 text-sm text-gray-700">
        <div>
          <h4 class="font-bold mb-2">Cron表达式格式：</h4>
          <p class="mb-2">秒 分 时 日 月 周</p>
          <p class="text-xs text-gray-500">例如：0 0 12 * * ? 表示每天中午12点执行</p>
        </div>
        
        <div>
          <h4 class="font-bold mb-2">特殊字符说明：</h4>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li><code>*</code>：表示每个时间单位都执行</li>
            <li><code>?</code>：表示不指定该时间单位（仅用于日或周）</li>
            <li><code>/</code>：表示间隔执行，如 */5 表示每5个单位执行一次</li>
            <li><code>-</code>：表示范围，如 1-5 表示1到5之间执行</li>
            <li><code>,</code>：表示多个值，如 1,3,5 表示在1、3、5时执行</li>
          </ul>
        </div>
        
        <div>
          <h4 class="font-bold mb-2">常用示例：</h4>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li><code>0 0 0 * * ?</code>：每天凌晨0点执行</li>
            <li><code>0 0 12 * * ?</code>：每天中午12点执行</li>
            <li><code>0 0 0 ? * MON</code>：每周一凌晨0点执行</li>
            <li><code>0 0 0 1 * ?</code>：每月1号凌晨0点执行</li>
            <li><code>0 */30 * * * ?</code>：每30分钟执行一次</li>
            <li><code>0 0 */2 * * ?</code>：每2小时执行一次</li>
          </ul>
        </div>
        
        <div>
          <h4 class="font-bold mb-2">注意事项：</h4>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li>日和周不能同时指定，其中一个必须使用 ?</li>
            <li>月份范围是1-12，日期范围是1-31</li>
            <li>小时范围是0-23，分钟和秒范围是0-59</li>
            <li>周的范围是1-7（1=周日，7=周六）</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        Cron表达式生成器是一个在线工具，用于生成和解析Cron表达式。Cron表达式是一种用于定义定时任务执行时间的字符串格式，广泛应用于系统调度、定时任务等场景。本工具提供了直观的界面来配置秒、分、时、日、月、周等时间单位，支持常用预设模板，并实时生成对应的Cron表达式和中文描述。
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
.custom-tabs :deep(.el-tabs__item) {
  border: none;
  background: transparent;
}

.custom-tabs :deep(.el-tabs__item.is-active) {
  border: 1px solid #409eff;
  background: #f0f9ff;
}

.custom-tabs :deep(.el-tabs__content) {
  overflow-y: visible;
}
</style>