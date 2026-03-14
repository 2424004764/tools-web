# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tools-Web is a Vue 3 + TypeScript + Vite online toolbox application. It provides 100+ tools across categories like development, text processing, image handling, data visualization, games, AI tools, and more.

**Stack:** Vue 3 (Composition API), TypeScript, Vite, Element Plus, Tailwind CSS, Pinia, Vue Router

**Deployment:** Cloudflare Pages with D1 database, Cloudflare Workers for serverless functions

## Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm dev:wrangler     # Start local wrangler for functions testing

# Build
pnpm build            # Development build (SEO disabled)
pnpm build:pro        # Production build (SEO enabled)

# Preview
pnpm preview          # Preview production build

# Local functions testing
wrangler pages dev .  # Test Cloudflare Functions locally
```

## Build & Deployment Notes

- **Windows build:** `pnpm build && xcopy /E /I /H /Y .\functions\* .\dist\functions\ && xcopy /Y .\wrangler.toml .\dist\ && xcopy /Y .\robots.txt .\dist\ && xcopy /Y .\sitemap.xml .\dist\`
- **Linux build:** `pnpm build && cp -r ./functions/* ./dist/functions/ && cp ./wrangler.toml ./dist/ && cp ./robots.txt ./dist/ && cp ./sitemap.xml ./dist/`
- Set `NODE_ENV=production` in `.env.production` for SEO builds
- The `/dist` folder is deployed to Cloudflare Pages

## Architecture

### Adding a New Tool

When creating a new tool, **you must update 5 places**:

1. **`src/components/Tools/tools.ts`** - Add tool metadata to `getToolsCate()` function:
   ```typescript
   {
     id: 1,
     title: '工具名称',
     logo: '/images/logo/tool_logo.png',  // Logo naming: {tool-name-in-kebab-case}.png
     desc: '工具描述',
     url: '/tool-route/',
     cateId: 2,  // Category ID (2=开发运维, 3=文本处理, 4=教育学术, 5=图片处理, 8=数据图表, 9=选择随机, 10=AI工具, 11=趣味互动, 12=其他工具)
     cate: '分类名称',
   }
   ```

2. **`src/router/router.ts`** - Add route:
   ```typescript
   {
     path: '/tool-route/',
     component: () => import('@/components/Tools/ToolFolder/ToolComponent.vue'),
     name: 'toolRoute',
     meta: {
       title: "工具页面标题",
       keywords: '关键词1,关键词2',
       description: '详细的SEO描述，用于搜索引擎优化',
     }
   }
   ```

3. **Create Component** - Copy `src/components/Tools/Example/` and rename to your tool name

4. **`sitemap.xml`** - Register the new tool page

5. **`README.md`** - Update feature log and tool list

### Directory Structure

```
src/
├── api/                    # API request modules
├── components/
│   ├── Common/             # Shared components (AiChatCore, ChatInput, etc.)
│   ├── Layout/             # Layout components (Header, Left sidebar, Footer, etc.)
│   │   ├── DetailHeader/   # Tool page header
│   │   ├── ToolDetail/     # Collapsible detail section component
│   │   └── Left/           # Left sidebar navigation
│   ├── Home/               # Home page, Login, UserInfo
│   └── Tools/              # All tool components (100+ tools)
│       └── Example/        # Template for new tools
├── router/                 # Vue Router configuration
├── spi/                    # AI provider interfaces (Pollinations, AiTools)
├── store/                  # Pinia stores
│   └── modules/
│       ├── component.ts    # UI state (left sidebar, active category)
│       ├── tools.ts        # Tools-related state
│       └── user.ts         # User authentication state
├── styles/                 # Global styles (Tailwind, custom CSS)
├── utils/                  # Utility functions
│   ├── echarts.ts         # ECharts configuration
│   ├── file.ts            # File handling utilities
│   ├── string.ts          # String manipulation utilities
│   ├── time.ts            # Date/time utilities
│   ├── request.ts         # Axios instance for external APIs
│   ├── functionsRequest.ts # Axios instance for Cloudflare Functions
│   ├── user.ts            # User authentication utilities
│   ├── supabase.ts        # Supabase client (temp chat room)
│   └── errorHandler.ts    # HTTP error handling
└── main.ts                # App entry point

functions/                 # Cloudflare Functions (serverless)
├── api/                   # API endpoints
├── controllers/           # Route controllers
├── middlewares/           # Auth middleware
├── routes/                # Route definitions
├── services/              # Business logic (D1 database operations)
├── utils/                 # Shared utilities
├── gitee-auth.js          # Gitee OAuth
├── github-auth.js         # GitHub OAuth
├── google-auth.js         # Google OAuth
├── linuxdo-auth.js        # Linux.do OAuth
├── qq-auth.js             # QQ OAuth
└── _middleware.js         # Cloudflare Workers middleware
```

### State Management (Pinia)

- **`useComponentStore`**: Left sidebar visibility, active category filter
- **`useToolsStore`**: Tools data, search, favorites
- **`useUserStore`**: User authentication, profile data

### HTTP Request Patterns

- **External APIs**: Use `src/utils/request.ts` (axios instance)
- **Cloudflare Functions**: Use `src/utils/functionsRequest.ts` - auto-adds Bearer token from localStorage
- **Functions proxy**: Routes through `VITE_SITE_URL` environment variable

### AI Providers (`src/spi/`)

Abstracted AI service layer supporting multiple providers:
- **Pollinations**: Free AI image generation, chat
- **AiTools**: AI tools directory

Add new providers by implementing `AIProvider` interface in `src/spi/common/interfaces.ts`

### Supabase Integration

Used for real-time features (temp chat room). Configuration:
```env
VITE_SUPABASE_URL='https://your-project.supabase.co'
VITE_SUPABASE_ANON_KEY='your-anon-key'
```

### Cloudflare D1 Database

All D1 operations are in `functions/services/`. Shared code should be extracted to `functions/utils/` to avoid duplication.

## Coding Conventions

From `.cursor/rules/general.mdc`:

- **Language**: Return responses in Chinese
- **Code style**: Return only modified code, minimal changes, don't show off
- **Responsive**: All pages must work on both H5 (mobile) and PC
- **Utilities**: Put common functions in `src/utils/`, use existing utilities
- **HTTP**: Use axios for all HTTP requests
- **Documentation**: Update tool descriptions when functionality changes
- **SEO**: Detailed descriptions required for all tool pages
- **Deletion**: When removing UI elements, also remove related methods/variables

### Core Principles (权重)

1. **体验性 (50%)**: Beautiful UI, smooth interactions, subtle animations
2. **完整性 (30%)**: Complete features, logical flow, consistent PC/H5 experience
3. **技术性 (20%)**: Clean architecture, performance optimization, maintainability

### UI Guidelines

- Use frosted glass effects, gradient animations, fade-in effects appropriately
- Maintain ultra-clean and premium UI aesthetics
- Leverage Tailwind CSS classes + Element Plus components

## Environment Variables

- **Development**: `.env.development` (copy from `.env.example`)
- **Production**: `.env.production` (set `NODE_ENV=production` for SEO)
- **Key variables**: `VITE_SITE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## SEO Requirements

Every tool page must have:
1. Route meta with `title`, `keywords`, `description`
2. Detailed description at bottom of page (in `ToolDetail` components)
3. Entry in `sitemap.xml`

## Common Patterns

### Tool Component Structure

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

// State
const input = ref('')
const result = ref('')

// Methods
const handleProcess = () => { /* ... */ }
</script>

<template>
  <div class="flex flex-col mt-3">
    <DetailHeader :title="工具标题" />

    <!-- Main tool UI -->
    <div class="p-4 rounded-2xl bg-white">
      <!-- Tool content -->
    </div>

    <!-- Usage instructions -->
    <ToolDetail title="使用说明">
      <!-- Detailed description for SEO -->
    </ToolDetail>
  </div>
</template>
```

### Layout Components

- **`DetailHeader`**: Page title with breadcrumb-style display
- **`ToolDetail`**: Collapsible content sections (usage, examples, tips)
- **Left sidebar**: Responsive - hides on mobile, drawer on small screens
