#!/bin/bash

echo "开始迁移AI应用数据..."

# 创建表
echo "1. 创建 ai_apps 表..."
wrangler d1 execute yifang-tool --file=./functions/db/005_create_ai_apps.sql

# 插入初始数据
echo "2. 插入初始应用数据..."
wrangler d1 execute yifang-tool --file=./functions/db/006_insert_ai_apps_data.sql

echo "迁移完成！"
echo ""
echo "现在可以启动开发服务器："
echo "  wrangler pages dev ."
