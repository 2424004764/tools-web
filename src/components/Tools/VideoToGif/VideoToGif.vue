<script setup lang="ts">
import { ref, reactive } from "vue"
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { UploadProps, UploadInstance, UploadRawFile, genFileId } from 'element-plus'
import { ElMessage } from 'element-plus'

// 状态管理
const info = reactive({
  title: "视频转GIF动图",
})

const upload = ref<UploadInstance>()
const videoFile = ref<File | null>(null)
const videoUrl = ref<string>('')
const videoElement = ref<HTMLVideoElement>()
const isVideoLoaded = ref(false)
const isGenerating = ref(false)
const generatedGifUrl = ref<string>('')
const generatedGifBlob = ref<Blob | null>(null)
const progress = ref(0)

const videoSettings = reactive({
  startTime: 0,
  endTime: 5,
  fps: 8,
  width: 320,
})

const currentTime = ref(0)
const videoDuration = ref(0)

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const uploadChange: UploadProps['onChange'] = async (file) => {
  const rawFile = file.raw
  if (!rawFile) return

  if (!rawFile.type.startsWith('video/')) {
    ElMessage.warning('请选择视频文件')
    return
  }

  if (rawFile.size > 50 * 1024 * 1024) {
    ElMessage.warning('视频文件不能超过50MB')
    return
  }

  videoFile.value = rawFile
  videoUrl.value = URL.createObjectURL(rawFile)
  generatedGifUrl.value = ''
  generatedGifBlob.value = null
  isVideoLoaded.value = false
  videoDuration.value = 0
}

const uploadExceed: UploadProps['onExceed'] = (files) => {
  upload.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  upload.value!.handleStart(file)
}

const onVideoLoaded = () => {
  if (videoElement.value) {
    videoDuration.value = videoElement.value.duration
    videoSettings.endTime = Math.min(5, videoDuration.value)
    videoSettings.startTime = 0
    isVideoLoaded.value = true
    ElMessage.success('视频加载成功')
  }
}

const onTimeUpdate = () => {
  if (videoElement.value) {
    currentTime.value = videoElement.value.currentTime
  }
}

const seekTo = (time: number) => {
  if (videoElement.value) {
    videoElement.value.currentTime = time
  }
}

// 加载 gifshot 库（使用本地文件）
const loadGifshot = async (): Promise<any> => {
  if ((window as any).gifshot) {
    return (window as any).gifshot
  }

  // 先尝试本地文件
  const localUrl = '/lib/gifshot.min.js'

  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = localUrl
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Local file failed'))
      document.head.appendChild(script)
    })
    if ((window as any).gifshot) {
      console.log('Using local gifshot')
      return (window as any).gifshot
    }
  } catch (e) {
    console.warn('Local file failed, trying CDN...')
  }

  // 备用CDN
  const cdnUrls = [
    'https://cdn.bootcdn.net/ajax/libs/gifshot/0.3.2/gifshot.min.js',
    'https://lib.baomitu.com/gifshot/0.3.2/gifshot.min.js',
  ]

  for (const url of cdnUrls) {
    try {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = url
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed: ${url}`))
        document.head.appendChild(script)
      })
      if ((window as any).gifshot) {
        console.log('Loaded from:', url)
        return (window as any).gifshot
      }
    } catch (e) {
      console.warn(`Failed ${url}`)
    }
  }

  throw new Error('无法加载GIF库')
}

const generateGif = async () => {
  if (!videoUrl.value || !videoElement.value) {
    ElMessage.warning('请先上传视频')
    return
  }

  const video = videoElement.value
  const duration = videoSettings.endTime - videoSettings.startTime

  if (duration <= 0) {
    ElMessage.warning('结束时间必须大于开始时间')
    return
  }

  isGenerating.value = true
  progress.value = 0

  try {
    // 加载库
    ElMessage.info('正在加载GIF库...')
    const gifshot = await loadGifshot()
    progress.value = 10

    video.pause()

    const numFrames = Math.floor(duration * videoSettings.fps)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const height = Math.floor(videoSettings.width * (video.videoHeight / video.videoWidth))
    canvas.width = videoSettings.width
    canvas.height = height

    const frameDataUrls: string[] = []

    // 捕获帧
    for (let i = 0; i < numFrames; i++) {
      const time = videoSettings.startTime + (i / videoSettings.fps)
      video.currentTime = time

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          frameDataUrls.push(canvas.toDataURL('image/jpeg', 0.8))
          progress.value = 10 + Math.floor((i + 1) / numFrames * 70)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
      })
    }

    // 生成GIF
    progress.value = 85
    ElMessage.info('正在生成GIF...')

    await new Promise<void>((resolve, reject) => {
      gifshot.createGIF({
        images: frameDataUrls,
        gifWidth: videoSettings.width,
        gifHeight: height,
        interval: 1 / videoSettings.fps,
        sampleInterval: 10,
        numWorkers: 1,
      }, (obj: any) => {
        progress.value = 100
        if (!obj.error) {
          generatedGifUrl.value = obj.image

          // 转换为Blob
          const byteString = atob(obj.image.split(',')[1])
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
          }
          generatedGifBlob.value = new Blob([ab], { type: 'image/gif' })

          ElMessage.success('GIF生成成功！')
          resolve()
        } else {
          reject(new Error(obj.errorMsg || '生成失败'))
        }
      })
    })

    video.currentTime = videoSettings.startTime

  } catch (error: any) {
    ElMessage.error('错误: ' + error.message)
    console.error(error)
  } finally {
    isGenerating.value = false
  }
}

const downloadGif = () => {
  if (!generatedGifBlob.value) return

  const url = URL.createObjectURL(generatedGifBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = `video-to-gif-${Date.now()}.gif`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  ElMessage.success('下载成功')
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="flex flex-col gap-4">
      <div class="bg-white rounded-2xl p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-700">1. 上传视频</h3>
          <el-upload
            ref="upload"
            :limit="1"
            @exceed="uploadExceed"
            accept="video/*"
            @change="uploadChange"
            :auto-upload="false"
            :show-file-list="false"
          >
            <template #trigger>
              <el-button type="primary">
                <template v-if="!videoFile">选择视频</template>
                <template v-else>重新选择</template>
              </el-button>
            </template>
          </el-upload>
        </div>

        <div v-if="videoUrl" class="video-container">
          <div class="relative bg-black rounded-lg overflow-hidden">
            <video
              ref="videoElement"
              :src="videoUrl"
              class="w-full max-h-64 mx-auto"
              controls
              @loadedmetadata="onVideoLoaded"
              @timeupdate="onTimeUpdate"
              crossorigin="anonymous"
            ></video>
          </div>
          <div class="mt-2 text-sm text-gray-500 text-center">
            时长: {{ formatTime(videoDuration) }} | 当前: {{ formatTime(currentTime) }}
          </div>
        </div>
      </div>

      <div v-if="isVideoLoaded" class="bg-white rounded-2xl p-4">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">2. 设置参数</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <h4 class="font-medium text-gray-600">时间范围（秒）</h4>

            <div class="space-y-3">
              <div>
                <div class="flex justify-between text-sm text-gray-500 mb-1">
                  <span>开始时间</span>
                  <span>{{ videoSettings.startTime.toFixed(1) }}s</span>
                </div>
                <el-slider
                  v-model="videoSettings.startTime"
                  :min="0"
                  :max="Math.max(videoSettings.endTime - 0.5, videoDuration - 0.5)"
                  :step="0.1"
                  @input="seekTo(videoSettings.startTime)"
                ></el-slider>
              </div>

              <div>
                <div class="flex justify-between text-sm text-gray-500 mb-1">
                  <span>结束时间</span>
                  <span>{{ videoSettings.endTime.toFixed(1) }}s</span>
                </div>
                <el-slider
                  v-model="videoSettings.endTime"
                  :min="videoSettings.startTime + 0.5"
                  :max="videoDuration"
                  :step="0.1"
                ></el-slider>
              </div>

              <div class="p-3 bg-gray-50 rounded-lg">
                <div class="flex justify-between items-center">
                  <span class="text-sm text-gray-600">选取时长:</span>
                  <span class="text-lg font-semibold text-blue-600">
                    {{ (videoSettings.endTime - videoSettings.startTime).toFixed(1) }}秒
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h4 class="font-medium text-gray-600">GIF参数</h4>

            <div class="space-y-3">
              <div>
                <div class="flex justify-between text-sm text-gray-500 mb-1">
                  <span>宽度</span>
                  <span>{{ videoSettings.width }}px</span>
                </div>
                <el-slider
                  v-model="videoSettings.width"
                  :min="100"
                  :max="640"
                  :step="10"
                ></el-slider>
              </div>

              <div>
                <div class="flex justify-between text-sm text-gray-500 mb-1">
                  <span>帧率 (FPS)</span>
                  <span>{{ videoSettings.fps }}</span>
                </div>
                <el-slider
                  v-model="videoSettings.fps"
                  :min="5"
                  :max="12"
                  :step="1"
                ></el-slider>
                <div class="text-xs text-gray-400 mt-1">建议5-8帧</div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-center">
          <el-button
            type="primary"
            size="large"
            :loading="isGenerating"
            @click="generateGif"
          >
            <template v-if="!isGenerating">
              <span class="mr-2">🎬</span> 生成GIF
            </template>
            <template v-else>
              生成中... {{ progress }}%
            </template>
          </el-button>
        </div>

        <div v-if="isGenerating" class="mt-4">
          <el-progress
            :percentage="progress"
            :stroke-width="20"
            status="success"
          ></el-progress>
          <div class="text-sm text-gray-500 mt-2 text-center">
            正在加载库并生成GIF，请稍候...
          </div>
        </div>
      </div>

      <div v-if="generatedGifUrl" class="bg-white rounded-2xl p-4">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">3. 预览与下载</h3>

        <div class="flex flex-col items-center">
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <img
              :src="generatedGifUrl"
              alt="生成的GIF"
              class="max-w-full rounded shadow-md"
            />
          </div>

          <div v-if="generatedGifBlob" class="mt-4 text-center">
            <p class="text-sm text-gray-500 mb-3">
              文件大小: {{ (generatedGifBlob.size / 1024).toFixed(2) }} KB
            </p>
            <el-button type="success" size="large" @click="downloadGif">
              <span class="mr-2">⬇️</span> 下载GIF
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <div class="space-y-3 text-gray-600">
        <p><strong>功能特点：</strong></p>
        <ul class="list-disc list-inside space-y-1">
          <li>纯前端处理，视频不上传服务器</li>
          <li>支持自定义视频片段选择</li>
          <li>可调节GIF宽度和帧率</li>
        </ul>
        <p class="mt-3"><strong>使用提示：</strong></p>
        <ul class="list-disc list-inside space-y-1">
          <li>视频文件建议不超过50MB</li>
          <li>建议GIF时长控制在5秒以内</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.video-container video {
  display: block;
}
</style>
