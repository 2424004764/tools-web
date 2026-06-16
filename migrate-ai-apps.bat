@echo off
chcp 65001 >nul
echo 开始迁移AI应用数据...
echo.

echo 1. 创建 ai_apps 表...
wrangler d1 execute yifang-tool --file=./functions/db/005_create_ai_apps.sql

echo.
echo 2. 插入初始应用数据...
wrangler d1 execute yifang-tool --file=./functions/db/006_insert_ai_apps_data.sql

echo.
echo 迁移完成！
echo.
echo 现在可以启动开发服务器：
echo   wrangler pages dev .
echo.
pause
