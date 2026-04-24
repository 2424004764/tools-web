<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: '好物网站导航',
})

type LinkItem = { title: string; url: string; desc?: string; logo?: string; rating?: number }
type Cate = { title: string; list: LinkItem[] }

const cates: Cate[] = [
  {
    title: 'APK文件托管分享',
    list: [
      {
        title: 'Upload.app',
        url: 'https://upload.app/',
        rating: 4.5,
        desc: '海外APK文件托管存储分享平台，支持上传APK/XAPK文件，提供病毒检查保证安全性，可查看网友分享的破解版APK，体验优秀的文件托管服务'
      },
    ],
  },
  {
    title: '开发工具',
    list: [
      {
        title: 'Adoptium',
        url: 'https://adoptium.net/',
        rating: 4.9,
        desc: 'Eclipse基金会官方Java运行时发行版，提供Eclipse Temurin® OpenJDK二进制文件。支持Java 8/11/17/21/24等版本，跨平台兼容Windows/macOS/Linux，提供x64/arm64架构支持，经过TCK认证和AQAvit验证，企业级质量保证'
      },
    ],
  },
  {
    title: '图床/图片托管',
    list: [
      {
        title: 'PICUI 图床',
        url: 'https://picui.cn/upload',
        rating: 4.7,
        desc: '免费图床，单图≤10MB，最多同时上传5张，拖拽上传，自动生成URL/HTML/BBCode/Markdown等链接格式'
      },
      {
        title: 'MJJ图床',
        url: 'https://mjj.today/',
        rating: 4.6,
        desc: '免费图床服务，支持图片上传和托管，提供稳定的图片外链服务'
      },
    ],
  },
  {
    title: '视频下载',
    list: [
      {
        title: 'GreenVideo',
        url: 'https://greenvideo.cc/',
        rating: 4.8,
        desc: '支持全球众多视频平台下载，包括Instagram、哔哩哔哩（B站）、抖音、Facebook、Weverse等各大视频平台以及社交网络。提供视频/音频/图片下载功能，支持未知或新视频站的探索能力，是一个全方位的媒体下载神器'
      },
    ],
  },
  {
    title: '技术社区',
    list: [
      {
        title: 'Linux.do',
        url: 'https://linux.do/',
        rating: 4.8,
        desc: '综合性技术论坛社区，内容涵盖广泛。包含开发调优、资源荟萃、文档共建、前沿快讯、跳蚤市场、求职招聘、创业推广、福利羊毛、闲聊娱乐等多样化版块，支持标签分类和权限分级，是一个活跃的技术交流平台'
      }
    ],
  },
  {
    title: '免费资源',
    list: [
      {
        title: 'FMHY',
        url: 'https://fmhy.net/',
        rating: 4.9,
        desc: '互联网上最大的免费资源集合！提供流媒体、下载、种子、游戏、阅读、教育等各类免费内容导航，涵盖广告拦截、AI工具、Android/iOS应用、Linux/macOS软件等丰富分类，是寻找免费资源的首选平台'
      },
    ],
  },
  {
    title: 'AI资源',
    list: [
      {
        title: '提示词仓库',
        url: 'https://docs.google.com/spreadsheets/d/1ngoQOhJqdguwNAilCl1joNwTje7FWWN9WiI2bo5VhpU/edit?gid=2093180351#gid=2093180351&range=A1',
        rating: 4.8,
        desc: '基于 Google Sheets 维护的提示词资源库，适合集中查看和整理各类 AI 提示词、场景模板与灵感示例，便于检索、收藏和复用'
      },
      {
        title: 'awesome-gpt-image-2-prompts',
        url: 'https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts/blob/main/README_zh-CN.md',
        rating: 4.8,
        desc: 'GPT-Image-2 高质量提示词库，收录人像摄影、海报插画、角色设计、UI截图等场景的优秀案例。大多数案例来源于 X/Twitter 上的创作者社区，包含完整的提示词文本和效果预览'
      },
    ],
  },
]
</script>

<template>
    <div class="flex flex-col mt-3 flex-1">
      <DetailHeader :title="info.title" />
      <div class="p-4 rounded-2xl bg-white">
        <div class="space-y-6">
          <ToolDetail v-for="cate in cates" :key="cate.title" :title="cate.title">
            <div class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <a
                v-for="item in cate.list"
                :key="item.title"
                class="group border rounded-xl p-3 sm:p-4 hover:shadow-md transition bg-white flex flex-col items-start gap-3 overflow-hidden"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div class="w-full">
                  <div class="flex items-center gap-2">
                    <div class="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">
                      {{ item.title[0] }}
                    </div>
                    <div class="flex-1 min-w-0 font-medium text-gray-900 group-hover:text-blue-600 truncate">
                      {{ item.title }}
                    </div>
                    <!-- H5 数字评分；仅移动端展示 -->
                    <span class="text-xs text-gray-600 sm:hidden flex-shrink-0">{{ ((item.rating ?? 0)).toFixed(1) }}/5</span>
                    <span class="text-gray-400 group-hover:text-blue-500 flex-shrink-0">→</span>
                  </div>
                  <!-- 平板及以上：星星评分单独一行显示 -->
                  <div class="mt-1 hidden sm:block">
                    <el-rate
                      :model-value="item.rating ?? 0"
                      disabled
                      allow-half
                      :max="5"
                      size="small"
                    />
                  </div>
                  <div class="text-gray-500 text-sm whitespace-pre-line break-words mt-2" v-if="item.desc">
                    {{ item.desc }}
                  </div>
                </div>
              </a>
            </div>
          </ToolDetail>
        </div>
      </div>
  
      <ToolDetail title="说明">
        <el-text>收录常用第三方好物网站，点击卡片将在新窗口打开；</el-text>
      </ToolDetail>
    </div>
  </template>
  
  <style scoped>
  </style>
