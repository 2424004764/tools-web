<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import { fetchPlaza } from '@/api/travel-maps'
import { formatDistance } from './constants'
import type { PlazaMapItem, Pagination } from './types'

const info = { title: '地图广场' }

const router = useRouter()
const list = ref<PlazaMapItem[]>([])
const pagination = ref<Pagination | null>(null)
const page = ref(1)
const loading = ref(true)

const load = async (target = 1) => {
  loading.value = true
  try {
    const res = await fetchPlaza(target, 12)
    list.value = res.list
    pagination.value = res.pagination
    page.value = target
  } catch {
    // functionsRequest 拦截器已提示
  } finally {
    loading.value = false
  }
}

onMounted(() => load(1))

const openMap = (slug: string) => {
  router.push(`/travel-map/share/${slug}`)
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title">
      <template #right>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg border border-accent-300 text-accent-700 hover:bg-accent-50 transition-colors"
          @click="router.push('/travel-map/')"
        >
          制作我的地图
        </button>
      </template>
    </DetailHeader>

    <div class="px-4">
      <div class="rounded-2xl bg-gradient-to-r from-sky-50 via-emerald-50 to-teal-50 p-4 border border-sky-100">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-2xl">🗺️</span>
          <h2 class="text-base font-semibold text-gray-800">大家分享的旅游地图</h2>
        </div>
        <p class="text-sm text-gray-600 leading-relaxed">
          这里汇集了所有公开分享的旅游地图，包含规划好的路线以及露营地、商店超市、水源、观景点等实用点位，点开即可查看。
        </p>
      </div>
    </div>

    <div class="p-4 rounded-2xl bg-white mx-4 mt-3">
      <div v-if="loading" class="py-16 text-center text-body-sm text-ink-500">加载中…</div>

      <div v-else-if="!list.length" class="py-16 text-center space-y-3">
        <div class="text-4xl">🏕️</div>
        <p class="text-body-sm text-ink-600">还没有人分享地图，来做第一个吧</p>
        <el-button type="primary" @click="router.push('/travel-map/')">制作我的地图</el-button>
      </div>

      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            v-for="item in list"
            :key="item.slug"
            type="button"
            class="text-left p-4 rounded-xl border border-border-subtle hover:border-accent-400 hover:shadow-sm transition-all"
            @click="openMap(item.slug)"
          >
            <h3 class="font-semibold text-ink-900 truncate">{{ item.title }}</h3>
            <p class="mt-1 text-body-sm text-ink-600 line-clamp-2 min-h-[2.5rem]">
              {{ item.description || '暂无简介' }}
            </p>

            <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
              <span>📍 {{ item.pointCount }} 点位</span>
              <span>🥾 {{ item.routeCount }} 路线</span>
              <span v-if="item.totalDistance > 0">{{ formatDistance(item.totalDistance) }}</span>
            </div>

            <div class="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <img
                  v-if="item.author.avatar"
                  :src="item.author.avatar"
                  alt=""
                  class="w-5 h-5 rounded-full object-cover"
                />
                <span class="text-xs text-ink-600 truncate">{{ item.author.name }}</span>
              </div>
              <span class="shrink-0 text-xs text-ink-400">
                👁 {{ item.viewCount }} · {{ formatTime(item.updatedAt) }}
              </span>
            </div>
          </button>
        </div>

        <div v-if="pagination && pagination.totalPages > 1" class="mt-6 flex justify-center">
          <el-pagination
            :current-page="page"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            layout="prev, pager, next"
            :background="true"
            @current-change="load"
          />
        </div>
      </template>
    </div>
  </div>
</template>
