import type { CSSProperties } from 'vue'
import spriteCoords from './sprite-coords.json'

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

/** 精灵图源 URL，public/sprites/tools.png */
export const SPRITE_URL = '/sprites/tools.png'

/** sprite 里每格实际像素（Retina @2x，CSS 仍以 40px 显示） */
export const SPRITE_CELL_PX = 80

/** sprite 整体尺寸（8 列 × 17 行 × STRIDE 84）；由构建脚本保证 */
const SPRITE_TOTAL_W = 8 * (80 + 4)
const SPRITE_TOTAL_H = 17 * (80 + 4)

/**
 * 根据工具的 logo URL，返回用于 :style 的精灵图样式对象。
 * 找不到坐标时返回 style=null，调用方应回退到原 <img>。
 *
 * 关键：背景尺寸是 sprite 原尺寸的一半，让 80px 的格子显示成 40px。
 * 不缩放的话 div 只显示每格的左上 1/4（用户已踩过这个坑）。
 */
export function useSpriteLogo(tool: { logo: string }): SpriteLogoResult {
  const cell = (spriteCoords as Record<string, SpriteCell | undefined>)[tool.logo]
  if (!cell) {
    return { style: null, displaySize: SPRITE_CELL_PX / 2 }
  }
  const display = SPRITE_CELL_PX / 2  // 40px
  return {
    style: {
      backgroundImage: `url(${SPRITE_URL})`,
      backgroundPosition: `-${cell.x / 2}px -${cell.y / 2}px`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${SPRITE_TOTAL_W / 2}px ${SPRITE_TOTAL_H / 2}px`,
      width: `${display}px`,
      height: `${display}px`,
    },
    displaySize: display,
  }
}