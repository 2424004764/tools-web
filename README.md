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

一站式在线工具箱：覆盖开发运维、文本处理、图片处理、数据图表、趣味互动、选择随机、教育学术与 AI 工具；提供 JSON/CSV/TSV 互转、随机密码/UUID、时间戳与进制转换、单位换算、URL 编解码/参数解析、正则测试、Markdown、文本对比/去重、哈希校验、文件大小转换、HTTP 状态码、JWT 解析、Cron 表达式、HTML 实体、二维码生成与识别、在线图片编辑/分割/转 Base64、文本转图片、色板取色器、柱状/折线/饼/散点图、摩斯电码，以及贪吃蛇/2048/俄罗斯方块/扫雷/打地鼠/数字华容道/数独等小游戏，另含 IP 查询、网站信息获取、AI 起名/变量名/文生图/翻译与在线请求调试等实用功能。

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

## 网站效果图
<img width="1896" height="939" alt="image" src="https://github.com/user-attachments/assets/a84b26dc-561f-41b9-92a3-5c8ec8c34828" />
<img width="1895" height="838" alt="image" src="https://github.com/user-attachments/assets/bc2e19b0-d788-460c-9199-93ae142b7dec" />
<img width="1873" height="970" alt="image" src="https://github.com/user-attachments/assets/92784ca1-f570-43fc-888b-b7e95203e2f8" />
<img width="1878" height="980" alt="image" src="https://github.com/user-attachments/assets/a9e2597e-5327-409d-a45f-c04f6546fdd7" />
<img width="1721" height="866" alt="image" src="https://github.com/user-attachments/assets/2d6e6c4c-af25-49d3-9a19-354823a3d507" />


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
git clone https://github.com/2424004764/tools-web.git
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

详见我的公众号文章：[https://mp.weixin.qq.com/s/kIrz2uAv0cmT3f2rPWbtdQ](https://mp.weixin.qq.com/s/RXWAGN6OpKw2qa1DKF_5-g)

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
- 2025-08-20 新增谷歌登录方式
- 2025-08-21 新增笔记备忘录功能，支持在线创建、编辑、删除笔记，数据安全存储在D1数据库
- 2025-08-28 新增物品辐射量示例功能、Cookie解析功能
- 2025-08-19 新增猜数字游戏
- 2025-08-30 点击功能时，增加loading效果、新增3D数学方程式、算法可视化功能
- 2025-08-31 新增假如你有100亿、AI提示词仓库功能、接入linux.do（https://connect.linux.do/dash/sso）登录方式
 - 2025-09-01 新增pdf转图片功能
 - 2025-09-02 接入gitee（https://gitee.com/oauth/applications）、github（https://github.com/settings/developers）登录方式
 - 2025-09-02 接入QQ（https://connect.qq.com/manage.html#/）登录方式
 - 2025-09-06 新增MySQL转Go结构体功能
 - 2025-09-07 新增数字序号记忆小游戏
 - 2025-09-08 新增个人简历功能
 - 2025-09-09 新增公司对比功能，支持多维度对比公司薪资、福利、工作时间等信息，历史记录存储
- 2025-09-10 新增AI面试功能，模拟真实面试场景，支持前端、后端、产品等多种岗位类型，提升面试表现
- 2025-09-14: 新增最低工资标准查询功能，支持全国31个省市最低工资标准查询
- 2025-09-14: 新增QA问答页面制作功能，支持创建个性化问答页面，可生成公开链接
- 2025-01-13: 新增字符串去空格功能，支持去除所有空格、去除首尾空格、去除多余空格、去除空行等多种模式
- 2025-01-13: 新增Base64编码/解码功能，支持文本的Base64编码与解码，双向实时转换
- 2025-01-13: 图片转Base64功能升级，支持Base64转图片，实现图片与Base64双向互转

## 工具列表

### 用户管理
- 用户登录 (Google OAuth)
- 用户信息管理
- 个人简历

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
  - Cookie解析
  - Base64编码/解码
  - 算法可视化
  - MySQL转Go结构体

- 文本处理
  - 文本对比
  - markdown编辑器
  - 字数统计
  - 文本去重
  - 字符串去空格
  - ASCII字形生成器
  - 在线文本编辑/HTML获取

- 图片处理
  - 二维码生成
  - 二维码识别
  - 文本转图片
  - 图片分割
  - 图片转Base64（支持Base64转图片）
  - 在线编辑图片
  - pdf转图片

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
  - 物品辐射量示例
  - 3D数学方程式

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
  - 假如你有100亿
  - 数字序号记忆

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
  - 简历管理
  - 公司对比
  - 最低工资标准查询
  - 号码一览
  - QA问答页面制作

- AI 工具
  - 在线文生图
  - AI工具导航
  - AI起变量名
  - AI起名
  - AI翻译
  - AI小学作文
  - AI每日励志鸡汤文
  - AI对话
  - AI面试
  - AI提示词仓库

- 笔记备忘录 - 在线笔记记录工具，支持创建、编辑、删除笔记，数据安全存储

## 其他

Q: 我应该如何添加新功能？

A: 
  - 在`components/Tools/tools.ts`文件中添加工具信息
  - 在`router/router.ts`中添加路由
  - 拷贝示例目录`components/Tools/Example`修改名称，在这个拷贝出来的目录中开发工具即可

<br/>

Q: 我可以参与开发 `Tools-Web` 吗？

A: 当然可以，随时欢迎提交 `PR`

Q：有问题怎么反馈呢？

A：可以提issue，或者加入微信群，如果群满或者二维码链接过期，则联系开发者，微信：yifang_self，微信群二维码：
<img src="https://github.com/user-attachments/assets/7cba19dd-eba6-4458-aef3-e8169ef4fc45" width="300">




  
