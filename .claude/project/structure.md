---
description: 项目目录结构
---

```
src/
├── api/                    # API 请求模块
├── components/
│   ├── Common/             # 共享组件（AiChatCore、ChatInput 等）
│   ├── Layout/             # 布局组件（Header、Left sidebar、Footer 等）
│   │   ├── DetailHeader/   # 工具页面头部
│   │   ├── ToolDetail/     # 可折叠详情组件
│   │   └── Left/           # 左侧导航栏
│   ├── Home/               # 首页、登录、用户信息
│   └── Tools/              # 所有工具组件（100+ 个工具）
│       └── Example/        # 新工具模板
├── router/                 # Vue Router 配置
├── spi/                    # AI 提供者接口（Pollinations、AiTools）
├── store/                  # Pinia 状态管理
│   └── modules/
│       ├── component.ts    # UI 状态（侧边栏、分类）
│       ├── tools.ts        # 工具相关状态
│       └── user.ts         # 用户认证状态
├── styles/                 # 全局样式（Tailwind、自定义 CSS）
├── utils/                  # 工具函数
│   ├── echarts.ts         # ECharts 配置
│   ├── file.ts            # 文件处理工具
│   ├── string.ts          # 字符串处理工具
│   ├── time.ts            # 日期/时间工具
│   ├── request.ts         # 外部 API 的 Axios 实例
│   ├── functionsRequest.ts # Cloudflare Functions 的 Axios 实例
│   ├── user.ts            # 用户认证工具
│   ├── supabase.ts        # Supabase 客户端（临时聊天室）
│   └── errorHandler.ts    # HTTP 错误处理
└── main.ts                # 应用入口

functions/                 # Cloudflare Functions（无服务器）
├── api/                   # API 端点
├── controllers/           # 路由控制器
├── middlewares/           # 认证中间件
├── routes/                # 路由定义
├── services/              # 业务逻辑（D1 数据库操作）
├── utils/                 # 共享工具
├── gitee-auth.js          # Gitee OAuth
├── github-auth.js         # GitHub OAuth
├── google-auth.js         # Google OAuth
├── linuxdo-auth.js        # Linux.do OAuth
├── qq-auth.js             # QQ OAuth
└── _middleware.js         # Cloudflare Workers 中间件
```
