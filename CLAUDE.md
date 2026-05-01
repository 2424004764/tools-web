# CLAUDE.md

本项目指南，供 Claude Code 在处理仓库代码时使用。

## 项目概述

Tools-Web 是一个基于 Vue 3 + TypeScript + Vite 的在线工具箱应用。提供 100+ 个工具，涵盖开发、文本处理、图片处理、数据可视化、游戏、AI 工具等多个分类。

**技术栈：** Vue 3（Composition API）、TypeScript、Vite、Element Plus、Tailwind CSS、Pinia、Vue Router

**部署：** Cloudflare Pages + D1 数据库，Cloudflare Workers 无服务器函数

## 快速导航

- [命令与构建](.claude/project/commands.md) — 开发命令、构建与部署
- [目录结构](.claude/project/structure.md) — 项目文件结构
- [添加新工具](.claude/project/new-tool.md) — 创建新工具的完整步骤
- [架构详情](.claude/project/architecture.md) — 状态管理、HTTP、AI、Supabase、D1、Functions
- [编码规范](.claude/project/coding-conventions.md) — 编码规范、核心原则、UI 指南
- [环境变量](.claude/project/env.md) — 环境变量说明
- [通用模式与 SEO](.claude/project/patterns.md) — 工具组件结构、SEO 要求、布局组件
