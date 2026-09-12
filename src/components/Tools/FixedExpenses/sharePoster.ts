import html2canvas from 'html2canvas'

const waitForImages = async (root: HTMLElement) => {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(image => new Promise<void>(resolve => {
    let timeout = 0
    const done = () => { window.clearTimeout(timeout); image.removeEventListener('load', done); image.removeEventListener('error', done); resolve() }
    if (image.complete && image.naturalWidth > 0) return resolve()
    image.addEventListener('load', done, { once: true }); image.addEventListener('error', done, { once: true }); timeout = window.setTimeout(done, 3000)
  })))
}

export async function captureSharePoster(element: HTMLElement): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  await waitForImages(element)
  const clone = element.cloneNode(true) as HTMLElement
  Object.assign(clone.style, { position: 'absolute', left: '-99999px', top: '0', transform: 'none', transition: 'none', willChange: 'auto', boxShadow: 'none' })
  document.body.appendChild(clone)
  try {
    const canvas = await html2canvas(clone, { backgroundColor: '#fff5f7', useCORS: true, scale: 2, width: 750, height: clone.offsetHeight, windowWidth: 750, windowHeight: clone.offsetHeight, scrollX: 0, scrollY: 0, x: 0, y: 0, onclone: doc => { const poster = doc.querySelector('.fe-share-poster') as HTMLElement | null; if (poster) Object.assign(poster.style, { position: 'absolute', left: '0', top: '0', transform: 'none', visibility: 'visible' }) } })
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('生成分享图片失败')), 'image/png'))
  } finally { clone.remove() }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
