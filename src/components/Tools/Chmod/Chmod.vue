<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

interface PermGroup {
  read: boolean
  write: boolean
  execute: boolean
}

interface SpecialBits {
  setuid: boolean
  setgid: boolean
  sticky: boolean
}

const groups = reactive<PermGroup[]>([
  { read: true, write: true, execute: true },
  { read: true, write: false, execute: true },
  { read: true, write: false, execute: true },
])

const special = reactive<SpecialBits>({
  setuid: false,
  setgid: false,
  sticky: false,
})

const octalInput = ref('755')
const syncing = ref(false)

const groupNames = ['所有者 (Owner)', '所属组 (Group)', '其他人 (Others)']
const bits = [
  { key: 'read' as const, label: '读 r', bit: 4 },
  { key: 'write' as const, label: '写 w', bit: 2 },
  { key: 'execute' as const, label: '执行 x', bit: 1 },
]

const groupOctals = computed(() =>
  groups.map(group => (group.read ? 4 : 0) + (group.write ? 2 : 0) + (group.execute ? 1 : 0)),
)

const specialOctal = computed(
  () => (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0),
)

const octal = computed(() => groupOctals.value.join(''))

const fullOctal = computed(() =>
  specialOctal.value === 0 ? octal.value : `${specialOctal.value}${octal.value}`,
)

const symbolic = computed(() => {
  const render = (group: PermGroup, index: number) => {
    let str = `${group.read ? 'r' : '-'}${group.write ? 'w' : '-'}${group.execute ? 'x' : '-'}`
    if (index === 0 && special.setuid) str = str.replace('x', str[2] === 'x' ? 's' : 'S')
    if (index === 1 && special.setgid) str = str.replace('x', str[2] === 'x' ? 's' : 'S')
    if (index === 2 && special.sticky) str = str.replace('x', str[2] === 'x' ? 't' : 'T')
    return str
  }
  return groups.map(render).join('')
})

const description = computed(() => {
  const name = (group: PermGroup) => {
    const perms = `${group.read ? '读' : ''}${group.write ? '写' : ''}${group.execute ? '执行' : ''}`
    return perms || '无权限'
  }
  return `所有者${name(groups[0])}，所属组${name(groups[1])}，其他人${name(groups[2])}${
    special.setuid ? '；setuid（以文件所有者身份执行）' : ''
  }${special.setgid ? '；setgid（以文件所属组身份执行）' : ''}${
    special.sticky ? '；粘滞位（仅所有者可删除）' : ''
  }`
})

const presets: { octal: string; label: string; desc: string; value?: string }[] = [
  { octal: '777', label: '777 所有人完全控制', desc: '所有人可读/写/执行，风险极高' },
  { octal: '755', label: '755 目录/脚本常用', desc: '所有者全权限，其他人只读和执行' },
  { octal: '644', label: '644 普通文件', desc: '所有者可读写，其他人只读' },
  { octal: '700', label: '700 私有目录', desc: '仅所有者可访问' },
  { octal: '600', label: '600 私密文件', desc: '仅所有者可读写，如密钥文件' },
  { octal: '666', label: '666 所有人可读写', desc: '所有人可读写，不可执行' },
  { octal: '444', label: '444 只读文件', desc: '所有人只读' },
  { octal: '000', label: '000 完全锁定', desc: '任何人无任何权限' },
]

const applyPreset = (preset: { value?: string; octal: string }) => {
  octalInput.value = preset.value ?? preset.octal
  syncFromOctal()
}

const syncFromOctal = () => {
  const raw = octalInput.value.trim()
  if (!/^[0-7]{3,4}$/.test(raw)) return
  syncing.value = true
  const padded = raw.padStart(4, '0')
  const digits = padded.split('').map(Number)
  special.setuid = digits[0] >= 4
  special.setgid = digits[0] % 4 >= 2
  special.sticky = digits[0] % 2 === 1
  digits.slice(1).forEach((digit, index) => {
    groups[index].read = digit >= 4
    groups[index].write = digit % 4 >= 2
    groups[index].execute = digit % 2 === 1
  })
  syncing.value = false
}

watch(groups, () => {
  if (!syncing.value) octalInput.value = octal.value
}, { deep: true })

watch(special, () => {
  if (!syncing.value) octalInput.value = fullOctal.value
}, { deep: true })

watch(octalInput, () => {
  if (!syncing.value) syncFromOctal()
})

const copyResult = async (value: string, tip: string) => {
  if (!value) return
  await copy(value)
  ElMessage.success(tip)
}
</script>

<template>
  <div class="chmod-page flex flex-col mt-3 flex-1">
    <DetailHeader title="Chmod权限计算器" />

    <section class="chmod-workspace">
      <div class="perm-grid">
        <div
          v-for="(groupName, groupIndex) in groupNames"
          :key="groupName"
          class="perm-group"
        >
          <h4>{{ groupName }}</h4>
          <el-checkbox
            v-for="item in bits"
            :key="item.key"
            v-model="groups[groupIndex][item.key]"
            :label="`${item.label}（${item.bit}）`"
          />
        </div>
        <div class="perm-group">
          <h4>特殊权限（可选）</h4>
          <el-checkbox v-model="special.setuid" label="setuid（4）" />
          <el-checkbox v-model="special.setgid" label="setgid（2）" />
          <el-checkbox v-model="special.sticky" label="粘滞位（1）" />
        </div>
      </div>

      <div class="result-row">
        <div class="result-field">
          <label>数字表示（8进制）</label>
          <div class="result-value">
            <el-input v-model="octalInput" maxlength="4" placeholder="如 755">
              <template #append>
                <el-button @click="copyResult(octalInput, '八进制权限已复制')">复制</el-button>
              </template>
            </el-input>
          </div>
        </div>
        <div class="result-field">
          <label>符号表示</label>
          <div class="result-value">
            <span class="symbolic">{{ symbolic }}</span>
            <el-button text type="primary" @click="copyResult(symbolic, '符号权限已复制')">复制</el-button>
          </div>
        </div>
        <div class="result-field">
          <label>对应命令</label>
          <div class="result-value">
            <code class="command">chmod {{ octalInput }} file</code>
            <el-button text type="primary" @click="copyResult(`chmod ${octalInput} file`, '命令已复制')">复制</el-button>
          </div>
        </div>
      </div>

      <p class="chmod-desc">{{ description }}</p>

      <div class="preset-heading">常用权限</div>
      <div class="preset-grid">
        <div
          v-for="preset in presets"
          :key="preset.label"
          class="preset-item"
          :class="{ active: octalInput === (preset.value ?? preset.octal) }"
          @click="applyPreset(preset)"
        >
          <strong>{{ preset.label }}</strong>
          <span>{{ preset.desc }}</span>
        </div>
      </div>
    </section>

    <ToolDetail title="说明">
      <div class="chmod-description">
        <p>通过勾选「读 / 写 / 执行」计算 Linux 文件权限，或直接输入八进制数字（如 <code>755</code>）反向查看权限含义，勾选与数字双向实时同步。</p>
        <p class="mt-2">每组权限按 <code>r=4、w=2、x=1</code> 求和得到一位八进制数字，三组拼接即为 <code>755</code> 这类常见写法；特殊权限作为第四位放在最前面（如 <code>4755</code>）。</p>
        <p class="mt-2">符号表示中，特殊权限占用执行位：<code>s/S</code> 代表 setuid/setgid，<code>t/T</code> 代表粘滞位，大写表示对应组没有执行权限。</p>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.chmod-workspace {
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.perm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.perm-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.perm-group h4 {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.perm-group :deep(.el-checkbox) {
  margin-right: 0;
}

.result-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.result-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.result-value {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.symbolic {
  font-family: monospace;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 2px;
}

.result-value code.command {
  padding: 6px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
  word-break: break-all;
}

.chmod-desc {
  margin: 14px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.preset-heading {
  margin: 18px 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}

.preset-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.preset-item:hover,
.preset-item.active {
  border-color: var(--el-color-primary);
}

.preset-item.active {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.preset-item strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.preset-item span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chmod-description {
  line-height: 1.8;
}

.chmod-description code {
  padding: 0 4px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

@media (max-width: 760px) {
  .chmod-workspace {
    padding: 14px;
  }
}
</style>
