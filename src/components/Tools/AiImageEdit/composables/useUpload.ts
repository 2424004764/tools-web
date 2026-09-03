// 上传区：多图并行数组、增删清、粘贴、缩略图拖拽排序、结果图拖回上传区。
// 生成中（isBatchLoading）不锁上传区：请求的 FormData 在发请求前已构建快照，
// 生成期间改 imageFiles 只影响下一轮，不影响当前批次，所以上传区始终可操作。
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadProps } from 'element-plus'
import Sortable from 'sortablejs'
import { fetchMyGenerationRecordImage } from '@/api/me'
import type { ResultSlot } from './useSlotVisuals'

export const MAX_IMAGES = 16

export function useUpload() {

  const uploadRef = ref<any>(null)
  const imageFiles = ref<File[]>([])
  const imagePreviews = ref<string[]>([])
  const uploadedFileNames = ref<string[]>([])
  // 与上面三个数组严格对齐的唯一 id。拖拽排序后 Vue 用 :key 跟踪 DOM，
  // 用下标 idx 作为 key 在 reorder 时会让 Vue 误判为「元素被替换」而闪烁，
  // 改用与文件一一绑定的稳定 id 才能让 Vue 正确复用 DOM
  const imageIds = ref<string[]>([])
  // 与 imagePreviews 等长的对象数组，每项含 aspect-ratio 字符串和 gridColumnSpan。
  // aspectRatio 让 grid cell 按图实际比例伸缩，9:16 长图不会被裁掉；
  // gridColumnSpan 让宽图（ratio>=1.6）横跨 2 列，避免被 1fr 等分列压扁成细条。
  // 解析异步、不阻塞预览显示。
  type AspectStyle = { aspectRatio: string; gridColumnSpan: number }
  const imageAspectStyles = ref<AspectStyle[]>([])
  // 缩略图网格 ref：用于挂载 Sortable
  const imageGridRef = ref<HTMLElement | null>(null)

  const canAddMore = computed(() => imageFiles.value.length < MAX_IMAGES)
  const remainingSlots = computed(() => MAX_IMAGES - imageFiles.value.length)

  // 根据宽高比算列数：宽图 span 2 让 2:1 横图能横着展开不被压扁，
  // 其它（竖图、方图）保持 span 1 不浪费横向空间。
  // 单图模式（is-single）不参与此逻辑，由 CSS 直接撑满横向。
  const calcSpan = (w: number, h: number): number => {
    const ratio = w / h
    if (ratio >= 1.6) return 2   // 2:1、16:9 这类横图 span 2
    return 1
  }

  // 从 dataURL 解析图片宽高比，同步填充 imageAspectStyles[idx]。
  // dataURL 在浏览器里是同步可解码的，new Image() + src 之后立刻能读 naturalWidth/Height，
  // 不需要 onload 回调——这样缩略图容器从一开始就贴合真实比例，2:1 这类长图不会再
  // 被默认正方形容器挤成一小条。失败时（罕见）再走 onload 兜底，极端情况走默认。
  const probeAspect = (dataUrl: string, idx: number) => {
    const img = new Image()
    const fill = () => {
      if (!img.naturalWidth || !img.naturalHeight) return
      const aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`
      imageAspectStyles.value[idx] = {
        aspectRatio,
        gridColumnSpan: calcSpan(img.naturalWidth, img.naturalHeight),
      }
    }
    img.onload = fill
    img.src = dataUrl
    // 同步读取（dataURL 数据已内嵌，浏览器立刻能解析出原始尺寸）
    fill()
  }

  // el-upload onChange：每次新增/移除文件都会触发，仅处理新增。
  // auto-upload=false 时 status='ready' 即代表「刚被加入内部列表」。
  const handleChange: UploadProps['onChange'] = (uploadFile) => {
    if (uploadFile.status === 'ready' && uploadFile.raw) {
      addImageFiles([uploadFile.raw])
    }
    // 立刻清空 el-upload 内部列表，避免内部累积导致下次选择时 onExceed 误判
    uploadRef.value?.clearFiles()
  }

  // onExceed：超过 MAX_IMAGES 触发。直接提示，由用户自己处理。
  const handleExceed: UploadProps['onExceed'] = () => {
    ElMessage.warning(`最多上传 ${MAX_IMAGES} 张图片`)
  }

  // 关闭 auto-upload 之后 http-request 不会再被调到，留个空实现兜底
  const handleUpload = (_options: any): Promise<void> => {
    return Promise.resolve()
  }

  // 追加图片：超过上限的部分静默丢弃并提示
  const addImageFiles = (files: File[]) => {
    let added = 0
    for (const file of files) {
      if (!canAddMore.value) {
        ElMessage.warning(`已达上限 ${MAX_IMAGES} 张`)
        break
      }
      if (!file.type.startsWith('image/')) {
        ElMessage.error(`已跳过非图片文件：${file.name || '未知'}`)
        continue
      }
      imageFiles.value.push(file)
      uploadedFileNames.value.push(file.name || 'image.png')
      imageIds.value.push(crypto.randomUUID())
      const reader = new FileReader()
      reader.onload = (e) => {
        // 同步追加到预览数组，保持索引一致
        const url = e.target?.result as string
        imagePreviews.value.push(url)
        // 异步探测宽高比，9:16 等长图上传时 grid cell 能随之拉高，缩略图不会被裁
        probeAspect(url, imagePreviews.value.length - 1)
      }
      reader.readAsDataURL(file)
      added++
    }
    if (added > 0) {
      ElMessage.success(added === 1 ? '图片已就绪' : `已添加 ${added} 张图片（共 ${imageFiles.value.length}/${MAX_IMAGES}）`)
      // 缩略图数量变化后重新挂 Sortable（addImageFiles 也用于拖拽回填，DOM 在那里被替换）
      nextTick(() => initImageSortable())
    }
  }

  // 移除指定索引的图片（生成中也可操作）
  const removeImage = (idx: number) => {
    imageFiles.value.splice(idx, 1)
    imagePreviews.value.splice(idx, 1)
    uploadedFileNames.value.splice(idx, 1)
    imageIds.value.splice(idx, 1)
    imageAspectStyles.value.splice(idx, 1)
  }

  // 清空全部图片（生成中也可操作）
  const clearAllImages = () => {
    imageFiles.value = []
    imagePreviews.value = []
    uploadedFileNames.value = []
    imageIds.value = []
    imageAspectStyles.value = []
    uploadRef.value?.clearFiles()
    nextTick(() => destroyImageSortable())
  }

  // 粘贴图片支持：追加到列表（已有图时继续往后加）
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) {
          const file = new File([blob], `clipboard-${Date.now()}.png`, { type: blob.type })
          addImageFiles([file])
        }
        return
      }
    }
  }

  // ============ 拖拽支持：生成结果可直接拖回上传区 ============
  // 自定义 MIME，dataTransfer 用它区分「来自本页结果」与「外部文件」。
  // 同时写 text/uri-list 与 text/plain，让拖到浏览器其他位置（标签页、外部编辑器）也能用。
  const RESULT_DRAG_MIME = 'application/x-ai-image-edit-result'
  const isDragOver = ref(false)
  // dragenter/dragleave 在子元素上会反复触发，用计数器在真正离开 dropzone 时才关闭高亮
  let dragCounter = 0
  // 拖拽结果回填中：后端代理拿 blob 通常几百毫秒～几秒，期间在上传区显示 loading 遮罩
  const isRefillingImage = ref(false)
  // 自驱动 spinner：用 requestAnimationFrame 直接改 transform 角度，
  // 绕开 CSS animation / prefers-reduced-motion / 第三方 CSS 注入缺失等问题。
  const spinnerRef = ref<HTMLDivElement | null>(null)
  let spinnerRafId = 0
  let spinnerAngle = 0
  const startSpinner = () => {
    if (!spinnerRef.value || spinnerRafId) return
    const tick = () => {
      spinnerAngle = (spinnerAngle + 6) % 360
      if (spinnerRef.value) spinnerRef.value.style.transform = `rotate(${spinnerAngle}deg)`
      spinnerRafId = requestAnimationFrame(tick)
    }
    tick()
  }
  const stopSpinner = () => {
    if (spinnerRafId) { cancelAnimationFrame(spinnerRafId); spinnerRafId = 0 }
  }
  // isRefillingImage 切换时同步启停 spinner；用 nextTick 等到 div 渲染完再取 ref
  watch(isRefillingImage, async (val) => {
    if (val) {
      await nextTick()
      startSpinner()
    } else {
      stopSpinner()
    }
  })

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault()
    dragCounter++
    const types = e.dataTransfer?.types
    if (!types) return
    if (types.includes('Files') || types.includes(RESULT_DRAG_MIME)) {
      isDragOver.value = true
    }
  }

  const onDragOver = (e: DragEvent) => {
    // 必须 preventDefault，否则浏览器不会触发后续的 drop
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCounter = Math.max(0, dragCounter - 1)
    if (dragCounter === 0) isDragOver.value = false
  }

  // 必须在「捕获阶段」监听：el-upload-dragger 内部 onDrop 会显式调用
  // e.stopPropagation()，导致冒泡阶段的外层 @drop 永远收不到事件。
  // capture 模式让我们在子元素处理前先拿到事件，自己决定是否拦截。
  const onUploadDrop = async (e: DragEvent) => {
    // 路径 A：来自本页生成结果（URL → fetch → Blob → File）。
    // dataTransfer 里只有自定义 MIME / text-uri-list，没有真实文件，
    // el-upload 处理会空转，这里要 stopPropagation 抢在自己手里处理。
    // 自定义 MIME 现在是 JSON：{ url, recordId }，每张结果图带自己的 recordId，
    // 拖回上传区时走对应 recordId 的后端代理拿 blob，绕过第三方图床 CORS。
    let resultUrl = ''
    let resultRecordId = ''
    const dragPayload = e.dataTransfer?.getData(RESULT_DRAG_MIME)
    if (dragPayload) {
      try {
        const parsed = JSON.parse(dragPayload)
        if (parsed && typeof parsed === 'object') {
          resultUrl = parsed.url || ''
          resultRecordId = parsed.recordId || ''
        } else if (typeof parsed === 'string') {
          // 兼容旧版纯 URL 字符串
          resultUrl = parsed
        }
      } catch {
        // 非 JSON 时按纯 URL 处理
        resultUrl = dragPayload
      }
    }
    if (!resultUrl) {
      resultUrl = e.dataTransfer?.getData('text/uri-list')?.split('\n')[0] || ''
    }
    if (resultUrl) {
      e.preventDefault()
      e.stopPropagation()
      dragCounter = 0
      isDragOver.value = false
      isRefillingImage.value = true
      try {
        // 第三方图床通常不带 CORS 头，前端 fetch 会失败。
        // 有 recordId 时复用「下载图片」同款后端代理拿 blob，绕过 CORS。
        let blob: Blob
        let filename = 'generated-result.png'
        if (resultRecordId) {
          const res = await fetchMyGenerationRecordImage(resultRecordId)
          blob = res.blob
          if (res.filename) filename = res.filename
        } else {
          // 兜底：极少数情况下没有 recordId（比如上游异常未返回）。
          // 这里有可能被 CORS 拦截，错误由 catch 统一提示。
          const resp = await fetch(resultUrl)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          blob = await resp.blob()
        }
        const file = new File([blob], filename, {
          type: blob.type || 'image/png',
        })
        // 把生成结果作为新图片追加（多图场景下插到末尾，不替换已有图）
        addImageFiles([file])
      } catch (err) {
        ElMessage.error('读取生成结果失败：' + (err as Error)?.message)
      } finally {
        isRefillingImage.value = false
      }
      return
    }

    // 路径 B：从操作系统拖入的真实文件 → 自己处理（el-upload-dragger 默认只取第一个 file，多图 drop 需要拦截）
    // 注意：addImageFiles 会自动跳过非图片文件 + 超出 MAX_IMAGES 的部分
    const droppedFiles = Array.from(e.dataTransfer?.files || [])
    if (droppedFiles.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      addImageFiles(droppedFiles)
    }
    dragCounter = 0
    isDragOver.value = false
  }

  // 结果图灰尘拖出：把 { url, recordId } 写进 dataTransfer
  const onSlotDragStart = (e: DragEvent, slot: ResultSlot) => {
    if (!e.dataTransfer || !slot.url) return
    // 自定义 MIME 用 JSON 携带 {url, recordId}：
    //   - url 给拖回上传区用（fetch blob / 当参考图）
    //   - recordId 给上传区代理走（绕过第三方图床 CORS）
    // text/uri-list 和 text/plain 只放 URL，方便拖到浏览器其他位置/外部编辑器
    const payload = JSON.stringify({ url: slot.url, recordId: slot.recordId })
    e.dataTransfer.setData(RESULT_DRAG_MIME, payload)
    e.dataTransfer.setData('text/uri-list', slot.url)
    e.dataTransfer.setData('text/plain', slot.url)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // ============ 缩略图拖拽排序（HTML5 原生 / Sortable.js）============
  // Sortable 实例：单个网格，挂在 imageGridRef 上
  let imageSortable: Sortable | null = null

  const destroyImageSortable = () => {
    if (imageSortable) {
      imageSortable.destroy()
      imageSortable = null
    }
  }

  // 初始化 / 重建 Sortable
  // - 必须在 thumb DOM 渲染出来后挂载，所以统一用 nextTick 包一层
  // - 「外部文件拖入」由父级 upload-dropzone 的 @drop.capture 处理，
  //   Sortable 仅负责在容器内重排 DOM，不会拦截文件类型 dataTransfer
  const initImageSortable = () => {
    destroyImageSortable()
    const el = imageGridRef.value
    if (!el) return
    if (imageIds.value.length < 2) return  // 只有 0/1 张时挂上也没意义
    imageSortable = Sortable.create(el, {
      animation: 150,
      ghostClass: 'upload-thumb-ghost',
      chosenClass: 'upload-thumb-chosen',
      dragClass: 'upload-thumb-dragging',
      // 延迟 80ms 才进入拖拽，避免和「点击放大」冲突（区分不动 vs 移动）
      delay: 80,
      delayOnTouchOnly: true,
      // 触摸起手在延迟期内移动超过 10px 即取消拖拽并放行滚动，
      // 否则从缩略图上起手滑动页面时前 80ms 会被 preventDefault 卡住
      touchStartThreshold: 10,
      // 生成中也可排序（FormData 已快照，不影响当前批次）
      disabled: false,
      onEnd: handleImageSortEnd,
    })
  }

  // 拖拽结束：同步重排 4 个并行数组（id / file / preview / name）
  // 排序后图片发送给 AI 的顺序与新顺序一致（FormData 按数组顺序写入）
  const handleImageSortEnd = (evt: Sortable.SortableEvent) => {
    const { oldIndex, newIndex } = evt
    if (
      oldIndex == null ||
      newIndex == null ||
      oldIndex === newIndex
    ) return

    const id = imageIds.value.splice(oldIndex, 1)[0]
    const file = imageFiles.value.splice(oldIndex, 1)[0]
    const preview = imagePreviews.value.splice(oldIndex, 1)[0]
    const name = uploadedFileNames.value.splice(oldIndex, 1)[0]
    const aspect = imageAspectStyles.value.splice(oldIndex, 1)[0]
    imageIds.value.splice(newIndex, 0, id)
    imageFiles.value.splice(newIndex, 0, file)
    imagePreviews.value.splice(newIndex, 0, preview)
    uploadedFileNames.value.splice(newIndex, 0, name)
    imageAspectStyles.value.splice(newIndex, 0, aspect)
  }

  // isBatchLoading 曾用于切换 Sortable disabled，现上传区不锁生成中，无需监听

  onMounted(() => {
    // 全局粘贴图片入口（Ctrl+V）
    document.addEventListener('paste', handlePaste)
  })

  onUnmounted(() => {
    document.removeEventListener('paste', handlePaste)
    destroyImageSortable()
    // 兜底停掉回填 spinner 的 rAF（正常路径由 isRefillingImage watch 停，
    // 组件卸载时若仍在回填则必须手动收尾）
    stopSpinner()
  })

  return {
    uploadRef,
    imageFiles,
    imagePreviews,
    uploadedFileNames,
    imageIds,
    imageAspectStyles,
    imageGridRef,
    canAddMore,
    remainingSlots,
    isDragOver,
    isRefillingImage,
    spinnerRef,
    handleChange,
    handleExceed,
    handleUpload,
    addImageFiles,
    removeImage,
    clearAllImages,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onUploadDrop,
    onSlotDragStart,
  }
}