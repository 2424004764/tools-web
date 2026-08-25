<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import DocumentCopy from '~icons/ep/documentCopy'
import Download from '~icons/ep/download'
import Headset from '~icons/ep/headset'
import VideoPlay from '~icons/ep/videoPlay'
import { fetchSharedPlaylist, postSharedSongPlay } from '@/api/music-playlist'
import { downloadAudio } from '@/utils/downloadAudio'
import { formatDuration, extOfMime } from './constants'
import type { PublicPlaylist, PublicPlaylistSong } from './types'

const route = useRoute()
const router = useRouter()
const playlist = ref<PublicPlaylist | null>(null)
const loading = ref(true)
const errorMsg = ref('')

// 当前播放歌曲
const currentIndex = ref<number>(-1)
const audioRef = ref<HTMLAudioElement | null>(null)
let lastPlayTs = 0

const currentSong = computed<PublicPlaylistSong | null>(() => {
  if (currentIndex.value < 0) return null
  return playlist.value?.songs?.[currentIndex.value] ?? null
})

const load = async () => {
  const slug = route.params.slug as string
  if (!slug) {
    errorMsg.value = '无效的分享链接'
    loading.value = false
    return
  }
  loading.value = true
  const result = await fetchSharedPlaylist(slug)
  if (result.ok) {
    playlist.value = result.data
    if (playlist.value.songs.length > 0) {
      currentIndex.value = 0
    }
  } else {
    errorMsg.value = result.message
  }
  loading.value = false
}

onMounted(load)

const playSongAt = (idx: number) => {
  if (!playlist.value) return
  if (idx < 0 || idx >= playlist.value.songs.length) return
  currentIndex.value = idx
  setTimeout(() => audioRef.value?.play().catch(() => { /* 用户手势未到位，静默 */ }), 0)
}

const onAudioPlay = async () => {
  const song = currentSong.value
  if (!song) return
  const now = Date.now()
  if (now - lastPlayTs < 30_000) return
  lastPlayTs = now
  await postSharedSongPlay(song.slug)
}

const onAudioEnded = () => {
  lastPlayTs = 0
  // 自动播放下一首
  if (currentIndex.value + 1 < (playlist.value?.songs.length ?? 0)) {
    playSongAt(currentIndex.value + 1)
  }
}

const onJumpToSong = (song: PublicPlaylistSong) => {
  router.push(`/music-playlist/song/${song.slug}`)
}

const downloadingId = ref<string | null>(null)
const onDownloadSong = async (song: PublicPlaylistSong) => {
  downloadingId.value = song.id
  const loading = ElMessage({ message: '准备下载…', type: 'info', duration: 0 })
  try {
    // 走 Function 代理而非 R2 直链，避开 R2 域 CORS 缺失问题
    const proxyUrl = `/api/music-playlist/song/${song.slug}/download`
    const filename = `${song.title}.${extOfMime(song.mimeType)}`
    await downloadAudio(proxyUrl, { filename })
    loading.close()
    ElMessage.success('已开始下载')
  } catch (e: any) {
    loading.close()
    ElMessage.error(e?.message || '下载失败')
  } finally {
    downloadingId.value = null
  }
}

const onCopyLink = () => {
  navigator.clipboard.writeText(window.location.href).then(
    () => ElMessage.success('已复制分享链接'),
    () => ElMessage.error('复制失败，请手动选择地址栏')
  )
}

onBeforeUnmount(() => {
  audioRef.value?.pause()
})
</script>

<template>
  <div class="flex flex-col mt-3">
    <DetailHeader title="歌单分享" />

    <div v-if="loading" class="status-card">
      <div class="status-text">正在加载…</div>
    </div>

    <div v-else-if="errorMsg || !playlist" class="status-card error">
      <el-icon :size="32"><Headset /></el-icon>
      <div class="status-text">{{ errorMsg || '歌单不存在' }}</div>
    </div>

    <div v-else class="share-container">
      <!-- 头部 -->
      <div class="header">
        <div class="header-icon">
          <el-icon :size="48" color="#ea580c"><Headset /></el-icon>
        </div>
        <div class="header-meta">
          <h1 class="title">{{ playlist.title }}</h1>
          <div v-if="playlist.description" class="desc">{{ playlist.description }}</div>
          <div class="stats">
            <el-tag size="small" effect="plain">{{ playlist.songCount }} 首</el-tag>
            <el-tag size="small" effect="plain" type="info">浏览 {{ playlist.viewCount }}</el-tag>
            <span class="author">分享者：{{ playlist.author.name || '匿名用户' }}</span>
          </div>
        </div>
      </div>

      <!-- 播放器 -->
      <div v-if="currentSong" class="player">
        <div class="now-playing">
          <span class="np-label">正在播放</span>
          <span class="np-title">{{ currentSong.title }}</span>
          <span v-if="currentSong.artist" class="np-artist">— {{ currentSong.artist }}</span>
        </div>
        <audio
          ref="audioRef"
          :src="currentSong.publicAudioUrl"
          controls
          preload="metadata"
          style="width: 100%"
          @play="onAudioPlay"
          @ended="onAudioEnded"
        />
      </div>

      <!-- 歌曲列表 -->
      <div class="section">
        <div class="section-title">歌曲列表</div>
        <div v-if="playlist.songs.length === 0" class="empty">
          歌单里还没有可公开播放的歌曲
        </div>
        <div v-for="(s, idx) in playlist.songs" :key="s.id" class="song-row" :class="{ active: idx === currentIndex }">
          <div class="song-index">
            <el-icon v-if="idx !== currentIndex" :size="14"><VideoPlay /></el-icon>
            <span v-else>▶</span>
          </div>
          <div class="song-info" @click="onJumpToSong(s)">
            <div class="song-title">{{ s.title }}</div>
            <div class="song-sub">
              <span>{{ s.artist || '未知艺人' }}</span>
              <span v-if="s.album">· {{ s.album }}</span>
              <span>· {{ formatDuration(s.durationSec) }}</span>
            </div>
          </div>
          <el-button :icon="Download" size="small" plain :loading="downloadingId === s.id" @click="onDownloadSong(s)">下载</el-button>
          <el-button size="small" plain @click="playSongAt(idx)">播放</el-button>
        </div>
      </div>

      <div class="actions">
        <el-button :icon="DocumentCopy" type="primary" plain @click="onCopyLink">复制链接</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-card {
  background: #fff;
  border: 1.5px solid #fed7aa;
  border-radius: 14px;
  padding: 60px 20px;
  text-align: center;
  color: #9a3412;
}
.status-card.error { color: #b91c1c; }
.status-text { margin-top: 12px; font-size: 14px; }

.share-container {
  background: #fff;
  border: 1.5px solid #fed7aa;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.header {
  display: flex;
  gap: 16px;
  align-items: center;
}
.header-icon {
  flex: 0 0 100px;
  height: 100px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff7ed, #fed7aa);
  display: flex;
  align-items: center;
  justify-content: center;
}
.header-meta { flex: 1; min-width: 0; }
.title { font-size: 22px; font-weight: 700; color: #1f2937; margin: 0 0 4px; word-break: break-all; }
.desc { font-size: 13px; color: #6b7280; margin-bottom: 6px; word-break: break-all; }
.stats { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.author { font-size: 12px; color: #9ca3af; }

.player {
  background: #fffbeb;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  padding: 12px 14px;
}
.now-playing {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
}
.np-label {
  font-size: 11px;
  background: #ea580c;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
}
.np-title { font-weight: 600; color: #1f2937; }
.np-artist { color: #6b7280; font-size: 12px; }

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}
.empty { font-size: 13px; color: #9ca3af; padding: 16px 0; text-align: center; }

.song-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  margin-bottom: 6px;
  transition: background 0.15s;
}
.song-row:hover { background: #fffbeb; }
.song-row.active { background: #fff7ed; border-color: #fdba74; }

.song-index {
  flex: 0 0 24px;
  text-align: center;
  color: #ea580c;
  font-size: 14px;
}
.song-info { flex: 1; min-width: 0; cursor: pointer; }
.song-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-row.active .song-title { color: #ea580c; }
.song-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>