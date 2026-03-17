/**
 * 公众号排版工具 - 主题配置
 */

export interface ThemeStyles {
  id: string
  // 颜色
  containerBg: string
  textColor: string
  headingColor: string
  linkColor: string
  quoteBg: string
  quoteBorder: string
  codeBg: string
  borderColor: string
  // 字体
  fontFamily: string
  headingWeight: string
  // 样式
  containerShadow: string
  containerRadius: string
  headingBorder: string
  quoteStyle: string // left, solid, bg
  // 装饰
  headingDecoration: string // none, underline, bg, side-line
  containerBorder: string
  // 间距
  headingSpacing: string
  paragraphSpacing: string
  listIndent: string
}

export interface Theme {
  id: string
  name: string
  description: string
  previewColor: string // 用于主题选择器的预览色块
  styles: ThemeStyles
}

export const themes: Theme[] = [
  {
    id: 'simple',
    name: '简约风格',
    description: '干净清爽，适合日常文章',
    previewColor: '#ffffff',
    styles: {
      id: 'simple',
      containerBg: '#ffffff',
      textColor: '#3f3f3f',
      headingColor: '#000000',
      linkColor: '#576b95',
      quoteBg: '#f7f7f7',
      quoteBorder: '#d1d1d1',
      codeBg: '#f0f0f0',
      borderColor: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      headingWeight: '600',
      containerShadow: 'none',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'left',
      headingDecoration: 'none',
      containerBorder: 'none',
      headingSpacing: '1.4em',
      paragraphSpacing: '1.8em',
      listIndent: '20px',
    }
  },
  {
    id: 'business',
    name: '商务风格',
    description: '专业严谨，适合商业文档',
    previewColor: '#f0f7ff',
    styles: {
      id: 'business',
      containerBg: '#ffffff',
      textColor: '#333333',
      headingColor: '#1a1a1a',
      linkColor: '#1890ff',
      quoteBg: '#f0f7ff',
      quoteBorder: '#1890ff',
      codeBg: '#f6f8fa',
      borderColor: '#d9d9d9',
      fontFamily: '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
      headingWeight: '700',
      containerShadow: '0 2px 8px rgba(0,0,0,0.08)',
      containerRadius: '4px',
      headingBorder: 'bottom',
      quoteStyle: 'solid',
      headingDecoration: 'underline',
      containerBorder: 'none',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '24px',
    }
  },
  {
    id: 'literary',
    name: '文艺风格',
    description: '楷体古韵，适合文化内容',
    previewColor: '#fffbf0',
    styles: {
      id: 'literary',
      containerBg: '#fffbf0',
      textColor: '#4a4a4a',
      headingColor: '#8b4513',
      linkColor: '#cd853f',
      quoteBg: '#fff8dc',
      quoteBorder: '#daa520',
      codeBg: '#ffefd5',
      borderColor: '#deb887',
      fontFamily: '"Kaiti SC", "STKaiti", "KaiTi", "楷体", serif',
      headingWeight: '600',
      containerShadow: 'none',
      containerRadius: '8px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'side-line',
      containerBorder: 'none',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '22px',
    }
  },
  {
    id: 'night',
    name: '深色模式',
    description: '护眼舒适，适合技术文章',
    previewColor: '#f5f5f5',
    styles: {
      id: 'night',
      containerBg: '#f5f5f5',
      textColor: '#2c3e50',
      headingColor: '#1a1a1a',
      linkColor: '#2980b9',
      quoteBg: '#ecf0f1',
      quoteBorder: '#2980b9',
      codeBg: '#f8f9fa',
      borderColor: '#bdc3c7',
      fontFamily: '"SF Mono", "Monaco", "Consolas", "Liberation Mono", monospace',
      headingWeight: '600',
      containerShadow: 'none',
      containerRadius: '8px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'bg',
      containerBorder: 'none',
      headingSpacing: '1.4em',
      paragraphSpacing: '1.7em',
      listIndent: '24px',
    }
  },
  {
    id: 'elegant',
    name: '优雅风格',
    description: '渐变背景，适合时尚内容',
    previewColor: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
    styles: {
      id: 'elegant',
      containerBg: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
      textColor: '#2c3e50',
      headingColor: '#34495e',
      linkColor: '#9b59b6',
      quoteBg: '#f0f3f7',
      quoteBorder: '#9b59b6',
      codeBg: '#eef2f7',
      borderColor: '#d5dbdf',
      fontFamily: '"Georgia", "Times New Roman", serif',
      headingWeight: '600',
      containerShadow: '0 8px 32px rgba(0,0,0,0.06)',
      containerRadius: '16px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'none',
      containerBorder: 'none',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '26px',
    }
  },
  {
    id: 'vibrant',
    name: '活力风格',
    description: '橙色系配色，适合活力主题',
    previewColor: '#fffaf0',
    styles: {
      id: 'vibrant',
      containerBg: '#ffffff',
      textColor: '#2d3748',
      headingColor: '#1a202c',
      linkColor: '#ed8936',
      quoteBg: '#fffaf0',
      quoteBorder: '#ed8936',
      codeBg: '#fff5eb',
      borderColor: '#fed7aa',
      fontFamily: '"Segoe UI", "Roboto", "Oxygen", "Ubuntu", sans-serif',
      headingWeight: '700',
      containerShadow: '0 4px 20px rgba(237, 137, 54, 0.15)',
      containerRadius: '12px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'bg',
      containerBorder: '2px solid #fed7aa',
      headingSpacing: '1.4em',
      paragraphSpacing: '1.8em',
      listIndent: '22px',
    }
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    description: '霓虹荧光，科技感十足',
    previewColor: '#0a0a0a',
    styles: {
      id: 'cyberpunk',
      containerBg: '#0a0a0a',
      textColor: '#e0e0e0',
      headingColor: '#ff00ff',
      linkColor: '#00ffff',
      quoteBg: 'linear-gradient(135deg, rgba(255, 0, 255, 0.1) 0%, rgba(0, 255, 255, 0.1) 100%)',
      quoteBorder: '#ff00ff',
      codeBg: '#1a1a2e',
      borderColor: '#ff00ff',
      fontFamily: '"Orbitron", "Rajdhani", "Segoe UI", sans-serif',
      headingWeight: '900',
      containerShadow: '0 0 40px rgba(255, 0, 255, 0.5), 0 0 80px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(255, 0, 255, 0.1)',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '3px solid transparent',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '28px',
    }
  },
  {
    id: 'neon',
    name: '霓虹之夜',
    description: '高对比霓虹配色',
    previewColor: '#0d0d0d',
    styles: {
      id: 'neon',
      containerBg: '#0d0d0d',
      textColor: '#ffffff',
      headingColor: '#ffff00',
      linkColor: '#ff0066',
      quoteBg: 'rgba(255, 0, 102, 0.15)',
      quoteBorder: '#ff0066',
      codeBg: '#1a1a1a',
      borderColor: '#00ff00',
      fontFamily: '"Arial Black", "Impact", sans-serif',
      headingWeight: '900',
      containerShadow: '0 0 30px rgba(255, 0, 102, 0.6), 0 0 60px rgba(0, 255, 0, 0.4)',
      containerRadius: '8px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '4px solid #ff0066',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '24px',
    }
  },
  {
    id: 'aurora',
    name: '极光幻境',
    description: '绚丽渐变，梦幻视觉',
    previewColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%)',
    styles: {
      id: 'aurora',
      containerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
      textColor: '#ffffff',
      headingColor: '#ffffff',
      linkColor: '#ffff00',
      quoteBg: 'rgba(255, 255, 255, 0.2)',
      quoteBorder: '#ffffff',
      codeBg: 'rgba(0, 0, 0, 0.3)',
      borderColor: 'rgba(255, 255, 255, 0.3)',
      fontFamily: '"Poppins", "Montserrat", sans-serif',
      headingWeight: '800',
      containerShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      containerRadius: '20px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'none',
      containerBorder: 'none',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '26px',
    }
  },
  {
    id: 'metal',
    name: '金属机甲',
    description: '金属质感，硬核风格',
    previewColor: '#2c2c2c',
    styles: {
      id: 'metal',
      containerBg: '#2c2c2c',
      textColor: '#e8e8e8',
      headingColor: '#c9c9c9',
      linkColor: '#4a9eff',
      quoteBg: 'linear-gradient(90deg, rgba(74, 158, 255, 0.1) 0%, rgba(192, 192, 192, 0.05) 100%)',
      quoteBorder: '#808080',
      codeBg: '#1a1a1a',
      borderColor: '#606060',
      fontFamily: '"Rajdhani", "Orbitron", "Segoe UI", sans-serif',
      headingWeight: '700',
      containerShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
      containerRadius: '4px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'side-line',
      containerBorder: '2px solid #404040',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.8em',
      listIndent: '24px',
    }
  },
  {
    id: 'candy',
    name: '糖果梦境',
    description: '甜美可爱，粉色系',
    previewColor: '#fff5f8',
    styles: {
      id: 'candy',
      containerBg: '#fff5f8',
      textColor: '#6b4c6a',
      headingColor: '#ff69b4',
      linkColor: '#ff1493',
      quoteBg: '#ffe4ec',
      quoteBorder: '#ff69b4',
      codeBg: '#fff0f5',
      borderColor: '#ffb6d9',
      fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif',
      headingWeight: '800',
      containerShadow: '0 8px 30px rgba(255, 105, 180, 0.25)',
      containerRadius: '24px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'bg',
      containerBorder: '4px dashed #ffb6d9',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '26px',
    }
  },
  {
    id: 'synthwave',
    name: '合成波',
    description: '80年代复古电子风',
    previewColor: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%)',
    styles: {
      id: 'synthwave',
      containerBg: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      textColor: '#ff6ec7',
      headingColor: '#ff6ec7',
      linkColor: '#00ffff',
      quoteBg: 'linear-gradient(90deg, rgba(255, 110, 199, 0.2) 0%, rgba(0, 255, 255, 0.1) 100%)',
      quoteBorder: '#ff6ec7',
      codeBg: 'rgba(15, 12, 41, 0.8)',
      borderColor: '#ff6ec7',
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      headingWeight: '900',
      containerShadow: '0 0 50px rgba(255, 110, 199, 0.6), inset 0 0 30px rgba(0, 255, 255, 0.1)',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '4px solid #00ffff',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '30px',
    }
  },
  {
    id: 'glitch',
    name: '故障艺术',
    description: '赛博故障风格',
    previewColor: '#000000',
    styles: {
      id: 'glitch',
      containerBg: '#000000',
      textColor: '#00ff00',
      headingColor: '#ff0000',
      linkColor: '#00ffff',
      quoteBg: 'rgba(255, 0, 0, 0.1)',
      quoteBorder: '#ff0000',
      codeBg: '#0a0a0a',
      borderColor: '#00ff00',
      fontFamily: '"Courier New", "Consolas", monospace',
      headingWeight: '900',
      containerShadow: '0 0 20px rgba(0, 255, 0, 0.8), 0 0 40px rgba(255, 0, 0, 0.4)',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '2px solid #00ff00',
      headingSpacing: '1.4em',
      paragraphSpacing: '1.8em',
      listIndent: '22px',
    }
  },
]

/**
 * 根据主题ID获取主题
 */
export function getThemeById(id: string): Theme | undefined {
  return themes.find(t => t.id === id)
}

/**
 * 根据主题ID获取主题名称
 */
export function getThemeName(id: string): string {
  const theme = getThemeById(id)
  return theme?.name || '未知主题'
}

/**
 * 根据主题ID获取主题样式
 */
export function getThemeStyles(id: string): ThemeStyles {
  const theme = getThemeById(id)
  return theme?.styles || themes[0].styles
}
