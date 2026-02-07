import type { ToolsReqData } from '@/components/Tools/tools.type.ts'

//获取tools分类与对应的工具
export function getToolsCate() {
  return [
    {
      id: 2,
      title: '开发运维',
      icon: '',
      list: [
        {
          id: 1,
          title: '随机密码生成',
          logo: '/images/logo/keywords.png',
          desc: '密码生成器、随机字符串生成,批量生成',
          url: '/randompassword/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: '在线密码管理',
          logo: '/images/logo/password_book.png',
          desc: '安全的密码存储工具，支持分组管理和备注，AES加密保护',
          url: '/password-manager/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'URL编码/解码',
          logo: '/images/logo/url.png',
          desc: 'URL在线编码解码工具（UrlEncode编码 和 UrlDecode解码）',
          url: '/urlencode/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'UUID生成器',
          logo: '/images/logo/uuid.png',
          desc: '批量生成UUID',
          url: '/uuid/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: '时间戳转换',
          logo: '/images/logo/Time.png',
          desc: '在线时间戳转换工具以及获取当前时间戳',
          url: '/timetran/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'MD5在线加密',
          logo: '/images/logo/md5.png',
          desc: 'MD5在线加密,长度包含32位、16位',
          url: '/md5/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'Json在线转换',
          logo: '/images/logo/json.png',
          desc: '提供实时编辑和预览JSON 数据，语法高亮、校验、格式化、转义，去转义、压缩等功能，可以提高阅读修改的效率和准确性',
          url: '/json/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'CSV/TSV ↔ JSON 互转',
          logo: '/images/logo/json.png',
          desc: 'CSV、TSV 与 JSON 相互转换，支持列头推断与分隔符选择',
          url: '/csv-json/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: '正则测试工具',
          logo: '/images/logo/reg.png',
          desc: '正则表达式测试工具, 常用正则表达式',
          url: '/reg/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'Unicode转中文',
          logo: '/images/logo/union.png',
          desc: 'Unicode和中文的相互转换',
          url: '/unicode/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'HTTP状态码',
          logo: '/images/logo/http_code.png',
          desc: 'http状态对应的名称和含义解释',
          url: '/httpstatuscode/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'JWT解析',
          logo: '/images/logo/jwt_parse.png',
          desc: '解析和解码JSON Web Token（jwt）',
          url: '/jwt/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: '文件大小转换',
          logo: '/images/logo/file_size.png',
          desc: '文件大小单位转换，支持字节、KB、MB、GB、TB等单位互转',
          url: '/filesize/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'Cron表达式生成器',
          logo: '/images/logo/cron.png',
          desc: '在线生成和解析Cron表达式，支持定时任务配置',
          url: '/cron/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'html实体转义',
          logo: '/images/logo/HtmlEntity.png',
          desc: 'html实体转义，实体转义成html',
          url: '/htmlentity/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: '在线请求调试',
          logo: '/images/logo/request.png',
          desc: '简化版Postman：构造HTTP请求、查看响应，支持JSON、表单、Raw',
          url: '/postman/',
          cateId: 2,
          cate: '开发运维',
        },
        // {
        //   id: 1,
        //   title: 'js代码格式化/压缩',
        //   logo: '/images/logo/JSForamt.png',
        //   desc: 'JS格式化/压缩工具,提供在线JS格式化、JS压缩、JS混淆、JS解密',
        //   url: '/jsforamt/',
        //   cateId: 2,
        //   cate: '开发运维',
        // },
        // {
        //   id: 1,
        //   title: 'Html代码格式化',
        //   logo: '/images/logo/HtmlFormat.png',
        //   desc: '提供在线html、xml格式化',
        //   url: '/htmlformat/',
        //   cateId: 2,
        //   cate: '开发运维',
        // },
        // {
        //   id: 1,
        //   title: 'Css代码格式化/压缩',
        //   logo: '/images/logo/CssFormat.png',
        //   desc: 'css格式化/压缩工具,提供在线css格式化、css压缩',
        //   url: '/cssformat/',
        //   cateId: 2,
        //   cate: '开发运维',
        // }
        {
          id: 1,
          title: 'URL 参数解析/构造',
          logo: '/images/logo/url.png',
          desc: '一键解析 ?a=1&b=2，支持编辑后重新拼接',
          url: '/urlparams/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: '命名风格转换',
          logo: '/images/logo/naming-case.png',
          desc: 'snake_case、camelCase、PascalCase、kebab-case 相互转换，支持逐行转换与复制',
          url: '/naming-case/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: '哈希校验/HMAC',
          logo: '/images/logo/md5.png',
          desc: 'SHA-1/256/512、HMAC-SHA256，文本/文件摘要',
          url: '/hash/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'Cookie解析/构造',
          logo: '/images/logo/cookie.png',
          desc: 'Cookie字符串解析与构造，支持请求头和响应头格式，包含Domain、Path、Expires等属性编辑',
          url: '/cookie/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'Base64编码/解码',
          logo: '/images/logo/base64.png',
          desc: '文本的Base64编码与解码，双向实时转换，支持中文',
          url: '/base64/',
          cateId: 2,
          cate: '开发运维',
        },
        {
          id: 1,
          title: 'MySQL转Go结构体',
          logo: '/images/logo/mysql_to_go.png',
          desc: '将MySQL数据表字段转换为Go语言结构体，支持字段类型映射、标签生成和命名规范转换',
          url: '/mysql-to-go/',
          cateId: 2,
          cate: '开发运维',
        },
      ]
    },
    {
      id: 3,
      title: '文本处理',
      icon: '',
      list: [
        {
          id: 1,
          title: '文本对比',
          logo: '/images/logo/diff.png',
          desc: '文本差异比对支持中文、英文、代码比对',
          url: '/diff/',
          cateId: 3,
          cate: '文本处理'
        },
        {
          id: 1,
          title: 'markdown编辑器',
          logo: '/images/logo/file-markdown-fill.png',
          desc: '在线创建或编辑markdown, 实时预览，导出markdown',
          url: '/markdown/',
          cateId: 3,
          cate: '文本处理'
        },
        {
          id: 1,
          title: '字数统计',
          logo: '/images/logo/wordCount.png',
          desc: '在线统计字符串的字数、段落、标点符号数量',
          url: '/wordcount/',
          cateId: 3,
          cate: '文本处理',
        },
        {
          id: 1,
          title: '文本去重',
          logo: '/images/logo/textRemoveDuplicate.png',
          desc: '可以删除或去除文本或字符串中的重复行',
          url: '/textremoveduplicate/',
          cateId: 3,
          cate: '文本处理',
        },
        {
          id: 1,
          title: '字符串去空格',
          logo: '/images/logo/stringclean.png',
          desc: '支持去除所有空格、去除首尾空格、去除多余空格、去除空行等多种模式',
          url: '/stringclean/',
          cateId: 3,
          cate: '文本处理',
        },
        {
          id: 1,
          title: 'ASCII字形生成器',
          logo: '/images/logo/ascii_word_pic.png',
          desc: '在线生成字形ASCII画',
          url: '/asciiwordpic/',
          cateId: 3,
          cate: '文本处理',
        },
        {
          id: 1,
          title: '在线文本编辑/HTML获取',
          logo: '/images/logo/richtextEditor.png',
          desc: '在线富文本编辑, html实时预览，在线编辑文本，文本编辑获取html',
          url: '/textedit/',
          cateId: 3,
          cate: '文本处理'
        },
      ]
    },
    {
      id: 4,
      title: '教育学术',
      icon: '',
      list: [
        {
          id: 1,
          title: '单位换算',
          logo: '/images/logo/unit.png',
          desc: '在线重量、长度、面积、时间、角度、速度、温度、压力、热量、功率等换算',
          url: '/unit/',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '摩斯电码',
          logo: '/images/logo/medium.png',
          desc: '支持中文的摩斯电码编码解码',
          url: '/morse/',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '常用进制转换',
          logo: '/images/logo/scaletran.png',
          desc: '在线进制转换工具,可在2到64进制之间相互转换',
          url: '/scaletran/',
          cateId: 4,
          cate: '教育学术',
        },
        {
          id: 1,
          title: 'ASCII码表',
          logo: '/images/logo/ascii.png',
          desc: 'ASCII码表,控制代码、标准ASCII字符和非标准ASCII字符对照表',
          url: '/ascii/',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '长度单位转换',
          logo: '/images/logo/length.png',
          desc: '长度转换工具-支持国际长度单位，中国传统长度单位，英制长度单位',
          url: '/unit/?active=length',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '面积单位转换',
          logo: '/images/logo/area.png',
          desc: '面积转换工具-支持国际面积单位，中国传统面积单位，英制面积单位',
          url: '/unit/?active=area',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '重量单位转换',
          logo: '/images/logo/weight.png',
          desc: '重量转换工具-支持国际重量单位，中国传统重量单位，英制重量单位(常衡制和金衡制)',
          url: '/unit/?active=weight',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '时间单位转换',
          logo: '/images/logo/time_unit.png',
          desc: '时间单位转换工具-支持国际时间单位',
          url: '/unit/?active=time',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '温度单位转换',
          logo: '/images/logo/temperature.png',
          desc: '温度单位转换工具-支持国际温度单位',
          url: '/unit/?active=temperature',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '压力单位转换',
          logo: '/images/logo/pressure.png',
          desc: '压力单位转换工具-Pa/kPa/hPa/MPa/bar/torr/psi等',
          url: '/unit/?active=pressure',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '热量单位转换',
          logo: '/images/logo/heat.png',
          desc: '热量单位转换工具-Wh/mWh/kWh/MWh/J/kJ等',
          url: '/unit/?active=heat',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '功率单位转换',
          logo: '/images/logo/power.png',
          desc: '功率单位转换工具-W/mW/kW/MW/GW等',
          url: '/unit/?active=power',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '物品辐射量示例',
          logo: '/images/logo/radiation_sample.png',
          desc: '展示常见物品的辐射量参考数据，帮助了解日常生活中的辐射水平',
          url: '/radiation-sample/',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '3D数学方程式',
          logo: '/images/logo/math_equation_3d.png',
          desc: '3D数学方程式可视化工具，支持参数方程、隐式方程、函数图像的三维展示',
          url: '/math-equation-3d/',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '算法可视化',
          logo: '/images/logo/algorithm_visualization.png',
          desc: '排序算法、搜索算法等算法处理过程的可视化展示，帮助理解算法原理',
          url: '/algorithm-visualization/',
          cateId: 4,
          cate: '教育学术'
        },
        {
          id: 1,
          title: '土地亩数计算器',
          logo: '/images/logo/land_area.png',
          desc: '在线土地亩数计算器，输入土地长宽自动计算亩数，支持平方米、公顷、平方千米等多种单位换算',
          url: '/land-area/',
          cateId: 4,
          cate: '教育学术'
        }
      ]
    },
    {
      id: 5,
      title: '图片处理',
      icon: '',
      list: [
        {
          id: 1,
          title: 'PDF转图片',
          logo: '/images/logo/pdf_to_image.png',
          desc: '在线将PDF文件转换为高清图片，支持多页转换，保持原始清晰度',
          url: '/pdf-to-image/',
          cateId: 5,
          cate: '图片处理'
        },
        {
          id: 1,
          title: '二维码生成',
          logo: '/images/logo/qrcode.png',
          desc: '在线生成二维码，支持带logo、透明、艺术的二维码生成',
          url: '/qrcode/',
          cateId: 5,
          cate: '图片处理'
        },
        {
          id: 1,
          title: '二维码识别',
          logo: '/images/logo/qrcode-scan.png',
          desc: '在线识别二维码，支持摄像头扫描、图片上传、拖拽等多种方式',
          url: '/qrcode-scan/',
          cateId: 5,
          cate: '图片处理',
        },
        {
          id: 1,
          title: '文本转图片',
          logo: '/images/logo/text_to_img.png',
          desc: '把文本转换成图片，生成长图，具有超多个性文字排版',
          url: '/texttoimg/',
          cateId: 5,
          cate: '图片处理'
        },
        {
          id: 1,
          title: '图片分割',
          logo: '/images/logo/imgCut.png',
          desc: '将图片分割成四宫格、九宫格、十六宫格，支持自定义行与列',
          url: '/imgcut/',
          cateId: 5,
          cate: '图片处理',
        },
        {
          id: 1,
          title: '图片、Base64互转',
          logo: '/images/logo/img.png',
          desc: '图片与Base64双向互转，支持图片转Base64编码和Base64转图片',
          url: '/imagetobase64/',
          cateId: 5,
          cate: '图片处理',
        },
        {
          id: 1,
          title: '图片压缩',
          logo: '/images/logo/img_compress.png',
          desc: '在线图片压缩工具，支持多种格式，可调节压缩质量，减小文件大小',
          url: '/image-compress/',
          cateId: 5,
          cate: '图片处理'
        },
        {
          id: 1,
          title: '闲鱼技能海报生成器',
          logo: '/images/logo/xianyu_post.png',
          desc: '专为闲鱼技能服务设计的海报生成工具，提供多种精美模板，支持自定义文字内容，一键生成高清海报图片',
          url: '/skill-poster/',
          cateId: 5,
          cate: '图片处理'
        },
      ]
    },
    {
      id: 8,
      title: '数据图表',
      icon: '',
      list: [
        {
          id: 1,
          title: '柱状图',
          logo: '/images/logo/bar.png',
          desc: '在线制作柱状图，像做表格一样制作可视化图表，支持导出静态或动态图表',
          url: '/bar/',
          cateId: 8,
          cate: '数据图表',
        },{
          id: 1,
          title: '折线图',
          logo: '/images/logo/line.png',
          desc: '在线制作折线图，像做表格一样制作可视化图表，支持导出静态或动态图表',
          url: '/line/',
          cateId: 8,
          cate: '数据图表',
        },
        {
          id: 1,
          title: '饼图',
          logo: '/images/logo/pie.png',
          desc: '在线制作饼图，像做表格一样制作可视化图表，支持导出静态或动态图表',
          url: '/pie/',
          cateId: 8,
          cate: '数据图表',
        },
        {
          id: 1,
          title: '散点图',
          logo: '/images/logo/scatter.png',
          desc: '在线制作散点图，像做表格一样制作可视化图表，支持导出静态或动态图表',
          url: '/scatter/',
          cateId: 8,
          cate: '数据图表',
        }
      ]
    },
    {
      id: 11,
      title: '趣味互动',
      icon: '',
      list: [
        {
          id: 1,
          title: '贪吃蛇',
          logo: '/images/logo/snake.png',
          desc: '经典贪吃蛇游戏，支持键盘控制，挑战你的反应速度',
          url: '/snake/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 2,
          title: '记忆力翻牌',
          logo: '/images/logo/memory.png',
          desc: '翻牌配对游戏，考验记忆力，找到相同的卡片',
          url: '/memory/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 3,
          title: '俄罗斯方块',
          logo: '/images/logo/tetris.png',
          desc: '经典俄罗斯方块游戏，考验空间思维和反应速度',
          url: '/tetris/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 4,
          title: '打地鼠',
          logo: '/images/logo/whackamole.png',
          desc: '经典打地鼠游戏，考验反应速度和手眼协调',
          url: '/whackamole/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 5,
          title: '2048',
          logo: '/images/logo/2048.png',
          desc: '经典2048益智游戏，考验策略思维和数字逻辑',
          url: '/game2048/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 6,
          title: '扫雷',
          logo: '/images/logo/minesweeper.png',
          desc: '经典扫雷游戏，考验逻辑推理能力',
          url: '/minesweeper/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 7,
          title: '数字华容道',
          logo: '/images/logo/puzzle.png',
          desc: '经典数字华容道游戏，考验逻辑思维和空间规划能力',
          url: '/puzzle/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 8,
          title: '数独游戏',
          logo: '/images/logo/sudoku.png',
          desc: '经典数独游戏，考验逻辑推理和数字分析能力',
          url: '/sudoku/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 9,
          title: 'AI五子棋',
          logo: '/images/logo/ai_gomoku.png',
          desc: '智能五子棋游戏，与AI对战，考验策略思维',
          url: '/ai-gomoku/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 10,
          title: '猜数字游戏',
          logo: '/images/logo/guess_number.png',
          desc: '经典猜数字游戏，在1-100范围内猜出系统随机数字',
          url: '/guess-number/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 11,
          title: '数字序号记忆',
          logo: '/images/logo/number_memory.png',
          desc: '测试记忆力的趣味游戏，先显示数字位置，隐藏后按顺序点击，挑战你的瞬时记忆',
          url: '/number-memory/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 12,
          title: '假如你有100亿',
          logo: '/images/logo/hundred_billion.png',
          desc: '假如你有100亿人民币，看看你会买什么？房产、汽车、产业任你选择',
          url: '/hundred-billion/',
          cateId: 11,
          cate: '趣味互动',
        },
        {
          id: 13,
          title: '临时聊天室',
          logo: '/images/logo/chat.png',
          desc: '在线临时聊天室，无需注册，不存储数据，关闭即消失',
          url: '/temp-chat/',
          cateId: 11,
          cate: '趣味互动',
        },
      ]
    },
    {
      id: 9,
      title: '选择随机',
      icon: '',
      list: [
        {
          id: 1,
          title: '生成随机数',
          logo: '/images/logo/random.png',
          desc: '可定制范围内进行随机数字，可用于抽奖、点名等用途',
          url: '/random/',
          cateId: 9,
          cate: '选择随机'
        },
        {
          id: 1,
          title: '帮我决定',
          logo: '/images/logo/choose.png',
          desc: '选择困难，难以决定，今天吃什么，现在做什么，自定义选项都给你安排的明明白白',
          url: '/decision/',
          cateId: 9,
          cate: '选择随机'
        },
        {
          id: 1,
          title: '抛硬币',
          logo: '/images/logo/coin.png',
          desc: '在线抛硬币，选择困难那么交给硬币来帮你选择吧',
          url: '/coin/',
          cateId: 9,
          cate: '选择随机',
        },
        {
          id: 1,
          title: '投骰子',
          logo: '/images/logo/dice.png',
          desc: '在线投骰子，可自定义骰子数量，简单好用的骰子工具',
          url: '/dice/',
          cateId: 9,
          cate: '选择随机',
        },
      ]
    },
    // {
    //   id: 6,
    //   title: '查询相关',
    //   icon: '',
    //   list: [
    //     {
    //       id: 1,
    //       title: 'IP查询',
    //       logo: '/images/logo/IP.png',
    //       desc: '在线查询ip地址、ip归属地',
    //       url: '/ip',
    //       cateId: 6,
    //       cate: '查询相关',
    //     },
    //     {
    //       id: 1,
    //       title: '网站favicon获取',
    //       logo: '/images/logo/text_to_img.png',
    //       desc: '获取网站logo、icon、favicon、标题、关键词、描述等信息',
    //       url: '/webInfo',
    //       cateId: 6,
    //       cate: '查询相关',
    //     }
    //   ]
    // },
    {
      id: 7,
      title: '其他工具',
      icon: '',
      list: [
        {
          id: 1,
          title: '数字转金额大写',
          logo: '/images/logo/numberToChinese.png',
          desc: '在线数字一键转换成人民币大写，中文大写转换数字',
          url: '/numbertochinese/',
          cateId: 7,
          cate: '其他工具'
        },
        {
          id: 1,
          title: '手持弹幕',
          logo: '/images/logo/dm.png',
          desc: '手持滚动弹幕',
          url: '/barrage/',
          cateId: 7,
          cate: '其他工具',
        },
        {
          id: 1,
          title: '色板',
          logo: '/images/logo/palettes.png',
          desc: '包含纯色、渐变与阶梯色和常用色彩组合',
          url: '/palettes/',
          cateId: 7,
          cate: '其他工具'
        },
        {
          id: 1,
          title: 'Color选择器',
          logo: '/images/logo/color_picker.png',
          desc: '颜色选择器、在各种颜色空间如十六进制、rgb、hsl、css等等之间转换颜色',
          url: '/colorpicker/',
          cateId: 7,
          cate: '其他工具'
        },
        {
          id: 1,
          title: '简历管理',
          logo: '/images/logo/resume.png',
          desc: '在线简历制作与管理，支持多种模板，安全存储个人简历信息',
          url: '/resume/',
          cateId: 7,
          cate: '其他工具',
        },
        {
          id: 1,
          title: '公司对比',
          logo: '/images/logo/company_compare.png',
          desc: '公司待遇对比工具，支持双休情况、福利待遇、工资等多维度对比，历史记录存储',
          url: '/company-compare/',
          cateId: 7,
          cate: '其他工具',
        },
        {
          id: 1,
          title: '最低工资标准查询',
          logo: '/images/logo/minimum_wage.png',
          desc: '全国各省市最低工资标准查询，提供最新的月最低工资和小时最低工资标准数据',
          url: '/minimum-wage/',
          cateId: 7,
          cate: '其他工具',
        },
        {
          id: 1,
          title: '号码一览',
          logo: '/images/logo/phone_directory.png',
          desc: '各种国家机构、公共服务、紧急救援等常用电话号码查询服务',
          url: '/phone-directory/',
          cateId: 7,
          cate: '其他工具',
        },
      ]
    },
    {
      id: 10,
      title: 'AI工具',
      icon: '',
      list:[
        {
          id: 1,
          title: '在线文生图',
          logo: '/images/logo/ai_test_to_image.png',
          desc: '提供在线免费无限次数的AI文生图服务',
          url: '/ai-text-to-image/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 2,
          title: 'AI工具导航',
          logo: '/images/logo/ai_tools.png',
          desc: '精选第三方AI工具分类导航，一键直达',
          url: '/aihub/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 3,
          title: 'AI起变量名',
          logo: '/images/logo/ai_variable_name.png',
          desc: '根据描述自动生成符合命名规范的变量名，支持多种命名风格与语言',
          url: '/ai-variable-name/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 4,
          title: 'AI起名',
          logo: '/images/logo/ai_get_name.png',
          desc: '输入父母姓氏、选择名长与性别，生成多个姓名并附命名理由',
          url: '/ai-name/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 5,
          title: 'AI翻译',
          logo: '/images/logo/ai_translate.png',
          desc: '支持多语言互译，源语言自动检测',
          url: '/ai-translate/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 6,
          title: 'AI小学作文',
          logo: '/images/logo/ai_elementary_essay.png',
          desc: '按年级/题材/关键词生成贴合小学生水平的作文',
          url: '/ai-elementary-essay/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 7,
          title: 'AI每日励志鸡汤文',
          logo: '/images/logo/ai_daily_motivation.png',
          desc: 'AI智能生成每日励志鸡汤文，支持多种风格选择，定时刷新，为你的每一天注入正能量',
          url: '/ai-daily-motivation/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 8,
          title: 'AI对话',
          logo: '/images/logo/ai_chat.png',
          desc: '智能AI对话助手，支持多轮对话，提供专业、准确的回答',
          url: '/ai-chat/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 9,
          title: 'AI面试',
          logo: '/images/logo/ai_interview.png',
          desc: 'AI智能面试助手，模拟真实面试场景，支持多种岗位类型，提升面试表现',
          url: '/ai-interview/',
          cateId: 10,
          cate: 'AI工具'
        },
        {
          id: 10,
          title: 'AI提示词仓库',
          logo: '/images/logo/ai_prompt.png',
          desc: '精选顶级AI提示词库，涵盖写作、编程、创意、分析等多个领域，助力提升AI对话效果',
          url: '/ai-prompt/',
          cateId: 10,
          cate: 'AI工具'
        },
        // {
        //   id: 2,
        //   title: '在线文本转语音',
        //   logo: '/images/logo/ai_text_to_speech.png',
        //   desc: '提供在线免费无限次数的文本转语音服务',
        //   url: '/ai-text-to-speech/',
        //   cateId: 10,
        //   cate: 'AI工具'
        // }
      ]
    },
    {
      id: 12,
      title: '好物网站',
      icon: '',
      list:[
        {
          id: 1,
          title: '好物网站导航',
          logo: '/images/logo/good_sites.png',
          desc: '精选优质网站分类导航，一键直达常用服务与网站',
          url: '/good-sites/',
          cateId: 12,
          cate: '好物网站'
        }
      ]
    }
  ]
}

//工具list
export function toolsList() {
  let list = [] as any[]
  let toolsCate = getToolsCate()
  for (let item in toolsCate) {
    for (let _item in toolsCate[item].list) {
      list.push(toolsCate[item].list[_item])
    }
  }
  return list
}

/**
 * url为键名的工具list map
 * @returns 
 */
export function urlKeyMap() {
  // let toolsMapByUrlKey = new Map()
  // let list = toolsList()
  // for (let item in list) {
  //   toolsMapByUrlKey.set(list[item].url, list[item])
  // }
  // return toolsMapByUrlKey
}

//获取工具
export function getTools(data: ToolsReqData) {
  //接收参数
  const { cateId, title } = data
  //获取工具list
  let list = toolsList()
  //标题筛选
  if (title != '') {
    list = list.filter(item => {
      let tmpValue = item.title.toLowerCase()
      let tmpDesc = item.desc.toLowerCase()
      // console.log(tmpValue.indexOf(title.toLowerCase()))
      return tmpValue.indexOf(title.toLowerCase()) !== -1 || tmpDesc.indexOf(title.toLowerCase()) !== -1;
    });
  }
  //分类筛选
  if (cateId > 0) {
    list = list.filter(item => {
      return item.cateId == cateId;  
    });
  }
  return list
}

const ToolsExport = {
  getTools,
  getToolsCate,
  toolsList,
};

export default ToolsExport;