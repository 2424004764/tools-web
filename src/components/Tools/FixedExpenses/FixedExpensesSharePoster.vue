<script setup lang="ts">
import { computed, ref } from 'vue'
import QrcodeVue3 from 'qrcode-vue3'
import PieChart from '~icons/ep/pie-chart'
import AlarmClock from '~icons/ep/alarm-clock'
import List from '~icons/ep/list'
import House from '~icons/ep/house'
import Iphone from '~icons/ep/iphone'
import Lock from '~icons/ep/lock'
import Van from '~icons/ep/van'
import CreditCard from '~icons/ep/credit-card'
import Reading from '~icons/ep/reading'
import Sunny from '~icons/ep/sunny'
import Money from '~icons/ep/money'
import type { FixedExpense, FixedExpenseStatistics } from './types'
import { getCategoryMeta } from './types'

export interface FixedExpensesPosterSnapshot {
  statistics: FixedExpenseStatistics
  items: FixedExpense[]
  toolLink: string
  shareDate: string
}

const props = defineProps<{ snapshot: FixedExpensesPosterSnapshot }>()
const posterRef = ref<HTMLElement>()
const categoryIcons = { housing: House, subscription: Iphone, insurance: Lock, transport: Van, loan: CreditCard, education: Reading, utility: Sunny, other: Money } as const
const getCategoryIcon = (category: string | null | undefined) => categoryIcons[category as keyof typeof categoryIcons] || Money
const formatMoney = (val: number | null | undefined, decimals = 2) => val === null || val === undefined ? '--' : val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const formatMoneyShort = (val: number | null | undefined) => val === null || val === undefined ? '--' : val >= 10000 ? `${(val / 10000).toFixed(1)} 万` : formatMoney(val, 0)
const filteredItems = computed(() => [...props.snapshot.items].sort((a, b) => b.isActive - a.isActive || (a.billingDay || 32) - (b.billingDay || 32) || a.name.localeCompare(b.name)))
const expenseTotal = computed(() => filteredItems.value.filter(item => item.isActive === 1).reduce((total, item) => total + item.amount, 0))
const expenseTotalText = computed(() => `¥${formatMoney(expenseTotal.value, expenseTotal.value % 1 === 0 ? 0 : 2)}`)
const expenseItems = computed(() => filteredItems.value.slice(0, 8).map(item => {
  const category = getCategoryMeta(item.category)
  return {
    ...item,
    categoryLabel: category.label,
    categoryColor: category.color,
    categoryIcon: getCategoryIcon(item.category),
    amountText: `¥${formatMoney(item.amount, item.amount % 1 === 0 ? 0 : 2)}`,
    billingDayText: item.billingDay ? `每月${item.billingDay}号` : '未设置扣款日',
    startDateText: item.startDate || '--',
    endDateText: item.endDate || '',
    noteText: item.note || ''
  }
}))
const heroStats = computed(() => [
  { label: '年度预估', value: `¥${formatMoneyShort(props.snapshot.statistics.yearlyTotal)}` },
  { label: '平均每项', value: `¥${formatMoney(props.snapshot.statistics.averagePerItem)}` },
  { label: '有效项目', value: `${props.snapshot.statistics.activeCount} 项` }
])
const metricTiles = computed(() => [
  { label: '总开销/月', value: `¥${formatMoneyShort(props.snapshot.statistics.monthlyTotal)}`, tone: 'rose' },
  { label: '总开销/年', value: `¥${formatMoneyShort(props.snapshot.statistics.yearlyTotal)}`, tone: 'pink' },
  { label: '平均每项', value: `¥${formatMoney(props.snapshot.statistics.averagePerItem)}`, tone: 'fuchsia' },
  { label: '已记录', value: `${props.snapshot.statistics.totalCount} 项`, tone: 'amber' }
])
defineExpose({ getElement: () => posterRef.value })
</script>

<template>
  <div ref="posterRef" class="fe-share-poster" aria-hidden="true">
    <div class="fe-poster-inner">
      <div class="fe-poster-hero">
        <div class="fe-poster-deco fe-poster-deco-1" />
        <div class="fe-poster-deco fe-poster-deco-2" />
        <div class="fe-poster-hero-body">
          <div class="fe-poster-hero-top">
            <span class="fe-poster-tag">📅 每月固定开销</span>
            <span class="fe-poster-month">{{ snapshot.statistics.currentMonth || '--' }}</span>
          </div>
          <div class="fe-poster-amount-row">
            <span class="fe-poster-currency">¥</span>
            <span class="fe-poster-amount">{{ formatMoney(snapshot.statistics.monthlyTotal) }}</span>
            <span class="fe-poster-per-month">/ 月</span>
          </div>
          <div class="fe-poster-hero-stats">
            <div v-for="stat in heroStats" :key="stat.label" class="fe-poster-hero-stat">
              <span class="fe-poster-hero-stat-label">{{ stat.label }}</span>
              <span class="fe-poster-hero-stat-value">{{ stat.value }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="fe-poster-section">
        <div class="fe-poster-section-title">
          <span class="fe-poster-section-title-badge blue"><PieChart /></span>
          <span>关键指标</span>
        </div>
        <div class="fe-poster-tiles">
          <div v-for="tile in metricTiles" :key="tile.label" class="fe-poster-tile" :class="`fe-poster-tile-${tile.tone}`">
            <div class="fe-poster-tile-label">{{ tile.label }}</div>
            <div class="fe-poster-tile-value">{{ tile.value }}</div>
          </div>
        </div>
      </div>
      <div v-if="snapshot.statistics.maxItem || snapshot.statistics.minItem" class="fe-poster-section fe-poster-mini">
        <div class="fe-poster-mini-row">
          <div class="fe-poster-mini-block">
            <div class="fe-poster-mini-label">最高开销</div>
            <div class="fe-poster-mini-name">{{ snapshot.statistics.maxItem?.name || '--' }}</div>
            <div class="fe-poster-mini-value">¥{{ formatMoney(snapshot.statistics.maxItem?.amount) }}</div>
          </div>
          <div class="fe-poster-mini-divider" />
          <div class="fe-poster-mini-block">
            <div class="fe-poster-mini-label">最低开销</div>
            <div class="fe-poster-mini-name">{{ snapshot.statistics.minItem?.name || '--' }}</div>
            <div class="fe-poster-mini-value">¥{{ formatMoney(snapshot.statistics.minItem?.amount) }}</div>
          </div>
        </div>
      </div>
      <div class="fe-poster-section">
        <div class="fe-poster-section-title">
          <span class="fe-poster-section-title-badge pink"><PieChart /></span>
          <span>分类占比</span>
        </div>
        <div v-if="!snapshot.statistics.byCategory.length" class="fe-poster-empty">暂无数据</div>
        <div v-else class="fe-poster-cat-list">
          <div v-for="c in snapshot.statistics.byCategory" :key="c.category" class="fe-poster-cat-row">
            <div class="fe-poster-cat-name">
              <span class="fe-poster-cat-dot" :style="{ backgroundColor: c.color }" />
              <span class="fe-poster-cat-name-icon"><component :is="getCategoryIcon(c.category)" /></span>
              <span>{{ getCategoryMeta(c.category).label }}</span>
            </div>
            <div class="fe-poster-cat-bar-wrap">
              <div class="fe-poster-cat-bar" :style="{ width: c.percentage + '%', backgroundColor: c.color }" />
            </div>
            <div class="fe-poster-cat-amount">
              <span>¥{{ formatMoneyShort(c.amount) }}</span>
              <small>{{ c.percentage.toFixed(1) }}%</small>
            </div>
          </div>
        </div>
      </div>
      <div class="fe-poster-section">
        <div class="fe-poster-section-title">
          <span class="fe-poster-section-title-badge rose"><AlarmClock /></span>
          <span>即将扣款</span>
        </div>
        <div v-if="!snapshot.statistics.nextBilling && !snapshot.statistics.upcoming.length" class="fe-poster-empty">暂无即将扣款</div>
        <div v-else class="fe-poster-upcoming-list">
          <div v-if="snapshot.statistics.nextBilling" class="fe-poster-upcoming-row">
            <div>
              <b>{{ snapshot.statistics.nextBilling.name }}</b>
              <small>{{ snapshot.statistics.nextBilling.date }}（{{ snapshot.statistics.nextBilling.billingDay }} 号扣款）</small>
            </div>
            <strong>¥{{ formatMoney(snapshot.statistics.nextBilling.amount) }}</strong>
          </div>
          <div v-for="u in snapshot.statistics.upcoming.slice(0, 3)" :key="u.id" class="fe-poster-upcoming-row">
            <div>
              <b>{{ u.name }}</b>
              <small>{{ u.date }}</small>
            </div>
            <strong>¥{{ formatMoney(u.amount) }}</strong>
          </div>
        </div>
      </div>
      <div class="fe-poster-section">
        <div class="fe-poster-section-title fe-poster-original-title">
          <span class="fe-poster-section-title-badge fuchsia"><List /></span>
          <div class="fe-poster-original-title-copy">
            <span>开销列表</span>
            <small>共 {{ filteredItems.length }} 项 · 筛选合计 {{ expenseTotalText }}</small>
          </div>
        </div>
        <div v-if="!filteredItems.length" class="fe-poster-empty">暂无开销</div>
        <div v-else class="fe-poster-original-list">
          <div v-for="item in expenseItems" :key="item.id" class="fe-poster-original-card" :class="{ 'fe-poster-original-card-inactive': item.isActive !== 1 }">
            <div class="fe-poster-original-card-head">
              <span class="fe-poster-original-icon" :style="{ backgroundColor: item.categoryColor + '22', color: item.categoryColor }">
                <component :is="item.categoryIcon" />
              </span>
              <div class="fe-poster-original-name">
                <b>{{ item.name }}</b>
                <small>{{ item.categoryLabel }}<span v-if="item.isActive !== 1"> · 已停用</span></small>
              </div>
            </div>
            <div class="fe-poster-original-amount"><strong>{{ item.amountText }}</strong><span>/ 月</span></div>
            <div class="fe-poster-original-dates">
              <div class="fe-poster-original-date-cell"><span>每月扣款</span><b>{{ item.billingDayText }}</b></div>
              <div class="fe-poster-original-date-cell"><span>起始日期</span><b>{{ item.startDateText }}</b></div>
            </div>
            <div v-if="item.endDateText" class="fe-poster-original-end">结束日期：{{ item.endDateText }}</div>
            <div v-if="item.noteText" class="fe-poster-original-note">{{ item.noteText }}</div>
          </div>
          <div v-if="filteredItems.length > 8" class="fe-poster-empty">还有 {{ filteredItems.length - 8 }} 项未显示</div>
        </div>
      </div>
      <div class="fe-poster-footer">
        <div>
          <b>每月固定开销 · 工具-Web</b>
          <span>{{ snapshot.toolLink }}</span>
          <small>扫码使用 · {{ snapshot.shareDate }}</small>
        </div>
        <div class="fe-poster-qr">
          <QrcodeVue3 :value="snapshot.toolLink" :width="160" :height="160" :margin="2" level="M" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fe-share-poster{position:absolute;left:-99999px;top:0;width:750px;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue','Microsoft YaHei',sans-serif}.fe-poster-inner{width:750px;background:linear-gradient(180deg,#fff5f7,#ffe4ec);padding-bottom:40px;box-sizing:border-box;color:#1a202c}.fe-poster-hero{position:relative;background:linear-gradient(135deg,#f43f5e,#ec4899 50%,#d946ef);padding:60px 50px 50px;overflow:hidden}.fe-poster-deco{position:absolute;border-radius:50%;background:#ffffff1f}.fe-poster-deco-1{width:280px;height:280px;top:-90px;right:-90px}.fe-poster-deco-2{width:200px;height:200px;bottom:-80px;left:-60px}.fe-poster-hero-body{position:relative;z-index:1}.fe-poster-hero-top,.fe-poster-amount-row,.fe-poster-hero-stats,.fe-poster-footer,.fe-poster-mini-row{display:flex}.fe-poster-hero-top{justify-content:space-between;align-items:center;margin-bottom:28px}.fe-poster-tag{font-size:24px;color:#fffe;font-weight:500}.fe-poster-month{font-size:22px;color:#fff;background:#ffffff38;padding:8px 18px;border-radius:24px}.fe-poster-amount-row{align-items:baseline;gap:8px;margin-bottom:32px}.fe-poster-currency{font-size:32px;color:#fffd}.fe-poster-amount{font-size:96px;font-weight:800;color:#fff;line-height:1}.fe-poster-per-month{font-size:28px;color:#fffd}.fe-poster-hero-stats{gap:16px}.fe-poster-hero-stat{flex:1;background:#ffffff2e;border-radius:16px;padding:18px 16px}.fe-poster-hero-stat-label{display:block;font-size:20px;color:#fffd;margin-bottom:8px;white-space:nowrap}.fe-poster-hero-stat-value{font-size:28px;color:#fff;font-weight:700;white-space:nowrap}.fe-poster-section{background:#fff;margin:28px 36px 0;border-radius:28px;padding:32px;box-shadow:0 8px 24px #f43f5e14;box-sizing:border-box}.fe-poster-section-title{font-size:28px;font-weight:700;margin:0 0 22px;display:flex;align-items:center;gap:18px;line-height:35px;min-height:56px;box-sizing:border-box}.fe-poster-section-title>span:last-child{display:block;line-height:35px;padding:10px 0 11px;white-space:nowrap}.fe-poster-section-title-badge{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;flex:0 0 56px;color:#475569}.fe-poster-section-title-badge svg{width:20px;height:20px}.blue{background:#dbeafe}.pink{background:#fce7f3}.rose{background:#ffe4e6}.fuchsia{background:#fae8ff}.fe-poster-empty{text-align:center;color:#a0aec0;font-size:22px;line-height:1.4;padding:24px 0}.fe-poster-tiles{display:grid;grid-template-columns:1fr 1fr;gap:18px}.fe-poster-tile{border-radius:20px;padding:26px 22px}.fe-poster-tile-rose{background:#ffe4e6}.fe-poster-tile-pink{background:#fce7f3}.fe-poster-tile-fuchsia{background:#fae8ff}.fe-poster-tile-amber{background:#fef3c7}.fe-poster-tile-label{font-size:22px;color:#6b7280;margin-bottom:10px}.fe-poster-tile-value{font-size:38px;font-weight:800;line-height:1.1}.fe-poster-mini{padding:26px 32px}.fe-poster-mini-block{flex:1;text-align:center}.fe-poster-mini-divider{width:1px;background:#f1f5f9;margin:0 8px}.fe-poster-mini-label{font-size:20px;color:#6b7280;margin-bottom:10px}.fe-poster-mini-name{font-size:22px;font-weight:600;margin-bottom:8px}.fe-poster-mini-value{font-size:32px;color:#f43f5e;font-weight:800}.fe-poster-cat-list,.fe-poster-items-list{display:flex;flex-direction:column;gap:18px}.fe-poster-cat-row{display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr) 140px;align-items:center;gap:18px}.fe-poster-cat-name{font-size:22px;display:flex;align-items:center;gap:12px;line-height:40px;white-space:nowrap;overflow:visible}.fe-poster-cat-name>span:last-child{display:block;line-height:40px;padding:2px 0 4px}.fe-poster-cat-dot{width:14px;height:14px;border-radius:50%;flex:none}.fe-poster-cat-name-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:#f3f4f6;flex:none}.fe-poster-cat-name-icon svg,.fe-poster-item-icon svg{width:20px;height:20px}.fe-poster-cat-bar-wrap{height:18px;background:#f3f4f6;border-radius:9px;overflow:hidden}.fe-poster-cat-bar{height:100%;border-radius:9px}.fe-poster-cat-amount{text-align:right;display:flex;flex-direction:column;font-size:22px;font-weight:700}.fe-poster-cat-amount small,.fe-poster-item-meta small,.fe-poster-upcoming-row small,.fe-poster-footer small{font-size:18px;color:#9ca3af;margin-top:4px}.fe-poster-upcoming-list{display:flex;flex-direction:column;gap:16px}.fe-poster-upcoming-row{display:flex;justify-content:space-between;gap:18px;padding:18px 22px;background:#fff1f2;border-radius:18px;font-size:24px}.fe-poster-upcoming-row strong{color:#f43f5e}.fe-poster-upcoming-row small{display:block;color:#f43f5e}.fe-poster-original-list{display:grid;grid-template-columns:1fr;gap:18px;width:100%;box-sizing:border-box;overflow:visible}.fe-poster-original-card{width:100%;min-width:0;min-height:288px;padding:20px 22px;border:1px solid #fce7f3;border-bottom:1px dashed #fbcfe8;border-radius:18px;background:#fff;box-sizing:border-box;overflow:visible;color:#1a202c;line-height:1.4}.fe-poster-original-card-inactive{opacity:.55}.fe-poster-original-card-head{display:flex;align-items:center;gap:14px;width:100%;min-width:0;min-height:58px;box-sizing:border-box;overflow:hidden}.fe-poster-original-icon{width:56px;height:56px;display:flex;align-items:center;justify-content:center;flex:0 0 56px;border-radius:16px;box-sizing:border-box;overflow:hidden}.fe-poster-original-icon svg{width:24px;height:24px;flex:0 0 24px}.fe-poster-original-name{min-width:0;display:flex;flex-direction:column;gap:3px;box-sizing:border-box;overflow:hidden}.fe-poster-original-name b{display:block;min-width:0;font-size:23px;line-height:36px;padding:2px 0 6px;font-weight:700;overflow:visible;text-overflow:ellipsis;white-space:nowrap}.fe-poster-original-name small{display:block;min-width:0;font-size:17px;line-height:29px;padding:2px 0 5px;color:#9ca3af;overflow:visible;text-overflow:ellipsis;white-space:nowrap}.fe-poster-original-amount{display:flex;align-items:baseline;gap:6px;margin:16px 0 15px;width:100%;min-height:43px;box-sizing:border-box;overflow:visible}.fe-poster-original-amount strong{font-size:34px;line-height:48px;padding:1px 0 3px;color:#f43f5e;font-weight:800;white-space:nowrap}.fe-poster-original-amount span{font-size:18px;line-height:27px;color:#9ca3af;white-space:nowrap}.fe-poster-original-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;box-sizing:border-box;overflow:visible}.fe-poster-original-date-cell{min-width:0;padding:9px 10px;background:#fff1f2;border-radius:10px;box-sizing:border-box;overflow:hidden}.fe-poster-original-date-cell span{display:block;font-size:15px;line-height:22px;padding:1px 0 3px;color:#9ca3af;white-space:nowrap;overflow:visible;text-overflow:ellipsis}.fe-poster-original-date-cell b{display:block;font-size:17px;line-height:29px;padding:2px 0 5px;color:#4b5563;font-weight:600;white-space:nowrap;overflow:visible;text-overflow:ellipsis}.fe-poster-original-end{margin-top:10px;padding-top:9px;border-top:1px dashed #fbcfe8;font-size:16px;line-height:24px;color:#b45309;overflow-wrap:anywhere;box-sizing:border-box}.fe-poster-original-note{margin-top:9px;padding:8px 10px;border-radius:9px;background:#f8fafc;font-size:16px;line-height:24px;color:#9ca3af;overflow-wrap:anywhere;box-sizing:border-box;overflow:visible}.fe-poster-original-title{align-items:center}.fe-poster-original-title-copy{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px;box-sizing:border-box;overflow:visible}.fe-poster-original-title-copy>span{display:block;font-size:28px;line-height:42px;padding:2px 0 4px;white-space:nowrap}.fe-poster-original-title-copy small{display:block;font-size:17px;line-height:28px;padding:1px 0 3px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}
.fe-poster-footer{margin-top:36px;padding:32px 50px 0;align-items:center;justify-content:space-between;gap:28px;color:#6b7280;font-size:20px}.fe-poster-footer>div:first-child{display:flex;flex-direction:column;gap:8px;min-width:0}.fe-poster-footer b{color:#f43f5e;font-size:24px}.fe-poster-footer span{font-size:18px;color:#374151;word-break:break-all}.fe-poster-qr{background:#fff;padding:14px;border-radius:20px}.fe-poster-qr canvas,.fe-poster-qr img{display:block;border-radius:12px}
</style>
