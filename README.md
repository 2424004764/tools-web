<div align="center">
  <pre>
    _______          _         __          __  _     
 |__   __|        | |        \ \        / / | |    
    | | ___   ___ | |___ _____\ \  /\  / /__| |__  
    | |/ _ \ / _ \| / __|______\ \/  \/ / _ \ '_ \ 
    | | (_) | (_) | \__ \       \  /\  /  __/ |_) |
    |_|\___/ \___/|_|___/        \/  \/ \___|_.__/ 
                                                                                                 
  </pre>
  <p> 只需简单几步，即可快速搭建属于自己的在线工具箱。</p> 

[![node](https://img.shields.io/badge/any_text-22.13.1-red?label=node)](node)
[![pnpm](https://img.shields.io/badge/any_text-10.14.0-white?label=pnpm)](pnpm)
[![vue](https://img.shields.io/badge/any_text-3.3.10-origin?label=vue)](vue)
[![tailwindcss](https://img.shields.io/badge/any_text-3.3.5-yellow?label=tailwindcss)](tailwindcss)
[![elementplus](https://img.shields.io/badge/any_text-2.7-blue?label=element-plus)](elementplus)
[![license](https://img.shields.io/github/license/naroat/tools-web)](LICENSE)

</div>

本仓库fork于：<a href="https://github.com/naroat/tools-web" target="_blank">Tools-Web</a>，感谢naroat做出的贡献！能让我方便在此基础上添加新功能。

## 目录

- [功能展览](#功能展览)
- [开始使用](#开始使用)
  - [Docker部署](#Docker部署)
  - [手动部署](#手动部署)
  - [cloudflare部署](#Cloudflare部署)
- [工具列表](#工具列表)
- [其他](#其他)

## 功能展示

在线站点：<a href="https://tool.fologde.com/" target="_blank">Tools-Web</a>

## 开始使用

我的node版本：22.13.1、pnpm版本：10.14.0



### Docker部署

```
docker run -d --name tools-web --restart unless-stopped -p 8080:80 docker0796/tools-web:latest
```

访问：`http://127.0.0.1:8080`


### 手动部署

安装`pnpm`
```
npm install pnpm -g
```

克隆
```
git clone --depth=1 https://github.com/naroat/tools-web.git
```

安装
```
# 进入项目
cd tools-web

# 复制配置文件
cp .env.example .env.development

# 安装
pnpm install
```

启动
```
pnpm dev
```

打包
```
windows命令
// 打包并且将根目录的functions文件夹全部内容和wrangler.toml文件复制到/dist文件夹下
pnpm build && xcopy /E /I /H /Y .\functions\* .\dist\functions\ && xcopy /Y .\wrangler.toml .\dist\ && xcopy /Y .\robots.txt .\dist\ && xcopy /Y .\sitemap.xml .\dist\

// 打包静态页面并且将根目录的functions文件夹全部内容和wrangler.toml文件复制到/dist文件夹下
pnpm build:pro && xcopy /E /I /H /Y .\functions\* .\dist\functions\ && xcopy /Y .\wrangler.toml .\dist\ && xcopy /Y .\robots.txt .\dist\ && xcopy /Y .\sitemap.xml .\dist\

linux只需要改一下复制的命令即可:
pnpm build && cp -r ./functions/* ./dist/functions/ && cp ./wrangler.toml ./dist/ && cp ./robots.txt ./dist/ && cp ./sitemap.xml ./dist/ && git add . && git commit -m "debug" && git push origin master

```

编译 && 移动 && 提交一条命令搞定：
```
pnpm build && cp -r ./functions/* ./dist/functions/ && cp ./wrangler.toml ./dist/ && cp ./robots.txt ./dist/ && cp ./sitemap.xml ./dist/
```

打包seo静态页面:复制`.env.development`文件，并将文件名修改为`.env.production`,将里面的`NODE_ENV`的值改为`production`,然后运行下面打包命令
```
pnpm build:pro
```

git提交
```
git add . && git commit -m "新增xx功能" && git push origin master
```

### Cloudflare部署

详见我的公众号文章：https://mp.weixin.qq.com/s/kIrz2uAv0cmT3f2rPWbtdQ

## 本地调试functions
根目录执行命令：
```
pnpm install wrangler
wrangler pages dev .
```
然后会启动一个服务，之后就可以像请求functions一样的方式调用的，只是把请求地址改成本地的

## 功能开发日志
- 2025年8月2日 新增文生图
- 2025年8月5日 新增cron表达式生成器
- 2025年8月6日 新增二维码识别、文件大小转换、贪吃蛇小游戏、记忆力翻牌、俄罗斯方块小游戏、打地鼠小游戏功能
- 2025-08-07 新增数独小游戏
- 2025-08-08 新增AI工具导航、postman lite功能
- 2025-08-10 新增哈希校验功能
- 2025-08-11 新增CSV/TSV互转JSON、命名风格转换、AI起变量名、AI起名功能
- 2025-08-12 新增AI翻译、AI小学作文功能
- 2025-08-12 新增 AI每日励志鸡汤文 功能
- 2025-08-14 新增 图片在线压缩 功能
- 2025-08-15 新增AI五子棋功能
- 2025-08-15 新增好物网站导航功能
- 2025-08-16 新增用户登录功能

## 工具列表

- 开发运维
  - 随机密码生成
  - URL编码/解码
  - UUID生成器
  - 时间戳转换
  - MD5在线加密
  - Json在线转换
  - CSV/TSV ↔ JSON 互转
  - 正则测试工具
  - Unicode转中文
  - HTTP状态码
  - JWT解析
  - 文件大小转换
  - Cron表达式生成器
  - html实体转义
  - 在线请求调试
  - URL 参数解析/构造
  - 命名风格转换
  - 哈希校验/HMAC

- 用户系统
  - 用户登录

- 文本处理
  - 文本对比
  - markdown编辑器
  - 字数统计
  - 文本去重
  - ASCII字形生成器
  - 在线文本编辑/HTML获取

- 图片处理
  - 二维码生成
  - 二维码识别
  - 文本转图片
  - 图片分割
  - 图片转Base64
  - 在线编辑图片

- 数据图表
  - 柱状图
  - 折线图
  - 饼图
  - 散点图

- 选择随机
  - 生成随机数
  - 帮我决定
  - 抛硬币
  - 投骰子

- 教育学术
  - 单位换算
  - 常用进制转换
  - ASCII码表
  - 长度单位转换
  - 面积单位转换
  - 重量单位转换
  - 时间单位转换
  - 温度单位转换
  - 压力单位转换
  - 热量单位转换
  - 功率单位转换
  - 摩斯电码

- 趣味互动
  - 贪吃蛇
  - 记忆力翻牌
  - 俄罗斯方块
  - 打地鼠
  - 2048
  - 扫雷
  - 数字华容道
  - 数独游戏
  - AI五子棋

- 好物网站
  - 好物网站导航

- 查询相关
  - IP查询
  - 网站信息获取

- 其他工具
  - 数字转金额大写
  - 手持弹幕
  - 色板
  - Color选择器

- AI 工具
  - 在线文生图
  - AI工具导航
  - AI起变量名
  - AI起名
  - AI翻译
  - AI小学作文
  - AI每日励志鸡汤文

## 其他

Q: 我应该如何添加新功能？

A: 
  - 在`components/Tools/tools.ts`文件中添加工具信息
  - 在`router/router.ts`中添加路由
  - 拷贝示例目录`components/Tools/Example`修改名称，在这个拷贝出来的目录中开发工具即可

<br/>

Q: 我可以参与开发 `Tools-Web` 吗？

A: 当然可以，随时欢迎提交 `PR`


  