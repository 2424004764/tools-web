import type { CSSProperties } from 'vue'
import spriteCoords from './sprite-coords.json'
// 用 ?url 让 vite 给资源加 contenthash，自动 cache busting。
// 旧方案：放在 public/ 下文件名固定，CDN/浏览器缓存命中旧图，与新 sprite-coords.json 错位。
// 新方案：URL 随 hash 变化，每次部署必然下载新图，坐标与图永远一致。
// eslint-disable-next-line import/no-unresolved
import spriteUrl from '@/assets/sprites/tools.png?url'

export interface SpriteCell {
  x: number
  y: number
  w: number
  h: number
}

export type SpriteLogoStyle = Pick<
  CSSProperties,
  | 'backgroundImage'
  | 'backgroundPosition'
  | 'backgroundRepeat'
  | 'backgroundSize'
  | 'width'
  | 'height'
>

export interface SpriteLogoResult {
  /** 准备直接绑到 :style 的对象；找不到坐标时为 null（让调用方决定 fallback） */
  style: SpriteLogoStyle | null
  /** 屏幕显示尺寸（Retina 下 sprite 80px 显示成 40px） */
  displaySize: number
}

/** 精灵图源 URL（vite 在构建时替换为带 contenthash 的资源路径，自动 cache busting） */
export const SPRITE_URL = spriteUrl

/** sprite 里每格实际像素（Retina @2x，CSS 仍以 40px 显示） */
export const SPRITE_CELL_PX = 80

/**
 * 从坐标数据中动态计算精灵图总尺寸。
 * 之前硬编码 17 行 → 新增工具后行数变化 → backgroundSize 与实际图片不匹配 → logo 位置全错。
 * 现在从 JSON 中的最大 x/y 反推，行列数无论如何变化都自动同步。
 */
function computeSpriteDimensions(coords: Record<string, SpriteCell>) {
  const PAD = 4
  const STRIDE = SPRITE_CELL_PX + PAD
  const cells = Object.values(coords)
  const maxX = cells.length > 0 ? Math.max(...cells.map((c) => c.x)) : 0
  const maxY = cells.length > 0 ? Math.max(...cells.map((c) => c.y)) : 0
  return {
    width: maxX + STRIDE,
    height: maxY + STRIDE,
  }
}

const spriteDimensions = computeSpriteDimensions(spriteCoords as Record<string, SpriteCell>)

/**
 * 根据工具的 logo URL，返回用于 :style 的精灵图样式对象。
 * 找不到坐标时返回 style=null，调用方应回退到原 <img>。
 *
 * displaySize：CSS 像素下的目标尺寸，默认 40px（首页卡片）。
 * 详情页等场景可传 48 / 56 等，函数内部按 scale = displaySize / SPRITE_CELL_PX
 * 同时缩放 backgroundSize 和 backgroundPosition，保证 cell 始终落在 div 中心。
 */
export function useSpriteLogo(tool: { logo: string }, displaySize = SPRITE_CELL_PX / 2): SpriteLogoResult {
  const cell = (spriteCoords as Record<string, SpriteCell | undefined>)[tool.logo]
  if (!cell) {
    return { style: null, displaySize }
  }
  const scale = displaySize / SPRITE_CELL_PX
  return {
    style: {
      backgroundImage: `url(${SPRITE_URL})`,
      backgroundPosition: `-${cell.x * scale}px -${cell.y * scale}px`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${spriteDimensions.width * scale}px ${spriteDimensions.height * scale}px`,
      width: `${displaySize}px`,
      height: `${displaySize}px`,
    },
    displaySize,
  }
}