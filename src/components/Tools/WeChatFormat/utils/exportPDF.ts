/**
 * PDF 导出支持
 */
import { ElMessage } from 'element-plus'

export async function exportToPDF(
  htmlContent: string,
  title: string = '文档'
): Promise<void> {
  try {
    // 动态加载 html2pdf.js
    const html2pdf = await loadHtml2Pdf()

    // 创建临时容器
    const container = document.createElement('div')
    container.innerHTML = htmlContent
    container.style.padding = '20px'
    container.style.width = '210mm' // A4 宽度
    container.style.background = '#ffffff'
    document.body.appendChild(container)

    // 配置 PDF 选项
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `${title}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4' as const,
        orientation: 'portrait' as const,
      },
    }

    // 生成并下载 PDF
    await html2pdf().set(opt).from(container).save()

    // 清理临时容器
    document.body.removeChild(container)

    ElMessage.success('PDF 导出成功')
  } catch (error) {
    console.error('PDF 导出失败:', error)
    ElMessage.error('PDF 导出失败，请重试')
  }
}

// 动态加载 html2pdf.js
let html2pdfCache: any = null

async function loadHtml2Pdf() {
  if (html2pdfCache) return html2pdfCache

  // 检查是否已加载
  if ((window as any).html2pdf) {
    html2pdfCache = (window as any).html2pdf
    return html2pdfCache
  }

  // 动态加载脚本
  await loadScript('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js')

  html2pdfCache = (window as any).html2pdf
  return html2pdfCache
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * 打印预览（作为 PDF 导出的替代方案）
 */
export function printPreview(htmlContent: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    ElMessage.error('无法打开打印窗口，请检查弹窗设置')
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>打印预览</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20px;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        pre {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
        }
        @media print {
          body { margin: 0; }
        }
      </style>
    </head>
    <body>${htmlContent}</body>
    </html>
  `)
  printWindow.document.close()

  // 等待内容加载完成后显示打印对话框
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}
