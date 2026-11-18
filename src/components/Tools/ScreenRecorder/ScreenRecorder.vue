<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import Download from '~icons/ep/download'
import RefreshRight from '~icons/ep/refresh-right'
import SwitchButton from '~icons/ep/switch-button'
import VideoCamera from '~icons/ep/video-camera'
import VideoPause from '~icons/ep/video-pause'
import VideoPlay from '~icons/ep/video-play'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: '屏幕录制',
})

type Phase = 'idle' | 'countdown' | 'recording' | 'paused' | 'done'

// —— 录制选项（录制中不可更改） ——
const includeSystemAudio = ref(false)
const includeMicAudio = ref(false)
const withCountdown = ref(false)
const quality = ref('original') // original | 1080 | 720 | 480
const fps = ref(0) // 0 = 跟随源
const bitrateMbps = ref(0) // 0 = 自动

// —— 运行状态 ——
const phase = ref<Phase>('idle')
const countdown = ref(0)
const elapsedMs = ref(0)
const recordedBytes = ref(0)
const captureSize = ref('')

// —— 结果 ——
const resultUrl = ref('')
const resultBytes = ref(0)
const resultDurationMs = ref(0)
const resultExt = ref('webm')

// —— 内部句柄 ——
const previewVideo = ref<HTMLVideoElement | null>(null)
let displayStream: MediaStream | null = null
let micStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let recorder: MediaRecorder | null = null
let pendingStream: MediaStream | null = null
let chunks: Blob[] = []
let countdownTimer = 0
let tickTimer = 0
let elapsedBase = 0
let startMark: number | null = null
let stopping = false // 区分「正常停止出结果」与「卸载时丢弃」

// —— 能力检测与格式选择 ——
const pickMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ]
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || ''
}

const supportedMime = pickMime()
const supported = !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined' && !!supportedMime

const formatSize = (bytes: number) => {
  if (bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const pad = (n: number) => String(n).padStart(2, '0')

const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

const timestampName = () => {
  const d = new Date()
  const p = (n: number) => pad(n)
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// —— 约束构造 ——
const buildVideoConstraints = () => {
  const c: MediaTrackConstraints = {}
  if (quality.value === '1080') {
    c.width = { ideal: 1920 }
    c.height = { ideal: 1080 }
  } else if (quality.value === '720') {
    c.width = { ideal: 1280 }
    c.height = { ideal: 720 }
  } else if (quality.value === '480') {
    c.width = { ideal: 854 }
    c.height = { ideal: 480 }
  }
  if (fps.value > 0) {
    c.frameRate = { ideal: fps.value, max: fps.value }
  }
  return Object.keys(c).length ? c : true
}

const buildDisplayOpts = (): DisplayMediaStreamOptions =>
  ({
    video: buildVideoConstraints(),
    audio: includeSystemAudio.value ? { echoCancellation: false, noiseSuppression: false } : false,
    // Chrome 专属提示字段：优先提供系统声音选项；避免选到本页面自身造成画面无限套娃
    systemAudio: 'include',
    selfBrowserSurface: 'exclude',
  }) as DisplayMediaStreamOptions

const recorderOpts = (): MediaRecorderOptions => {
  const opts: MediaRecorderOptions = { mimeType: supportedMime || undefined, audioBitsPerSecond: 128000 }
  if (bitrateMbps.value > 0) opts.videoBitsPerSecond = bitrateMbps.value * 1000000
  return opts
}

const startErrorText = (err: unknown) => {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
      return '已取消屏幕选择或未授权录制'
    case 'NotFoundError':
      return '没有可用的屏幕录制源'
    case 'NotSupportedError':
      return '当前浏览器不支持屏幕捕获'
    case 'SecurityError':
      return '屏幕捕获需要 HTTPS 或 localhost 环境'
    default:
      return err instanceof Error ? err.message : '启动录制失败'
  }
}

// —— 计时 ——
const tick = () => {
  if (phase.value === 'recording' && startMark !== null) {
    elapsedMs.value = elapsedBase + (performance.now() - startMark)
  }
}

// —— 开始（点击即发起 getDisplayMedia，必须保持在用户手势内） ——
const startCapture = async () => {
  if (!supported) {
    ElMessage.error('当前浏览器不支持屏幕录制，请使用桌面版 Chrome / Edge / Firefox / Safari')
    return
  }

  let display: MediaStream
  try {
    display = await navigator.mediaDevices.getDisplayMedia(buildDisplayOpts())
  } catch (err) {
    ElMessage.warning(startErrorText(err))
    return
  }

  // 麦克风在屏幕源确定后再申请，失败不阻断录制
  let mic: MediaStream | null = null
  if (includeMicAudio.value) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      ElMessage.warning('无法获取麦克风，将继续录制' + (display.getAudioTracks().length ? '（仅系统声音）' : '无声视频'))
    }
  }

  if (includeSystemAudio.value && display.getAudioTracks().length === 0) {
    ElMessage.warning('未捕获到系统声音：浏览器弹窗中需选择标签页/整块屏幕并勾选「同时分享音频」')
  }

  const videoTrack = display.getVideoTracks()[0]
  if (!videoTrack) {
    display.getTracks().forEach((t) => t.stop())
    ElMessage.error('未获取到画面轨道，请重试')
    return
  }

  // 浏览器自带的「停止分享」按钮会直接结束视频轨道，监听并正常收尾
  videoTrack.addEventListener('ended', onSourceEnded)

  const settings = videoTrack.getSettings()
  captureSize.value = settings.width && settings.height ? `${settings.width}×${settings.height}` : ''

  // 混音：系统声音 + 麦克风合成一条音轨
  let audioTracks = display.getAudioTracks()
  if (mic && audioContext === null) {
    try {
      audioContext = new AudioContext()
      const dest = audioContext.createMediaStreamDestination()
      for (const t of display.getAudioTracks()) {
        audioContext.createMediaStreamSource(new MediaStream([t])).connect(dest)
      }
      for (const t of mic.getAudioTracks()) {
        audioContext.createMediaStreamSource(new MediaStream([t])).connect(dest)
      }
      audioTracks = dest.stream.getAudioTracks()
    } catch {
      audioTracks = [...display.getAudioTracks(), ...mic.getAudioTracks()]
    }
  }

  displayStream = display
  micStream = mic
  pendingStream = new MediaStream([videoTrack, ...audioTracks])

  if (withCountdown.value) {
    phase.value = 'countdown'
    countdown.value = 3
    countdownTimer = window.setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        window.clearInterval(countdownTimer)
        countdownTimer = 0
        beginRecording()
      }
    }, 1000)
  } else {
    beginRecording()
  }
}

const beginRecording = () => {
  if (!pendingStream) return
  chunks = []
  recordedBytes.value = 0
  elapsedBase = 0
  elapsedMs.value = 0
  startMark = performance.now()
  stopping = false

  try {
    recorder = new MediaRecorder(pendingStream, recorderOpts())
  } catch {
    ElMessage.error('无法启动录制器，请重试')
    teardownCapture()
    phase.value = 'idle'
    return
  }

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data)
      recordedBytes.value += e.data.size
    }
  }
  recorder.onstop = finishRecording
  recorder.start(1000)

  phase.value = 'recording'
  tickTimer = window.setInterval(tick, 200)
  window.addEventListener('beforeunload', onBeforeUnloadGuard)

  nextTick(() => {
    if (previewVideo.value) previewVideo.value.srcObject = pendingStream
  })
}

const pauseRecording = () => {
  if (recorder?.state === 'recording') {
    recorder.pause()
    if (startMark !== null) {
      elapsedBase += performance.now() - startMark
      startMark = null
    }
    phase.value = 'paused'
  }
}

const resumeRecording = () => {
  if (recorder?.state === 'paused') {
    recorder.resume()
    startMark = performance.now()
    phase.value = 'recording'
  }
}

const stopRecording = () => {
  if (recorder && recorder.state !== 'inactive') {
    stopping = true
    recorder.stop()
  }
}

// 用户点了浏览器自带的「停止分享」
const onSourceEnded = () => {
  if (phase.value === 'countdown') {
    cancelCapture()
    return
  }
  if (recorder && recorder.state !== 'inactive') {
    stopping = true
    recorder.stop()
  }
}

const finishRecording = () => {
  const durationMs = elapsedBase + (startMark !== null ? performance.now() - startMark : 0)
  const actualMime = recorder?.mimeType || supportedMime || 'video/webm'
  teardownCapture()

  if (!stopping || chunks.length === 0) {
    // 卸载时丢弃，不出结果
    phase.value = 'idle'
    return
  }

  const blob = new Blob(chunks, { type: actualMime })
  chunks = []
  resultUrl.value = URL.createObjectURL(blob)
  resultBytes.value = blob.size
  resultDurationMs.value = durationMs
  resultExt.value = actualMime.includes('mp4') ? 'mp4' : 'webm'
  phase.value = 'done'
  ElMessage.success('录制完成')
}

const cancelCapture = () => {
  stopping = false
  if (recorder && recorder.state !== 'inactive') {
    recorder.onstop = null
    try {
      recorder.stop()
    } catch {
      /* 忽略 */
    }
  }
  recorder = null
  chunks = []
  teardownCapture()
  phase.value = 'idle'
}

const teardownCapture = () => {
  window.clearInterval(countdownTimer)
  countdownTimer = 0
  window.clearInterval(tickTimer)
  tickTimer = 0
  window.removeEventListener('beforeunload', onBeforeUnloadGuard)

  displayStream?.getTracks().forEach((t) => t.stop())
  micStream?.getTracks().forEach((t) => t.stop())
  displayStream = null
  micStream = null
  pendingStream = null
  if (previewVideo.value) previewVideo.value.srcObject = null

  audioContext?.close().catch(() => {})
  audioContext = null
  recorder = null
  captureSize.value = ''
}

const onBeforeUnloadGuard = (e: BeforeUnloadEvent) => {
  e.preventDefault()
  e.returnValue = ''
}

// —— 结果操作 ——
const download = () => {
  if (!resultUrl.value) return
  const a = document.createElement('a')
  a.href = resultUrl.value
  a.download = `屏幕录制_${timestampName()}.${resultExt.value}`
  a.click()
  ElMessage.success('下载成功')
}

const reset = () => {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultBytes.value = 0
  resultDurationMs.value = 0
  elapsedMs.value = 0
  phase.value = 'idle'
}

onBeforeUnmount(() => {
  if (phase.value === 'recording' || phase.value === 'paused' || phase.value === 'countdown') {
    cancelCapture()
  }
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})

const controlsDisabled = computed(() => !supported)

const statusText = computed(() => {
  switch (phase.value) {
    case 'countdown':
      return '准备开始'
    case 'recording':
      return '录制中'
    case 'paused':
      return '已暂停'
    case 'done':
      return '录制完成'
    default:
      return '待开始'
  }
})
</script>

<template>
  <div class="screen-recorder-page flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <!-- 录制选项 -->
      <div class="bg-gray-50 rounded-lg p-3 space-y-3">
        <div class="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <el-checkbox v-model="includeSystemAudio" :disabled="phase !== 'idle'">系统声音</el-checkbox>
          <el-checkbox v-model="includeMicAudio" :disabled="phase !== 'idle'">麦克风</el-checkbox>
          <el-checkbox v-model="withCountdown" :disabled="phase !== 'idle'">3 秒倒计时</el-checkbox>
        </div>
        <div class="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <span class="text-body-sm text-gray-500">清晰度：</span>
          <el-select v-model="quality" :disabled="phase !== 'idle'" class="!w-32">
            <el-option label="原始画质" value="original" />
            <el-option label="1080P" value="1080" />
            <el-option label="720P" value="720" />
            <el-option label="480P" value="480" />
          </el-select>

          <span class="text-body-sm text-gray-500">帧率：</span>
          <el-select v-model="fps" :disabled="phase !== 'idle'" class="!w-32">
            <el-option label="原始帧率" :value="0" />
            <el-option label="60 fps" :value="60" />
            <el-option label="30 fps" :value="30" />
            <el-option label="24 fps" :value="24" />
          </el-select>

          <span class="text-body-sm text-gray-500">码率：</span>
          <el-select v-model="bitrateMbps" :disabled="phase !== 'idle'" class="!w-32">
            <el-option label="自动" :value="0" />
            <el-option label="4 Mbps" :value="4" />
            <el-option label="8 Mbps" :value="8" />
            <el-option label="16 Mbps" :value="16" />
          </el-select>
        </div>
        <div class="flex items-center gap-2 flex-wrap text-body-sm">
          <el-tag v-if="supported" type="info" size="small">输出格式：{{ resultExt === 'mp4' || supportedMime.includes('mp4') ? 'MP4' : 'WebM' }}</el-tag>
          <el-tag v-else type="danger" size="small">当前浏览器不支持屏幕录制，请使用桌面版 Chrome / Edge / Firefox / Safari</el-tag>
          <el-tag v-if="captureSize" type="success" size="small">画面 {{ captureSize }}</el-tag>
        </div>
      </div>

      <!-- 预览 / 结果 -->
      <div class="border rounded-lg overflow-hidden">
        <div class="bg-gray-100 px-3 py-2 text-body-sm flex justify-between items-center gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span
              v-if="phase === 'recording'"
              class="rec-dot"
              title="录制中"
            ></span>
            <span
              v-else-if="phase === 'paused'"
              class="rec-dot rec-dot--paused"
              title="已暂停"
            ></span>
            <span class="font-medium">{{ statusText }}</span>
          </div>
          <div class="flex items-center gap-2 text-gray-500">
            <span v-if="phase === 'recording' || phase === 'paused' || phase === 'done'">
              时长 {{ formatDuration(phase === 'done' ? resultDurationMs : elapsedMs) }}
            </span>
            <span v-if="phase === 'recording' || phase === 'paused' || phase === 'done'">
              大小 {{ formatSize(phase === 'done' ? resultBytes : recordedBytes) }}
            </span>
            <span v-if="captureSize && phase !== 'idle' && phase !== 'done'">{{ captureSize }}</span>
          </div>
        </div>

        <div class="relative">
          <!-- 待开始 -->
          <div v-if="phase === 'idle'" class="flex flex-col items-center justify-center min-h-[280px] gap-4 p-6">
            <el-empty
              :description="supported ? '点击下方按钮，在浏览器弹窗中选择要录制的屏幕、窗口或标签页' : '当前环境不支持屏幕录制'"
              :image-size="80"
            />
            <el-button type="primary" size="large" :disabled="controlsDisabled" @click="startCapture">
              <el-icon class="mr-1"><VideoCamera /></el-icon>
              开始录制
            </el-button>
            <div v-if="supported" class="text-body-sm text-gray-400 text-center max-w-[480px]">
              需要系统声音时，请在浏览器分享弹窗中勾选「同时分享标签页 / 系统音频」（Chrome / Edge 支持）
            </div>
          </div>

          <!-- 倒计时 -->
          <div v-else-if="phase === 'countdown'" class="flex flex-col items-center justify-center min-h-[280px] gap-4">
            <div class="countdown-num">{{ countdown }}</div>
            <el-button size="small" @click="cancelCapture">取消</el-button>
          </div>

          <!-- 实时预览 -->
          <video
            v-else-if="phase === 'recording' || phase === 'paused'"
            ref="previewVideo"
            class="w-full max-h-[480px] bg-black"
            autoplay
            muted
            playsinline
          ></video>

          <!-- 结果回放 -->
          <video
            v-else-if="phase === 'done'"
            class="w-full max-h-[480px] bg-black"
            :src="resultUrl"
            controls
            playsinline
          ></video>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="flex items-center gap-2 flex-wrap">
        <template v-if="phase === 'recording'">
          <el-button @click="pauseRecording">
            <el-icon class="mr-1"><VideoPause /></el-icon>
            暂停
          </el-button>
          <el-button type="danger" @click="stopRecording">
            <el-icon class="mr-1"><SwitchButton /></el-icon>
            停止并生成视频
          </el-button>
        </template>
        <template v-else-if="phase === 'paused'">
          <el-button type="primary" @click="resumeRecording">
            <el-icon class="mr-1"><VideoPlay /></el-icon>
            继续
          </el-button>
          <el-button type="danger" @click="stopRecording">
            <el-icon class="mr-1"><SwitchButton /></el-icon>
            停止并生成视频
          </el-button>
        </template>
        <template v-else-if="phase === 'done'">
          <el-button type="primary" @click="download">
            <el-icon class="mr-1"><Download /></el-icon>
            下载视频（{{ resultExt.toUpperCase() }} · {{ formatSize(resultBytes) }}）
          </el-button>
          <el-button @click="reset">
            <el-icon class="mr-1"><RefreshRight /></el-icon>
            重新录制
          </el-button>
        </template>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="工具说明">
      <div class="space-y-3">
        <el-text>
          <strong>使用方法：</strong>点击「开始录制」，浏览器会弹出选择框，可选择整块屏幕、应用窗口或浏览器标签页；点击浏览器自带的「停止分享」按钮同样会结束录制并生成视频。
        </el-text>
        <el-divider />
        <el-text>
          <strong>声音录制：</strong>「系统声音」需在浏览器分享弹窗中勾选「同时分享标签页 / 系统音频」（Chrome、Edge 支持）；「麦克风」可单独开启，两者同时开启时自动混音为一条音轨。
        </el-text>
        <el-divider />
        <el-text>
          <strong>输出格式：</strong>优先输出 WebM（VP9/VP8），Safari 等环境自动回退 MP4，可在 VLC、主流播放器与剪辑软件中直接使用。暂停期间不会写入内容，计时也会同步暂停。
        </el-text>
        <el-divider />
        <el-text>
          <strong>隐私安全：</strong>录制全程在浏览器本地完成，视频不上传服务器，仅保存在你的设备内存中，点击下载后才落盘。长时间录制建议预留足够的内存与磁盘空间。
        </el-text>
        <el-divider />
        <el-text>
          <strong>兼容说明：</strong>需要桌面版 Chrome / Edge / Firefox / Safari 14.1+，且页面运行在 HTTPS 或 localhost 环境；大部分移动端浏览器不支持屏幕捕获。清晰度与帧率为「期望值」，实际以系统与屏幕源能力为准。
        </el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-danger);
  animation: rec-pulse 1s ease-in-out infinite;
}
.rec-dot--paused {
  background: var(--el-color-warning);
  animation: none;
}
@keyframes rec-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.countdown-num {
  font-size: 64px;
  font-weight: 700;
  color: var(--el-color-primary);
  line-height: 1;
}
</style>

<style>
/* Element Plus 的空状态插画默认使用白色阶梯，深色背景下会显得过亮。 */
html.dark .screen-recorder-page .el-empty {
  --el-empty-fill-color-0: #30323a;
  --el-empty-fill-color-1: #2c2e35;
  --el-empty-fill-color-2: #34363f;
  --el-empty-fill-color-3: #33353e;
  --el-empty-fill-color-4: #3d3f49;
  --el-empty-fill-color-5: #3c3e48;
  --el-empty-fill-color-6: #42444e;
  --el-empty-fill-color-7: #464852;
  --el-empty-fill-color-8: #4a4c56;
  --el-empty-fill-color-9: #525461;
}
</style>
