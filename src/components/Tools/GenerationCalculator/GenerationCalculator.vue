<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

/**
 * 辈分显示与亲属称谓计算工具（交互式家谱树）
 * ------------------------------------------------------------
 * 以「我」为根节点，点击任意节点旁的「+」长出父母 / 兄弟姐妹 / 配偶 / 子女 等分支，
 * 组成一棵家谱树。每个节点自动推导它相对「我」的称谓与辈分；选中节点可查看
 * 完整关系链、辈分、关系类型（直系 / 旁系 / 姻亲）及对方对我的反向称呼。
 */

type Gender = 'M' | 'F'
type StepCode = 'F' | 'M' | 'XB' | 'NB' | 'XZ' | 'NZ' | 'H' | 'W' | 'S' | 'D'

interface StepMeta {
  code: StepCode
  label: string
  gender: Gender
  group: 'up' | 'same' | 'spouse' | 'down'
}

const STEP_LIST: StepMeta[] = [
  { code: 'F', label: '父亲', gender: 'M', group: 'up' },
  { code: 'M', label: '母亲', gender: 'F', group: 'up' },
  { code: 'XB', label: '哥哥', gender: 'M', group: 'same' },
  { code: 'NB', label: '弟弟', gender: 'M', group: 'same' },
  { code: 'XZ', label: '姐姐', gender: 'F', group: 'same' },
  { code: 'NZ', label: '妹妹', gender: 'F', group: 'same' },
  { code: 'H', label: '丈夫', gender: 'M', group: 'spouse' },
  { code: 'W', label: '妻子', gender: 'F', group: 'spouse' },
  { code: 'S', label: '儿子', gender: 'M', group: 'down' },
  { code: 'D', label: '女儿', gender: 'F', group: 'down' },
]
const STEP_MAP: Record<StepCode, StepMeta> = Object.fromEntries(
  STEP_LIST.map(s => [s.code, s])
) as Record<StepCode, StepMeta>

const stepGroups = {
  up: STEP_LIST.filter(s => s.group === 'up'),
  same: STEP_LIST.filter(s => s.group === 'same'),
  spouse: STEP_LIST.filter(s => s.group === 'spouse'),
  down: STEP_LIST.filter(s => s.group === 'down'),
}

// ============================================================
// 关系引擎（把关系链归约为「共同祖先 + 上行 / 下行分支」）
// ============================================================
type Age = 'elder' | 'younger' | null
interface Move { dir: 'up' | 'down'; gender: Gender | null; age: Age }
interface RNode { gen: number; gender: Gender }

function expand(code: StepCode): Move[] {
  switch (code) {
    case 'F': return [{ dir: 'up', gender: 'M', age: null }]
    case 'M': return [{ dir: 'up', gender: 'F', age: null }]
    case 'S': return [{ dir: 'down', gender: 'M', age: null }]
    case 'D': return [{ dir: 'down', gender: 'F', age: null }]
    case 'XB': return [{ dir: 'up', gender: null, age: null }, { dir: 'down', gender: 'M', age: 'elder' }]
    case 'NB': return [{ dir: 'up', gender: null, age: null }, { dir: 'down', gender: 'M', age: 'younger' }]
    case 'XZ': return [{ dir: 'up', gender: null, age: null }, { dir: 'down', gender: 'F', age: 'elder' }]
    case 'NZ': return [{ dir: 'up', gender: null, age: null }, { dir: 'down', gender: 'F', age: 'younger' }]
    default: return []
  }
}

function reduceMoves(moves: Move[]): Move[] {
  const stack: Move[] = []
  for (const m of moves) {
    const top = stack[stack.length - 1]
    if (m.dir === 'up' && top && top.dir === 'down') stack.pop()
    else stack.push(m)
  }
  return stack
}

function buildNodes(reduced: Move[], myGender: Gender): { nodes: RNode[]; branchAge: Age } {
  const ups = reduced.filter(m => m.dir === 'up')
  const downs = reduced.filter(m => m.dir === 'down')
  const nodes: RNode[] = [{ gen: 0, gender: myGender }]
  let gen = 0
  for (const u of ups) { gen += 1; nodes.push({ gen, gender: u.gender ?? 'M' }) }
  for (const d of downs) { gen -= 1; nodes.push({ gen, gender: d.gender ?? 'M' }) }
  return { nodes, branchAge: downs.length ? downs[0].age : null }
}

const flipAge = (a: Age): Age => (a === 'elder' ? 'younger' : a === 'younger' ? 'elder' : null)

interface Rel { up: number; down: number; paternalUp: Gender | null; splitChild: Gender | null; targetGender: Gender; age: Age }

function relate(nodes: RNode[], branchAge: Age, aIdx: number, bIdx: number): Rel {
  let peakIdx = 0
  for (let i = 1; i < nodes.length; i++) if (nodes[i].gen > nodes[peakIdx].gen) peakIdx = i
  const up = nodes[peakIdx].gen - nodes[aIdx].gen
  const down = nodes[peakIdx].gen - nodes[bIdx].gen
  const paternalUp = up > 0 ? nodes[aIdx + (peakIdx > aIdx ? 1 : -1)].gender : null
  const splitChild = down > 0 ? nodes[peakIdx + (bIdx > peakIdx ? 1 : -1)].gender : null
  const age: Age = branchAge ? (bIdx > peakIdx ? branchAge : flipAge(branchAge)) : null
  return { up, down, paternalUp, splitChild, targetGender: nodes[bIdx].gender, age }
}

function ancestorTerm(up: number, male: boolean, internal: boolean): string {
  const ext = internal ? '' : '外'
  if (up === 1) return male ? '父亲' : '母亲'
  if (up === 2) return internal ? (male ? '爷爷' : '奶奶') : (male ? '外公' : '外婆')
  if (up === 3) return ext + (male ? '曾祖父' : '曾祖母')
  if (up === 4) return ext + (male ? '高祖父' : '高祖母')
  const names = ['', '', '', '', '', '天祖', '烈祖', '太祖', '远祖', '鼻祖']
  const base = names[up] || `${up}世祖`
  return ext + base + (male ? '父' : '母')
}

function descendantTerm(down: number, male: boolean, internal: boolean): string {
  const ext = internal ? '' : '外'
  if (down === 1) return male ? '儿子' : '女儿'
  if (down === 2) return internal ? (male ? '孙子' : '孙女') : (male ? '外孙' : '外孙女')
  if (down === 3) return ext + (male ? '曾孙' : '曾孙女')
  if (down === 4) return ext + (male ? '玄孙' : '玄孙女')
  const names = ['', '', '', '', '', '来孙', '晜孙', '仍孙', '云孙', '耳孙']
  const base = names[down] || `${down}世孙`
  return ext + base + (male ? '' : '（女）')
}

function collateralTerm(rel: Rel): string {
  const { up, down, paternalUp, splitChild, targetGender, age } = rel
  const male = targetGender === 'M'
  const paternal = paternalUp === 'M'
  const elder = age === 'elder'
  const younger = age === 'younger'
  const gen = up - down

  if (up === 1 && down === 1) {
    if (male) return elder ? '哥哥' : younger ? '弟弟' : '兄弟'
    return elder ? '姐姐' : younger ? '妹妹' : '姐妹'
  }
  if (up === 2 && down === 1) {
    if (paternal) { if (male) return elder ? '伯伯' : younger ? '叔叔' : '伯伯 / 叔叔'; return '姑姑' }
    if (male) return '舅舅'
    return '姨妈'
  }
  if (up === 1 && down === 2) {
    const brother = splitChild === 'M'
    if (brother) return male ? '侄子' : '侄女'
    return male ? '外甥' : '外甥女'
  }
  if (up === 2 && down === 2) {
    const tang = paternal && splitChild === 'M'
    const pfx = tang ? '堂' : '表'
    if (male) return elder ? pfx + '哥' : younger ? pfx + '弟' : pfx + '兄弟'
    return elder ? pfx + '姐' : younger ? pfx + '妹' : pfx + '姐妹'
  }
  if (up === 3 && down === 1) {
    if (paternal) { if (male) return elder ? '伯祖父' : younger ? '叔祖父' : '伯祖父 / 叔祖父'; return '姑婆' }
    if (male) return '舅公'
    return '姨婆'
  }
  if (up === 1 && down === 3) {
    const brother = splitChild === 'M'
    if (brother) return male ? '侄孙' : '侄孙女'
    return male ? '甥孙' : '甥孙女'
  }
  if (up === 3 && down === 2 && gen === 1) {
    const tang = paternal && splitChild === 'M'
    const pfx = tang ? '堂' : '表'
    if (paternal) { if (male) return elder ? pfx + '伯' : younger ? pfx + '叔' : pfx + '伯叔'; return pfx + '姑' }
    if (male) return pfx + '舅'
    return pfx + '姨'
  }
  if (up === 2 && down === 3) {
    const tang = paternal && splitChild === 'M'
    const pfx = tang ? '堂' : '表'
    return male ? pfx + '侄' : pfx + '侄女'
  }
  if (gen > 0) return `${male ? '男性' : '女性'}长辈（长 ${gen} 辈旁系）`
  if (gen < 0) return `${male ? '男性' : '女性'}晚辈（晚 ${-gen} 辈旁系）`
  return male ? '同辈男性亲属（远房）' : '同辈女性亲属（远房）'
}

function describe(rel: Rel): string {
  const { up, down, paternalUp, splitChild, targetGender } = rel
  const male = targetGender === 'M'
  if (up === 0 && down === 0) return '本人'
  if (up === 0) return descendantTerm(down, male, splitChild === 'M')
  if (down === 0) return ancestorTerm(up, male, paternalUp === 'M')
  return collateralTerm(rel)
}

interface BloodResult { term: string; reverseTerm: string; genOffset: number; relType: string; side: string }

function computeBlood(steps: StepCode[], myGender: Gender): BloodResult {
  const moves = steps.flatMap(expand)
  const reduced = reduceMoves(moves)
  const { nodes, branchAge } = buildNodes(reduced, myGender)
  const N = nodes.length - 1
  const fwd = relate(nodes, branchAge, 0, N)
  const rev = relate(nodes, branchAge, N, 0)
  const genOffset = nodes[N].gen
  let relType = '本人'
  if (fwd.up === 0 && fwd.down === 0) relType = '本人'
  else if (fwd.up === 0 || fwd.down === 0) relType = '直系血亲'
  else relType = '旁系血亲'
  let side = ''
  if (fwd.up > 0) side = fwd.paternalUp === 'M' ? '父系' : fwd.paternalUp === 'F' ? '母系' : ''
  else if (fwd.down > 0) side = fwd.splitChild === 'M' ? '父系（内）' : '母系（外）'
  return { term: describe(fwd), reverseTerm: describe(rev), genOffset, relType, side }
}

const SPOUSE_OF: Record<string, string> = {
  哥哥: '嫂子', 弟弟: '弟媳', 姐姐: '姐夫', 妹妹: '妹夫',
  儿子: '儿媳', 女儿: '女婿',
  父亲: '母亲 / 继母', 母亲: '父亲 / 继父',
  伯伯: '伯母', 叔叔: '婶婶', 姑姑: '姑父', 舅舅: '舅妈', 姨妈: '姨父',
  爷爷: '奶奶', 奶奶: '爷爷', 外公: '外婆', 外婆: '外公',
  孙子: '孙媳', 孙女: '孙女婿', 外孙: '外孙媳妇', 外孙女: '外孙女婿',
  侄子: '侄媳', 侄女: '侄女婿', 外甥: '外甥媳妇', 外甥女: '外甥女婿',
  堂哥: '堂嫂', 堂弟: '堂弟媳', 堂姐: '堂姐夫', 堂妹: '堂妹夫',
  表哥: '表嫂', 表弟: '表弟媳', 表姐: '表姐夫', 表妹: '表妹夫',
  伯祖父: '伯祖母', 叔祖父: '叔祖母', 曾祖父: '曾祖母', 高祖父: '高祖母',
}
function spouseOf(term: string, step: StepCode): string {
  return SPOUSE_OF[term] || `${term}的${step === 'H' ? '丈夫' : '妻子'}`
}

const INLAW_WIFE: Record<string, string> = {
  父亲: '岳父', 母亲: '岳母', 哥哥: '大舅子（内兄）', 弟弟: '小舅子（内弟）',
  姐姐: '大姨子', 妹妹: '小姨子', 爷爷: '岳祖父', 奶奶: '岳祖母', 儿子: '儿子', 女儿: '女儿',
}
const INLAW_HUSBAND: Record<string, string> = {
  父亲: '公公', 母亲: '婆婆', 哥哥: '大伯子', 弟弟: '小叔子',
  姐姐: '大姑子', 妹妹: '小姑子', 爷爷: '祖公公', 奶奶: '祖婆婆', 儿子: '儿子', 女儿: '女儿',
}
function inLaw(inner: string, iAmHusband: boolean): string {
  const map = iAmHusband ? INLAW_WIFE : INLAW_HUSBAND
  return map[inner] || `${iAmHusband ? '妻子' : '丈夫'}的${inner}`
}

interface Result { term: string; reverse: string; genOffset: number; relType: string; side: string }

function computeRelation(steps: StepCode[], myGender: Gender): Result {
  if (steps.length === 0) return { term: '本人', reverse: '本人', genOffset: 0, relType: '本人', side: '' }
  const spouseCount = steps.filter(s => s === 'H' || s === 'W').length
  const lastIsSpouse = steps[steps.length - 1] === 'H' || steps[steps.length - 1] === 'W'

  if (spouseCount === 0) {
    const b = computeBlood(steps, myGender)
    return { term: b.term, reverse: b.reverseTerm, genOffset: b.genOffset, relType: b.relType, side: b.side }
  }
  if (spouseCount === 1 && lastIsSpouse) {
    const step = steps[steps.length - 1]
    const bloodSteps = steps.slice(0, -1)
    if (bloodSteps.length === 0) {
      return { term: step === 'H' ? '丈夫' : '妻子', reverse: myGender === 'M' ? '丈夫' : '妻子', genOffset: 0, relType: '配偶', side: '' }
    }
    const b = computeBlood(bloodSteps, myGender)
    return { term: spouseOf(b.term, step), reverse: '', genOffset: b.genOffset, relType: '姻亲', side: b.side }
  }
  if (spouseCount === 1 && (steps[0] === 'H' || steps[0] === 'W')) {
    const step = steps[0]
    const rest = steps.slice(1)
    const spouseGender: Gender = STEP_MAP[step].gender
    const b = computeBlood(rest, spouseGender)
    const iAmHusband = step === 'W'
    return { term: inLaw(b.term, iAmHusband), reverse: '', genOffset: b.genOffset, relType: '姻亲', side: b.side }
  }
  const b = computeBlood(steps.filter(s => s !== 'H' && s !== 'W') as StepCode[], myGender)
  return { term: `${b.term}（姻亲，含婚姻关系）`, reverse: '', genOffset: b.genOffset, relType: '姻亲', side: b.side }
}

// ============================================================
// 家谱树
// ============================================================
interface TreeNode {
  id: number
  step: StepCode | null   // 相对父节点的关系；根为 null
  chain: StepCode[]        // 从「我」到本节点的完整关系链
  children: TreeNode[]
  expanded: boolean
}

let uid = 0
const nextId = () => ++uid
const makeNode = (step: StepCode | null, chain: StepCode[]): TreeNode => ({
  id: nextId(), step, chain, children: [], expanded: true,
})

const myGender = ref<Gender>('M')
const root = ref<TreeNode>(makeNode(null, []))
const selectedId = ref<number>(root.value.id)

// 扁平化为带缩进 / 引导线的行，便于渲染树形
interface FlatRow { node: TreeNode; depth: number; guides: boolean[]; isLast: boolean }
function flatten(node: TreeNode, depth: number, guides: boolean[], isLast: boolean, out: FlatRow[]) {
  out.push({ node, depth, guides, isLast })
  if (node.expanded) {
    node.children.forEach((c, i) => {
      const cLast = i === node.children.length - 1
      const childGuides = depth === 0 ? [] : [...guides, !isLast]
      flatten(c, depth + 1, childGuides, cLast, out)
    })
  }
}
const rows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = []
  flatten(root.value, 0, [], true, out)
  return out
})

const nodeInfo = (node: TreeNode) => computeRelation(node.chain, myGender.value)

const findNode = (id: number, node: TreeNode = root.value): TreeNode | null => {
  if (node.id === id) return node
  for (const c of node.children) {
    const found = findNode(id, c)
    if (found) return found
  }
  return null
}

const addRelation = (node: TreeNode, step: StepCode) => {
  const child = makeNode(step, [...node.chain, step])
  node.children.push(child)
  node.expanded = true
  selectedId.value = child.id
}

const removeNode = (id: number, node: TreeNode = root.value): boolean => {
  const idx = node.children.findIndex(c => c.id === id)
  if (idx !== -1) {
    node.children.splice(idx, 1)
    if (selectedId.value === id) selectedId.value = root.value.id
    return true
  }
  return node.children.some(c => removeNode(id, c))
}

const toggle = (node: TreeNode) => { node.expanded = !node.expanded }
const select = (node: TreeNode) => { selectedId.value = node.id }

const setAllExpanded = (val: boolean, node: TreeNode = root.value) => {
  node.expanded = val
  node.children.forEach(c => setAllExpanded(val, c))
}

const resetTree = () => {
  root.value = makeNode(null, [])
  selectedId.value = root.value.id
}

// 沿关系链创建 / 复用节点（用于加载示例）
const addByChain = (steps: StepCode[]) => {
  let cur = root.value
  const acc: StepCode[] = []
  for (const s of steps) {
    acc.push(s)
    let next = cur.children.find(c => c.step === s)
    if (!next) {
      next = makeNode(s, [...acc])
      cur.children.push(next)
    }
    cur.expanded = true
    cur = next
  }
}

interface Example { label: string; chains: StepCode[][] }
const EXAMPLES: Example[] = [
  { label: '父系一族', chains: [['F', 'XB', 'S'], ['F', 'NB', 'D'], ['F', 'NZ']] },
  { label: '母系亲戚', chains: [['M', 'F'], ['M', 'NB', 'S'], ['M', 'XZ']] },
  { label: '三代同堂', chains: [['F', 'F'], ['XB', 'S'], ['S', 'D']] },
  { label: '姻亲关系', chains: [['W', 'F'], ['W', 'XB'], ['XB', 'W']] },
]
const loadExample = (ex: Example) => {
  resetTree()
  ex.chains.forEach(addByChain)
  root.value.expanded = true
}

// 选中节点信息
const selected = computed(() => findNode(selectedId.value) || root.value)
const selectedInfo = computed(() => nodeInfo(selected.value))
const selectedChainText = computed(() => {
  const s = selected.value.chain
  if (s.length === 0) return '我'
  return '我' + s.map(c => '的' + STEP_MAP[c].label).join('')
})

const genShort = (g: number) => (g === 0 ? '平辈' : g > 0 ? `长${g}辈` : `晚${-g}辈`)
const genLabel = (g: number) => (g === 0 ? '平辈（同辈）' : g > 0 ? `长 ${g} 辈` : `晚 ${-g} 辈`)
const genColorCls = (g: number) => (g === 0 ? 'bg-sky-100 text-sky-700' : g > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')

const prefixOf = (row: FlatRow) => {
  let p = row.guides.map(g => (g ? '│   ' : '    ')).join('')
  if (row.depth > 0) p += row.isLast ? '└── ' : '├── '
  return p
}

// 辈分速查表
const UP_CHART = [
  { n: 1, name: '父 / 母', call: '爸爸、妈妈' },
  { n: 2, name: '祖 / 外祖', call: '爷爷奶奶、外公外婆' },
  { n: 3, name: '曾祖', call: '曾祖父母' },
  { n: 4, name: '高祖', call: '高祖父母' },
]
const DOWN_CHART = [
  { n: 1, name: '子 / 女', call: '儿子、女儿' },
  { n: 2, name: '孙 / 外孙', call: '孙子孙女、外孙' },
  { n: 3, name: '曾孙', call: '曾孙、曾孙女' },
  { n: 4, name: '玄孙', call: '玄孙、玄孙女' },
]
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="辈分称谓计算" />

    <!-- 顶部工具栏 -->
    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-h2 font-semibold text-slate-800">家谱树</div>
          <div class="mt-1 text-body-sm text-slate-500">以「我」为根，点击节点上的「+」长出亲属分支，点击节点查看称谓与辈分。</div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-body-sm text-slate-600">我的性别</span>
            <el-radio-group v-model="myGender" size="small">
              <el-radio-button value="M">男</el-radio-button>
              <el-radio-button value="F">女</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <el-button size="small" @click="setAllExpanded(true)">展开全部</el-button>
        <el-button size="small" @click="setAllExpanded(false)">收起全部</el-button>
        <el-button size="small" type="danger" plain @click="resetTree">重置</el-button>
        <span class="mx-1 h-4 w-px bg-slate-200"></span>
        <span class="text-caption text-slate-400">示例：</span>
        <el-button v-for="ex in EXAMPLES" :key="ex.label" size="small" round @click="loadExample(ex)">{{ ex.label }}</el-button>
      </div>
    </div>

    <!-- 家谱树 + 详情 -->
    <div class="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <!-- 树 -->
      <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200 overflow-x-auto">
        <div class="min-w-[420px] space-y-1">
          <div v-for="row in rows" :key="row.node.id" class="flex items-center">
            <!-- 引导线 -->
            <span class="font-mono whitespace-pre text-slate-300 select-none text-body-sm leading-none">{{ prefixOf(row) }}</span>

            <!-- 折叠三角 -->
            <button
              v-if="row.node.children.length"
              class="w-4 h-4 mr-1 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600"
              @click.stop="toggle(row.node)"
            >
              <span class="text-caption">{{ row.node.expanded ? '▾' : '▸' }}</span>
            </button>
            <span v-else class="w-4 mr-1 shrink-0"></span>

            <!-- 节点卡片 -->
            <div
              class="group inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border cursor-pointer transition-colors"
              :class="selectedId === row.node.id ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300'"
              @click="select(row.node)"
            >
              <span v-if="row.node.step" class="text-caption text-slate-400 shrink-0">{{ STEP_MAP[row.node.step].label }} →</span>
              <span class="font-semibold shrink-0" :class="row.depth === 0 ? 'text-indigo-600' : 'text-slate-800'">
                {{ nodeInfo(row.node).term }}
              </span>
              <span class="text-caption px-1.5 py-0.5 rounded shrink-0" :class="genColorCls(nodeInfo(row.node).genOffset)">
                {{ genShort(nodeInfo(row.node).genOffset) }}
              </span>

              <!-- 添加关系 -->
              <el-popover placement="bottom-start" :width="260" trigger="click">
                <template #reference>
                  <button
                    class="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-indigo-500 text-white hover:bg-indigo-600 text-body-sm leading-none"
                    title="添加亲属"
                    @click.stop
                  >+</button>
                </template>
                <div class="space-y-2">
                  <div class="text-caption text-slate-400 mb-1">从「{{ nodeInfo(row.node).term }}」出发添加</div>
                  <div class="flex flex-wrap gap-1.5">
                    <el-button v-for="s in stepGroups.up" :key="s.code" size="small" type="primary" plain @click.stop="addRelation(row.node, s.code)">{{ s.label }}</el-button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <el-button v-for="s in stepGroups.same" :key="s.code" size="small" type="success" plain @click.stop="addRelation(row.node, s.code)">{{ s.label }}</el-button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <el-button v-for="s in stepGroups.spouse" :key="s.code" size="small" type="warning" plain @click.stop="addRelation(row.node, s.code)">{{ s.label }}</el-button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <el-button v-for="s in stepGroups.down" :key="s.code" size="small" type="info" plain @click.stop="addRelation(row.node, s.code)">{{ s.label }}</el-button>
                  </div>
                </div>
              </el-popover>

              <!-- 删除 -->
              <button
                v-if="row.node.step"
                class="w-5 h-5 shrink-0 flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 text-body-sm leading-none opacity-0 group-hover:opacity-100"
                title="删除该节点及其分支"
                @click.stop="removeNode(row.node.id)"
              >×</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 选中详情 -->
      <div class="p-5 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl h-fit">
        <div class="text-body-sm opacity-90">{{ selectedChainText }}</div>
        <div class="mt-2 text-5xl font-bold tracking-tight">{{ selectedInfo.term }}</div>

        <div class="mt-5 space-y-2.5">
          <div class="flex items-center justify-between text-body-sm">
            <span class="opacity-80">辈分</span>
            <span class="font-medium">{{ genLabel(selectedInfo.genOffset) }}</span>
          </div>
          <div class="flex items-center justify-between text-body-sm">
            <span class="opacity-80">关系类型</span>
            <span class="font-medium">{{ selectedInfo.relType }}<template v-if="selectedInfo.side"> · {{ selectedInfo.side }}</template></span>
          </div>
          <div class="flex items-center justify-between text-body-sm">
            <span class="opacity-80">对方称呼我</span>
            <span class="font-medium">{{ selectedInfo.reverse || '—' }}</span>
          </div>
        </div>

        <div class="mt-5 pt-4 border-t border-white/20 text-caption text-white/80 leading-relaxed">
          在左侧树上点击任意节点即可切换查看。点击节点上的
          <span class="inline-flex w-4 h-4 items-center justify-center rounded bg-white/25 align-middle">+</span>
          添加父母、兄弟姐妹、配偶或子女。
        </div>
      </div>
    </div>

    <!-- 辈分速查表 -->
    <div class="mt-4 p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="text-h2 font-semibold text-slate-800 mb-1">辈分速查表</div>
      <div class="text-body-sm text-slate-500 mb-4">以「我」为第 0 辈，向上为长辈、向下为晚辈。</div>
      <div class="grid gap-6 md:grid-cols-2">
        <div>
          <div class="text-body-sm font-medium text-amber-600 mb-2">↑ 长辈（直系）</div>
          <div class="space-y-1.5">
            <div v-for="rowc in UP_CHART" :key="'u' + rowc.n" class="flex items-center gap-3 text-body-sm">
              <span class="w-14 shrink-0 text-caption text-slate-400">长 {{ rowc.n }} 辈</span>
              <span class="w-20 shrink-0 font-medium text-slate-700">{{ rowc.name }}</span>
              <span class="text-slate-500">{{ rowc.call }}</span>
            </div>
          </div>
        </div>
        <div>
          <div class="text-body-sm font-medium text-emerald-600 mb-2">↓ 晚辈（直系）</div>
          <div class="space-y-1.5">
            <div v-for="rowc in DOWN_CHART" :key="'d' + rowc.n" class="flex items-center gap-3 text-body-sm">
              <span class="w-14 shrink-0 text-caption text-slate-400">晚 {{ rowc.n }} 辈</span>
              <span class="w-20 shrink-0 font-medium text-slate-700">{{ rowc.name }}</span>
              <span class="text-slate-500">{{ rowc.call }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        辈分称谓计算工具以交互式家谱树的方式帮你算清中国式亲戚称呼。使用方法：先在右上角选择「我」的性别；然后点击任意节点上的「+」，从长辈 / 同辈 / 配偶 / 晚辈四组中选择关系，即可在树上长出一个分支节点（例如在「爸爸」下添加「哥哥」，再在其下添加「儿子」）。每个节点都会自动显示它相对「我」的称谓与辈分；点击节点，右侧会展示完整关系链、辈分（平辈 / 长 N 辈 / 晚 N 辈）、关系类型（直系血亲 / 旁系血亲 / 姻亲，父系 / 母系）以及对方对我的反向称呼。
        <br /><br />
        计算原理：把从「我」到目标节点的关系链归约为「共同祖先 + 上行分支 + 下行分支」的结构——先向上找到最近的共同祖先，再向下走到对方，据此判断辈分差、父系 / 母系与堂 / 表关系。「堂」表示同姓的父系旁系（如伯伯的孩子），「表」表示异姓旁系（如姑姑、舅舅、姨妈的孩子）。
        <br /><br />
        说明：血亲关系的正向与反向称谓均可准确给出；姻亲仅给出常见称呼，个别地区方言称谓可能不同。堂表兄弟姐妹的长幼默认参考其父母的长幼，实际以本人年龄为准。所有计算均在浏览器本地完成，不会上传任何数据。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
