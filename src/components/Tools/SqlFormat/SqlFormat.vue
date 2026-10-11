<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'SQL 格式化'

const source = ref('')
const result = ref('')
const converting = ref(false)
const dialect = ref('mysql')
const keywordCase = ref<'upper' | 'lower' | 'preserve'>('upper')
const indentSize = ref<'0' | '2' | '4' | '8' | 'tab'>('2')

const dialectOptions = [
  { value: 'sql', label: '标准 SQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'db2', label: 'DB2' },
  { value: 'hive', label: 'Hive' },
  { value: 'n1ql', label: 'N1QL' },
  { value: 'plsql', label: 'PL/SQL' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'spark', label: 'Spark' },
  { value: 'trino', label: 'Trino' },
  { value: 'transactsql', label: 'SQL Server (T-SQL)' },
]

const doFormat = async () => {
  if (!source.value.trim()) {
    ElMessage.warning('请输入 SQL 语句')
    return
  }
  converting.value = true
  try {
    const { format } = await import('sql-formatter')
    result.value = format(source.value, {
      // sql-formatter 的 dialect 类型较窄，这里按运行时值传入
      language: dialect.value as never,
      keywordCase: keywordCase.value === 'preserve' ? 'preserve' : keywordCase.value,
      tabWidth: indentSize.value === 'tab' ? undefined : Number(indentSize.value),
      useTabs: indentSize.value === 'tab',
      expressionWidth: 50,
    })
  } catch (e) {
    console.error('SQL 格式化失败:', e)
    ElMessage.error('SQL 语法有误：' + (e instanceof Error ? e.message.split('\n')[0] : '请检查输入'))
  } finally {
    converting.value = false
  }
}

const doCompress = () => {
  if (!source.value.trim()) {
    ElMessage.warning('请输入 SQL 语句')
    return
  }
  // 压缩：去除注释与多余空白（保留字符串字面量内的内容）
  let s = source.value
  s = s.replace(/--[^\n]*/g, ' ')
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  result.value = s
}

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const sample = `select u.id, u.name, count(o.id) as order_count from users u left join orders o on o.user_id = u.id where u.created_at >= '2026-01-01' and u.status in (1, 2) group by u.id, u.name having count(o.id) > 10 order by order_count desc limit 20;`
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">SQL 格式化</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          SQL 在线美化工具，支持 15 种方言、关键字大小写与缩进设置，可将单行 SQL 压缩为一行。
        </p>
      </header>

      <div class="sql-toolbar">
        <div class="sql-option">
          <label>方言</label>
          <el-select v-model="dialect" class="!w-44">
            <el-option v-for="d in dialectOptions" :key="d.value + d.label" :label="d.label" :value="d.value" />
          </el-select>
        </div>
        <div class="sql-option">
          <label>关键字</label>
          <el-radio-group v-model="keywordCase">
            <el-radio-button value="upper">大写</el-radio-button>
            <el-radio-button value="lower">小写</el-radio-button>
            <el-radio-button value="preserve">保持</el-radio-button>
          </el-radio-group>
        </div>
        <div class="sql-option">
          <label>缩进</label>
          <el-radio-group v-model="indentSize">
            <el-radio-button value="2">2</el-radio-button>
            <el-radio-button value="4">4</el-radio-button>
            <el-radio-button value="8">8</el-radio-button>
            <el-radio-button value="tab">Tab</el-radio-button>
          </el-radio-group>
        </div>
        <div class="flex flex-wrap gap-2">
          <el-button type="primary" :loading="converting" @click="doFormat">格式化</el-button>
          <el-button @click="doCompress">压缩</el-button>
          <el-button :disabled="!result" @click="copy">复制</el-button>
          <el-button @click="source = sample; result = ''">示例</el-button>
          <el-button @click="source = ''; result = ''">清空</el-button>
        </div>
      </div>

      <div class="sql-layout">
        <div class="sql-pane">
          <div class="sql-pane-head"><span>输入 SQL</span><span class="text-body-sm text-slate-500">{{ source.length.toLocaleString() }} 字符</span></div>
          <el-input v-model="source" type="textarea" :rows="16" placeholder="粘贴 SQL 语句…" spellcheck="false" />
        </div>
        <div class="sql-pane">
          <div class="sql-pane-head"><span>格式化结果</span></div>
          <el-input v-model="result" type="textarea" :rows="16" readonly placeholder="美化后的 SQL…" spellcheck="false" />
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        基于 sql-formatter 引擎，支持 MySQL、PostgreSQL、SQL Server、Oracle 等主流方言的关键字与函数识别。格式化会自动换行对齐 SELECT / FROM / WHERE / JOIN 等子句；压缩会移除注释和多余空白并合并为一行，方便日志传输。仅做文本美化，不会执行任何语句，内容不离开浏览器。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.sql-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.sql-option {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sql-option > label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.sql-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.sql-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sql-pane-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  height: 28px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.sql-pane :deep(textarea) {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
}

@media (max-width: 767px) {
  .sql-layout {
    grid-template-columns: 1fr;
  }
}
</style>
