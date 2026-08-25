<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import DocumentCopy from '~icons/ep/documentCopy'
import Download from '~icons/ep/download'
import Headset from '~icons/ep/headset'
import { fetchSharedSong, postSharedSongPlay } from '@/api/music-playlist'
import { downloadAudio } from '@/utils/downloadAudio'
import { formatDuration, formatBytes, extOfMime } from './constants'
import type { PublicSong } from './types'

const route = useRoute()
const song = ref<PublicSong | null>(null)
const loading = ref(true)
const errorMsg = ref('')

const audioRef = ref<HTMLAudioElement | null>(null)
let lastPlayTs = 0 // 同一会话 30s 内只 +1，避免拖动进度条连续触发

const load = async () => {
  const slug = route.params.slug as string
  if (!slug) {
    errorMsg.value = '无效的分享链接'
    loading.value = false
    return
  }
  loading.value = true
  const result = await fetchSharedSong(slug)
  if (result.ok) {
    song.value = result.data
  } else {
    errorMsg.value = result.message
  }
  loading.value = false
}

onMounted(load)

const onCopyLink = () => {
  navigator.clipboard.writeText(window.location.href).then(
    () => ElMessage.success('已复制分享链接'),
    () => ElMessage.error('复制失败，请手动选择地址栏')
  )
}

const downloading = ref(false)
const onDownload = async () => {
  if (!song.value) return
  downloading.value = true
  const loading = ElMessage({
    message: '准备下载…',
    type: 'info',
    duration: 0,
  })
  try {
    // 走 Function 代理而非 R2 直链，避开 R2 域 CORS 缺失问题
    const proxyUrl = `/api/music-playlist/song/${song.value.slug}/download`
    const filename = `${song.value.title}.${extOfMime(song.value.mimeType)}`
    await downloadAudio(proxyUrl, { filename })
    loading.close()
    ElMessage.success('已开始下载')
  } catch (e: any) {
    loading.close()
    ElMessage.error(e?.message || '下载失败')
  } finally {
    downloading.value = false
  }
}

// <audio> 真正开始播放时 +1；防抖 30s
const onAudioPlay = async () => {
  if (!song.value) return
  const now = Date.now()
  if (now - lastPlayTs < 30_000) return
  lastPlayTs = now
  await postSharedSongPlay(song.value.slug)
  // 不在前端更新 playCount，避免与服务端不一致；下次重新进入页面会看到新值
}

const onAudioEnded = () => {
  // 重新允许本次结束后下一次播放计 +1（避免快速重播被去重）
  lastPlayTs = 0
}

onBeforeUnmount(() => {
  audioRef.value?.pause()
})
</script>

<template>
  <div class="flex flex-col mt-3">
    <DetailHeader title="歌曲分享" />

    <div v-if="loading" class="status-card">
      <div class="status-text">正在加载…</div>
    </div>

    <div v-else-if="errorMsg || !song" class="status-card error">
      <el-icon :size="32"><Headset /></el-icon>
      <div class="status-text">{{ errorMsg || '歌曲不存在' }}</div>
    </div>

    <div v-else class="share-container">
      <div class="cover">
        <el-icon :size="64" color="#ea580c"><Headset /></el-icon>
      </div>

      <div class="meta">
        <h1 class="title">{{ song.title }}</h1>
        <div v-if="song.artist" class="row"><span class="lbl">艺人</span><span>{{ song.artist }}</span></div>
        <div v-if="song.album" class="row"><span class="lbl">专辑</span><span>{{ song.album }}</span></div>
        <div class="row"><span class="lbl">时长</span><span>{{ formatDuration(song.durationSec) }}</span></div>
        <div class="row"><span class="lbl">大小</span><span>{{ formatBytes(song.fileSize) }}</span></div>
        <div class="row"><span class="lbl">格式</span><span>{{ song.mimeType }}</span></div>
        <div class="row"><span class="lbl">播放</span><span>{{ song.playCount }} 次</span></div>
        <div class="row"><span class="lbl">分享者</span><span>{{ song.author.name || '匿名用户' }}</span></div>
      </div>

      <div class="player">
        <audio
          ref="audioRef"
          :src="song.publicAudioUrl"
          controls
          preload="metadata"
          style="width: 100%"
          @play="onAudioPlay"
          @ended="onAudioEnded"
        >
          您的浏览器不支持 audio 元素。
        </audio>
      </div>

      <div class="actions">
        <el-button :icon="Download" :loading="downloading" plain @click="onDownload">下载音频</el-button>
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

.cover {
  width: 100%;
  aspect-ratio: 16 / 5;
  max-height: 220px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff7ed, #fed7aa);
  display: flex;
  align-items: center;
  justify-content: center;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px;
  word-break: break-all;
}
.row {
  display: flex;
  gap: 12px;
  font-size: 14px;
  color: #4b5563;
}
.lbl {
  flex: 0 0 64px;
  color: #9ca3af;
  font-size: 12px;
}

.player {
  background: #fffbeb;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #fed7aa;
}

.actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>