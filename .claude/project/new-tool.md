---
description: 添加新工具的完整步骤
---

## 添加新工具

创建新工具时，**必须更新以下 5 个地方**：

1. **`src/components/Tools/tools.ts`** - 在 `getToolsCate()` 函数中添加工具元数据：
   ```typescript
   {
     id: 1,
     title: '工具名称',
     logo: '/images/logo/tool_logo.png',  // Logo 命名规则：{工具名-kebab-case}.png
     desc: '工具描述',
     url: '/tool-route/',
     cateId: 2,  // 分类 ID（2=开发运维、3=文本处理、4=教育学术、5=图片处理、8=数据图表、9=选择随机、10=AI工具、11=趣味互动、12=其他工具）
     cate: '分类名称',
   }
   ```

2. **`src/router/router.ts`** - 添加路由：
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

3. **创建组件** - 复制 `src/components/Tools/Example/` 并重命名为你的工具名

4. **`sitemap.xml`** - 注册新工具页面

5. **`README.md`** - 更新功能日志和工具列表
