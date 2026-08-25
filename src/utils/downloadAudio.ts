// 跨域音频下载：fetch → Blob → objectURL → 触发 <a download>
//
// 为什么不用 <a download href={r2Url}>：R2.dev 是跨域，浏览器会忽略 download 属性，
// 直接打开音频（部分浏览器还会"播放"）。fetch + blob 在所有现代浏览器表现一致，
// 且能强制指定文件名。30MB 上限对 blob 内存压力也可接受。

export interface DownloadAudioOptions {
  /** 下载文件名（必传，由调用方按 mime + 标题生成） */
  filename: string
  /** 显示给用户的提示，可选 */
  loadingTip?: string
}

export async function downloadAudio(
  url: string,
  options: DownloadAudioOptions
): Promise<void> {
  if (!url) throw new Error('下载地址为空')

  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`)

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)

  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = options.filename
    a.rel = 'noopener noreferrer'
    // 部分浏览器（Firefox）要求 a 必须在 DOM 里才触发 click
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // 下一帧再释放，确保浏览器已开始下载
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}