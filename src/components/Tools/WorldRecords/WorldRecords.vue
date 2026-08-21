<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

interface RecordItem {
  title: string       // 纪录名称
  record: string      // 数值/纪录内容
  location: string    // 位置/持有者
  desc: string        // 详细描述
}

interface RecordCategory {
  key: string
  name: string
  emoji: string
  desc: string
  items: RecordItem[]
}

// 世界之最数据
const categories: RecordCategory[] = [
  {
    key: 'nature',
    name: '自然地理',
    emoji: '🏔️',
    desc: '地球自然奇观的极限',
    items: [
      {
        title: '世界最高峰',
        record: '8,848.86 米',
        location: '珠穆朗玛峰（中国/尼泊尔）',
        desc: '位于喜马拉雅山脉，是地球上海拔最高的山峰。2020 年中国和尼泊尔联合宣布其高程为 8848.86 米。',
      },
      {
        title: '世界最低点',
        record: '-430.5 米',
        location: '死海（约旦/以色列/巴勒斯坦）',
        desc: '湖面海拔最低的陆地凹陷，湖水含盐量高达 33%，人可以轻松漂浮在水面上。',
      },
      {
        title: '世界最深的海沟',
        record: '-10,984 米',
        location: '马里亚纳海沟（西太平洋）',
        desc: '地球海洋最深处，水压超过 1,000 个大气压。2020 年中国"奋斗者号"载人深潜器下潜至 10,909 米。',
      },
      {
        title: '世界最长河流',
        record: '6,650 公里',
        location: '尼罗河（非洲）',
        desc: '发源于东非高原，流经非洲东部和北部，注入地中海，沿途孕育了古埃及文明。',
      },
      {
        title: '世界流域最广的河流',
        record: '7,050,000 平方公里',
        location: '亚马孙河（南美洲）',
        desc: '流域面积最大、流量最大的河流，注入大西洋，承载了全球约 20% 的淡水入海。',
      },
      {
        title: '世界最大湖泊',
        record: '371,000 平方公里',
        location: '里海（欧亚大陆）',
        desc: '世界面积最大的湖泊，也是世界最大的咸水湖，被俄罗斯、哈萨克斯坦等五国环抱。',
      },
      {
        title: '世界最深湖泊',
        record: '1,642 米',
        location: '贝加尔湖（俄罗斯）',
        desc: '世界最深、蓄水量最大的淡水湖，蕴含全球约 20% 的淡水，是地球上最古老的湖泊之一。',
      },
      {
        title: '世界最大沙漠',
        record: '约 9,000,000 平方公里',
        location: '撒哈拉沙漠（非洲）',
        desc: '世界最大的热沙沙漠，横跨非洲北部多个国家，气温最高可达 57°C。',
      },
      {
        title: '世界最大岛屿',
        record: '2,166,086 平方公里',
        location: '格陵兰岛（丹麦）',
        desc: '世界面积最大的岛屿，约 81% 面积被冰雪覆盖，人口仅约 5.6 万。',
      },
      {
        title: '世界最高瀑布',
        record: '979 米',
        location: '安赫尔瀑布（委内瑞拉）',
        desc: '落差最大的瀑布，落差是尼亚加拉瀑布的 18 倍，从平顶山顶直坠而下。',
      },
      {
        title: '世界最长山系',
        record: '约 8,900 公里',
        location: '安第斯山脉（南美洲）',
        desc: '沿南美洲西岸延伸，几乎与海岸线平行，是世界上最长的大陆山脉。',
      },
      {
        title: '世界最大火山',
        record: '体积约 8,300 万立方公里',
        location: '冒纳罗亚火山（夏威夷）',
        desc: '从海底到山顶总高度超过 9,000 米，超过珠穆朗玛峰海拔，是世界上体积最大的火山。',
      },
    ],
  },
  {
    key: 'country',
    name: '国家之最',
    emoji: '🌍',
    desc: '国家、城市与人口的世界极限',
    items: [
      {
        title: '世界面积最大的国家',
        record: '17,098,242 平方公里',
        location: '俄罗斯',
        desc: '横跨欧亚大陆北部，跨越 11 个时区，是世界面积最大的国家。',
      },
      {
        title: '世界面积最小的国家',
        record: '0.44 平方公里',
        location: '梵蒂冈',
        desc: '位于意大利罗马城内，是天主教教廷所在地，世界人口最少的独立主权国家。',
      },
      {
        title: '世界人口最多的国家',
        record: '约 14.25 亿',
        location: '印度',
        desc: '2023 年超越中国成为世界人口最多的国家，人口密度也居世界前列。',
      },
      {
        title: '世界人口最少的国家',
        record: '约 800 人',
        location: '图瓦卢',
        desc: '太平洋上的岛国，由 9 个珊瑚岛组成，受海平面上升威胁严重。',
      },
      {
        title: '世界最北端的城市',
        record: '北纬 78°55′',
        location: '朗伊尔城（挪威）',
        desc: '世界最北端的永久定居点之一，居民约 2,000 人，冬季会有长达数月的极夜。',
      },
      {
        title: '世界最南端的城市',
        record: '南纬 54°56′',
        location: '乌斯怀亚（阿根廷）',
        desc: '位于火地岛最南端，被誉为"世界尽头"，是前往南极洲的门户城市。',
      },
      {
        title: '世界海拔最高的首都',
        record: '海拔 3,640 米',
        location: '玻利维亚首都拉巴斯',
        desc: '位于安第斯山脉之中，市区平均海拔超过 3,600 米，是世界海拔最高的首都之一。',
      },
      {
        title: '世界最长的国界',
        record: '约 8,893 公里',
        location: '美国-加拿大',
        desc: '包括陆界与水界，是世界最长的国际边界，几乎全部未有军事化。',
      },
      {
        title: '世界海岸线最长的国家',
        record: '约 202,080 公里',
        location: '加拿大',
        desc: '北临北冰洋、东临大西洋、西临太平洋，海岸线曲折破碎，是世界海岸线最长的国家。',
      },
    ],
  },
  {
    key: 'building',
    name: '建筑奇迹',
    emoji: '🏛️',
    desc: '人类建筑史的极限工程',
    items: [
      {
        title: '世界最高建筑',
        record: '828 米 / 163 层',
        location: '哈利法塔（阿联酋迪拜）',
        desc: '2010 年建成，超越台北 101 成为世界最高建筑，名字来源于阿联酋前总统。',
      },
      {
        title: '世界最长跨海大桥',
        record: '55 公里',
        location: '港珠澳大桥（中国）',
        desc: '连接香港、珠海、澳门，世界上最长的跨海大桥，主体工程集桥、岛、隧于一体。',
      },
      {
        title: '世界最长大坝',
        record: '坝长 2,335 米 / 高 185 米',
        location: '三峡大坝（中国）',
        desc: '世界规模最大的水电站，总装机容量 2,250 万千瓦，是世界上最大的水电工程。',
      },
      {
        title: '世界最大单体建筑',
        record: '约 16.5 万平方米',
        location: '新成都大熊猫繁育研究基地熊猫馆（中国）',
        desc: '世界最大的大熊猫主题场馆，结合科研、繁育与科普功能。',
      },
      {
        title: '世界最高的住宅楼',
        record: '472 米 / 95 层',
        location: '432 Park Avenue（美国纽约）',
        desc: '位于曼哈顿中央公园旁，是世界最高的纯住宅摩天大楼之一。',
      },
      {
        title: '世界最古老的现存建筑',
        record: '约公元前 2,500 年',
        location: '吉萨金字塔群（埃及）',
        desc: '现存最古老的大型石砌建筑之一，4,500 年后仍矗立，唯一存留的古代世界七大奇迹。',
      },
      {
        title: '世界最大的宗教建筑',
        record: '面积约 40 万平方米',
        location: '吴哥窟（柬埔寨）',
        desc: '世界上最大的宗教建筑群，原为印度教神庙，后改奉佛教。',
      },
    ],
  },
  {
    key: 'animal',
    name: '动物之最',
    emoji: '🐋',
    desc: '动物王国的极限记录',
    items: [
      {
        title: '世界最大的动物',
        record: '体长 30 米 / 重 180 吨',
        location: '蓝鲸（全球海洋）',
        desc: '地球有史以来最大的动物，超过任何恐龙，心脏重约 180 公斤，每天进食约 4 吨磷虾。',
      },
      {
        title: '世界最高的动物',
        record: '身高 5.7 米',
        location: '长颈鹿（非洲草原）',
        desc: '世界最高的陆生动物，长颈可达 2 米，血压是人类的 2 倍以保证血液能输送到脑部。',
      },
      {
        title: '世界陆地上最大的动物',
        record: '重 6.05 吨',
        location: '非洲象（非洲）',
        desc: '现存最大的陆地动物，肩高可达 3.96 米，鼻子由约 4 万块肌肉构成。',
      },
      {
        title: '世界最快的动物',
        record: '时速 389 公里',
        location: '游隼（全球）',
        desc: '俯冲时速度可达 389 公里/小时，是地球上速度最快的动物。',
      },
      {
        title: '世界陆地上最快的动物',
        record: '时速 110 公里',
        location: '猎豹（非洲）',
        desc: '短距离冲刺可达 110 km/h，但持续时间不超过 30 秒。',
      },
      {
        title: '世界最长寿的动物',
        record: '寿命 400+ 年',
        location: '格陵兰鲨（北冰洋）',
        desc: '已知最长寿的脊椎动物，估计年龄可达 400 岁以上，生长极其缓慢。',
      },
      {
        title: '世界最小的哺乳动物',
        record: '体长 4 厘米',
        location: '大黄蜂蝙蝠（泰国）',
        desc: '世界最小的哺乳动物，体重仅约 2 克，和一枚硬币大小相仿。',
      },
      {
        title: '世界最聪明的动物',
        record: 'IQ 难以量化',
        location: '宽吻海豚',
        desc: '具有复杂的语言系统、自我认知能力，能在镜子里认出自己，脑容量仅次于人类。',
      },
      {
        title: '世界最毒的动物',
        record: '一只可毒死 60 人',
        location: '箱型水母（澳大利亚海域）',
        desc: '世界毒性最强的动物之一，毒液可在 3 分钟内导致心脏骤停。',
      },
    ],
  },
  {
    key: 'plant',
    name: '植物之最',
    emoji: '🌳',
    desc: '植物界的极限记录',
    items: [
      {
        title: '世界最高的树',
        record: '115.92 米',
        location: '亥伯龙神（美国加州红杉国家公园）',
        desc: '世界最高的活体树木，属北美红杉，2023 年测量确认高度。',
      },
      {
        title: '世界最古老的树',
        record: '约 4,853 年',
        location: '玛土撒拉（美国加州白山）',
        desc: '已知最古老的单茎树木之一，直到 2013 年才公布其位置以保护。',
      },
      {
        title: '世界最大的花',
        record: '直径可达 1 米',
        location: '大王花（印度尼西亚）',
        desc: '世界最大的单朵花，又称"尸花"，散发腐肉般的臭味以吸引苍蝇授粉。',
      },
      {
        title: '世界最小的花',
        record: '直径约 1 毫米',
        location: '浮萍花（全球淡水）',
        desc: '世界最小的开花植物，整株长度不超过 1 毫米，花朵肉眼几乎看不见。',
      },
      {
        title: '世界最长寿的植物',
        record: '约 80,000 年',
        location: '潘多（美国犹他州）',
        desc: '一株 8 万年前由同一根系克隆出的颤杨林，是已知最古老最重的单体生物。',
      },
      {
        title: '世界最大的种子',
        record: '重达 17 公斤',
        location: '海椰子（塞舌尔）',
        desc: '世界上最大的种子，需要 6-7 年才能成熟，仅产于塞舌尔群岛。',
      },
    ],
  },
  {
    key: 'human',
    name: '人体之最',
    emoji: '👤',
    desc: '人类身体与寿命的极限',
    items: [
      {
        title: '世界最高的女性',
        record: '身高 2.15 米',
        location: '曾克·伊梅尔（土耳其）',
        desc: '被吉尼斯认证为世界最高的女性，患有罕见的韦弗综合征。',
      },
      {
        title: '世界最高的男性',
        record: '身高 2.72 米',
        location: '罗伯特·瓦德洛（美国）',
        desc: '被称为"阿拉丁"，20 岁时去世，是医学记录中最高的人。',
      },
      {
        title: '世界最矮的人',
        record: '身高 0.546 米',
        location: '钱德拉·巴哈杜尔·唐吉（尼泊尔）',
        desc: '2012 年吉尼斯认证的世界最矮的人，能走能动，外出时使用拐杖。',
      },
      {
        title: '世界最长寿纪录',
        record: '122 岁 164 天',
        location: '让娜·卡尔芒（法国）',
        desc: '1875-1997 年，是有记录以来最长寿的人，已被列入吉尼斯世界纪录。',
      },
      {
        title: '世界最深潜水记录',
        record: '332 米',
        location: '阿赫迈德·加布尔（埃及）',
        desc: '2004 年创下的恒重潜水世界纪录，下潜过程不使用任何外部空气供给。',
      },
      {
        title: '世界最长憋气',
        record: '24 分钟 3 秒',
        location: '布达佩斯·塞德里克（克罗地亚）',
        desc: '2021 年在水下憋气 24 分 3 秒，创下吉尼斯世界纪录。',
      },
    ],
  },
  {
    key: 'tech',
    name: '科技之最',
    emoji: '🚀',
    desc: '现代科技的极限突破',
    items: [
      {
        title: '世界最快的超级计算机',
        record: '1,742 EFLOPS',
        location: 'Frontier（美国橡树岭国家实验室）',
        desc: '2022 年起连续位居 TOP500 榜首，是世界首台突破 Exaflop 门槛的超算。',
      },
      {
        title: '世界最远飞行探测器',
        record: '约 240 亿公里',
        location: '旅行者 1 号（深空）',
        desc: '1977 年发射，是迄今飞得最远的人造物体，已进入星际空间。',
      },
      {
        title: '世界最大单口径射电望远镜',
        record: '口径 500 米',
        location: 'FAST（中国贵州）',
        desc: '世界最大、最灵敏的单口径射电望远镜，被誉为"中国天眼"。',
      },
      {
        title: '世界最大粒子加速器',
        record: '周长 27 公里',
        location: 'LHC（欧洲核子中心）',
        desc: '世界最大、能量最高的粒子加速器，2012 年发现了希格斯玻色子。',
      },
      {
        title: '世界最强运载火箭',
        record: '近地轨道 150 吨级',
        location: 'Starship（SpaceX）',
        desc: '史上运力最强的运载火箭，可完全重复使用，目标是将人类送上火星。',
      },
      {
        title: '世界最快的量产车',
        record: '极速 490 公里/小时',
        location: '布加迪 Chiron Super Sport 300+',
        desc: '2019 年创下量产车极速纪录，是当前汽车工业的速度极限。',
      },
      {
        title: '世界最深的钻孔',
        record: '深 12,262 米',
        location: '科拉超深钻孔（俄罗斯）',
        desc: '前苏联 1970-1994 年间钻探，是世界最深的人造钻孔，温度超过 180°C。',
      },
    ],
  },
  {
    key: 'culture',
    name: '文化之最',
    emoji: '📚',
    desc: '人类文明的史诗记录',
    items: [
      {
        title: '世界使用人数最多的语言',
        record: '母语人口 13 亿+',
        location: '英语（全球）',
        desc: '全球使用人数最多的语言，被 67 个国家列为官方语言。',
      },
      {
        title: '世界最古老的文字',
        record: '约公元前 3,200 年',
        location: '楔形文字（古美索不达米亚）',
        desc: '已知最早的成熟文字系统，由苏美尔人发明。',
      },
      {
        title: '世界最长的史诗',
        record: '约 22,000 行',
        location: '摩诃婆罗多（印度）',
        desc: '世界上最长的史诗，是古印度梵语叙事诗，约 10 倍于荷马史诗的总和。',
      },
      {
        title: '世界最畅销的书',
        record: '销量 50 亿+',
        location: '《圣经》',
        desc: '有史以来发行量最大的书，被翻译成 3,000+ 种语言。',
      },
      {
        title: '世界最大的博物馆',
        record: '面积约 36 万平方米',
        location: '卢浮宫（法国巴黎）',
        desc: '世界最古老、最大、最著名的博物馆之一，藏品约 38 万件。',
      },
      {
        title: '世界最高的山峰圣母像',
        record: '高 22.4 米',
        location: '巴西里约热内卢基督像',
        desc: '矗立在 710 米高的科科瓦多山顶，是世界最著名的宗教雕塑之一。',
      },
    ],
  },
]

const activeCategory = ref<string>('all')
const searchKeyword = ref('')

// 筛选后的分类
const filteredCategories = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  return categories
    .filter((c) => activeCategory.value === 'all' || c.key === activeCategory.value)
    .map((c) => {
      if (!kw) return c
      const matchedItems = c.items.filter(
        (it) =>
          it.title.toLowerCase().includes(kw) ||
          it.record.toLowerCase().includes(kw) ||
          it.location.toLowerCase().includes(kw) ||
          it.desc.toLowerCase().includes(kw),
      )
      return { ...c, items: matchedItems }
    })
    .filter((c) => c.items.length > 0)
})

// 汇总数量
const totalCount = computed(() => categories.reduce((s, c) => s + c.items.length, 0))

const resetFilter = () => {
  activeCategory.value = 'all'
  searchKeyword.value = ''
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="'世界之最'"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 顶部说明 + 统计 -->
      <div class="hero">
        <div class="hero-icon">🌏</div>
        <div class="hero-content">
          <h2 class="hero-title">世界之最大全</h2>
          <p class="hero-sub">
            收录 <strong>{{ totalCount }}</strong> 条世界纪录，覆盖
            <strong>{{ categories.length }}</strong> 个分类：
            自然地理、国家、建筑、动物、植物、人体、科技、文化。
          </p>
        </div>
      </div>

      <!-- 搜索框 -->
      <div class="mb-4">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索纪录名称、数值、位置或描述..."
          clearable
          size="large"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 分类筛选 -->
      <div class="category-tabs">
        <button
          class="tab"
          :class="{ active: activeCategory === 'all' }"
          @click="activeCategory = 'all'"
        >
          <span class="tab-emoji">🌐</span>
          <span>全部</span>
          <span class="tab-count">{{ totalCount }}</span>
        </button>
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="tab"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          <span class="tab-emoji">{{ cat.emoji }}</span>
          <span>{{ cat.name }}</span>
          <span class="tab-count">{{ cat.items.length }}</span>
        </button>
      </div>

      <!-- 结果 -->
      <div v-if="filteredCategories.length === 0" class="empty">
        <el-empty description="未找到匹配的世界纪录">
          <el-button type="primary" @click="resetFilter">重置筛选</el-button>
        </el-empty>
      </div>

      <div v-else>
        <section
          v-for="cat in filteredCategories"
          :key="cat.key"
          class="cat-section"
        >
          <div class="cat-header">
            <span class="cat-emoji">{{ cat.emoji }}</span>
            <div class="cat-info">
              <h3 class="cat-title">{{ cat.name }}</h3>
              <p class="cat-desc">{{ cat.desc }}</p>
            </div>
            <span class="cat-num">{{ cat.items.length }} 条</span>
          </div>

          <div class="card-grid">
            <div v-for="item in cat.items" :key="item.title" class="record-card">
              <div class="card-top">
                <div class="card-title">{{ item.title }}</div>
                <div class="card-record">{{ item.record }}</div>
              </div>
              <div class="card-location">
                <el-icon><LocationFilled /></el-icon>
                <span>{{ item.location }}</span>
              </div>
              <div class="card-desc">{{ item.desc }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="工具简介">
      <el-text>
        这是一份"世界之最"百科图鉴，按自然地理、国家、建筑、动物、植物、人体、科技、文化
        八个维度整理了 {{ totalCount }} 条代表性世界纪录。
        每条记录包含<strong>纪录数值</strong>、<strong>所在地/持有者</strong>以及
        <strong>背景介绍</strong>，适合作为知识科普、学习参考和日常趣味查询。
      </el-text>
    </ToolDetail>

    <ToolDetail title="使用说明">
      <el-text>
        1. 在搜索框输入关键词（如"最高"、"最快"、"中国"）即可实时筛选<br/>
        2. 点击顶部分类标签可切换只查看某一类别的世界之最<br/>
        3. 卡片左上显示纪录名称，下方数字为纪录具体数值与单位<br/>
        4. 数据来自公开资料，部分数值（如峰高、海拔）会随官方重新测量而更新，仅供参考
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #eef2ff 0%, #f0f9ff 50%, #ecfeff 100%);
  border: 1px solid #e0e7ff;
}
.hero-icon {
  font-size: 2.5rem;
  line-height: 1;
}
.hero-content {
  flex: 1;
}
.hero-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.25rem 0;
}
.hero-sub {
  font-size: 0.875rem;
  color: #475569;
  margin: 0;
  line-height: 1.6;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  font-size: 0.875rem;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}
.tab:hover {
  background: #e5e7eb;
}
.tab.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
.tab-emoji {
  font-size: 1rem;
}
.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  padding: 0 0.35rem;
  height: 1.2rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
}
.tab.active .tab-count {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.cat-section {
  margin-top: 1.5rem;
}
.cat-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
  border-bottom: 2px dashed #e5e7eb;
}
.cat-emoji {
  font-size: 1.75rem;
  line-height: 1;
}
.cat-info {
  flex: 1;
}
.cat-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
}
.cat-desc {
  margin: 0.15rem 0 0 0;
  font-size: 0.8125rem;
  color: #64748b;
}
.cat-num {
  font-size: 0.75rem;
  color: #6366f1;
  background: #eef2ff;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.85rem;
}

.record-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.85rem;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  transition: all 0.2s ease;
}
.record-card:hover {
  border-color: #a5b4fc;
  box-shadow: 0 6px 18px -6px rgba(99, 102, 241, 0.25);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
}
.card-record {
  font-size: 1.1rem;
  font-weight: 700;
  color: #6366f1;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.01em;
}

.card-location {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8125rem;
  color: #475569;
  font-weight: 500;
}
.card-location .el-icon {
  font-size: 0.95rem;
  color: #ef4444;
}

.card-desc {
  font-size: 0.8125rem;
  color: #4b5563;
  line-height: 1.55;
}

.empty {
  padding: 2rem 0;
}

@media (max-width: 768px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }
  .card-grid {
    grid-template-columns: 1fr;
  }
  .cat-header {
    flex-wrap: wrap;
  }
}
</style>