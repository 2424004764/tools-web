<script setup lang="ts">
import { reactive, ref, computed, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const searchQuery = ref('')

const categories = reactive([
  {
    id: 'algebra',
    title: '代数基础',
    icon: '📐',
    formulas: [
      { name: '平方差公式', formula: 'a² - b² = (a+b)(a-b)', unit: '', desc: '两数平方之差等于它们的和与差的乘积' },
      { name: '完全平方公式', formula: '(a±b)² = a² ± 2ab + b²', unit: '', desc: '两数和（或差）的完全平方' },
      { name: '完全立方公式', formula: '(a±b)³ = a³ ± 3a²b + 3ab² ± b³', unit: '', desc: '两数和（或差）的完全立方' },
      { name: '立方差公式', formula: 'a³ - b³ = (a-b)(a² + ab + b²)', unit: '', desc: '两数立方之差' },
      { name: '立方和公式', formula: 'a³ + b³ = (a+b)(a² - ab + b²)', unit: '', desc: '两数立方之和' },
      { name: '求根公式', formula: 'x = (-b ± √(b²-4ac)) / 2a', unit: '', desc: '一元二次方程 ax²+bx+c=0 的解' },
      { name: '韦达定理', formula: 'x₁ + x₂ = -b/a, x₁ · x₂ = c/a', unit: '', desc: '一元二次方程根与系数的关系' },
      { name: '等比数列求和', formula: 'S = a₁(1-qⁿ)/(1-q), q≠1', unit: '', desc: '等比数列前n项和' },
      { name: '等差数列求和', formula: 'S = n(a₁+aₙ)/2 = n(2a₁+(n-1)d)/2', unit: '', desc: '等差数列前n项和' },
      { name: '指数运算', formula: 'aᵐ · aⁿ = aᵐ⁺ⁿ, (aᵐ)ⁿ = aᵐⁿ', unit: '', desc: '同底数幂的运算法则' },
      { name: '对数运算', formula: 'logₐ(MN) = logₐM + logₐN', unit: '', desc: '对数乘法法则' },
      { name: '对数换底', formula: 'logₐM = logᵦM / logᵦa', unit: '', desc: '换底公式' },
      { name: '排列数', formula: 'P(n,m) = n!/(n-m)!', unit: '', desc: '从n个不同元素中取m个的排列数' },
      { name: '组合数', formula: 'C(n,m) = n!/[m!(n-m)!]', unit: '', desc: '从n个不同元素中取m个的组合数' },
      { name: '二项式定理', formula: '(a+b)ⁿ = ΣC(n,k)aⁿ⁻ᵏbᵏ', unit: '', desc: '二项展开式通项公式' },
    ]
  },
  {
    id: 'trigonometry',
    title: '三角函数',
    icon: '📏',
    formulas: [
      { name: '弧度与角度', formula: '180° = π rad', unit: 'rad', desc: '弧度与角度的换算关系' },
      { name: '正弦定义', formula: 'sin θ = 对边/斜边', unit: '', desc: '直角三角形中正弦函数' },
      { name: '余弦定义', formula: 'cos θ = 邻边/斜边', unit: '', desc: '直角三角形中余弦函数' },
      { name: '正切定义', formula: 'tan θ = 对边/邻边 = sinθ/cosθ', unit: '', desc: '直角三角形中正切函数' },
      { name: '余切定义', formula: 'cot θ = 邻边/对边 = 1/tanθ', unit: '', desc: '余切函数' },
      { name: '正割定义', formula: 'sec θ = 1/cosθ', unit: '', desc: '正割函数' },
      { name: '余割定义', formula: 'csc θ = 1/sinθ', unit: '', desc: '余割函数' },
      { name: '同角关系', formula: 'sin²θ + cos²θ = 1', unit: '', desc: '平方和关系' },
      { name: '同角关系', formula: '1 + tan²θ = sec²θ', unit: '', desc: '正割平方关系' },
      { name: '同角关系', formula: '1 + cot²θ = csc²θ', unit: '', desc: '余割平方关系' },
      { name: '正弦二倍角', formula: 'sin2θ = 2sinθcosθ', unit: '', desc: '二倍角公式' },
      { name: '余弦二倍角', formula: 'cos2θ = cos²θ - sin²θ = 2cos²θ-1', unit: '', desc: '二倍角公式' },
      { name: '正切二倍角', formula: 'tan2θ = 2tanθ/(1-tan²θ)', unit: '', desc: '二倍角公式' },
      { name: '正弦和差', formula: 'sin(α±β) = sinαcosβ ± cosαsinβ', unit: '', desc: '和差化积' },
      { name: '余弦和差', formula: 'cos(α±β) = cosαcosβ ∓ sinαsinβ', unit: '', desc: '和差化积' },
      { name: '正切和差', formula: 'tan(α±β) = (tanα±tanβ)/(1∓tanαtanβ)', unit: '', desc: '和差化积' },
      { name: '正弦积化和', formula: 'sinαcosβ = [sin(α+β)+sin(α-β)]/2', unit: '', desc: '积化和差' },
      { name: '余弦积化和', formula: 'cosαcosβ = [cos(α+β)+cos(α-β)]/2', unit: '', desc: '积化和差' },
      { name: '正弦正弦积化和', formula: 'sinαsinβ = [cos(α-β)-cos(α+β)]/2', unit: '', desc: '积化和差' },
      { name: '正弦定理', formula: 'a/sinA = b/sinB = c/sinC = 2R', unit: '', desc: 'R为外接圆半径' },
      { name: '余弦定理', formula: 'c² = a² + b² - 2abcosC', unit: '', desc: '三角形边角关系' },
    ]
  },
  {
    id: 'geometry',
    title: '几何',
    icon: '🔷',
    formulas: [
      { name: '勾股定理', formula: 'a² + b² = c²', unit: '', desc: '直角三角形两直角边的平方和等于斜边平方' },
      { name: '正方形面积', formula: 'S = a²', unit: '', desc: '边长为a的正方形面积' },
      { name: '矩形面积', formula: 'S = ab', unit: '', desc: '长为a、宽为b的矩形面积' },
      { name: '三角形面积', formula: 'S = ½ah = ½absinC', unit: '', desc: '底×高÷2，或两边及其夹角正弦' },
      { name: '梯形面积', formula: 'S = ½(a+b)h', unit: '', desc: '上底a、下底b、高h的梯形面积' },
      { name: '圆形面积', formula: 'S = πr²', unit: '', desc: '半径为r的圆面积' },
      { name: '圆周长', formula: 'C = 2πr = πd', unit: '', desc: '半径r或直径d的圆周长' },
      { name: '扇形面积', formula: 'S = ½r²θ = (θ/360°)πr²', unit: '', desc: '弧度θ或角度θ的扇形面积' },
      { name: '椭圆面积', formula: 'S = πab', unit: '', desc: '长半轴a、短半轴b的椭圆面积' },
      { name: '平行四边形面积', formula: 'S = ah = absinθ', unit: '', desc: '底×高，或两边及其夹角正弦' },
      { name: '菱形面积', formula: 'S = ½d₁d₂', unit: '', desc: '对角线分别为d₁和d₂的菱形面积' },
      { name: '球体积', formula: 'V = ⁴⁄₃πr³', unit: '', desc: '半径为r的球体积' },
      { name: '球表面积', formula: 'S = 4πr²', unit: '', desc: '半径为r的球表面积' },
      { name: '正方体体积', formula: 'V = a³', unit: '', desc: '边长为a的正方体体积' },
      { name: '长方体体积', formula: 'V = abc', unit: '', desc: '长a、宽b、高c的长方体体积' },
      { name: '圆柱体积', formula: 'V = πr²h', unit: '', desc: '底面半径r、高h的圆柱体积' },
      { name: '圆柱表面积', formula: 'S = 2πr(r+h)', unit: '', desc: '底面半径r、高h的圆柱表面积' },
      { name: '圆锥体积', formula: 'V = ⅓πr²h', unit: '', desc: '底面半径r、高h的圆锥体积' },
      { name: '圆台体积', formula: 'V = ⅓πh(r² + rR + R²)', unit: '', desc: '上底r、下底R、高h的圆台体积' },
      { name: '棱锥体积', formula: 'V = ⅓Sh', unit: '', desc: '底面积S、高h的棱锥体积' },
      { name: '棱台体积', formula: 'V = ⅓h(S₁ + √(S₁S₂) + S₂)', unit: '', desc: '上底面积S₁、下底面积S₂、高h' },
      { name: '两点距离', formula: 'd = √[(x₂-x₁)² + (y₂-y₁)²]', unit: '', desc: '平面直角坐标系中两点距离' },
      { name: '中点坐标', formula: 'M = ((x₁+x₂)/2, (y₁+y₂)/2)', unit: '', desc: '线段中点坐标公式' },
      { name: '直线斜率', formula: 'k = (y₂-y₁)/(x₂-x₁)', unit: '', desc: '过两点的直线斜率' },
      { name: '点到直线距离', formula: 'd = |Ax₀ + By₀ + C|/√(A²+B²)', unit: '', desc: '点(x₀,y₀)到直线Ax+By+C=0的距离' },
    ]
  },
  {
    id: 'calculus',
    title: '微积分',
    icon: '∫',
    formulas: [
      { name: '导数定义', formula: `f'(x) = lim [f(x+Δx)-f(x)]/Δx`, unit: '', desc: '导数的极限定义' },
      { name: '常数导数', formula: `(c)' = 0`, unit: '', desc: '常数的导数为零' },
      { name: '幂函数导数', formula: `(xⁿ)' = nxⁿ⁻¹`, unit: '', desc: '幂函数求导公式' },
      { name: '指数函数导数', formula: `(aˣ)' = aˣlna, (eˣ)' = eˣ`, unit: '', desc: '指数函数求导' },
      { name: '对数函数导数', formula: `(logₐx)' = 1/(xlna), (lnx)' = 1/x`, unit: '', desc: '对数函数求导' },
      { name: '正弦函数导数', formula: `(sinx)' = cosx`, unit: '', desc: '正弦函数求导' },
      { name: '余弦函数导数', formula: `(cosx)' = -sinx`, unit: '', desc: '余弦函数求导' },
      { name: '正切函数导数', formula: `(tanx)' = sec²x = 1/cos²x`, unit: '', desc: '正切函数求导' },
      { name: '导数的加法', formula: `(u±v)' = u' ± v'`, unit: '', desc: '函数和差的导数' },
      { name: '导数的乘法', formula: `(uv)' = u'v + uv'`, unit: '', desc: '函数乘积的导数' },
      { name: '导数的除法', formula: `(u/v)' = (u'v - uv')/v²`, unit: '', desc: '函数商的导数' },
      { name: '复合函数导数', formula: `[f(g(x))]' = f'(g)·g'(x)`, unit: '', desc: '链式法则' },
      { name: '不定积分定义', formula: `∫f(x)dx = F(x) + C`, unit: '', desc: 'F(x)为f(x)的原函数' },
      { name: '幂函数积分', formula: `∫xⁿdx = xⁿ⁺¹/(n+1) + C, n≠-1`, unit: '', desc: '幂函数积分公式' },
      { name: '∫1/x dx', formula: `∫1/x dx = ln|x| + C`, unit: '', desc: '1/x的积分' },
      { name: '指数函数积分', formula: `∫aˣdx = aˣ/lna + C, ∫eˣdx = eˣ + C`, unit: '', desc: '指数函数积分' },
      { name: '正弦函数积分', formula: `∫sinx dx = -cosx + C`, unit: '', desc: 'sinx的积分' },
      { name: '余弦函数积分', formula: `∫cosx dx = sinx + C`, unit: '', desc: 'cosx的积分' },
      { name: '分部积分', formula: `∫u dv = uv - ∫v du`, unit: '', desc: '分部积分公式' },
      { name: '定积分基本定理', formula: `∫ₐᵇf(x)dx = F(b) - F(a)`, unit: '', desc: '牛顿-莱布尼茨公式' },
      { name: '极限基本公式', formula: `lim(x→0) sinx/x = 1`, unit: '', desc: '重要极限' },
      { name: '极限基本公式', formula: `lim(x→∞) (1+1/x)ˣ = e`, unit: '', desc: '重要极限' },
      { name: '洛必达法则', formula: `lim f(x)/g(x) = lim f'(x)/g'(x)`, unit: '', desc: '求0/0或∞/∞型极限' },
    ]
  },
  {
    id: 'linear-algebra',
    title: '线性代数',
    icon: '📊',
    formulas: [
      { name: '二阶行列式', formula: '|a b; c d| = ad - bc', unit: '', desc: '2×2矩阵的行列式计算' },
      { name: '三阶行列式', formula: '|a b c; d e f; g h i| = aei+bfg+cdh-ceg-bdi-afh', unit: '', desc: '3×3矩阵的行列式计算' },
      { name: '行列式性质', formula: '|Aᵀ| = |A|', unit: '', desc: '转置行列式相等' },
      { name: '行列式乘法', formula: '|AB| = |A|·|B|', unit: '', desc: '行列式相乘等于行列式相乘' },
      { name: '矩阵加法', formula: '(A+B)ᵢⱼ = Aᵢⱼ + Bᵢⱼ', unit: '', desc: '同型矩阵对应元素相加' },
      { name: '矩阵乘法', formula: '(AB)ᵢⱼ = Σₖ AᵢₖBₖⱼ', unit: '', desc: '矩阵乘法规则' },
      { name: '单位矩阵', formula: 'E·A = A·E = A', unit: '', desc: '单位矩阵的性质' },
      { name: '逆矩阵', formula: 'AA⁻¹ = A⁻¹A = E', unit: '', desc: '矩阵与其逆矩阵的乘积为单位矩阵' },
      { name: '伴随矩阵', formula: 'A* = (Aᵢⱼ)', unit: '', desc: '代数余子式组成的矩阵' },
      { name: '求逆公式', formula: 'A⁻¹ = A*/|A|', unit: '', desc: '通过伴随矩阵求逆' },
      { name: '向量点积', formula: 'a·b = |a||b|cosθ = Σaᵢbᵢ', unit: '', desc: '两向量的数量积' },
      { name: '向量叉积', formula: 'a×b = |a||b|sinθ·n', unit: '', desc: '两向量的向量积，结果为向量' },
      { name: '向量模', formula: '|a| = √(a₁² + a₂² + a₃²)', unit: '', desc: '向量的长度' },
      { name: '矩阵秩性质', formula: 'r(A+B) ≤ r(A) + r(B)', unit: '', desc: '矩阵和的秩不超过各自秩之和' },
      { name: '矩阵秩性质', formula: 'r(AB) ≤ min(r(A), r(B))', unit: '', desc: '矩阵积的秩不超过各矩阵的秩' },
    ]
  },
  {
    id: 'probability',
    title: '概率统计',
    icon: '🎲',
    formulas: [
      { name: '概率加法', formula: 'P(A∪B) = P(A) + P(B) - P(A∩B)', unit: '', desc: '两个事件并的概率' },
      { name: '条件概率', formula: 'P(B|A) = P(AB)/P(A)', unit: '', desc: '在A发生的条件下B发生的概率' },
      { name: '乘法公式', formula: 'P(AB) = P(A)·P(B|A)', unit: '', desc: '两个事件同时发生的概率' },
      { name: '全概率公式', formula: 'P(B) = ΣP(Aᵢ)·P(B|Aᵢ)', unit: '', desc: '全概率公式' },
      { name: '贝叶斯公式', formula: 'P(Aᵢ|B) = P(Aᵢ)·P(B|Aᵢ) / ΣP(Aⱼ)·P(B|Aⱼ)', unit: '', desc: '贝叶斯公式' },
      { name: '独立事件乘法', formula: 'P(AB) = P(A)·P(B)', unit: '', desc: 'A、B相互独立时' },
      { name: '期望线性', formula: 'E(aX+b) = aE(X) + b', unit: '', desc: '线性变换下期望的变化' },
      { name: '期望加法', formula: 'E(X+Y) = E(X) + E(Y)', unit: '', desc: '随机变量和的期望等于期望的和' },
      { name: '方差公式', formula: 'D(X) = E(X²) - [E(X)]²', unit: '', desc: '方差的计算公式' },
      { name: '方差性质', formula: 'D(aX+b) = a²D(X)', unit: '', desc: '线性变换下方差的变化' },
      { name: '二项分布', formula: 'P(X=k) = C(n,k)·pᵏ·(1-p)ⁿ⁻ᵏ', unit: '', desc: 'X~B(n,p)的概率质量函数' },
      { name: '二项分布期望', formula: 'E(X) = np', unit: '', desc: '二项分布的期望' },
      { name: '二项分布方差', formula: 'D(X) = np(1-p)', unit: '', desc: '二项分布的方差' },
      { name: '正态分布', formula: 'f(x) = (1/√(2πσ²))·e⁻⁽ˣ⁻ᵘ⁾²/²σ²', unit: '', desc: 'X~N(μ,σ²)的概率密度函数' },
      { name: '正态分布标准化', formula: 'Z = (X-μ)/σ ~ N(0,1)', unit: '', desc: '标准正态分布' },
      { name: '泊松分布', formula: 'P(X=k) = (λᵏ·e⁻ᵘ)/k!', unit: '', desc: 'X~P(λ)的概率质量函数' },
      { name: '大数定律', formula: 'lim(n→∞) P(|X̄ₙ - μ| < ε) = 1', unit: '', desc: '样本均值依概率收敛到期望' },
      { name: '中心极限定理', formula: '√n(X̄ₙ-μ)/σ ~ N(0,1)', unit: '', desc: '大量独立同分布随机变量的和近似正态' },
    ]
  },
  {
    id: 'complex',
    title: '复数',
    icon: '🔢',
    formulas: [
      { name: '复数定义', formula: 'z = a + bi, i² = -1', unit: '', desc: 'a为实部，b为虚部' },
      { name: '复数模', formula: '|z| = √(a² + b²)', unit: '', desc: '复数z = a+bi的模' },
      { name: '复数共轭', formula: 'z̄ = a - bi', unit: '', desc: 'z的共轭复数' },
      { name: '复数乘法', formula: '(a+bi)(c+di) = (ac-bd) + (ad+bc)i', unit: '', desc: '复数相乘规则' },
      { name: '复数除法', formula: '(a+bi)/(c+di) = [(ac+bd)+(bc-ad)i]/(c²+d²)', unit: '', desc: '复数相除规则' },
      { name: '欧拉公式', formula: 'e^(iθ) = cosθ + isinθ', unit: '', desc: '欧拉公式' },
      { name: '复数三角形式', formula: 'z = r(cosθ + isinθ)', unit: '', desc: '极坐标形式，r为模，θ为辐角' },
      { name: '复数指数形式', formula: 'z = re^(iθ)', unit: '', desc: '指数形式' },
      { name: '乘方公式', formula: '[r(cosθ+isinθ)]ⁿ = rⁿ(cos nθ + isin nθ)', unit: '', desc: '棣莫弗公式' },
      { name: '开方公式', formula: '√[r(cosθ+isinθ)] = √r[cos((θ+2kπ)/n) + isin((θ+2kπ)/n)]', unit: '', desc: '复数n次方根' },
    ]
  },
  {
    id: 'number-theory',
    title: '数论',
    icon: '∞',
    formulas: [
      { name: '整除性质', formula: '若a|b且a|c，则a|(b±c)', unit: '', desc: '整除的加减性质' },
      { name: '最大公约数', formula: 'gcd(a,b) = gcd(b, a mod b)', unit: '', desc: '欧几里得算法' },
      { name: '最小公倍数', formula: 'lcm(a,b) = |ab|/gcd(a,b)', unit: '', desc: '两数之积除以最大公约数' },
      { name: '互质条件', formula: 'gcd(a,b) = 1', unit: '', desc: 'a与b互质' },
      { name: '同余定义', formula: 'a ≡ b (mod m) ⟺ m|(a-b)', unit: '', desc: '同余的定义' },
      { name: '同余加法', formula: '若a≡b, c≡d (mod m)，则a±c≡b±d (mod m)', unit: '', desc: '同余的加减性质' },
      { name: '同余乘法', formula: '若a≡b, c≡d (mod m)，则ac≡bd (mod m)', unit: '', desc: '同余的乘法性质' },
      { name: '费马小定理', formula: '若p为素数，gcd(a,p)=1，则a^(p-1) ≡ 1 (mod p)', unit: '', desc: '费马小定理' },
      { name: '欧拉函数', formula: 'φ(n) = n·∏(1-1/pᵢ), pᵢ为n的质因数', unit: '', desc: '欧拉函数定义' },
      { name: '欧拉定理', formula: '若gcd(a,n)=1，则a^φ(n) ≡ 1 (mod n)', unit: '', desc: '欧拉定理' },
      { name: '质数判定', formula: '若n为合数，则n有质因数≤√n', unit: '', desc: '质数判定的必要条件' },
      { name: '算术基本定理', formula: 'n = p₁^a¹ · p₂^a² · ... · pₖ^aᵏ', unit: '', desc: '每个大于1的整数都可唯一分解' },
    ]
  },
])

// 过滤公式
const filteredCategories = computed(() => {
  // 有分类筛选
  if (activeCategory.value) {
    const cat = categories.find(c => c.id === activeCategory.value)
    return cat ? [cat] : []
  }

  // 无分类筛选，有搜索词
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    return categories
      .map(cat => ({
        ...cat,
        formulas: cat.formulas.filter(f =>
          f.name.toLowerCase().includes(query) ||
          f.formula.toLowerCase().includes(query) ||
          f.desc.toLowerCase().includes(query)
        )
      }))
      .filter(cat => cat.formulas.length > 0)
  }

  // 全部显示
  return categories
})

const activeCategory = ref('')

const scrollToCategory = (catId: string) => {
  if (catId === 'all') {
    activeCategory.value = ''
    nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  } else if (activeCategory.value === catId) {
    activeCategory.value = ''
  } else {
    activeCategory.value = catId
    nextTick(() => document.getElementById(catId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="数学公式查询"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <!-- 搜索 -->
      <div class="relative">
        <el-input
          v-model="searchQuery"
          placeholder="搜索公式名称或关键词..."
          size="large"
          clearable
        >
          <template #prefix>
            <span class="text-gray-400">🔍</span>
          </template>
        </el-input>
      </div>

      <!-- 分类导航 -->
      <div class="flex flex-wrap gap-2">
        <el-tag
          :type="activeCategory === '' ? 'primary' : 'info'"
          effect="plain"
          class="cursor-pointer hover:bg-orange-100"
          @click="scrollToCategory('all')"
        >
          全部
        </el-tag>
        <el-tag
          v-for="cat in categories"
          :key="cat.id"
          :type="activeCategory === cat.id ? 'primary' : 'info'"
          effect="plain"
          class="cursor-pointer hover:bg-orange-100"
          @click="scrollToCategory(cat.id)"
        >
          {{ cat.icon }} {{ cat.title }}
        </el-tag>
      </div>

      <!-- 公式列表 -->
      <div class="space-y-6">
        <div v-for="cat in filteredCategories" :key="cat.id" :id="cat.id" class="border rounded-lg p-4">
          <h3 class="text-lg font-bold text-gray-800 mb-3">
            {{ cat.icon }} {{ cat.title }}
          </h3>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div
              v-for="(formula, idx) in cat.formulas"
              :key="idx"
              class="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="font-medium text-gray-800">{{ formula.name }}</div>
                  <div class="font-mono text-primary text-lg my-1">{{ formula.formula }}</div>
                  <div class="text-sm text-gray-500">{{ formula.desc }}</div>
                </div>
                <el-tag v-if="formula.unit" size="small" type="warning" class="ml-2">
                  {{ formula.unit }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 无结果 -->
      <div v-if="filteredCategories.length === 0" class="text-center py-10 text-gray-400">
        未找到相关公式
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <div class="text-sm leading-7 space-y-2">
        <p class="font-bold">功能说明</p>
        <p>常用数学公式速查工具，涵盖中小学至大学水平的主要数学公式。</p>
        <ul class="list-disc ml-5">
          <li><strong>代数基础</strong>：因式分解、方程求根、数列、排列组合、二项式定理</li>
          <li><strong>三角函数</strong>：三角比定义、同角关系、和差化积、倍角公式、正弦定理、余弦定理</li>
          <li><strong>几何</strong>：平面几何面积、立体几何体积、解析几何距离与斜率</li>
          <li><strong>微积分</strong>：导数公式、不定积分、定积分、极限、洛必达法则</li>
          <li><strong>线性代数</strong>：行列式、矩阵运算、向量运算、矩阵秩</li>
          <li><strong>概率统计</strong>：概率公式、期望方差、二项分布、正态分布、大数定律</li>
          <li><strong>复数</strong>：复数四则运算、欧拉公式、棣莫弗公式</li>
          <li><strong>数论</strong>：整除、同余、费马小定理、欧拉函数、算术基本定理</li>
        </ul>
        <br>
        <p class="font-bold">使用说明</p>
        <p>使用搜索框可以快速查找公式，或通过分类标签浏览。公式包含名称、表达式和释义。</p>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>