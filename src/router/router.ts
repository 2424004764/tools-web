//对外暴露配置路由(常量路由)
export const constantRoute = [
  //首页
  {
    path: '/',
    component: () => import('@/components/Home/Home.vue'),
    name: 'home',
    meta: {
      keywords: '在线工具,开发运维,文本处理,图片处理,数据图表,趣味互动,选择随机,教育学术,AI工具,好物网站,JSON转换,CSV,TSV,随机密码,UUID,时间戳转换,进制转换,单位换算,URL编码,URL参数,正则测试,Markdown,文本对比,文本去重,哈希,HMAC,文件大小转换,HTTP状态码,JWT解析,Cron生成,HTML实体,二维码生成,二维码识别,图片编辑,图片分割,图片转Base64,文本转图片,色板,取色器,柱状图,折线图,饼图,散点图,摩斯电码,贪吃蛇,2048,俄罗斯方块,扫雷,打地鼠,数字华容道,数独,IP查询,网站信息,AI起名,AI变量名,文生图,AI翻译,Postman',
      description: '一站式在线工具箱：覆盖开发运维、文本处理、图片处理、数据图表、趣味互动、选择随机、教育学术与 AI 工具；提供 JSON/CSV/TSV 互转、随机密码/UUID、时间戳与进制转换、单位换算、URL 编解码/参数解析、正则测试、Markdown、文本对比/去重、哈希校验、文件大小转换、HTTP 状态码、JWT 解析、Cron 表达式、HTML 实体、二维码生成与识别、在线图片编辑/分割/转 Base64、文本转图片、色板取色器、柱状/折线/饼/散点图、摩斯电码，以及贪吃蛇/2048/俄罗斯方块/扫雷/打地鼠/数字华容道/数独等小游戏，另含 IP 查询、网站信息获取、AI 起名/变量名/文生图/翻译与在线请求调试等实用功能。'
    }
  },
  // 用户信息页
  {
    path: '/userinfo',
    component: () => import('@/components/Home/UserInfo.vue'),
    name: 'userinfo',
    meta: {
      title: "用户信息",
      keywords: '用户信息,个人资料,账户详情',
      description: '查看和管理您的用户信息和个人资料',
    }
  },
  //工具
  {
    path: '/timetran',
    component: () => import('@/components/Tools/TimeTran/TimeTran.vue'),
    name: 'timetran',
    meta: {
      title: "时间戳转换",
      keywords: '时间,日期转换时间戳,Unix时间戳',
      description: 'Unix时间戳转换可以把Unix时间转成北京时间。',
    }
  },
  {
    path: '/md5',
    component: () => import('@/components/Tools/MD5/MD5.vue'),
    name: 'MD5',
    meta: {
      title: "MD5在线加密",
      keywords: 'md5加密，md5在线加密，md5',
      description: '在线md5加密，一键生成md5加密字符串，可生成16位或32位md5加密字符串，md5双重加密',
    }
  },
  {
    path: '/json',
    component: () => import('@/components/Tools/JsonTran/JsonTran.vue'),
    name: 'json',
    meta: {
      title: "Json在线转换",
      keywords: 'json编辑器，json格式化,json压缩,json转义,json去转义',
      description: '提供实时编辑和预览JSON 数据，语法高亮、校验、格式化、转义，去转义、压缩等功能，可以提高阅读修改的效率和准确性',
    }
  },
  {
    path: '/csv-json',
    component: () => import('@/components/Tools/CsvJson/CsvJson.vue'),
    name: 'csv-json',
    meta: {
      title: 'CSV/TSV ↔ JSON 互转',
      keywords: 'CSV,TSV,JSON,互转,分隔符,列头推断',
      description: 'CSV、TSV 与 JSON 相互转换，支持列头推断与分隔符选择',
    }
  },
  {
    path: '/reg',
    component: () => import('@/components/Tools/RegTest/RegTest.vue'),
    name: 'reg',
    meta: {
      title: "正则表达式测试",
      keywords: '正则表达式测试工具,常用正则表达式,在线正则表达式',
      description: '正则表达式测试工具,常用正则表达式,在线正则表达式',
    }
  },
  {
    path: '/cron',
    component: () => import('@/components/Tools/CronGenerator/CronGenerator.vue'),
    name: 'cron',
    meta: {
      title: "Cron表达式生成器",
      keywords: 'cron表达式,cron表达式生成器,定时任务,在线cron',
      description: '在线Cron表达式生成器，支持秒、分、时、日、月、周、年的配置，提供常用预设模板和实时预览功能',
    }
  },
  {
    path: '/unicode',
    component: () => import('@/components/Tools/Unicode/Unicode.vue'),
    name: 'unicode',
    meta: {
      title: "Unicode转中文",
      keywords: '在线Unicode编码转换，中文转Unicode，Unicode转中文',
      description: '在线Unicode编码转换，中文转Unicode，Unicode转中文，在文本框里输入要转换的内容，然后点击要转换的类型按钮，转换完成后即可看到对应的内容。..',
    }
  },
  {
    path: '/wordcount',
    component: () => import('@/components/Tools/WordCount/WordCount.vue'),
    name: 'wordcount',
    meta: {
      title: "在线字数统计",
      keywords: '在线字数计算器,计算字数,在线字数统计器,字数计数器',
      description: '在线字数计数器,主要是方便计算字数，以控制文字数量的小工具(小说作者、论文、文案文档、文字编辑必备工具)。',
    }
  },
  {
    path: '/ip',
    component: () => import('@/components/Tools/Ip/Ip.vue'),
    name: 'ip',
    meta: {
      title: "IP查询",
      keywords: 'ip,ip查询,ip地址查询,ip138,查ip,我的ip,公网ip,ip归属地查询',
      description: '公网ip地址归属地查询',
    }
  },
  {
    path: '/scaletran',
    component: () => import('@/components/Tools/ScaleTran/ScaleTran.vue'),
    name: 'scaletran',
    meta: {
      title: "常用进制转换",
      keywords: '进制转换,进制转换工具,10进制转2进制,2进制转10进制,10进制转62进制,62进制转10进制',
      description: '常用进制转换工具，支持32进制以上进制转换',
    }
  },
  {
    path: '/signimage',
    component: () => import('@/components/Tools/SignImage/SignImage.vue'),
    name: 'signimage',
    meta: {
      title: "在线编辑图片",
      keywords: '在线图片裁剪，图片标注，图片滤镜，图片画笔、图片旋转、图片文字，图片美,图片尺寸调整化',
      description: '在线图片裁剪，图片标注，图片滤镜，图片画笔、图片旋转、图片文字,图片尺寸调整等操作',
    }
  },
  {
    path: '/randompassword',
    component: () => import('@/components/Tools/RandomPassword/RandomPassword.vue'),
    name: 'random_password',
    meta: {
      title: "随机密码生成",
      keywords: '在线生成随机密码，批量生成随机密码，密码生成',
      description: '在线随机密码生成',
    }
  },
  {
    path: '/urlencode',
    component: () => import('@/components/Tools/UrlEncode/UrlEncode.vue'),
    name: 'urlencode',
    meta: {
      title: "URL编码/解码",
      keywords: 'url编码，url解码，url加密，url解密',
      description: '在线url编码，在线url解码工具',
    }
  },
  {
    path: '/ascii',
    component: () => import('@/components/Tools/ASCII/ASCII.vue'),
    name: 'ascii',
    meta: {
      title: "ASCII码表",
      keywords: 'ascii，ascii码表,ascii对照表，ascii控制字符，ascii打印字符，ascii扩展码',
      description: 'ascii全面对照表，包含控制字符，打印字符，扩展码',
    }
  },
  {
    path: '/uuid',
    component: () => import('@/components/Tools/UUID/UUID.vue'),
    name: 'uuid',
    meta: {
      title: "UUID生成器",
      keywords: 'UUID生成器',
      description: 'uuid生成器，批量uuid生成',
    }
  },
  {
    path: '/barrage',
    component: () => import('@/components/Tools/Barrage/Barrage.vue'),
    name: 'barrage',
    meta: {
      title: "手持弹幕",
      keywords: '手持弹幕，弹幕工具',
      description: '手持弹幕是一种新型的互动沟通工具，可以方便地为各种户外活动、演出嘉年华等活动增加趣味性和互动性。手持弹幕具有轻便、易携带、易操作等优点，可以让每个参与者都变成活动的一部分。同时，手持弹幕还可以通过预先编写的文本、表情等形式，表达参与者的情感和想法，实现沟通互动。在社交媒体时代，手持弹幕的使用也带来了更广泛的社交效应，增加了活动的互动性和传播度。无论是举办方还是参与者，手持弹幕都是一个非常有价值的互动工具。',
    }
  },
  {
    path: '/palettes',
    component: () => import('@/components/Tools/Palettes/Palettes.vue'),
    name: 'palettes',
    meta: {
      title: "色板",
      keywords: '色板，颜色板',
      description: '在线复制颜色，好看的颜色组合色板',
    }
  },
  {
    path: '/unit',
    component: () => import('@/components/Tools/Unit/Unit.vue'),
    name: 'unit',
    meta: {
      title: "单位转换",
      keywords: '在线单位换算,长度单位换算,面积单位换算,时间单位换算,重量单位换算,温度单位换算,压力单位换算,热量单位换算,功率单位换算。',
      description: '在线单位换算,长度单位换算,面积单位换算,时间单位换算,重量单位换算,温度单位换算,压力单位换算,热量单位换算,功率单位换算。',
    }
  },
  {
    path: '/qrcode',
    component: () => import('@/components/Tools/Qrcode/Qrcode.vue'),
    name: 'qrcode',
    meta: {
      title: "二维码生成",
      keywords: '二维码,qrcode,二维码制作,二维码生成,微信二维码',
      description: '在线生成二维码,支持logo二维码,多种样式预设',
    }
  },
  {
    path: '/qrcode-scan',
    component: () => import('@/components/Tools/QrcodeScan/QrcodeScan.vue'),
    name: 'qrcodeScan',
    meta: {
      title: "二维码识别",
      keywords: '二维码识别,二维码扫描,qrcode扫描,二维码读取',
      description: '在线识别二维码,支持摄像头扫描、图片上传、拖拽等多种方式',
    }
  },
  {
    path: '/filesize',
    component: () => import('@/components/Tools/FileSize/FileSize.vue'),
    name: 'fileSize',
    meta: {
      title: "文件大小转换",
      keywords: '文件大小转换,字节转换,KB转换,MB转换,GB转换,TB转换',
      description: '在线文件大小单位转换工具,支持字节、KB、MB、GB、TB等单位互转',
    }
  },
  {
    path: '/decision',
    component: () => import('@/components/Tools/Decision/Decision.vue'),
    name: 'decision',
    meta: {
      title: "帮我决定",
      keywords: '选择困难，难以决定，今天吃什么，现在做什么，自定义选项都给你安排的明明白白',
      description: '选择困难症，自定义选择内容',
    }
  },
  {
    path: '/morse',
    component: () => import('@/components/Tools/Morse/Morse.vue'),
    name: 'morse',
    meta: {
      title: "摩斯电码",
      keywords: 'morse电码,摩斯电码',
      description: '摩斯电码编码解码',
    }
  },
  {
    path: '/random',
    component: () => import('@/components/Tools/Random/Random.vue'),
    name: 'random',
    meta: {
      title: "生成随机数",
      keywords: '随机数生成,随机数',
      description: '可定制范围内进行随机数字，可用于抽奖、点名等用途',
    }
  },
  {
    path: '/numbertochinese',
    component: () => import('@/components/Tools/NumberToChinese/NumberToChinese.vue'),
    name: 'numberToChinese',
    meta: {
      title: "数字转金额大写",
      keywords: '数字转中文,数字转大写,中文转数字,大写转数字,数字中文互转',
      description: '在线数字一键转换成人民币大写，中文大写金额数字应用正楷或行书填写',
    }
  },
  {
    path: '/diff',
    component: () => import('@/components/Tools/Diff/Diff.vue'),
    name: 'diff',
    meta: {
      title: "文本对比",
      keywords: '中文比对,代码比对，代码对比，文本比对，英文比对',
      description: '文本差异比对支持中文、英文、代码比对',
    }
  },
  {
    path: '/markdown',
    component: () => import('@/components/Tools/Markdown/Markdown.vue'),
    name: 'markdown',
    meta: {
      title: "markdown编辑器",
      keywords: '在线创建或编辑markdown, 实时预览，导出markdown',
      description: '在线markdown编辑器',
    }
  },
  {
    path: '/texttoimg',
    component: () => import('@/components/Tools/TextToImg/TextToImg.vue'),
    name: 'textToImg',
    meta: {
      title: "文本转图片",
      keywords: '文本生成图片，文本生成长图，推广长图',
      description: '把文本转换成图片，生成长图，具有超多个性文字排版',
    }
  },
  {
    path: '/webinfo',
    component: () => import('@/components/Tools/WebInfo/WebInfo.vue'),
    name: 'webInfo',
    meta: {
      title: "网站favicon获取",
      keywords: '获取网站logo,获取网站icon,获取网站favicon,获取网站标题,获取网站关键词,获取网站描述',
      description: '获取网站logo、icon、favicon、标题、关键词、描述等信息',
    }
  },
  {
    path: '/bar',
    component: () => import('@/components/Tools/Chart/Bar/Bar.vue'),
    name: 'bar',
    meta: {
      title: "柱状图",
      keywords: '柱状图',
      description: '在线制作柱状图，像做表格一样制作可视化图表，支持导出静态或动态图表',
    }
  },
  {
    path: '/line',
    component: () => import('@/components/Tools/Chart/Line/Line.vue'),
    name: 'line',
    meta: {
      title: "折线图",
      keywords: '折线图',
      description: '在线制作折线图，像做表格一样制作可视化图表，支持导出静态或动态图表',
    }
  },
  {
    path: '/pie',
    component: () => import('@/components/Tools/Chart/Pie/Pie.vue'),
    name: 'pie',
    meta: {
      title: "饼图",
      keywords: '饼图',
      description: '在线制作饼图，像做表格一样制作可视化图表，支持导出静态或动态图表',
    }
  },
  {
    path: '/scatter',
    component: () => import('@/components/Tools/Chart/Scatter/Scatter.vue'),
    name: 'scatter',
    meta: {
      title: "散点图",
      keywords: '散点图',
      description: '在线制作散点图，像做表格一样制作可视化图表，支持导出静态或动态图表',
    }
  },
  {
    path: '/coin',
    component: () => import('@/components/Tools/Coin/Coin.vue'),
    name: 'coin',
    meta: {
      title: "抛硬币",
      keywords: '抛硬币,硬币',
      description: '在线抛硬币，选择困难那么交给硬币来帮你选择吧',
    }
  },
  {
    path: '/dice',
    component: () => import('@/components/Tools/Dice/Dice.vue'),
    name: 'dice',
    meta: {
      title: "投骰子",
      keywords: '投骰子,骰子,自定义骰子',
      description: '在线投骰子，可自定义骰子数量，简单好用的骰子工具',
    }
  },
  {
    path: '/textremoveduplicate',
    component: () => import('@/components/Tools/TextRemoveDuplicate/TextRemoveDuplicate.vue'),
    name: 'textRemoveDuplicate',
    meta: {
      title: "文本去重",
      keywords: '文本去重,文本排重，文本去除重复',
      description: '可以删除或去除文本或字符串中的重复行',
    }
  },
  {
    path: '/imgcut',
    component: () => import('@/components/Tools/ImgCut/ImgCut.vue'),
    name: 'imgCut',
    meta: {
      title: "图片切割",
      keywords: '图片分割,图片切割,四宫格,九宫格,十六宫格',
      description: '将图片分割成四宫格、九宫格、十六宫格，支持自定义行与列',
    }
  },
  {
    path: '/httpstatuscode',
    component: () => import('@/components/Tools/HttpStatusCode/HttpStatusCode.vue'),
    name: 'HttpStatusCode',
    meta: {
      title: "HTTP状态码",
      keywords: 'http状态码',
      description: '所有http状态对应的名称和含义解释',
    }
  },
  {
    path: '/jwt',
    component: () => import('@/components/Tools/JWT/JWT.vue'),
    name: 'jwt',
    meta: {
      title: "JWT解析",
      keywords: 'jwt解析，jwt解码，json web token',
      description: '解析和解码JSON Web Token（jwt）',
    }
  },
  {
    path: '/notes',
    component: () => import('@/components/Tools/Notes/Notes.vue'),
    name: 'notes',
    meta: {
      title: "笔记备忘录",
      keywords: '在线笔记,备忘录,笔记记录,在线记事本',
      description: '在线笔记记录工具，支持创建、编辑、删除笔记，数据安全存储',
    }
  },
  {
    path: '/htmlentity',
    component: () => import('@/components/Tools/HtmlEntity/HtmlEntity.vue'),
    name: 'HtmlEntity',
    meta: {
      title: "html实体转义",
      keywords: 'html实体转义',
      description: 'html实体转义，实体转义成html',
    }
  },
  {
    path: '/colorpicker',
    component: () => import('@/components/Tools/ColorPicker/ColorPicker.vue'),
    name: 'ColorPicker',
    meta: {
      title: "Color选择器",
      keywords: '颜色选择器,Color选择器',
      description: '颜色选择器、在各种颜色空间如十六进制、rgb、hsl、css等等之间转换颜色',
    }
  },
  {
    path: '/asciiwordpic',
    component: () => import('@/components/Tools/ASCIIWordPic/ASCIIWordPic.vue'),
    name: 'asciiWordPic',
    meta: {
      title: "ASCII字形生成器",
      keywords: 'ASCII画,字形画,字形生成器',
      description: '在线生成字形ASCII画',
    }
  },
  {
    path: '/imagetobase64',
    component: () => import('@/components/Tools/ImageToBase64/ImageToBase64.vue'),
    name: 'imageToBase64',
    meta: {
      title: "图片转Base64",
      keywords: '图片转base64,图片编码,base64编码,图片转码',
      description: '将图片文件转换为Base64编码，支持拖拽上传和点击上传，方便在网页中使用图片',
    }
  },
  // {
  //   path: '/jsforamt',
  //   component: () => import('@/components/Tools/JSFormat/JSFormat.vue'),
  //   name: 'JSForamt',
  //   meta: {
  //     title: "js代码格式化/压缩",
  //     keywords: 'js代码格式化,js格式化,js压缩,javascript格式化',
  //     description: 'JS格式化/压缩工具,提供在线JS格式化、JS压缩、JS混淆、JS解密',
  //   }
  // },
  // {
  //   path: '/htmlformat',
  //   component: () => import('@/components/Tools/HtmlFormat/HtmlFormat.vue'),
  //   name: 'HtmlFormat',
  //   meta: {
  //     title: "html代码格式化",
  //     keywords: 'html格式化,xml格式化',
  //     description: '提供在线html、xml格式化',
  //   }
  // },
  // {
  //   path: '/cssformat',
  //   component: () => import('@/components/Tools/CssFormat/CssFormat.vue'),
  //   name: 'CssFormat',
  //   meta: {
  //     title: "css代码格式化/压缩",
  //     keywords: 'css格式化,css压缩',
  //     description: '提供在线css格式化,在线css压缩工具',
  //   }
  // },
  {
    path: '/textedit',
    component: () => import('@/components/Tools/TextEdit/TextEdit.vue'),
    name: 'TextEdit',
    meta: {
      title: "在线文本编辑/HTML获取",
      keywords: '文本编辑，富文本预览，在线编辑文本，文本编辑获取html',
      description: '在线富文本编辑, html实时预览，在线编辑文本，文本编辑获取html',
    }
  },
  {
    path: '/ai-text-to-image',
    component: () => import('@/components/Tools/AiTextToImage/AiTextToImage.vue'),
    name: 'AiTextToImage',
    meta: {
      title: "在线文生图",
      keywords: '在线文生图,文生图,文生图工具,文生图服务',
      description: '提供在线免费无限次数的文生图服务',
    }
  },
  // {
  //   path: '/ai-text-to-speech',
  //   component: () => import('@/components/Tools/AiTextToSpeech/AiTextToSpeech.vue'),
  //   name: 'AiTextToSpeech',
  //   meta: {
  //     title: "在线文本转语音",
  //     keywords: '在线文本转语音,文本转语音,语音合成,AI语音',
  //     description: '提供在线免费无限次数的文本转语音服务',
  //   }
  // },
  // 关于
  {
    path: '/about',
    component: () => import('@/components/Home/About.vue'),
    name: 'about',
    meta: {
      title: "关于",
      keywords: '关于ranblogs,关于工具站',
      description: '',
    }
  },
  // 登录页面
  {
    path: '/login',
    component: () => import('@/components/Home/Login.vue'),
    name: 'login',
    meta: {
      title: "用户登录",
      keywords: '用户登录,账号登录,工具箱登录',
      description: 'Tools-Web工具箱用户登录页面，登录后享受更多个性化功能',
    }
  },
  //其他路由
  {
    path: '/404',
    component: () => import('@/components/404/404.vue'),
    name: '404',
    meta: {
      title: "404"
    }
  },
  {
    //重定向
    path: '/:pathMatch(.*)*',
    redirect: '/404',
    name: 'Any',
  },
  {
    path: '/snake',
    component: () => import('@/components/Tools/Snake/Snake.vue'),
    name: 'snake',
    meta: {
      title: "贪吃蛇",
      keywords: '贪吃蛇,小游戏,休闲游戏,键盘游戏',
      description: '经典贪吃蛇游戏，支持键盘控制，挑战你的反应速度',
    }
  },
  {
    path: '/memory',
    component: () => import('@/components/Tools/Memory/Memory.vue'),
    name: 'memory',
    meta: {
      title: "记忆力翻牌",
      keywords: '记忆力游戏,翻牌配对,记忆训练,益智游戏',
      description: '记忆力翻牌配对游戏，考验你的记忆力，找到相同的卡片配对，训练大脑记忆能力',
    }
  },
  {
    path: '/tetris',
    component: () => import('@/components/Tools/Tetris/Tetris.vue'),
    name: 'tetris',
    meta: {
      title: "俄罗斯方块",
      keywords: '俄罗斯方块,益智游戏,空间思维,经典游戏',
      description: '经典俄罗斯方块游戏，考验你的空间思维和反应速度，消除横行获得高分',
    }
  },
  {
    path: '/whackamole',
    component: () => import('@/components/Tools/WhackAMole/WhackAMole.vue'),
    name: 'whackamole',
    meta: {
      title: "打地鼠",
      keywords: '打地鼠,街机游戏,反应速度,手眼协调',
      description: '经典打地鼠游戏，考验你的反应速度和手眼协调能力，30秒倒计时挑战',
    }
  },
  {
    path: '/game2048',
    component: () => import('@/components/Tools/Game2048/Game2048.vue'),
    name: 'game2048',
    meta: {
      title: "2048",
      keywords: '2048,益智游戏,数字逻辑,策略思维',
      description: '经典2048益智游戏，考验你的策略思维和数字逻辑能力，通过合并达到2048',
    }
  },
  {
    path: '/minesweeper',
    component: () => import('@/components/Tools/Minesweeper/Minesweeper.vue'),
    name: 'minesweeper',
    meta: {
      title: "扫雷",
      keywords: '扫雷,逻辑推理,益智游戏,数字推理',
      description: '经典扫雷游戏，考验你的逻辑推理能力，找出所有地雷挑战最快时间',
    }
  },
  {
    path: '/puzzle',
    component: () => import('@/components/Tools/Puzzle/Puzzle.vue'),
    name: 'puzzle',
    meta: {
      title: "数字华容道",
      keywords: '数字华容道,滑块游戏,益智游戏,逻辑游戏',
      description: '经典数字华容道游戏，通过移动数字方块将数字按顺序排列，考验逻辑思维和空间规划能力',
    }
  },
  {
    path: '/sudoku',
    component: () => import('@/components/Tools/Sudoku/Sudoku.vue'),
    name: 'sudoku',
    meta: {
      title: "数独游戏",
      keywords: '数独,数独游戏,在线数独,数独解题',
      description: '经典数独游戏，考验逻辑推理和数字分析能力',
    }
  },
  {
    path: '/ai-gomoku',
    component: () => import('@/components/Tools/AiGomoku/AiGomoku.vue'),
    name: 'ai-gomoku',
    meta: {
      title: "AI五子棋",
      keywords: '五子棋,AI五子棋,在线五子棋,智能五子棋',
      description: '智能五子棋游戏，与AI对战，考验策略思维',
    }
  },
  {
    path: '/aihub',
    component: () => import('@/components/Tools/AiHub/AiHub.vue'),
    name: 'aihub',
    meta: {
      title: 'AI工具导航',
      keywords: 'AI工具导航,AI工具集合,AI第三方工具,AI网站',
      description: '精选第三方AI工具分类导航，一键直达常用AI服务与网站',
    }
  },
  {
    path: '/ai-variable-name',
    component: () => import('@/components/Tools/AiVariableName/AiVariableName.vue'),
    name: 'ai-variable-name',
    meta: {
      title: 'AI起变量名',
      keywords: 'AI变量名,AI变量,AI命名,AI起变量名',
      description: '根据描述自动生成符合命名规范的变量名，支持多种命名风格与语言',
    }
  },
  {
    path: '/ai-name',
    component: () => import('@/components/Tools/AiName/AiName.vue'),
    name: 'ai-name',
    meta: {
      title: 'AI起名',
      keywords: 'AI起名,起名字,宝宝起名,中文姓名,取名',
      description: '输入父母姓氏，选择名的长度与性别，生成多个中文姓名，并给出命名理由',
    }
  },
  {
    path: '/postman',
    component: () => import('@/components/Tools/PostmanLite/PostmanLite.vue'),
    name: 'postman',
    meta: {
      title: "在线请求调试",
      keywords: '在线postman, http客户端, 接口调试, 请求构造, 跨域CORS',
      description: '简化版Postman：构造HTTP请求、查看响应，支持JSON、表单、Raw',
    }
  },
  {
    path: '/urlparams',
    component: () => import('@/components/Tools/UrlParams/UrlParams.vue'),
    name: 'urlParams',
    meta: {
      title: 'URL 参数解析/构造',
      keywords: 'URL 参数解析,URL 参数构造,querystring,URL 查询参数',
      description: '一键解析 ?a=1&b=2，支持编辑后重新拼接',
    }
  },
  {
    path: '/naming-case',
    component: () => import('@/components/Tools/NamingCase/NamingCase.vue'),
    name: 'naming-case',
    meta: {
      title: '命名风格转换',
      keywords: 'snake_case,camelCase,PascalCase,kebab-case,命名,风格,转换',
      description: 'snake_case、camelCase、PascalCase、kebab-case 相互转换，支持逐行转换与复制',
    }
  },
  {
    path: '/hash',
    component: () => import('@/components/Tools/Hash/Hash.vue'),
    name: 'hash',
    meta: {
      title: '哈希校验/HMAC',
      keywords: 'SHA1,SHA256,SHA512,HMAC-SHA256,哈希,摘要,校验',
      description: 'SHA-1/256/512、HMAC-SHA256，支持文本与文件摘要计算',
    }
  },
  {
    path: '/ai-translate',
    component: () => import('@/components/Tools/AiTranslate/AiTranslate.vue'),
    name: 'ai-translate',
    meta: {
      title: 'AI翻译',
      keywords: 'AI翻译,自动检测,多语言翻译,LibreTranslate',
      description: '支持多语言互译，源语言自动检测，免费使用'
    }
  },
  {
    path: '/ai-elementary-essay',
    component: () => import('@/components/Tools/AiElementaryEssay/AiElementaryEssay.vue'),
    name: 'ai-elementary-essay',
    meta: {
      title: 'AI小学作文',
      keywords: 'AI小学作文,作文生成,小学生作文,年级作文,题材作文',
      description: '按年级、体裁和关键词生成贴合小学生水平的作文，支持字数、风格与结构控制'
    }
  },
  {
    path: '/ai-daily-motivation',
    component: () => import('@/components/Tools/AiDailyMotivation/AiDailyMotivation.vue'),
    name: 'ai-daily-motivation',
    meta: {
      title: 'AI每日励志鸡汤文',
      keywords: 'AI鸡汤文,励志鸡汤文,每日鸡汤,正能量,励志语录',
      description: 'AI智能生成每日励志鸡汤文，支持多种风格选择，定时刷新，为你的每一天注入正能量'
    }
  },
  {
    path: '/good-sites',
    component: () => import('@/components/Tools/GoodSites/GoodSites.vue'),
    name: 'good-sites',
    meta: {
      title: '好物网站导航',
      keywords: '好物网站,网站导航,优质网站,实用网站',
      description: '精选优质网站分类导航，一键直达常用服务与网站',
    }
  },
  {
    path: '/ai-chat',
    component: () => import('@/components/Tools/AiChat/AiChat.vue'),
    name: 'ai-chat',
    meta: {
      title: "AI对话",
      keywords: 'AI对话,智能对话,AI助手,聊天机器人,智能问答',
      description: '智能AI对话助手，支持多轮对话，提供专业、准确的回答，帮助你解决各种问题',
    }
  },
  {
    path: '/image-compress',
    component: () => import('@/components/Tools/ImageCompress/ImageCompress.vue'),
    name: 'image-compress',
    meta: {
      title: "图片压缩",
      keywords: '图片压缩,在线压缩,图片优化,压缩图片,减小图片大小',
      description: '在线图片压缩工具，支持JPG、PNG、WebP等格式，可调节压缩质量，有效减小图片文件大小，保持图片质量',
    }
  },
]
