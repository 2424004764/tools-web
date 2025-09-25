<script setup lang="ts">
import { reactive, ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import 'viewerjs/dist/viewer.css'
import { ArrowDown, ArrowRight, Menu, Close } from '@element-plus/icons-vue'
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')

const info = reactive({
  title: "AI提示词仓库",
})

// 分组数据结构
const categoryGroups = [
  {
    id: 'content',
    name: '内容创作',
    icon: '✍️',
    children: [
      { id: 'novel', name: '小说创作', icon: '📖' },
      { id: 'copywriting', name: '文案写作', icon: '✏️' },
      { id: 'story', name: '故事创作', icon: '📚' },
      { id: 'blog', name: '博客写作', icon: '📝' }
    ]
  },
  {
    id: 'tech',
    name: '技术开发',
    icon: '💻',
    children: [
      { id: 'code-review', name: '代码审查', icon: '🔍' },
      { id: 'algorithm', name: '算法解析', icon: '🧮' },
      { id: 'architecture', name: '架构设计', icon: '🏗️' },
      { id: 'debugging', name: '调试优化', icon: '🐛' }
    ]
  },
  {
    id: 'business',
    name: '商业分析',
    icon: '📊',
    children: [
      { id: 'strategy', name: '商业策略', icon: '🎯' },
      { id: 'market', name: '市场分析', icon: '📈' },
      { id: 'finance', name: '财务分析', icon: '💰' }
    ]
  },
  {
    id: 'design',
    name: '创意设计',
    icon: '🎨',
    children: [
      { id: 'ui-design', name: 'UI设计', icon: '🖼️' },
      { id: 'brand', name: '品牌设计', icon: '🏷️' },
      { id: 'creative', name: '创意策划', icon: '💡' }
    ]
  },
  {
    id: 'education',
    name: '教育学习',
    icon: '🎓',
    children: [
      { id: 'explain', name: '知识解释', icon: '🔍' },
      { id: 'teaching', name: '教学设计', icon: '👨‍🏫' }
    ]
  },
  {
    id: 'language',
    name: '语言处理',
    icon: '🌐',
    children: [
      { id: 'translation', name: '翻译润色', icon: '🔄' },
      { id: 'writing-improve', name: '文本改进', icon: '✨' }
    ]
  },
  {
    id: 'research',
    name: '研究分析',
    icon: '🔬',
    children: [
      { id: 'data-analysis', name: '数据分析', icon: '📊' },
      { id: 'research-method', name: '研究方法', icon: '🔍' }
    ]
  },
  {
    id: 'marketing',
    name: '营销推广',
    icon: '📢',
    children: [
      { id: 'digital-marketing', name: '数字营销', icon: '💻' },
      { id: 'content-marketing', name: '内容营销', icon: '📝' }
    ]
  },
  {
    id: 'image',
    name: '图片生成',
    icon: '🖼️',
    children: [
      { id: 'figurine', name: '手办生成', icon: '🎎' },
      { id: 'character', name: '角色设计', icon: '👤' },
      { id: 'scene', name: '场景生成', icon: '🏞️' }
    ]
  }
]

// 提示词数据 - 按子分类组织，添加type字段区分文生图和文生文
const prompts = {
  novel: [
    {
      title: '小说故事创作者',
      prompt: '扮演一位经验丰富的小说作家。我会提供故事的基本元素（如主角、背景、冲突等），你需要创作一个引人入胜的故事开头。故事应该：1. 有鲜明的人物形象；2. 设置悬念或冲突；3. 使用生动的描写；4. 吸引读者继续阅读的兴趣。',
      tags: ['小说', '创意', '故事'],
      difficulty: '高级',
      type: 'text' // 文生文类型
    },
    {
      title: '知乎盐选短篇小说大纲创作',
      prompt: `您是一位经验丰富的知乎盐选专栏作家，擅长创作广受好评的短篇小说。请根据以下设定和要求，创作一篇充满满足感（爽点）的知乎风格短篇小说大纲。

类型：爽文（酷/满足感故事）核心要求：密集的满足感时刻，快节奏，多转折，出人意料的结局。知乎风格：第一人称叙述。融入知乎特色，如：高赞回答、专业知识、数据分析、案例研究。语言风格：口语化、幽默，偶尔尖锐（毒舌），善于使用修辞手法如反问、比喻、排比等。可适当使用网络用语/梗，但必须与整体风格协调。

故事设定：高冲突/强转折：故事充满激烈冲突。主角将持续遭遇挑战和危机，但总能设法克服并实现逆转。情感共鸣/爽点的满足感：主角的人设应有一定缺陷或弱点，但也具有独特的魅力和优势。主角的经历应引起读者共鸣，其行动和成长应满足读者对酷/宣泄时刻的渴望。紧凑节奏/持续悬念：故事节奏明快，情节紧凑且相互关联，在关键节点构建悬念以保持读者兴趣。

情节要求：冲突驱动：故事冲突必须围绕主角展开，紧密相连，随着情节发展逐步升级，最终达到高潮并解决。反派驱动：过渡情节点的挑战主要由反派（们）创造，难度逐渐增加。反派的动机必须合理，其行动逻辑清晰。逻辑一致性：所有情节设计必须合乎逻辑，考虑主角的优势和能力，确保其行动和选择在合理范围内。创新且有趣：可适当添加新颖的设定或情节点，以增强故事的趣味性和可读性。

大纲要求：标题：简洁、清晰且吸引人，能够概括故事的核心内容或主要冲突。最好带有悬念或转折的暗示。角色设定：主角：详细设定主角的姓名、年龄、职业、性格、背景、外貌、初始弱点/缺陷，以及其目标和动机。主要配角：至少2个主要配角。他们可以是主角的朋友、盟友、恋爱对象等。设定他们的基本信息、与主角的关系以及他们在故事中的角色。反派：至少1个主要反派。设定他们的基本信息、与主角的冲突点、作恶动机以及他们的能力或资源。核心冲突：贯穿整个故事的中心矛盾，推动情节发展。

情节大纲：

（以下列格式输出，详细描述故事的情节发展，确保情节符合知乎热门小说的成功要素，并与用户提供的灵感相匹配。）

第0部分。（引言/序章）内容要求：原创内容，字数不超过180字。语言简洁，直接呈现冲突和极端结果，在结尾设置悬念和转折。标点符号：对话不要使用标准引号，请使用「」代替。所有""符号应替换为「」。输出格式：直接创建正文，句号后换行。

第1部分。（开篇章节）最精彩的钩子情节概述：将开篇章节内容分为5个情节点，总字数约2000字。标明每个情节点的建议字数和情感点。输出格式：

情节点，建议字数
情节分解：将开篇章节内容分为5个点故事，然后进一步细分为3个点故事
点x
点x.1
点x.2
点x.3
情感点
扩展建议
金句（金句）展示主角（男/女主人公）的性格特征和情感状态：（金句注释：可以使用一些网络用语，以及知乎常用的反问、比喻、举例等。金句应反映您作为知乎用户的独特个性，可以是尖锐、自嘲、幽默、深刻等。）

第2部分。（发展）情感爆发，为高潮铺垫格式如上

第3部分。（付费点/变现钩子）内容要求：设置付费点。可以添加更多转折，如反派的各种阴谋/阻碍，主角一一应对，打脸反派，充满满足感时刻。格式如上

第4部分。（转折点/高潮）内容要求：让读者感到解气：主角强烈反击，反派受到惩罚。格式如上

第5部分。（结尾/解决）内容要求：设计一个戏剧性的结局，影响深远、创新且出人意料。格式如上`,
      tags: ['知乎', '盐选', '短篇小说', '大纲'],
      difficulty: '高级',
      type: 'text'
    },
    {
      title: '知乎超能力短篇小说创作',
      prompt: `你是一位经验丰富的知乎盐选专栏作家，擅长创作高赞短篇小说。请创作一篇超过5000字的短篇小说大纲，充满满足感，符合知乎风格。

核心要求：密集的满足感时刻，节奏快，多重转折，出人意料的结局。知乎风格：第一人称叙述。融入知乎特色，如：高赞回答、专业知识、数据分析、案例研究。语言风格：口语化、幽默，偶尔尖锐，善于使用修辞手法如反问、比喻、排比等。适当使用网络流行语/梗，但确保与整体风格协调。

故事背景：高概念/强设定：主角拥有特殊的超能力/金手指。这种能力必须新颖，并在故事发展中起到关键作用。请详细描述这种能力。高冲突/强转折：故事充满激烈的冲突和矛盾。主角将持续遇到挑战和危机，但总能克服并实现逆转。情感共鸣/满足感时刻：主角的人设应有一定缺陷或弱点，但也有独特的魅力和闪光点。主角的经历应与读者产生共鸣，其行动和成长应为读者提供满足感时刻，如：打脸反派、逆袭/复仇、揭露真相、找到爱情等。紧凑节奏/上升悬念：故事节奏紧凑，情节紧凑且相互关联，在关键节点设置悬念以保持读者兴趣。

情节要求：冲突驱动：故事的冲突必须围绕主角展开，紧密相连，随着情节发展不断升级，最终达到高潮和解决。反派驱动：过渡情节中的挑战主要由反派角色创造，难度逐渐增加。反派的动机必须合理，行动逻辑。逻辑一致性：所有情节设计必须合乎逻辑，考虑主角的优势和能力，确保其行动和选择在合理范围内。创新有趣：适当融入新颖的背景或情节点，以增强故事的趣味性和可读性。

大纲要求：标题：简洁、清晰、吸引人，能够概括故事的核心内容或主要冲突，最好带有悬念或转折。知乎问题：提出一个知乎问题，介绍故事的亮点和核心噱头/套路，能够迅速抓住读者的注意力。

角色设定：主角：详细设定主角的姓名、年龄、职业、性格、背景、外貌、特殊能力/金手指、初始弱点/缺陷，以及其目标和动机。主要配角：设定至少2个主要配角。他们可以是主角的朋友、盟友、恋爱对象等。设定他们的基本信息、与主角的关系以及他们在故事中的角色。反派角色：设定至少1个主要反派。设定他们的基本信息、与主角的冲突点、作恶动机以及他们的能力或资源。核心冲突：详细描述主角面临的主要冲突。这个冲突应是故事的中心矛盾，并推动情节发展。

情节大纲：I. 引言/序言 原创内容，不超过180字。简洁语言，直接呈现冲突和极端结果。在结尾设置悬念和转折。每句话应包含不同的情感点，并反映反常特性（异常情况和行为）。标点符号：不要使用标准引号进行对话；请使用「」代替。所有""符号应替换为「」。输出格式：直接创建正文，注意格式化换行。

第一部分。（开篇章节）爆炸性开篇，极其反常且吸引人 情节分解：将开篇章节内容分为5个子情节，总字符数约为2000字符。输出格式：情节：情节点1（3项）+使用【】标记扩展建议 建议字符数：情感点：展示主角性格特征的金句：（金句注释：语言风格应符合知乎社区的特征。可以使用一些网络俚语，以及常见的知乎技巧如反问、比喻和举例。金句应反映你作为知乎用户的独特个性，可以是尖锐、自嘲、幽默、深刻等。金句应能够击中读者的痛点或以其巧妙的幽默让他们微笑。）

第二部分。（延续/发展）格式：同上 + 所有后续格式同上

第三部分。（付费点）内容要求：设置一个付费点。可以包含更多转折，如反派的种种阴谋/阻碍，主角一一应对，打脸反派，密集的满足感时刻。

第四部分。（转折点）内容要求：让读者感到平反：主角强力反击，反派受到惩罚。

第五部分。（结局）内容要求：设计一个戏剧性的结局，有影响力、创新且令人惊喜。`,
      tags: ['知乎', '超能力', '短篇小说', '金手指'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  copywriting: [
    {
      title: '专业文案写手',
      prompt: '我希望你充当专业的文案写手。我会给你一个主题，你需要为这个主题写一篇吸引人的、有创意的文案。文案应该具有以下特点：1. 有吸引力的标题；2. 清晰的结构；3. 生动的语言；4. 强烈的感召力。请确保内容原创且符合目标受众的需求。',
      tags: ['文案', '创意', '营销'],
      difficulty: '中级',
      type: 'text'
    },
    {
      title: '小红书爆款文案策划',
      prompt: `# 角色
假如你是小红书爆款文案策划，你将根据要求创作爆款小红书文案，根据以下规则一步步执行：
# 文案创作技巧：
1.标题采用二极管标题法进行创作，利用人们追求快乐和逃避痛苦的心理，衍生出正刺激和负刺激。例如：正面刺激为产品或方法+只需 N 秒（短期）+ 便可开挂（逆天效果）；负面刺激为你不 X+绝对会后悔（天大损失）+（紧迫感）。
2.使用具有吸引力的标题，使用emoji 表情、标点符号、具有挑战性和悬念的表述。融入热点话题和搜索到各种资料使标题能够抓住读者的眼球，可以多使用感叹号。
3.从给定的爆款关键词列表中选取 1-2 个，增加标题的热度。
4.文案正文的创作应尽量口语化并使用 emoji 的方式来强调重要信息或关键词，加入适当的情感表达引起读者的共鸣。最后一行抽取3-5个搜索关键词，每个关键词用"#"开头，例如"#探店#美食#网红打卡"
5.请根据用户给出的主题，生成相对应的小红书文案。
# 爆款关键词
都给我冲、听我一句劝、真的有被惊艳到、谁懂啊、挖到宝了、我不允许、被问爆了n遍、快来抄作业、惊呆了、答应我一定要试试、可以封神、中国人不骗中国人、后悔没有早点、解锁新品、划走错过一个亿、请大数据把我推给、明星都在用的、有手就会的、必看、保姆教程、直接封神、被夸爆的、快艾特你的XX一起看、跟着买就对了、有手就会、绝绝子、我悟了、流量密码、不走弯路、我又快乐了、吐血整理、福音
# 参考例子：
《🆘 这辈子离不开CCD了！！！》
 宝子们  CCD 跟阳光也太配了吧！直出冷白皮简直无敌了 📷 附调色教程 💖都给我冲，快去试试拍出美美的照片吧！#ccd #相机分享 #氛围感
#极光#
《绝绝子❗️这家泡芙烘焙店好吃到哭！》
我不允许还有姐妹不知道这家泡芙店！！一进店直接给我香迷糊了🤩，浓郁的巧克力酱与泡芙完美融合，简直是巧克力控的福音！都给我冲呀🐛
#网红打卡 #探店 #美食

## 用户给出的主题
帮我写一个重庆火锅探店文案`,
      tags: ['小红书', '爆款文案', '营销', '探店'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  story: [
    {
      title: '故事情节设计师',
      prompt: '作为专业的故事情节设计师，请帮助我构建引人入胜的故事情节。请按照以下步骤：1. 分析故事主题和核心冲突；2. 设计三幕式结构；3. 创造转折点和高潮；4. 安排角色成长弧线；5. 确保情节逻辑合理且具有感染力。',
      tags: ['故事', '情节', '结构'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  blog: [
    {
      title: '博客内容策划师',
      prompt: '担任专业的博客内容策划师，帮助创作高质量的博客文章。请关注：1. 确定目标读者和写作目的；2. 设计吸引人的标题和开头；3. 构建清晰的文章结构；4. 融入SEO优化元素；5. 提供实用的建议和见解。',
      tags: ['博客', 'SEO', '内容营销'],
      difficulty: '中级',
      type: 'text'
    }
  ],
  'code-review': [
    {
      title: '代码审查专家',
      prompt: '作为一名资深的代码审查专家，请仔细审查我提供的代码。关注以下几个方面：1. 代码质量和可读性；2. 性能优化建议；3. 安全性问题；4. 最佳实践的遵循情况；5. 潜在的bug或逻辑错误。请提供具体的改进建议和修改后的代码示例。',
      tags: ['代码审查', '优化', '最佳实践'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  algorithm: [
    {
      title: '算法解释师',
      prompt: '我希望你充当算法导师。当我给你一个算法问题或概念时，请用通俗易懂的语言解释：1. 算法的基本思路和原理；2. 时间和空间复杂度分析；3. 适用场景和局限性；4. 提供清晰的代码实现；5. 举出实际的应用例子。',
      tags: ['算法', '教学', '解释'],
      difficulty: '中级',
      type: 'text'
    }
  ],
  strategy: [
    {
      title: '商业策略顾问',
      prompt: '扮演一位资深商业策略顾问。针对我提出的商业问题，请提供专业的分析和建议：1. 市场分析和竞争环境；2. SWOT分析；3. 可行的战略选择；4. 实施计划和时间表；5. 风险评估和应对策略。请确保建议具有可操作性和实用性。',
      tags: ['战略', '分析', '咨询'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  'ui-design': [
    {
      title: '创意设计师',
      prompt: '作为一名富有创意的设计师，我需要你为我的项目提供设计灵感。请根据我的需求：1. 分析设计目标和受众；2. 提出多个创意概念；3. 描述视觉风格和色彩搭配；4. 解释设计理念和寓意；5. 提供实施建议。让设计既美观又实用。',
      tags: ['设计', '创意', '视觉'],
      difficulty: '中级',
      type: 'text'
    }
  ],
  explain: [
    {
      title: '知识解释专家',
      prompt: '担任一位耐心的教育工作者。当我向你询问任何知识点时，请：1. 用简单易懂的语言解释概念；2. 提供生动的例子或比喻；3. 分步骤说明复杂的过程；4. 提出相关的思考问题；5. 推荐进一步学习的资源。确保解释适合学习者的水平。',
      tags: ['教学', '解释', '学习'],
      difficulty: '中级',
      type: 'text'
    }
  ],
  translation: [
    {
      title: '翻译润色专家',
      prompt: '作为专业的翻译和语言润色专家，请帮助我处理文本。对于翻译任务：1. 准确传达原文含义；2. 保持语言自然流畅；3. 考虑文化差异和语境；4. 提供多个版本供选择。对于润色任务：1. 改进语言表达；2. 增强文章逻辑；3. 保持原作者的风格和语调。',
      tags: ['翻译', '润色', '语言'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  'data-analysis': [
    {
      title: '研究分析师',
      prompt: '扮演一位专业的研究分析师。针对我提出的研究问题：1. 明确研究目标和范围；2. 制定系统的分析框架；3. 收集和整理相关信息；4. 进行深入的分析和推理；5. 得出有依据的结论和建议。确保分析过程客观、严谨、全面。',
      tags: ['研究', '分析', '方法论'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  'digital-marketing': [
    {
      title: '数字营销专家',
      prompt: '作为经验丰富的数字营销专家，请为我的营销活动提供专业建议：1. 分析目标客户群体；2. 制定营销策略和渠道选择；3. 设计吸引人的营销内容；4. 提出效果评估指标；5. 优化建议和改进方案。确保策略既创新又实用。',
      tags: ['数字营销', '策略', '推广'],
      difficulty: '高级',
      type: 'text'
    }
  ],
  figurine: [
    {
      title: '桌面手办提示词',
      prompt: 'a commercial 1/7 scale figurine of the character in the picture was created, depicting a realistic style and a realistic environment. The figurine is placed on a computer desk with a round transparent acrylic base. There is no text on the base. The computer screen shows the Zbrush modeling process of the figurine. Next to the computer screen is a BANDAI-style toy box with the original painting printed on it.',
      tags: ['手办', '3D建模', 'BANDAI'],
      difficulty: '中级',
      type: 'image', // 文生图类型
      sampleImage: 'https://pub-3f8970eda51e4fc595eaf2c37979f683.r2.dev/1e5bcfb8-ac88-4a64-b115-9f21c04835ad.png'
    }
  ],
  character: [
    {
      title: '角色设计提示词',
      prompt: 'Design a character concept art, full body portrait, fantasy character design, detailed armor and clothing, dynamic pose, professional illustration style, high resolution, clean background',
      tags: ['角色设计', '概念艺术', '插画'],
      difficulty: '中级',
      type: 'image'
    }
  ],
  scene: [
    {
      title: '场景生成提示词',
      prompt: 'Epic fantasy landscape, mystical forest with ancient trees, magical lighting, ethereal atmosphere, detailed environment concept art, cinematic composition, high quality rendering',
      tags: ['场景', '环境设计', '奇幻'],
      difficulty: '中级',
      type: 'image'
    }
  ]
}

// 当前选中的分类
const activeCategory = ref('content') // 默认选择第一个分组
const activeCategoryType = ref('group') // 'group' or 'sub'

// 分组展开状态
const expandedGroups = ref<Set<string>>(new Set(['content'])) // 默认展开第一个分组

// 侧边栏是否展开（移动端）
const sidebarExpanded = ref(false)

// 检测是否为移动端
const isMobile = ref(false)

// 悬浮按钮位置 - 使用更精确的初始值
const buttonTop = ref('6.5rem') // 直接设置正确的初始位置

// 检测屏幕尺寸和计算按钮位置
const checkMobile = () => {
  const newIsMobile = window.innerWidth < 768
  isMobile.value = newIsMobile
  
  // 只有在移动端状态发生变化时才重新计算位置
  if (newIsMobile) {
    buttonTop.value = '6.5rem'
  }
  
  // 如果切换到桌面端，确保侧边栏状态正确
  if (!newIsMobile) {
    sidebarExpanded.value = false
    document.body.style.overflow = ''
  }
}

// 使用nextTick确保DOM完全渲染后再计算位置
onMounted(async () => {
  // 等待DOM渲染完成
  await nextTick()
  
  // 延迟一帧确保所有样式都已应用
  window.requestAnimationFrame(() => {
    checkMobile()
  })
  
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.body.style.overflow = ''
})

// 监听侧边栏展开状态，处理滚动穿透
watch(sidebarExpanded, (newVal) => {
  if (newVal && isMobile.value) {
    // 展开时阻止body滚动
    document.body.style.overflow = 'hidden'
  } else {
    // 收起时恢复body滚动
    document.body.style.overflow = ''
  }
})

// 对话框状态
const dialogVisible = ref(false)
const currentDialogPrompt = ref('')
const currentDialogTitle = ref('')

// 复制提示词
const copyPrompt = async (prompt: string) => {
  copy(prompt)
}

// 复制提示词并关闭弹窗
const copyPromptAndClose = async (prompt: string) => {
  copy(prompt)
  dialogVisible.value = false
}

// 显示完整提示词
const showFullPrompt = (title: string, prompt: string) => {
  currentDialogTitle.value = title
  currentDialogPrompt.value = prompt
  dialogVisible.value = true
}

// 截取提示词显示前几行 - 更简单直接的方法
const getPreviewPrompt = (prompt: string) => {
  // 直接按字符数截取，大约2-3行的内容
  if (prompt.length <= 100) {
    return prompt
  }
  return prompt.substring(0, 100) + '...'
}

// 获取子分类的提示词数量
const getSubCategoryCount = (categoryId: string) => {
  return prompts[categoryId]?.length || 0
}

// 获取分组的提示词总数
const getGroupCount = (groupId: string) => {
  const group = categoryGroups.find(g => g.id === groupId)
  if (!group) return 0
  return group.children.reduce((total, child) => total + getSubCategoryCount(child.id), 0)
}

// 切换分组展开状态
const toggleGroupExpanded = (groupId: string) => {
  const expanded = new Set(expandedGroups.value)
  if (expanded.has(groupId)) {
    expanded.delete(groupId)
  } else {
    expanded.add(groupId)
  }
  expandedGroups.value = expanded
}

// 切换分类选择
const selectCategory = (categoryId: string, type: 'group' | 'sub') => {
  if (type === 'group') {
    // 点击分组标题
    activeCategory.value = categoryId
    activeCategoryType.value = 'group'
    // 同时展开该分组
    if (!expandedGroups.value.has(categoryId)) {
      toggleGroupExpanded(categoryId)
    }
  } else {
    // 点击子分类
    activeCategory.value = categoryId
    activeCategoryType.value = 'sub'
  }
  // 移动端自动收起侧边栏
  sidebarExpanded.value = false
}

// 获取当前活跃的提示词
const filteredPrompts = computed(() => {
  if (activeCategoryType.value === 'group') {
    // 显示整个分组下所有子分类的提示词
    const group = categoryGroups.find(g => g.id === activeCategory.value)
    if (!group) return []
    
    const allPrompts: any[] = [] // 添加类型注解
    for (const child of group.children) {
      const childPrompts = prompts[child.id] || []
      // 为每个提示词添加分类信息
      const promptsWithCategory = childPrompts.map((prompt: any) => ({
        ...prompt,
        categoryName: child.name,
        categoryIcon: child.icon
      }))
      allPrompts.push(...promptsWithCategory)
    }
    return allPrompts
  } else {
    // 显示单个子分类的提示词
    return prompts[activeCategory.value] || []
  }
})

// 获取当前分类名称
const getCurrentCategoryName = computed(() => {
  if (activeCategoryType.value === 'group') {
    const group = categoryGroups.find(g => g.id === activeCategory.value)
    return group ? group.name : '未知分组'
  } else {
    for (const group of categoryGroups) {
      const child = group.children.find(c => c.id === activeCategory.value)
      if (child) {
        return `${group.name} - ${child.name}`
      }
    }
    return '未知分类'
  }
})

// 获取难度等级的颜色
const getDifficultyColor = (difficulty: string) => {
  const colors = {
    '初级': 'success',
    '中级': 'warning', 
    '高级': 'danger'
  }
  return colors[difficulty] || 'primary'
}

// 跳转到AI生图页面并带上提示词（新页面打开）
const generateImage = (prompt: string) => {
  const encodedPrompt = encodeURIComponent(prompt)
  const url = `/ai-text-to-image?prompt=${encodedPrompt}`
  window.open(url, '_blank')
}

// 在弹窗中生成图片（新页面打开）
const generateImageAndClose = (prompt: string) => {
  generateImage(prompt)
  dialogVisible.value = false
}

// 新增：跳转到AI对话页面并带上提示词（新页面打开）
const generateText = (prompt: string) => {
  const encodedPrompt = encodeURIComponent(prompt)
  const url = `/ai-chat?prompt=${encodedPrompt}&autoSend=true`
  window.open(url, '_blank')
}

// 在弹窗中生成文本（新页面打开）
const generateTextAndClose = (prompt: string) => {
  generateText(prompt)
  dialogVisible.value = false
}

// 根据提示词类型显示对应的按钮文本
const getActionButtonText = (type: string) => {
  return type === 'image' ? '生成图片' : '文生文'
}

// 根据提示词类型执行对应的操作
const handleAction = (prompt: string, type: string) => {
  if (type === 'image') {
    generateImage(prompt)
  } else {
    generateText(prompt)
  }
}

// 在弹窗中根据类型执行操作
const handleActionAndClose = (prompt: string, type: string) => {
  if (type === 'image') {
    generateImageAndClose(prompt)
  } else {
    generateTextAndClose(prompt)
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1 relative">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="flex flex-1 gap-4 relative">
      <!-- 移动端菜单按钮 -->
      <div 
        v-if="isMobile"
        class="fixed left-4 z-50"
        :style="{ top: buttonTop }"
      >
        <el-button 
          type="primary" 
          circle 
          @click="sidebarExpanded = !sidebarExpanded"
          class="shadow-lg"
        >
          <el-icon><Menu /></el-icon>
        </el-button>
      </div>

      <!-- 移动端遮罩 -->
      <div 
        v-if="sidebarExpanded && isMobile" 
        class="fixed inset-0 bg-black bg-opacity-50 z-40"
        @click="sidebarExpanded = false"
        @touchmove.prevent
      ></div>

      <!-- 左侧分类栏 -->
      <div 
        v-show="!isMobile || sidebarExpanded"
        :class="[
          'bg-white rounded-2xl border border-gray-200 overflow-hidden',
          {
            // 桌面端样式
            'w-80 relative': !isMobile,
            // 移动端样式
            'fixed inset-y-0 left-0 w-80 z-50': isMobile,
            // 动画
            'transition-transform duration-300 ease-in-out': isMobile,
            'translate-x-0': isMobile && sidebarExpanded,
            '-translate-x-full': isMobile && !sidebarExpanded
          }
        ]"
      >
        <div class="h-full overflow-y-auto p-4" @touchmove.stop>
          <h3 class="text-lg font-semibold mb-4 text-gray-700 flex items-center justify-between">
            <span>分类导航</span>
            <el-button 
              v-if="isMobile && sidebarExpanded" 
              type="text" 
              @click="sidebarExpanded = false"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </h3>
          
          <div class="space-y-2">
            <div v-for="group in categoryGroups" :key="group.id" class="border border-gray-100 rounded-lg overflow-hidden">
              <!-- 分组标题 -->
              <div 
                class="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer"
                :class="{ 'bg-blue-50 border-b border-blue-100': activeCategory === group.id && activeCategoryType === 'group' }"
              >
                <div 
                  class="flex items-center gap-2 flex-1"
                  @click="selectCategory(group.id, 'group')"
                >
                  <span class="text-lg">{{ group.icon }}</span>
                  <span :class="[
                    'font-medium',
                    activeCategory === group.id && activeCategoryType === 'group' 
                      ? 'text-blue-600' 
                      : 'text-gray-800'
                  ]">{{ group.name }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {{ getGroupCount(group.id) }}
                  </div>
                  <div 
                    class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 cursor-pointer transition-colors"
                    @click.stop="toggleGroupExpanded(group.id)"
                  >
                    <el-icon class="text-gray-600">
                      <ArrowDown v-if="expandedGroups.has(group.id)" />
                      <ArrowRight v-else />
                    </el-icon>
                  </div>
                </div>
              </div>
              
              <!-- 子分类 -->
              <div 
                v-if="expandedGroups.has(group.id)" 
                class="border-t border-gray-100 bg-gray-50"
              >
                <div 
                  v-for="child in group.children" 
                  :key="child.id"
                  @click="selectCategory(child.id, 'sub')"
                  :class="[
                    'flex items-center justify-between p-3 pl-6 cursor-pointer transition-colors',
                    activeCategory === child.id && activeCategoryType === 'sub'
                      ? 'bg-blue-50 border-r-2 border-blue-500' 
                      : 'hover:bg-white'
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-sm">{{ child.icon }}</span>
                    <span :class="[
                      'text-sm',
                      activeCategory === child.id && activeCategoryType === 'sub'
                        ? 'text-blue-600 font-medium' 
                        : 'text-gray-600'
                    ]">{{ child.name }}</span>
                  </div>
                  <div class="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {{ getSubCategoryCount(child.id) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧内容区 -->
      <div 
        :class="[
          'flex-1 bg-white rounded-2xl border border-gray-200 p-6 overflow-auto',
          isMobile ? 'w-full' : ''
        ]"
      >
        <!-- 标题 -->
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-gray-800 mb-2">{{ getCurrentCategoryName }}</h2>
          <p class="text-gray-600 text-sm">共 {{ filteredPrompts.length }} 个精选提示词</p>
        </div>

        <!-- 提示词列表 -->
        <div v-if="filteredPrompts.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div 
            v-for="(item, index) in filteredPrompts" 
            :key="index"
            class="border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all duration-200 hover:border-gray-300"
          >
            <!-- 标题和难度 -->
            <div class="flex justify-between items-start mb-4">
              <div class="flex-1">
                <h4 class="text-lg font-semibold text-gray-800 mb-1">{{ item.title }}</h4>
                <!-- 分组视图时显示子分类信息 -->
                <div v-if="activeCategoryType === 'group' && item.categoryName" class="flex items-center gap-1 text-sm text-gray-500">
                  <span>{{ item.categoryIcon }}</span>
                  <span>{{ item.categoryName }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <!-- 类型标识 -->
                <el-tag 
                  :type="item.type === 'image' ? 'success' : 'info'" 
                  size="small"
                  effect="plain"
                >
                  {{ item.type === 'image' ? '文生图' : '文生文' }}
                </el-tag>
                <el-tag :type="getDifficultyColor(item.difficulty)" size="small">
                  {{ item.difficulty }}
                </el-tag>
              </div>
            </div>

            <!-- 效果图展示 -->
            <div v-if="item.sampleImage" class="mb-4" v-viewer>
              <img 
                :src="item.sampleImage" 
                :alt="item.title + '效果图'" 
                class="w-full h-40 object-cover rounded-md border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
                :title="'点击预览 ' + item.title + ' 效果图'"
              />
            </div>

            <!-- 标签 -->
            <div class="flex flex-wrap gap-2 mb-4">
              <el-tag 
                v-for="tag in item.tags" 
                :key="tag" 
                size="small" 
                type="info" 
                effect="plain"
              >
                {{ tag }}
              </el-tag>
            </div>

            <!-- 提示词预览 -->
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
              <div class="prompt-preview">
                <pre class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{{ getPreviewPrompt(item.prompt) }}</pre>
              </div>
              <div class="mt-2 flex justify-end">
                <el-button 
                  type="text" 
                  size="small" 
                  @click="showFullPrompt(item.title, item.prompt)"
                  class="text-blue-600 hover:text-blue-800"
                >
                  查看完整提示词
                </el-button>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex justify-end gap-2">
              <el-button type="primary" size="default" @click="copyPrompt(item.prompt)">
                复制提示词
              </el-button>
              <el-button 
                :type="item.type === 'image' ? 'success' : 'warning'" 
                size="default" 
                @click="handleAction(item.prompt, item.type)"
              >
                {{ getActionButtonText(item.type) }}
              </el-button>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-12 text-gray-500">
          <div class="text-4xl mb-4">📝</div>
          <p class="text-lg mb-2">该分类下的提示词正在整理中</p>
          <p class="text-sm">敬请期待更多精彩内容...</p>
        </div>
      </div>
    </div>

    <!-- 提示词详情对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="currentDialogTitle"
      width="60%"
      top="8vh"
      :close-on-click-modal="true"
      class="prompt-dialog"
    >
      <div class="max-h-96 overflow-y-auto">
        <div class="bg-gray-50 p-4 rounded-lg">
          <pre class="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{{ currentDialogPrompt }}</pre>
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-end gap-3">
          <el-button @click="dialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="copyPromptAndClose(currentDialogPrompt)">
            复制提示词
          </el-button>
          <!-- 根据当前显示的提示词类型动态显示按钮 -->
          <el-button 
            v-if="filteredPrompts.find(p => p.prompt === currentDialogPrompt)"
            :type="filteredPrompts.find(p => p.prompt === currentDialogPrompt)?.type === 'image' ? 'success' : 'warning'"
            @click="handleActionAndClose(currentDialogPrompt, filteredPrompts.find(p => p.prompt === currentDialogPrompt)?.type || 'text')"
          >
            {{ getActionButtonText(filteredPrompts.find(p => p.prompt === currentDialogPrompt)?.type || 'text') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 描述 -->
    <ToolDetail title="功能说明" class="mt-4">
      <el-text>
        AI提示词仓库收录了各个领域的顶级提示词，帮助你更好地与AI进行对话。
        <br>• <strong>层级分类</strong>：支持分组展开/收起，可查看分组或子分类
        <br>• <strong>统计准确</strong>：实时显示各分类和分组的提示词数量
        <br>• <strong>质量精选</strong>：每个提示词都经过精心挑选和测试
        <br>• <strong>智能识别</strong>：自动区分文生图和文生文提示词，提供对应操作
        <br>• <strong>响应式设计</strong>：完美适配PC和移动设备
        <br>• <strong>效果预览</strong>：部分提示词提供效果图参考
        <br>• <strong>简洁展示</strong>：提示词预览模式，点击查看完整内容
        <br>• <strong>持续更新</strong>：定期添加新的优质提示词
        <br><br>
        <strong>使用建议：</strong>
        <br>1. 点击分组可查看该分组下所有提示词
        <br>2. 点击子分类查看特定类别的提示词
        <br>3. 点击"查看全部"查看完整提示词内容
        <br>4. 点击复制按钮获取提示词
        <br>5. 文生图提示词点击"生成图片"跳转到AI生图页面
        <br>6. 文生文提示词点击"文生文"跳转到AI对话页面并自动发起对话
        <br>7. 如果你有好的提示词，欢迎提交到<a style="color: blue;" :href="gitUrl+'/issues/new'" target="_blank">GitHub</a>，我们会尽快审核并添加到提示词仓库中
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 文本行数限制 */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 4.5em; /* 约3行的高度 */
}

/* 预览容器最大高度 */
.prompt-preview {
  max-height: 80px;
  overflow: hidden;
  position: relative;
}

.prompt-preview::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20px;
  background: linear-gradient(transparent, #f9fafb);
  pointer-events: none;
}

/* 确保左侧栏在移动端正确显示 */
@media (max-width: 768px) {
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 30;
  }
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 对话框样式优化 */
:deep(.prompt-dialog .el-dialog) {
  border-radius: 12px;
}

:deep(.prompt-dialog .el-dialog__header) {
  padding: 20px 20px 10px 20px;
  border-bottom: 1px solid #f0f0f0;
}

:deep(.prompt-dialog .el-dialog__body) {
  padding: 20px;
}

:deep(.prompt-dialog .el-dialog__footer) {
  padding: 15px 20px 20px 20px;
  border-top: 1px solid #f0f0f0;
}

/* 移动端对话框适配 */
@media (max-width: 768px) {
  :deep(.prompt-dialog .el-dialog) {
    width: 90% !important;
    margin: 0 5%;
  }
}
</style>