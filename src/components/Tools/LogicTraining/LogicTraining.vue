<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

// 题型类型
type QuestionType = 'truth-lie' | 'logic' | 'math' | 'sequence'

// 题目接口
interface Question {
  id: number
  type: QuestionType
  typeLabel: string
  difficulty: 'easy' | 'medium' | 'hard'
  difficultyLabel: string
  title: string
  content: string
  options?: string[]
  answer: string | string[]
  explanation: string
}

// 题库
const questions: Question[] = [
  // 真话谎话题
  {
    id: 1,
    type: 'truth-lie',
    typeLabel: '真话谎话题',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '骑士与无赖',
    content: '一个岛上住着骑士（永远说真话）和无赖（永远说谎话）。你遇到一个人，他说："我是骑士。"请问这个人是什么身份？',
    options: ['骑士', '无赖', '无法确定'],
    answer: '无法确定',
    explanation: '骑士说"我是骑士"是陈述事实（真话），无赖说"我是骑士"是在撒谎（因为实际是无赖）。所以两种身份的人都可能说这句话，无法确定他的身份。'
  },
  {
    id: 2,
    type: 'truth-lie',
    typeLabel: '真话谎话题',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '岔路口的抉择',
    content: '你来到一个岔路口，一条路通往宝藏，另一条通往死胡同。路口有两个人，甲和乙。其中一个是骑士（永远说真话），一个是无赖（永远说谎话），但你不知道谁是哪个。你应该问什么问题才能找到通往宝藏的路？',
    options: ['问甲："乙是骑士吗？"', '问甲："哪条路通往宝藏？"', '问甲："如果我问乙哪条路通往宝藏，他会怎么回答？"', '问甲："你是骑士吗？"'],
    answer: '问甲："如果我问乙哪条路通往宝藏，他会怎么回答？"',
    explanation: '无论甲是骑士还是无赖，他都会指向死胡同的那条路。所以选择相反的路就是宝藏之路。这是经典的"嵌套问题"技巧。'
  },
  {
    id: 3,
    type: 'truth-lie',
    typeLabel: '真话谎话题',
    difficulty: 'hard',
    difficultyLabel: '困难',
    title: '三个人的身份',
    content: '甲、乙、丙三人中有一个是骑士（永远说真话），一个是无赖（永远说谎话），一个是间谍（有时说真话有时说谎话）。甲说："我是间谍。"乙说："甲说的没错。"丙说："我不是间谍。"请确定三人的身份。',
    options: ['甲是间谍，乙是无赖，丙是骑士', '甲是间谍，乙是骑士，丙是无赖', '甲是骑士，乙是间谍，丙是无赖', '无法确定'],
    answer: '甲是间谍，乙是无赖，丙是骑士',
    explanation: '骑士不会说自己是间谍（撒谎），所以甲不是骑士。如果甲是无赖，那他说"我是间谍"就是谎话，意味着他不是间谍也不是骑士，矛盾。所以甲是间谍。乙说"甲说的没错"是谎话（因为甲是间谍，说"我是间谍"有时是真有时是假），所以乙是无赖。剩下的丙是骑士。'
  },

  // 逻辑推理题
  {
    id: 4,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '谁偷了蛋糕',
    content: '办公室的蛋糕被偷吃了。老板问了四个人：甲说"是乙偷的"，乙说"是丁偷的"，丙说"我没偷"，丁说"乙在撒谎"。已知只有一个人说了真话，谁偷了蛋糕？',
    options: ['甲', '乙', '丙', '丁'],
    answer: '丙',
    explanation: '假设丙偷了：甲说谎（不是乙），乙说谎（不是丁），丙说谎（他偷了），丁说真话（乙确实在撒谎）。只有丁说真话，符合条件。'
  },
  {
    id: 5,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '帽子颜色',
    content: '三个人排成一列，面向前方。后面的人能看到前面所有人的帽子，前面的人看不到任何人的帽子。给他们戴上帽子（共3顶红帽和2顶白帽，随机取3顶）。最后一个人说"我不知道我的帽子颜色"，中间的人也说"我不知道"，最前面的人说"我知道我的帽子是红色的"。为什么最前面的人能确定？',
    options: ['因为他看到了别人的帽子', '因为后面两人的回答排除了白色可能', '因为他运气好', '因为他数过帽子数量'],
    answer: '因为后面两人的回答排除了白色可能',
    explanation: '如果最后两人看到两顶白帽，他们就能确定自己是红色。最后的人不知道，说明前两人不全是白色。中间的人不知道，说明即使看到前面是白色，他也不能确定自己是白色（因为最后的人没确定），所以中间的人一定看到前面是红色，但他自己不能确定，说明前面是红色且他自己是白色时最后的人也应该不知道。综合推断，最前面的人一定是红色。'
  },
  {
    id: 6,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'hard',
    difficultyLabel: '困难',
    title: '爱因斯坦的谜题',
    content: '五栋不同颜色的房子，住着五个不同国籍的人。每个人喝不同的饮料，养不同的宠物，抽不同的香烟。已知：①英国人住红色房子；②瑞典人养狗；③丹麦人喝茶；④绿色房子在白色房子左边；⑤绿色房子主人喝咖啡；⑥抽Pall Mall香烟养鸟；⑦黄色房子主人抽Dunhill；⑧住中间房子的人喝牛奶；⑨挪威人住第一间房；⑩抽Blends香烟的人住在养猫人隔壁；⑪养马的人住抽Dunhill的人隔壁；⑫抽Blue Master的人喝啤酒；⑬德国人抽Prince；⑭挪威人住蓝色房子隔壁；⑮抽Blends香烟的人有个喝水的邻居。谁养鱼？',
    options: ['英国人', '瑞典人', '丹麦人', '挪威人', '德国人'],
    answer: '德国人',
    explanation: '通过逻辑推理可以得出：①挪威人-黄房-水-Dunhill-猫；②丹麦人-蓝房-茶-Blends-马；③英国人-红房-奶-Pall Mall-鸟；④德国人-绿房-咖啡-Prince-鱼；⑤瑞典人-白房-啤酒-Blue Master-狗。所以德国人养鱼。'
  },

  // 数学思维题
  {
    id: 7,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '蜗牛爬井',
    content: '一只蜗牛掉进一口10米深的井里。白天它向上爬3米，晚上睡觉时滑下2米。请问蜗牛第几天能爬出井口？',
    options: ['10天', '8天', '9天', '7天'],
    answer: '8天',
    explanation: '前7天蜗牛每天净上升1米，7天后到达7米高度。第8天白天爬3米就能到达10米，爬出井口了。'
  },
  {
    id: 8,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '狼羊白菜过河',
    content: '一个农夫带着一只狼、一只羊和一颗白菜要过河。小船只能容纳农夫和一样物品。如果农夫不在，狼会吃羊，羊会吃白菜。农夫如何把所有东西都安全运过河？',
    options: ['先运狼', '先运羊', '先运白菜', '不可能完成'],
    answer: '先运羊',
    explanation: '正确顺序：①带羊过河，空船返回；②带狼过河，带羊返回；③带白菜过河，空船返回；④带羊过河。这样所有物品都安全过河了。'
  },
  {
    id: 9,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'hard',
    difficultyLabel: '困难',
    title: '倒水问题',
    content: '你有一个5升的水壶和一个3升的水壶，无限量的水。如何准确量出4升水？',
    options: [
      '5升壶装满，倒入3升壶，把3升壶倒空，把5升壶剩下的2升倒入3升壶，5升壶装满，倒入3升壶至满，5升壶剩下4升',
      '3升壶装满倒入5升壶，重复一次，3升壶再装满倒入5升壶至满，3升壶剩1升，把5升壶倒空，把1升倒入5升壶，3升壶装满倒入5升壶',
      '5升壶装满，倒入3升壶，把3升壶倒空，重复两次',
      '直接估计4升'
    ],
    answer: '5升壶装满，倒入3升壶，把3升壶倒空，把5升壶剩下的2升倒入3升壶，5升壶装满，倒入3升壶至满，5升壶剩下4升',
    explanation: '步骤：①5升壶装满（5,0）；②倒入3升壶（2,3）；③倒空3升壶（2,0）；④把5升壶的2升倒入3升壶（0,2）；⑤5升壶装满（5,2）；⑥倒入3升壶至满（3升壶已有2升，只能再装1升）（4,3）。完成！5升壶里正好4升。'
  },

  // 序列推理题
  {
    id: 10,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '数字序列',
    content: '请找出规律，填入下一个数字：1, 1, 2, 3, 5, 8, 13, ?',
    options: ['18', '20', '21', '26'],
    answer: '21',
    explanation: '这是斐波那契数列，每个数字是前两个数字之和：1+1=2, 1+2=3, 2+3=5, 3+5=8, 5+8=13, 8+13=21。'
  },
  {
    id: 11,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '字母序列',
    content: '请找出规律，填入下一个字母：O, T, T, F, F, S, S, ?',
    options: ['E', 'N', 'T', 'S'],
    answer: 'E',
    explanation: '这是英文数字首字母序列：One(1), Two(2), Three(3), Four(4), Five(5), Six(6), Seven(7), Eight(8)...所以答案是E。'
  },
  {
    id: 12,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'hard',
    difficultyLabel: '困难',
    title: '复杂序列',
    content: '请找出规律，填入下一个数字：2, 6, 12, 20, 30, 42, ?',
    options: ['50', '54', '56', '60'],
    answer: '56',
    explanation: '方法一：相邻两数之差是4, 6, 8, 10, 12，构成偶数数列，下一个差是14，所以42+14=56。方法二：第n项是n×(n+1)，即1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42, 7×8=56。'
  },

  // ========== 新增题目 ==========

  // 真话谎话题
  {
    id: 13,
    type: 'truth-lie',
    typeLabel: '真话谎话题',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '自我介绍',
    content: '岛上住着骑士（永远说真话）和无赖（永远说谎话）。你遇到一个人，他说："我是无赖。"请问这个人是什么身份？',
    options: ['骑士', '无赖', '无法确定', '这种情况不可能'],
    answer: '这种情况不可能',
    explanation: '骑士永远说真话，不会说"我是无赖"（谎话）。无赖永远说谎话，不会说"我是无赖"（真话）。所以在标准设定下，没有人会说这句话！这是一个经典的逻辑悖论问题。'
  },
  {
    id: 14,
    type: 'truth-lie',
    typeLabel: '真话谎话题',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '两兄弟',
    content: '一对兄弟，一个永远说真话，一个永远说谎话。你想知道哪条路去学校，应该问其中一个人什么问题？',
    options: ['"你是哥哥吗？"', '"哪条路去学校？"', '"如果我问你兄弟哪条路去学校，他会怎么回答？"', '"你家住在哪里？"'],
    answer: '"如果我问你兄弟哪条路去学校，他会怎么回答？"',
    explanation: '无论你问的是说真话的还是说谎话的，他们都会指向错误的路。说真话的会如实转述兄弟的谎话，说谎话的会谎报兄弟的真话。所以选择相反的路就是正确的。'
  },
  {
    id: 15,
    type: 'truth-lie',
    typeLabel: '真话谎话题',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '三个人的陈述',
    content: '甲、乙、丙三人中有一个骑士（永远真话），两个无赖（永远谎话）。甲说："乙是骑士。"乙说："丙不是骑士。"丙说："甲和乙都是无赖。"请问谁是骑士？',
    options: ['甲', '乙', '丙', '无法确定'],
    answer: '丙',
    explanation: '逐一假设：若甲是骑士→乙也是骑士（甲说的），矛盾（只有一个骑士）；若乙是骑士→甲说谎（乙不是骑士），丙说谎（甲和乙不都是无赖），但乙是骑士意味着甲是无赖，丙说"甲和乙都是无赖"是谎话，这个假设看似成立。但仔细检查：若乙是骑士，则甲说"乙是骑士"是真话，但甲是无赖应该说谎，矛盾！；若丙是骑士→甲、乙都是无赖。验证：甲说"乙是骑士"是谎话✓，乙说"丙不是骑士"是谎话✓（丙是骑士），符合！所以丙是骑士。'
  },

  // 逻辑推理题
  {
    id: 16,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '排队问题',
    content: 'A、B、C、D四人排队。已知：A不在第一；B不在最后；C在A前面；D紧跟在B后面。请从前往后排出顺序。',
    options: ['C-A-B-D', 'C-B-D-A', 'B-D-C-A', 'C-A-D-B'],
    answer: 'C-A-B-D',
    explanation: '由"C在A前面"排除A在C前；由"D紧跟B后面"只能是B-D组合；B不在最后且B-D组合，所以B只能是第2或第3；A不在第一，C在A前面，所以C必须是第一。A只能是第二或第三。如果A是第二，B-D只能是第三四，顺序C-A-B-D。验证：A不在第一✓，B不在最后✓，C在A前✓，D紧跟B✓。'
  },
  {
    id: 17,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '谁在说真话',
    content: '甲说："我们四个人都在说谎。"乙说："我们之中只有一个人在说真话。"丙说："我们之中只有两个人在说真话。"丁说："我们之中只有三个人在说真话。"请问谁在说真话？',
    options: ['甲', '乙', '丙', '丁'],
    answer: '乙',
    explanation: '甲说"四人都在说谎"，如果是真话，则甲也在说谎，矛盾。所以甲在说谎。乙说"只有一人说真话"，如果乙说真话，则只有乙一人说真话，其他三人说谎，这是自洽的。如果丙说真话，则两人说真话，矛盾。如果丁说真话，则三人说真话，矛盾。所以只有乙说真话。'
  },
  {
    id: 18,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '职业推理',
    content: '甲、乙、丙三人分别是医生、教师和律师（顺序不确定）。已知：甲不是医生；医生的年龄比教师大；丙的年龄比医生大。请确定三人的职业。',
    options: ['甲是医生，乙是教师，丙是律师', '甲是教师，乙是律师，丙是医生', '甲是律师，乙是教师，丙是医生', '甲是律师，乙是医生，丙是教师'],
    answer: '甲是教师，乙是律师，丙是医生',
    explanation: '甲不是医生。丙比医生大，所以丙不是医生。因此乙是医生。丙的年龄比医生（乙）大，医生比教师大，所以年龄顺序：丙 > 乙(医生) > 教师。甲不是医生且年龄最小，所以甲是教师，丙是律师。'
  },
  {
    id: 19,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'hard',
    difficultyLabel: '困难',
    title: '五个人的座位',
    content: '五个人A、B、C、D、E坐成一排。已知：A不坐两端；B和C不相邻；D坐在正中间；E的左边是B。请问从左到右的座位顺序是？',
    options: ['B-E-A-D-C', 'C-A-E-D-B', 'A-B-E-D-C', 'B-A-C-D-E'],
    answer: 'B-E-A-D-C',
    explanation: 'D在正中间（第3位）。E的左边是B，所以B-E组合，B在第1位时E在第2位。A不坐两端，A可以是第2或4位。但E在第2位，所以A在第4位。剩下的C在第5位。验证：A不在两端✓，B和C不相邻✓（B在第1，C在第5），D在中间✓，E左边是B✓。顺序：B-E-A-D-C。'
  },
  {
    id: 20,
    type: 'logic',
    typeLabel: '逻辑推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '谁打破了花瓶',
    content: '妈妈问四个孩子谁打破了花瓶。甲说："是乙打破的。"乙说："是丁打破的。"丙说："不是我打破的。"丁说："乙在撒谎。"已知只有一个人说了真话，谁打破了花瓶？',
    options: ['甲', '乙', '丙', '丁'],
    answer: '丙',
    explanation: '逐一假设验证：若甲打破→甲说谎、乙说谎、丙说真话、丁说真话（2人说真话矛盾）；若乙打破→甲说真话、乙说谎、丙说真话、丁说谎（2人说真话矛盾）；若丙打破→甲说谎（不是乙）、乙说谎（不是丁）、丙说谎（就是丙打破的）、丁说真话（乙确实撒谎），只有丁1人说真话✓；若丁打破→甲说谎、乙说真话、丙说真话、丁说谎（2人说真话矛盾）。所以是丙打破的。'
  },

  // 数学思维题
  {
    id: 21,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '鸡兔同笼',
    content: '一个笼子里有鸡和兔共10只，数脚共有28只。请问鸡有几只？',
    options: ['4只', '5只', '6只', '7只'],
    answer: '6只',
    explanation: '设鸡x只，兔y只。x+y=10，2x+4y=28。解得x=6，y=4。所以鸡有6只。'
  },
  {
    id: 22,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '分糖果',
    content: '5个小朋友分20个糖果，要求每个人至少分到2个，且每人分到的数量都不相同。请问分到最多糖果的小朋友能分到几个？',
    options: ['5个', '6个', '7个', '8个'],
    answer: '6个',
    explanation: '每人至少2个且数量不同，最小的分配是2、3、4、5、6，和为20。这正好用完所有糖果，所以最多的小朋友分到6个。'
  },
  {
    id: 23,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '过桥问题',
    content: '四个人过桥，分别需要1、2、5、10分钟。桥一次最多过两人，需要手电筒（只有一支），过桥必须带手电筒回送。四人全部过桥最少需要几分钟？',
    options: ['17分钟', '19分钟', '21分钟', '22分钟'],
    answer: '17分钟',
    explanation: '最优策略：①1和2过桥（2分钟），1回送（1分钟）；②5和10过桥（10分钟），2回送（2分钟）；③1和2过桥（2分钟）。总计：2+1+10+2+2=17分钟。'
  },
  {
    id: 24,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '分金条',
    content: '你有一根7米长的金条，只能切两刀，要求每天给工人付1米长金条，共7天。应该怎么切？',
    options: ['切成1米、2米、4米', '切成1米、1米、5米', '切成1米、3米、3米', '切成2米、2米、3米'],
    answer: '切成1米、2米、4米',
    explanation: '切成1、2、4米三段。第1天给1米；第2天给2米，收回1米；第3天给1+2=3米；第4天给4米，收回1+2；第5天给4+1=5米；第6天给4+2=6米，收回1；第7天给4+2+1=7米。完美！这是二进制分割的应用。'
  },
  {
    id: 25,
    type: 'math',
    typeLabel: '数学思维',
    difficulty: 'hard',
    difficultyLabel: '困难',
    title: '25匹马赛跑',
    content: '有25匹马，每次只能赛5匹，没有计时器，只能知道相对名次。最少需要几次比赛才能找出最快的3匹马？',
    options: ['5次', '6次', '7次', '8次'],
    answer: '7次',
    explanation: '①先分5组预赛（5次）；②5组冠军再赛一次（第6次），找出最快的马。假设各组冠军排名是A>B>C>D>E，则D、E组全部淘汰，C组只有C1可能进前3，B组B1、B2可能，A组A1、A2、A3可能；③让A2、A3、B1、B2、C1赛一次（第7次），前2名配合A1就是总前3。所以共需7次。'
  },

  // 序列推理题
  {
    id: 26,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '等差数列',
    content: '请找出规律，填入下一个数字：3, 7, 11, 15, 19, ?',
    options: ['21', '22', '23', '24'],
    answer: '23',
    explanation: '这是等差数列，相邻两数之差都是4：19+4=23。'
  },
  {
    id: 27,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '平方数列',
    content: '请找出规律，填入下一个数字：4, 9, 16, 25, 36, ?',
    options: ['42', '45', '47', '49'],
    answer: '49',
    explanation: '这是平方数列：2²=4, 3²=9, 4²=16, 5²=25, 6²=36, 7²=49。'
  },
  {
    id: 28,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '交替数列',
    content: '请找出规律，填入下一个数字：1, 2, 4, 7, 11, 16, ?',
    options: ['20', '21', '22', '23'],
    answer: '22',
    explanation: '相邻两数之差是：1, 2, 3, 4, 5...下一个差应该是6，所以16+6=22。'
  },
  {
    id: 29,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '双重规律',
    content: '请找出规律，填入下一个数字：2, 5, 11, 23, 47, ?',
    options: ['90', '92', '94', '95'],
    answer: '95',
    explanation: '规律是：前一项×2+1=后一项。2×2+1=5, 5×2+1=11, 11×2+1=23, 23×2+1=47, 47×2+1=95。'
  },
  {
    id: 30,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '交替运算',
    content: '请找出规律，填入下一个数字：1, 4, 7, 10, 13, 16, ?',
    options: ['17', '18', '19', '20'],
    answer: '19',
    explanation: '这是等差数列，相邻两数之差都是3：16+3=19。'
  },
  {
    id: 31,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'hard',
    difficultyLabel: '困难',
    title: '三角数',
    content: '请找出规律，填入下一个数字：1, 3, 6, 10, 15, 21, ?',
    options: ['26', '27', '28', '29'],
    answer: '28',
    explanation: '这是三角数列（也叫三角形数）：第n个三角数是1+2+3+...+n=n(n+1)/2。1=1, 3=1+2, 6=1+2+3, 10=1+2+3+4, 15=1+2+3+4+5, 21=1+2+3+4+5+6, 28=1+2+3+4+5+6+7。'
  },
  {
    id: 32,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '字母数字对应',
    content: '请找出规律，填入下一个字母：J, F, M, A, M, J, ?',
    options: ['A', 'J', 'S', 'O'],
    answer: 'J',
    explanation: '这是英文月份首字母序列：January(1月), February(2月), March(3月), April(4月), May(5月), June(6月), July(7月)...所以答案是J。'
  },
  {
    id: 33,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '平方数列进阶',
    content: '请找出规律，填入下一个数字：1, 4, 9, 16, 25, 36, 49, 64, 81, ?',
    options: ['90', '95', '100', '121'],
    answer: '100',
    explanation: '这是平方数列：1², 2², 3², 4², 5², 6², 7², 8², 9², 10²。所以答案是100。'
  },
  {
    id: 34,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'medium',
    difficultyLabel: '中等',
    title: '立方数列',
    content: '请找出规律，填入下一个数字：1, 8, 27, 64, 125, ?',
    options: ['150', '175', '200', '216'],
    answer: '216',
    explanation: '这是立方数列：1³=1, 2³=8, 3³=27, 4³=64, 5³=125, 6³=216。'
  },
  {
    id: 35,
    type: 'sequence',
    typeLabel: '序列推理',
    difficulty: 'easy',
    difficultyLabel: '简单',
    title: '倍增数列',
    content: '请找出规律，填入下一个数字：2, 4, 8, 16, 32, ?',
    options: ['48', '56', '64', '72'],
    answer: '64',
    explanation: '每个数字是前一个数字的2倍：2×2=4, 4×2=8, 8×2=16, 16×2=32, 32×2=64。'
  }
]

// 状态
const currentType = ref<QuestionType | 'all'>('all')
const currentDifficulty = ref<'all' | 'easy' | 'medium' | 'hard'>('all')
const currentQuestion = ref<Question | null>(null)
const lastQuestionId = ref<number>(-1)
const selectedAnswer = ref<string>('')
const showResult = ref(false)
const isCorrect = ref(false)
const stats = ref({
  total: 0,
  correct: 0,
  streak: 0,
  skipped: 0
})

// 过滤后的题目列表
const filteredQuestions = computed(() => {
  return questions.filter(q => {
    if (currentType.value !== 'all' && q.type !== currentType.value) return false
    if (currentDifficulty.value !== 'all' && q.difficulty !== currentDifficulty.value) return false
    return true
  })
})

// 随机选择题目（避免连续重复）
const getRandomQuestion = () => {
  if (filteredQuestions.value.length === 0) return null
  if (filteredQuestions.value.length === 1) return filteredQuestions.value[0]

  let newIndex: number
  let attempts = 0
  const maxAttempts = 10

  do {
    newIndex = Math.floor(Math.random() * filteredQuestions.value.length)
    attempts++
  } while (
    filteredQuestions.value[newIndex].id === lastQuestionId.value &&
    attempts < maxAttempts &&
    filteredQuestions.value.length > 1
  )

  return filteredQuestions.value[newIndex]
}

// 开始新题目
const startNewQuestion = () => {
  currentQuestion.value = getRandomQuestion()
  if (currentQuestion.value) {
    lastQuestionId.value = currentQuestion.value.id
  }
  selectedAnswer.value = ''
  showResult.value = false
  isCorrect.value = false
}

// 跳过当前题目
const skipQuestion = () => {
  stats.value.skipped++
  stats.value.streak = 0
  startNewQuestion()
}

// 提交答案
const submitAnswer = () => {
  if (!currentQuestion.value || !selectedAnswer.value) return

  showResult.value = true
  stats.value.total++

  const correct = currentQuestion.value.answer
  if (selectedAnswer.value === correct) {
    isCorrect.value = true
    stats.value.correct++
    stats.value.streak++
  } else {
    isCorrect.value = false
    stats.value.streak = 0
  }
}

// 获取难度颜色
const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return 'success'
    case 'medium': return 'warning'
    case 'hard': return 'danger'
    default: return 'info'
  }
}

// 初始化
startNewQuestion()
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="逻辑思维训练"></DetailHeader>

    <!-- 主内容区 -->
    <div class="p-4 rounded-2xl bg-white">
      <!-- 筛选器 -->
      <div class="flex flex-wrap gap-3 mb-6">
        <el-select v-model="currentType" placeholder="选择题型" style="width: 140px" @change="startNewQuestion">
          <el-option label="全部题型" value="all"></el-option>
          <el-option label="真话谎话题" value="truth-lie"></el-option>
          <el-option label="逻辑推理" value="logic"></el-option>
          <el-option label="数学思维" value="math"></el-option>
          <el-option label="序列推理" value="sequence"></el-option>
        </el-select>

        <el-select v-model="currentDifficulty" placeholder="选择难度" style="width: 120px" @change="startNewQuestion">
          <el-option label="全部难度" value="all"></el-option>
          <el-option label="简单" value="easy"></el-option>
          <el-option label="中等" value="medium"></el-option>
          <el-option label="困难" value="hard"></el-option>
        </el-select>

        <div class="ml-auto flex gap-4 text-sm">
          <div class="flex items-center gap-1">
            <span class="text-gray-500">已答:</span>
            <span class="font-bold text-gray-800">{{ stats.total }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-gray-500">正确:</span>
            <span class="font-bold text-green-600">{{ stats.correct }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-gray-500">正确率:</span>
            <span class="font-bold" :class="stats.total > 0 ? (stats.correct / stats.total >= 0.6 ? 'text-green-600' : 'text-red-500') : 'text-gray-800'">
              {{ stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0 }}%
            </span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-gray-500">连胜:</span>
            <span class="font-bold text-blue-600">{{ stats.streak }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-gray-500">跳过:</span>
            <span class="font-bold text-gray-600">{{ stats.skipped }}</span>
          </div>
        </div>
      </div>

      <!-- 题目卡片 -->
      <div v-if="currentQuestion" class="max-w-3xl mx-auto">
        <!-- 题目标签 -->
        <div class="flex gap-2 mb-4">
          <el-tag :type="getDifficultyColor(currentQuestion.difficulty)" size="small">
            {{ currentQuestion.difficultyLabel }}
          </el-tag>
          <el-tag type="info" size="small">{{ currentQuestion.typeLabel }}</el-tag>
        </div>

        <!-- 题目内容 -->
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
          <h3 class="text-lg font-bold text-gray-800 mb-3">{{ currentQuestion.title }}</h3>
          <p class="text-gray-700 leading-relaxed whitespace-pre-line">{{ currentQuestion.content }}</p>
        </div>

        <!-- 答案选项 -->
        <div v-if="!showResult" class="space-y-3 mb-6">
          <div
            v-for="option in currentQuestion.options"
            :key="option"
            class="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:border-blue-400 hover:bg-blue-50"
            :class="selectedAnswer === option ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
            @click="selectedAnswer = option"
          >
            <div class="flex items-center gap-3">
              <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                :class="selectedAnswer === option ? 'border-blue-500 bg-blue-500' : 'border-gray-300'">
                <div v-if="selectedAnswer === option" class="w-2 h-2 rounded-full bg-white"></div>
              </div>
              <span class="text-gray-700">{{ option }}</span>
            </div>
          </div>
        </div>

        <!-- 结果显示 -->
        <div v-else class="mb-6">
          <div
            class="p-4 rounded-xl border-2 mb-4"
            :class="isCorrect ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'"
          >
            <div class="flex items-center gap-3 mb-2">
              <span class="text-2xl">{{ isCorrect ? '🎉' : '😔' }}</span>
              <span class="text-lg font-bold" :class="isCorrect ? 'text-green-700' : 'text-red-700'">
                {{ isCorrect ? '回答正确！' : '回答错误' }}
              </span>
            </div>
            <p class="text-gray-600" v-if="!isCorrect">
              你的选择：<span class="font-bold text-red-600">{{ selectedAnswer }}</span>
            </p>
            <p class="text-gray-600 mt-1">
              正确答案：<span class="font-bold" :class="isCorrect ? 'text-green-700' : 'text-gray-800'">{{ currentQuestion.answer }}</span>
            </p>
          </div>

          <!-- 解析 -->
          <div class="bg-amber-50 rounded-xl p-5 border border-amber-200">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-lg">💡</span>
              <span class="font-bold text-amber-800">答案解析</span>
            </div>
            <p class="text-gray-700 leading-relaxed">{{ currentQuestion.explanation }}</p>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-center gap-4">
          <template v-if="!showResult">
            <el-button size="large" @click="skipQuestion">
              换一题
            </el-button>
            <el-button
              type="primary"
              size="large"
              :disabled="!selectedAnswer"
              @click="submitAnswer"
            >
              提交答案
            </el-button>
          </template>
          <el-button
            v-else
            type="primary"
            size="large"
            @click="startNewQuestion"
          >
            下一题 →
          </el-button>
        </div>
      </div>

      <!-- 无题目提示 -->
      <div v-else class="text-center py-12 text-gray-500">
        <span class="text-4xl mb-4 block">🔍</span>
        <p>没有符合条件的题目，请调整筛选条件</p>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4">
        <div>
          <h4 class="font-bold text-gray-800 mb-2">🎯 工具介绍</h4>
          <p class="text-gray-600">逻辑思维训练工具提供多种类型的思维题目，帮助锻炼逻辑推理能力、数学思维能力和严谨性。题目包含真话谎话题、逻辑推理题、数学思维题和序列推理题。</p>
        </div>
        <div>
          <h4 class="font-bold text-gray-800 mb-2">📚 题型说明</h4>
          <ul class="text-gray-600 space-y-1">
            <li><strong>真话谎话题：</strong>通过分析说话者的真话与谎话关系，推理出正确结论。经典的"骑士与无赖"问题。</li>
            <li><strong>逻辑推理：</strong>根据已知条件，运用演绎推理找出答案。锻炼严谨的逻辑思维。</li>
            <li><strong>数学思维：</strong>需要运用数学知识和逻辑分析解决的实际问题。</li>
            <li><strong>序列推理：</strong>找出数列或序列的规律，推导出下一个元素。</li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-gray-800 mb-2">💡 使用技巧</h4>
          <ul class="text-gray-600 space-y-1">
            <li>• 仔细阅读题目，理解所有条件和约束</li>
            <li>• 可以用草稿纸画图或列出可能性</li>
            <li>• 不要急于下结论，验证你的推理是否严密</li>
            <li>• 答错后认真阅读解析，理解正确的解题思路</li>
          </ul>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义样式补充 */
</style>
