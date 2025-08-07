/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 2048游戏方块颜色
        'tile-2': '#EEE4DA',
        'tile-4': '#EDE0C8',
        'tile-8': '#F2B179',
        'tile-16': '#F59563',
        'tile-32': '#F67C5F',
        'tile-64': '#F65E3B',
        'tile-128': '#EDCF72',
        'tile-256': '#EDCC61',
        'tile-512': '#EDC850',
        'tile-1024': '#EDC53F',
        'tile-2048': '#EDC22E',
        'tile-dark': '#3C3A32',
        // 文字颜色
        'tile-text-dark': '#776E65',
        'tile-text-light': '#F9F6F2',
      }
    },
    screens: {
      // 自定义响应式尺寸
      'c-xs': {'max': '768px'},
      'c-sm': {'min': '768px'}, //相当远默认的md
      'c-md': {'min': '992px'},
      'c-lg': {'min': '1200px'},
      ...defaultTheme.screens,
    },
    animation: {
      fold: 'fold 1s infinite'
    },
    keyframes: {
      fold: {
        '0%, 100%': { 
          opacity: 0
        },  
        '50%': { 
          opacity: 1
        }  
      }
    }
  },
  plugins: [],
}

