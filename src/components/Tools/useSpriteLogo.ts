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
  'backgroundImage' | 'backgroundPosition' | 'backgroundRepeat' | 'width' | 'height'
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

/**
 * 根据工具的 logo URL，返回用于 :style 的精灵图样式对象。
 * 找不到坐标时返回 style=null，调用方应回退到原 <img>。
 */
export function useSpriteLogo(tool: { logo: string }): SpriteLogoResult {
  const cell = (spriteCoords as Record<string, SpriteCell | undefined>)[tool.logo]
  if (!cell) {
    return { style: null, displaySize: SPRITE_CELL_PX / 2 }
  }
  return {
    style: {
      backgroundImage: `url(${SPRITE_URL})`,
      backgroundPosition: `-${cell.x}px -${cell.y}px`,
      backgroundRepeat: 'no-repeat',
      width: `${SPRITE_CELL_PX / 2}px`,
      height: `${SPRITE_CELL_PX / 2}px`,
    },
    displaySize: SPRITE_CELL_PX / 2,
  }
}