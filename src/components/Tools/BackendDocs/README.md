# TechDocViewer 通用文档组件

## 概述

`TechDocViewer` 是一个通用的技术文档展示组件，可以渲染不同技术栈的文档内容。通过传入文档数据，它可以展示包含章节、代码示例、表格等多种内容的结构化文档。

## 功能特性

- 📖 **多章节文档**：支持分章节展示技术文档
- 💻 **代码高亮**：支持多种编程语言的代码块展示
- 📊 **表格展示**：支持复杂表格的展示
- 📱 **响应式设计**：支持移动端和桌面端
- 🔍 **目录导航**：左侧目录支持快速跳转
- 🔗 **锚点链接**：支持 URL hash 跳转到指定章节

## 使用方法

### 1. 导入组件

```vue
<script setup>
import TechDocViewer from '@/components/Tools/BackendDocs/TechDocViewer.vue'
</script>
```

### 2. 传入文档数据

```vue
<template>
  <TechDocViewer :tech-doc="docData" :back-url="'/custom-back-url'" />
</template>
```

### 3. 文档数据格式

```typescript
interface TechDocData {
  name: string        // 技术栈名称
  icon: string        // 图标（可选）
  color: string       // 主题色类名
  chapters: {         // 章节列表
    id: string        // 章节ID（用于锚点）
    title: string     // 章节标题
    content: any[]    // 章节内容
  }[]
}
```

### 4. 内容块类型

组件支持以下内容块类型：

#### 标题
```javascript
{
  type: 'heading',
  text: '这是标题'
}
```

#### 段落
```javascript
{
  type: 'paragraph',
  text: '这是段落内容'
}
```

#### 列表
```javascript
{
  type: 'list',
  items: [
    '<strong>项目1</strong>：描述1',
    '项目2：描述2'
  ]
}
```

#### 表格
```javascript
{
  type: 'table',
  headers: ['列1', '列2', '列3'],
  rows: [
    ['数据1', '数据2', '数据3'],
    ['数据4', '数据5', '数据6']
  ]
}
```

#### 代码块
```javascript
{
  type: 'code',
  lang: 'javascript',  // 语言标识
  code: `console.log('Hello World')`
}
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `techDoc` | `TechDocData` | - | 文档数据（必需） |
| `backUrl` | `string` | `'/backend-docs'` | 返回按钮链接 |

## 添加新文档

### 1. 在 `techDocs.ts` 中定义文档数据

```typescript
export const newTechDoc: TechDocData = {
  name: '新技术栈',
  icon: 'N',
  color: 'from-purple-400 to-purple-600',
  chapters: [
    // 章节内容...
  ]
}
```

### 2. 在 `techDocs` 映射中注册

```typescript
export const techDocs: Record<string, TechDocData> = {
  mongodb: mongodbDoc,
  mysql: mysqlDoc,
  newtech: newTechDoc  // 添加新文档
}
```

### 3. 更新技术栈列表

在 `BackendDocs.vue` 中添加新的技术栈配置：

```javascript
{
  id: 'newtech',
  name: '新技术栈',
  icon: '',
  desc: '新技术栈的描述',
  color: 'from-purple-400 to-purple-600',
  status: 'completed'
}
```

## 示例

查看 `techDocs.ts` 文件中的 `mongodbDoc` 和 `mysqlDoc` 作为完整示例。

## 注意事项

1. 文档数据应该预先定义，避免在组件运行时动态生成大量内容
2. 代码块中的内容会保持原始格式，包括缩进和换行
3. 表格在移动端会水平滚动显示
4. 组件会自动处理 URL hash，用于章节间导航