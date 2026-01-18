// 修复 qrcode-vue3 的类型问题
declare module 'qrcode-vue3' {
  import { DefineComponent } from 'vue'

  export const QRCodeVue3: DefineComponent<{
    value: string
    size?: number
    level?: string
    renderAs?: 'canvas' | 'svg'
    margin?: number
    background?: string
    foreground?: string
    image?: string
    imageSrc?: string
    loadImage?: boolean
    qa?: boolean
    class?: string
    id?: string
  }>

  export default QRCodeVue3
}
