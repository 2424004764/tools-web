<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import TiandituMap from './TiandituMap.vue'
import { fetchSharedMap } from '@/api/travel-maps'
import { searchPoi, type PoiItem } from '@/utils/tiandituSearch'
import {
  POINT_CATEGORIES, DEFAULT_CENTER, DEFAULT_ZOOM,
  getCategory, formatDistance, formatElevation,
} from './constants'
import type { SharedMapDetail, MapPoint, PointCategory } from './types'

const route = useRoute()
const router = useRouter()
const mapRef = ref<InstanceType<typeof TiandituMap> | null>(null)

const detail = ref<SharedMapDetail | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const categoryFilter = ref<PointCategory | 'all'>('all')

const filteredPoints = computed(() => {
  const points = detail.value?.points ?? []
  return categoryFilter.value === 'all'
    ? points
    : points.filter((p) => p.category === categoryFilter.value)
})

// 只展示这张地图里实际用到的分类，避免筛选器里一堆空选项
const usedCategories = computed(() => {
  const used = new Set((detail.value?.points ?? []).map((p) => p.category))
  return POINT_CATEGORIES.filter((c) => used.has(c.value))
})

const load = async () => {
  const slug = route.params.slug as string
  if (!slug) {
    errorMsg.value = '无效的分享链接'
    loading.value = false
    return
  }

  loading.value = true
  const result = await fetchSharedMap(slug)
  if (result.ok) {
    detail.value = result.data
    setTimeout(() => mapRef.value?.fitAll(), 120)
  } else {
    errorMsg.value = result.message
  }
  loading.value = false
}

onMounted(load)

const locatePoint = (p: MapPoint) => {
  mapRef.value?.panTo(p.lng, p.lat, 15)
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.warning('复制失败，请手动复制地址栏链接')
  }
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('zh-CN')
}

// ---------- 周边搜索（只读页只支持搜，结果点击只能定位，不能加点） ----------

const POI_CATEGORIES = [
  { keyword: '露营地', emoji: '⛺', label: '露营地' },
  { keyword: '超市', emoji: '🛒', label: '超市' },
  { keyword: '加油站', emoji: '⛽', label: '加油站' },
  { keyword: '餐厅', emoji: '🍜', label: '餐厅' },
  { keyword: '卫生间', emoji: '🚻', label: '卫生间' },
  { keyword: '停车场', emoji: '🅿️', label: '停车场' },
]

const poiQuery = ref('')
const poiResults = ref<PoiItem[]>([])
const poiLoading = ref(false)
const poiVisible = ref(false)

async function runPoiSearch() {
  const kw = poiQuery.value.trim()
  if (!kw) {
    ElMessage.warning('请输入关键词')
    return
  }
  const bounds = mapRef.value?.getBounds()
  if (!bounds) {
    ElMessage.warning('地图还没准备好')
    return
  }
  poiLoading.value = true
  poiVisible.value = true
  try {
    const res = await searchPoi(kw, bounds, { count: 20 })
    poiResults.value = res.pois
    if (!res.pois.length) {
      ElMessage.info('当前视野内没搜到结果')
    }
  } catch (error: any) {
    ElMessage.error(error?.message || 'POI 搜索失败')
    poiResults.value = []
  } finally {
    poiLoading.value = false
  }
}

function flyToPoi(p: PoiItem) {
  mapRef.value?.panTo(p.lng, p.lat, 16)
  poiVisible.value = false
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="detail?.title || '旅游地图'">
      <template #right>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg border border-border-subtle text-ink-700 hover:bg-gray-50 transition-colors"
            @click="router.push('/travel-map/plaza')"
          >
            地图广场
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg border border-accent-300 text-accent-700 hover:bg-accent-50 transition-colors"
            @click="router.push('/travel-map/')"
          >
            做一张我的
          </button>
        </div>
      </template>
    </DetailHeader>

    <div v-if="loading" class="p-4 mx-4 mt-3 rounded-2xl bg-white">
      <div class="py-20 text-center text-body-sm text-ink-500">加载中…</div>
    </div>

    <div v-else-if="errorMsg" class="p-4 mx-4 mt-3 rounded-2xl bg-white">
      <div class="py-20 text-center space-y-3">
        <div class="text-4xl">🧭</div>
        <p class="text-body-sm text-ink-700">{{ errorMsg }}</p>
        <el-button type="primary" @click="router.push('/travel-map/plaza')">去地图广场看看</el-button>
      </div>
    </div>

    <div v-else-if="detail" class="px-4 mt-3 space-y-3">
      <!-- 作者与简介 -->
      <div class="p-4 rounded-2xl bg-white">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <img
              v-if="detail.author.avatar"
              :src="detail.author.avatar"
              alt=""
              class="w-7 h-7 rounded-full object-cover"
            />
            <div class="min-w-0">
              <div class="text-body-sm text-ink-900 truncate">{{ detail.author.name }}</div>
              <div class="text-xs text-ink-500">
                更新于 {{ formatTime(detail.updatedAt) }} · 👁 {{ detail.viewCount }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <el-button size="small" @click="copyLink">复制链接</el-button>
            <el-button size="small" @click="mapRef?.fitAll()">看全</el-button>
          </div>
        </div>

        <p v-if="detail.description" class="mt-3 text-body-sm text-ink-700 leading-relaxed">
          {{ detail.description }}
        </p>

        <div class="mt-3 grid grid-cols-3 gap-2 text-center">
          <div class="p-2 rounded-xl bg-gray-50">
            <div class="text-lg font-semibold text-ink-900">{{ detail.points.length }}</div>
            <div class="text-xs text-ink-500">点位</div>
          </div>
          <div class="p-2 rounded-xl bg-gray-50">
            <div class="text-lg font-semibold text-ink-900">{{ detail.routes.length }}</div>
            <div class="text-xs text-ink-500">路线</div>
          </div>
          <div class="p-2 rounded-xl bg-gray-50">
            <div class="text-lg font-semibold text-ink-900">{{ formatDistance(detail.totalDistance) }}</div>
            <div class="text-xs text-ink-500">总里程</div>
          </div>
        </div>
      </div>

      <!-- 周边搜索（只读页只用来导航，搜到的不能保存到这张图） -->
      <div class="p-3 rounded-2xl bg-white">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <el-input
              v-model="poiQuery"
              placeholder="搜当前视野周边：露营地/超市/加油站/卫生间…"
              size="default"
              @keyup.enter="runPoiSearch"
            >
              <template #prefix>📌</template>
              <template #append>
                <el-button size="default" :loading="poiLoading" @click="runPoiSearch">搜周边</el-button>
              </template>
            </el-input>
            <div
              v-if="poiVisible"
              class="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-border-subtle rounded-lg shadow-lg"
            >
              <div class="px-3 py-2 flex flex-wrap gap-1.5 border-b border-border-subtle bg-gray-50">
                <button
                  v-for="c in POI_CATEGORIES"
                  :key="c.keyword"
                  type="button"
                  class="text-xs px-2 py-1 rounded-full border border-border-subtle hover:border-accent-300 transition-colors"
                  @click="poiQuery = c.keyword; runPoiSearch()"
                >{{ c.emoji }} {{ c.label }}</button>
              </div>
              <div v-if="poiLoading" class="p-3 text-center text-xs text-ink-500">搜索中…</div>
              <div
                v-else-if="!poiResults.length"
                class="p-3 text-center text-xs text-ink-500"
              >无结果</div>
              <button
                v-for="p in poiResults"
                :key="`${p.lng}-${p.lat}-${p.name}`"
                type="button"
                class="w-full text-left px-3 py-2 hover:bg-accent-50 border-b border-border-subtle last:border-0"
                @click="flyToPoi(p)"
              >
                <div class="text-body-sm text-ink-900 truncate">{{ p.name }}</div>
                <div class="text-xs text-ink-500 truncate">{{ p.address }}</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 点位 + 路线 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div class="p-3 rounded-2xl bg-white">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-body-sm font-semibold text-ink-900">点位</h3>
            <el-select
              v-if="usedCategories.length > 1"
              v-model="categoryFilter"
              size="small"
              style="width: 128px"
            >
              <el-option value="all" label="全部分类" />
              <el-option
                v-for="c in usedCategories"
                :key="c.value"
                :value="c.value"
                :label="`${c.emoji} ${c.label}`"
              />
            </el-select>
          </div>

          <p v-if="!filteredPoints.length" class="py-6 text-center text-xs text-ink-500">
            该分类下暂无点位
          </p>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            <button
              v-for="p in filteredPoints"
              :key="p.id"
              type="button"
              class="text-left p-2 rounded-lg border border-border-subtle hover:border-accent-300 transition-colors"
              @click="locatePoint(p)"
            >
              <div class="flex items-center gap-2">
                <span>{{ getCategory(p.category).emoji }}</span>
                <span class="flex-1 min-w-0 truncate text-body-sm text-ink-900">{{ p.name }}</span>
                <span class="shrink-0 text-xs text-ink-500">{{ formatElevation(p.elevation) }}</span>
              </div>
              <p v-if="p.note" class="mt-0.5 text-xs text-ink-500 line-clamp-2">{{ p.note }}</p>
            </button>
          </div>
        </div>

        <div v-if="detail.routes.length" class="p-3 rounded-2xl bg-white">
          <h3 class="text-body-sm font-semibold text-ink-900 mb-2">路线</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="r in detail.routes"
              :key="r.id"
              class="p-2 rounded-lg border border-border-subtle flex items-center gap-2"
            >
              <span
                class="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow"
                :style="{ backgroundColor: r.color }"
              ></span>
              <span class="flex-1 min-w-0 truncate text-body-sm text-ink-900">{{ r.name }}</span>
              <span class="shrink-0 text-xs text-ink-500">{{ formatDistance(r.distance) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 地图（满宽 100%） -->
      <div class="w-full h-[420px] sm:h-[560px] lg:h-[640px] rounded-2xl overflow-hidden border border-border-subtle">
        <TiandituMap
          ref="mapRef"
          :points="detail.points"
          :routes="detail.routes"
          :center="detail.center || DEFAULT_CENTER"
          :zoom="detail.zoom || DEFAULT_ZOOM"
          :base-layer="detail.baseLayer"
          readonly
          @point-click="(id) => {
            const p = detail!.points.find((x) => x.id === id)
            if (p) locatePoint(p)
          }"
        />
      </div>
    </div>
  </div>
</template>
