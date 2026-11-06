<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const ipText = ref('192.168.1.100')
const maskText = ref('255.255.255.0')
const prefix = ref(24)

const prefixPresets = [8, 16, 20, 22, 24, 25, 26, 27, 28, 30]

// 点分十进制转 32 位无符号整数，非法返回 null
const parseIp = (raw: string) => {
  const parts = raw.trim().split('.')
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return null
  let value = 0
  for (const part of parts) {
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value
}

// 掩码文本（CIDR 数字或点分掩码）转前缀长度；非连续 1 的掩码返回 null
const maskFromText = (raw: string) => {
  const text = raw.trim().replace(/^\//, '')
  if (/^\d{1,2}$/.test(text)) {
    const n = Number(text)
    return n <= 32 ? n : null
  }
  const mask = parseIp(text)
  if (mask === null) return null
  let count = 0
  let bit = 31
  while (bit >= 0 && ((mask >>> bit) & 1) === 1) {
    count++
    bit--
  }
  const rest = bit >= 0 ? mask & (2 ** (bit + 1) - 1) : 0
  return rest === 0 ? count : null
}

const maskFromPrefix = (p: number) =>
  p <= 0 ? 0 : p >= 32 ? 0xFFFFFFFF : (0xFFFFFFFF << (32 - p)) >>> 0

const numToIp = (value: number) =>
  [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.')

const numToBinary = (value: number) =>
  [24, 16, 8, 0]
    .map(shift => ((value >>> shift) & 255).toString(2).padStart(8, '0'))
    .join('.')

// 手输掩码 → 同步前缀；纯数字输入视为输入中，不回写成点分形式，避免打断输入
watch(maskText, (value) => {
  const p = maskFromText(value)
  if (p === null || p === prefix.value) return
  const digitsOnly = /^\d{1,2}$/.test(value.trim().replace(/^\//, ''))
  prefix.value = p
  if (!digitsOnly) maskText.value = numToIp(maskFromPrefix(p))
})

// 滑杆/预设改前缀 → 掩码框同步为点分形式
watch(prefix, (p) => {
  maskText.value = numToIp(maskFromPrefix(p))
})

const parsedIp = computed(() => parseIp(ipText.value))
const parsedPrefix = computed(() => maskFromText(maskText.value))

const error = computed(() => {
  if (parsedIp.value === null) return 'IP 地址格式不正确，应为点分十进制，如 192.168.1.100'
  if (parsedPrefix.value === null) {
    return '子网掩码不正确：支持 CIDR（如 /24）或连续 1 的点分掩码（如 255.255.255.0）'
  }
  return ''
})

const classify = (ip: number) => {
  const o1 = (ip >>> 24) & 255
  const o2 = (ip >>> 16) & 255
  const tags: string[] = []
  if (o1 === 0) tags.push('保留 0.0.0.0/8')
  else if (o1 === 10) tags.push('A 类 · 私网 10.0.0.0/8')
  else if (o1 === 127) tags.push('A 类 · 环回 127.0.0.0/8')
  else if (o1 === 169 && o2 === 254) tags.push('B 类 · 链路本地 169.254.0.0/16')
  else if (o1 === 172 && o2 >= 16 && o2 <= 31) tags.push('B 类 · 私网 172.16.0.0/12')
  else if (o1 === 192 && o2 === 168) tags.push('C 类 · 私网 192.168.0.0/16')
  else if (o1 === 100 && o2 >= 64 && o2 <= 127) tags.push('A 类 · CGNAT 100.64.0.0/10')
  else if (o1 < 128) tags.push('A 类 · 公网')
  else if (o1 < 192) tags.push('B 类 · 公网')
  else if (o1 < 224) tags.push('C 类 · 公网')
  else if (o1 < 240) tags.push('D 类 · 组播')
  else tags.push('E 类 · 保留')
  return tags
}

const formatCount = (n: number) => n.toLocaleString('en-US')

const info = computed(() => {
  if (error.value) return null
  const ip = parsedIp.value!
  const p = parsedPrefix.value!
  const mask = maskFromPrefix(p)
  const network = (ip & mask) >>> 0
  const broadcast = (network | (~mask >>> 0)) >>> 0
  const hostBits = 32 - p
  const total = 2 ** hostBits
  // /32 视为单主机路由，/31 按 RFC 3021 点对点两个地址均可用
  const usable = hostBits === 0 ? 1 : hostBits === 1 ? 2 : total - 2
  const firstIp = hostBits <= 1 ? network : network + 1
  const lastIp = hostBits === 0 ? network : hostBits === 1 ? broadcast : broadcast - 1
  const usableNote = hostBits === 0 ? '（单个主机）' : hostBits === 1 ? '（RFC 3021 点对点）' : ''

  const items = [
    { key: 'mask', label: '子网掩码', value: `${numToIp(mask)}（/${p}）` },
    { key: 'wildcard', label: '反掩码（通配符）', value: numToIp(~mask >>> 0) },
    { key: 'network', label: '网络地址', value: numToIp(network) },
    { key: 'broadcast', label: '广播地址', value: numToIp(broadcast) },
    { key: 'range', label: '可用主机范围', value: `${numToIp(firstIp)} ~ ${numToIp(lastIp)}` },
    { key: 'usable', label: '可用主机数', value: `${formatCount(usable)}${usableNote}` },
    { key: 'total', label: '地址总数', value: formatCount(total) },
    { key: 'cidr', label: 'CIDR 表示', value: `${numToIp(network)}/${p}` },
    { key: 'binary', label: '掩码二进制', value: numToBinary(mask) },
    { key: 'bits', label: '网络位 / 主机位', value: `${p} 位 / ${hostBits} 位` },
    { key: 'class', label: '地址类别', value: classify(network).join('，') },
  ]

  return { ip, p, network, hostBits, items }
})

// 32 位可视化：按网络位/主机位着色
const octets = computed(() => {
  if (!info.value) return []
  const { ip, p } = info.value
  return [0, 1, 2, 3].map(k => {
    const shift = 24 - k * 8
    const bits = Array.from({ length: 8 }, (_, i) => (ip >>> (shift + 7 - i)) & 1)
    return {
      decimal: (ip >>> shift) & 255,
      bits: bits.map((bit, i) => ({ bit, isNetwork: k * 8 + i < p })),
    }
  })
})

const cidrTable = Array.from({ length: 33 }, (_, p) => {
  const total = 2 ** (32 - p)
  const usable = p >= 32 ? 1 : p === 31 ? 2 : total - 2
  return { p, mask: numToIp(maskFromPrefix(p)), total, usable }
})

const setPrefix = (p: number) => {
  prefix.value = p
}

const fillExample = () => {
  ipText.value = '192.168.1.100'
  prefix.value = 24
}

const copyResult = async (value: string, label: string) => {
  await copy(value)
  ElMessage.success(`${label}已复制`)
}
</script>

<template>
  <div class="subnet-page flex flex-col mt-3 flex-1">
    <DetailHeader title="子网掩码/IP 计算器" />

    <section class="subnet-workspace">
      <div class="workspace-toolbar">
        <label class="control-field">
          <span>IP 地址</span>
          <el-input v-model="ipText" class="ip-input" placeholder="如 192.168.1.100" />
        </label>
        <label class="control-field">
          <span>子网掩码</span>
          <el-input v-model="maskText" class="mask-input" placeholder="如 255.255.255.0 或 /24" />
        </label>
        <div class="action-group">
          <el-button text type="primary" @click="fillExample">填充示例</el-button>
        </div>
      </div>

      <div class="prefix-row">
        <span class="prefix-label">CIDR 前缀</span>
        <span class="prefix-value">/{{ prefix }}</span>
        <el-slider
          v-model="prefix"
          class="prefix-slider"
          :min="0"
          :max="32"
          :step="1"
          show-stops
          :marks="{ 0: '/0', 8: '/8', 16: '/16', 24: '/24', 32: '/32' }"
        />
      </div>

      <div class="preset-row">
        <span class="preset-label">常用前缀</span>
        <el-button
          v-for="p in prefixPresets"
          :key="p"
          size="small"
          :type="p === prefix ? 'primary' : 'default'"
          :plain="p !== prefix"
          @click="setPrefix(p)"
        >
          /{{ p }}
        </el-button>
      </div>

      <p v-if="error" class="subnet-error" role="alert">{{ error }}</p>

      <template v-if="info">
        <div class="bit-visual" aria-label="IP 地址 32 位二进制分布">
          <div v-for="(octet, k) in octets" :key="k" class="bit-octet">
            <span v-for="(cell, i) in octet.bits" :key="i" class="bit-cell" :class="{ 'is-network': cell.isNetwork }">
              {{ cell.bit }}
            </span>
            <span class="bit-decimal">{{ octet.decimal }}</span>
            <span v-if="k < 3" class="bit-dot">.</span>
          </div>
          <div class="bit-legend">
            <span><i class="legend-swatch is-network" />网络位 {{ info.p }} 位</span>
            <span><i class="legend-swatch" />主机位 {{ info.hostBits }} 位</span>
          </div>
        </div>

        <div class="result-grid">
          <div v-for="item in info.items" :key="item.key" class="result-item">
            <span class="result-label">{{ item.label }}</span>
            <span class="result-value">{{ item.value }}</span>
            <el-button text type="primary" size="small" @click="copyResult(item.value, item.label)">
              复制
            </el-button>
          </div>
        </div>
      </template>
    </section>

    <el-collapse class="cidr-collapse">
      <el-collapse-item name="table">
        <template #title>
          <span class="cidr-title">CIDR 对照表（/0 - /32）</span>
        </template>
        <div class="cidr-scroll">
          <table class="cidr-table">
            <thead>
              <tr>
                <th>CIDR</th>
                <th>子网掩码</th>
                <th>可用主机数</th>
                <th>地址总数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in cidrTable" :key="row.p" :class="{ 'is-current': info && row.p === info.p }">
                <td>/{{ row.p }}</td>
                <td>{{ row.mask }}</td>
                <td>{{ formatCount(row.usable) }}</td>
                <td>{{ formatCount(row.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </el-collapse-item>
    </el-collapse>

    <ToolDetail title="说明">
      <div class="subnet-description">
        <p>输入 IP 地址与子网掩码（支持 <code>/24</code> 这类 CIDR 写法或 <code>255.255.255.0</code> 点分掩码），实时计算网络地址、广播地址、可用主机范围、反掩码与二进制掩码。</p>
        <p class="mt-2">掩码必须为连续的 1；反掩码（通配符掩码）是掩码按位取反，常用于 ACL 与 OSPF 配置。可用主机数为地址总数减去网络地址与广播地址；<code>/31</code> 按 RFC 3021 两个地址均可用于点对点链路，<code>/32</code> 表示单个主机路由。</p>
        <p class="mt-2">地址类别按首个八位组划分：1-126 为 A 类、128-191 为 B 类、192-223 为 C 类、224-239 为 D 类组播、240-255 为 E 类保留；同时识别私网（10/8、172.16/12、192.168/16）、环回、链路本地与 CGNAT 等特殊网段。</p>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.subnet-workspace {
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.workspace-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 18px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.control-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.ip-input {
  width: 200px;
}

.mask-input {
  width: 220px;
}

.action-group {
  margin-left: auto;
}

.prefix-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
}

.prefix-label {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.prefix-value {
  flex-shrink: 0;
  width: 40px;
  font-family: monospace;
  font-size: 15px;
  color: var(--el-color-primary);
}

.prefix-slider {
  flex: 1;
  margin: 0 12px 22px 0;
}

.preset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 14px;
}

.preset-label {
  margin-right: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.subnet-error {
  margin: 0 0 10px;
  color: var(--el-color-danger);
  font-size: 13px;
}

.bit-visual {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 2px;
  padding: 12px;
  margin-bottom: 16px;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 8px;
  font-family: monospace;
}

.bit-octet {
  display: flex;
  align-items: center;
  gap: 3px;
}

.bit-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 24px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.bit-cell.is-network {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.bit-decimal {
  margin-left: 6px;
  min-width: 28px;
  text-align: center;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.bit-dot {
  margin: 0 6px;
  color: var(--el-text-color-placeholder);
}

.bit-legend {
  display: flex;
  gap: 16px;
  width: 100%;
  margin-top: 6px;
  font-family: initial;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.legend-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 4px;
  border-radius: 3px;
  vertical-align: -1px;
  background: var(--el-fill-color-light);
}

.legend-swatch.is-network {
  background: var(--el-color-primary-light-8);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.result-label {
  flex-shrink: 0;
  min-width: 110px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.result-value {
  flex: 1;
  font-family: monospace;
  font-size: 15px;
  word-break: break-all;
  color: var(--el-text-color-primary);
}

.cidr-collapse {
  margin-top: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.cidr-title {
  padding-left: 12px;
  font-weight: 500;
}

.cidr-scroll {
  max-height: 320px;
  overflow: auto;
}

.cidr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.cidr-table th,
.cidr-table td {
  padding: 6px 12px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-family: monospace;
}

.cidr-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.cidr-table tr.is-current td {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.subnet-description {
  line-height: 1.8;
}

.subnet-description code {
  padding: 0 4px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

@media (max-width: 760px) {
  .subnet-workspace {
    padding: 14px;
  }

  .ip-input,
  .mask-input {
    width: 100%;
  }

  .control-field {
    width: 100%;
  }

  .control-field span {
    flex-shrink: 0;
  }

  .action-group {
    width: 100%;
    margin-left: 0;
  }

  .result-grid {
    grid-template-columns: 1fr;
  }

  .result-label {
    min-width: 96px;
  }
}
</style>
