/**
 * 表达式求值引擎（科学计算器用）
 * --------------------------------------------------------
 * 不引入 mathjs / expr-eval，纯手写 tokenizer + 递归下降 parser + 求值器。
 * 支持：
 *   - 基本四则运算：+ - * / % ^(右结合) 、一元负号
 *   - 括号
 *   - 三角/反三角：sin cos tan asin acos atan（受 angleMode 控制 deg/rad）
 *   - 双曲：sinh cosh tanh
 *   - 对数/指数：ln log10 log2 log(x,base) sqrt cbrt exp exp2 exp10 pow(x,y)
 *   - 其他：abs floor ceil round n! 阶乘、!√x 取倒、% 模
 *   - 常量：pi e phi
 *   - 隐式乘法：2pi、2(3+4)、(2)(3)、3sin(0) 等
 *   - 后置阶乘：5!
 *
 * 暴露：
 *   - evaluate(expr, options) -> { ok: true, value } | { ok: false, error }
 *   - formatNumber(n)         智能截断浮点显示
 *   - DEG_TO_RAD / RAD_TO_DEG 角度转换
 */

export type AngleMode = 'deg' | 'rad'

export interface EvalOptions {
  angleMode?: AngleMode   // 默认 'rad'
  ans?: number             // 上一次结果，用于 ans 常量
}

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; error: string }

// ============================================================
// 常量与函数表
// ============================================================

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  π: Math.PI,
  e: Math.E,
  E: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
}

// 单参数函数
// 三角类放在外层包装，会根据 angleMode 自动转 rad
type TrigFn = (rad: number) => number

const TRIG_FN: Record<string, TrigFn> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  // 反三角在 deg 模式下输出的是角度，需要再换算
  asin: (r) => r,
  acos: (r) => r,
  atan: (r) => r,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  asinh: Math.asinh,
  acosh: Math.acosh,
  atanh: Math.atanh,
}

const INV_TRIG_OUTPUT: Record<string, TrigFn> = {
  // 反三角在 rad 模式下直接是 Math.asin/acos/atan
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
}

// 单参数纯数值函数
// 注意：log 是可变参数（1 或 2 个），放到下方 callFunction 末尾专门处理，
// 不能放进 SINGLE_FN（否则带两个参数时会先抛"需要 1 个参数"）
const SINGLE_FN: Record<string, (x: number) => number> = {
  ln: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  exp: Math.exp,
  exp2: (x) => Math.pow(2, x),
  exp10: (x) => Math.pow(10, x),
  reciprocal: (x) => 1 / x,
  sign: Math.sign,
}

// 双参数函数
const DOUBLE_FN: Record<string, (a: number, b: number) => number> = {
  pow: Math.pow,
  // log(x, base) -> 以 base 为底的对数
  logb: (x, base) => Math.log(x) / Math.log(base),
  // nCr 组合数（可后续扩展）
  // mod：与 % 同义
  mod: (a, b) => ((a % b) + b) % b,
}

// 综合函数表（包含可单/双参数的：log(x[,base])）
// log 是可变参数函数（1 或 2 个），不放在 SINGLE_FN / DOUBLE_FN，
// 但必须加入 ALL_FN_NAMES，否则 insertImplicitMul 会把它当作常量并插入隐式乘号
const ALL_FN_NAMES = new Set([
  ...Object.keys(TRIG_FN),
  ...Object.keys(SINGLE_FN),
  ...Object.keys(DOUBLE_FN),
  'log',
])

// ============================================================
// Tokenizer
// ============================================================

type TokenType =
  | 'NUM'
  | 'IDENT'   // 函数名 / 常量名 / ans
  | 'OP'      // + - * / ^ %
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'BANG'    // 阶乘 ! 后缀
  | 'EOF'

interface Token {
  type: TokenType
  value: string
  pos: number
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = input.length

  while (i < n) {
    const ch = input[i]

    // 跳过空白
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++
      continue
    }

    // 数字：整数 / 小数 / 纯 . 开头的小数
    if (/[0-9.]/.test(ch)) {
      const start = i
      // 形如 .5 的支持
      if (ch === '.') {
        i++
        while (i < n && /[0-9]/.test(input[i])) i++
      } else {
        while (i < n && /[0-9]/.test(input[i])) i++
        if (i < n && input[i] === '.') {
          i++
          while (i < n && /[0-9]/.test(input[i])) i++
        }
      }
      // 科学计数 1e3 / 1.5e-2 （限定在数字后）
      if (i < n && (input[i] === 'e' || input[i] === 'E')) {
        const save = i
        const next = i + 1
        // 仅当 e 后跟数字（可选符号）才视作科学计数
        if (next < n && (/[0-9]/.test(input[next]) || ((input[next] === '+' || input[next] === '-') && next + 1 < n && /[0-9]/.test(input[next + 1])))) {
          i = next
          if (input[i] === '+' || input[i] === '-') i++
          while (i < n && /[0-9]/.test(input[i])) i++
        } else {
          // 回退，避免把 1e 当成 IDENT
          i = save
        }
      }
      tokens.push({ type: 'NUM', value: input.slice(start, i), pos: start })
      continue
    }

    // 标识符（函数名/常量/ans）：字母或 π
    if (/[a-zA-Z_π]/.test(ch) || ch === 'π') {
      const start = i
      while (i < n && /[a-zA-Z0-9_π]/.test(input[i])) i++
      tokens.push({ type: 'IDENT', value: input.slice(start, i), pos: start })
      continue
    }

    // 运算符
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '%') {
      // 一元负号识别在 parser 阶段，这里一律当 OP 入栈
      tokens.push({ type: 'OP', value: ch, pos: i })
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch, pos: i })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch, pos: i })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ch, pos: i })
      i++
      continue
    }
    if (ch === '!') {
      tokens.push({ type: 'BANG', value: ch, pos: i })
      i++
      continue
    }

    // 未识别字符
    throw new CalcError(`无法识别字符 "${ch}"`, i)
  }

  tokens.push({ type: 'EOF', value: '', pos: n })
  return tokens
}

class CalcError extends Error {
  pos: number
  constructor(msg: string, pos: number) {
    super(msg)
    this.pos = pos
  }
}

// ============================================================
// 隐式乘法插入
//   在以下相邻处插入一个虚拟的 '*' token：
//     NUM/IDENT/RPAREN 紧跟  NUM/IDENT/LPAREN
//   注意：IDENT 在这里必须是非 ans/常量（也就是函数名），但 tokenize 阶段
//   无法区分，所以统一插入。解析阶段会在 identifier 上下文里自然吸收。
//   为避免无限插入，只在 prev.type ∈ {NUM,RPAREN,IDENT(常量名)} 时做。
// ============================================================
function insertImplicitMul(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    out.push(t)
    if (i === tokens.length - 1) break
    const next = tokens[i + 1]
    if (shouldInsertMul(t, next)) {
      out.push({ type: 'OP', value: '*', pos: -1 })
    }
  }
  return out
}

function shouldInsertMul(a: Token, b: Token): boolean {
  if (a.type === 'EOF' || b.type === 'EOF') return false
  // 后置阶乘后面不能再隐式乘（5!3 没意义）
  if (a.type === 'BANG') return false

  const isLeft = a.type === 'NUM' || a.type === 'RPAREN' ||
    (a.type === 'IDENT' && !ALL_FN_NAMES.has(a.value) && !['ans', 'Ans', 'ANS'].includes(a.value))
  const isRight = b.type === 'NUM' || b.type === 'LPAREN' ||
    (b.type === 'IDENT') // IDENT：函数名(隐式乘)、常量(隐式乘)、ans(隐式乘)
  // 但 ans 后面跟 RPAREN 不算（无此语法）；ans 后跟 NUM/LPAREN 则插入 *

  return isLeft && isRight
}

// ============================================================
// Parser
//   expr   := add
//   add    := mul (('+' | '-') mul)*
//   mul    := pow (('*' | '/' | '%') pow)*
//   pow    := unary ('^' pow)?           // 右结合
//   unary  := ('-' | '+') unary | postfix
//   postfix:= primary ('!')*
//   primary:= NUMBER
//          |  IDENT                              (常量或 ans)
//          |  IDENT '(' args ')'                 (函数调用)
//          |  '(' expr ')'
//   args   := expr (',' expr)*
// ============================================================

class Parser {
  i = 0
  tokens: Token[]
  ans: number
  angleMode: AngleMode

  constructor(tokens: Token[], ans: number, angleMode: AngleMode) {
    this.tokens = tokens
    this.ans = ans
    this.angleMode = angleMode
  }

  peek(): Token {
    return this.tokens[this.i]
  }
  next(): Token {
    return this.tokens[this.i++]
  }
  match(type: TokenType, value?: string): boolean {
    const t = this.peek()
    if (t.type !== type) return false
    if (value !== undefined && t.value !== value) return false
    this.i++
    return true
  }

  parse(): number {
    const v = this.parseExpr()
    if (this.peek().type !== 'EOF') {
      throw new CalcError(`表达式末尾有多余内容`, this.peek().pos)
    }
    return v
  }

  parseExpr(): number {
    return this.parseAdd()
  }

  parseAdd(): number {
    let left = this.parseMul()
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value
      const right = this.parseMul()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  parseMul(): number {
    let left = this.parsePow()
    while (this.peek().type === 'OP' && (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')) {
      const op = this.next().value
      const right = this.parsePow()
      if (op === '*') left = left * right
      else if (op === '/') {
        if (right === 0) throw new CalcError('除数不能为 0', this.peek().pos)
        left = left / right
      }
      else {
        // 数学模（与 JS 的 % 不同，处理负数情况）
        left = ((left % right) + right) % right
      }
    }
    return left
  }

  parsePow(): number {
    const left = this.parseUnary()
    if (this.peek().type === 'OP' && this.peek().value === '^') {
      this.next()
      const right = this.parsePow() // 右结合
      return Math.pow(left, right)
    }
    return left
  }

  parseUnary(): number {
    const t = this.peek()
    if (t.type === 'OP' && (t.value === '-' || t.value === '+')) {
      this.next()
      const v = this.parseUnary()
      return t.value === '-' ? -v : v
    }
    return this.parsePostfix()
  }

  parsePostfix(): number {
    let v = this.parsePrimary()
    while (this.peek().type === 'BANG') {
      this.next()
      v = factorial(v)
    }
    return v
  }

  parsePrimary(): number {
    const t = this.peek()

    if (t.type === 'NUM') {
      this.next()
      return parseFloat(t.value)
    }

    if (t.type === 'LPAREN') {
      this.next()
      const v = this.parseExpr()
      if (!this.match('RPAREN')) {
        throw new CalcError('缺少右括号 ")"', this.peek().pos)
      }
      return v
    }

    if (t.type === 'IDENT') {
      // 函数调用 IDENT '('
      if (this.i + 1 < this.tokens.length && this.tokens[this.i + 1].type === 'LPAREN') {
        const name = t.value
        this.next() // 消耗 IDENT
        this.next() // 消耗 '('
        // 解析参数：expr (',' expr)*
        const args: number[] = []
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpr())
          while (this.match('COMMA')) {
            args.push(this.parseExpr())
          }
        }
        if (!this.match('RPAREN')) {
          throw new CalcError(`函数 "${name}" 缺少右括号`, this.peek().pos)
        }
        return callFunction(name, args, this.angleMode)
      }
      // 单标识符：常量或 ans
      this.next()
      return resolveIdent(t.value, this.ans)
    }

    throw new CalcError(`意外的符号 "${t.value}"`, t.pos)
  }
}

function resolveIdent(name: string, ans: number): number {
  if (name === 'ans' || name === 'Ans' || name === 'ANS') return ans
  if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return CONSTANTS[name]
  throw new CalcError(`未定义的标识符 "${name}"`, 0)
}

function callFunction(name: string, args: number[], angleMode: AngleMode): number {
  // 三角函数：单参数，输入可能是 deg
  if (TRIG_FN[name]) {
    if (args.length !== 1) throw new CalcError(`函数 "${name}" 需要 1 个参数`, 0)
    // 反三角输出 deg 模式时再换算为度
    if (name === 'asin' || name === 'acos' || name === 'atan') {
      const r = INV_TRIG_OUTPUT[name](args[0])
      return angleMode === 'deg' ? (r * 180) / Math.PI : r
    }
    const rad = angleMode === 'deg' ? (args[0] * Math.PI) / 180 : args[0]
    return TRIG_FN[name](rad)
  }

  // 单参数数值函数
  if (SINGLE_FN[name]) {
    if (args.length !== 1) throw new CalcError(`函数 "${name}" 需要 1 个参数`, 0)
    const v = SINGLE_FN[name](args[0])
    if (name === 'sqrt' && args[0] < 0) throw new CalcError('sqrt 不能对负数求值', 0)
    return v
  }

  // 双参数函数
  if (DOUBLE_FN[name]) {
    if (args.length !== 2) throw new CalcError(`函数 "${name}" 需要 2 个参数`, 0)
    return DOUBLE_FN[name](args[0], args[1])
  }

  // log(x[, base])：可变参数 1 或 2 个
  if (name === 'log') {
    if (args.length === 1) return Math.log10(args[0])
    if (args.length === 2) return Math.log(args[0]) / Math.log(args[1])
    throw new CalcError(`函数 "log" 需要 1 或 2 个参数`, 0)
  }

  throw new CalcError(`未定义的函数 "${name}"`, 0)
}

function factorial(n: number): number {
  if (!isFinite(n)) throw new CalcError('阶乘参数无效', 0)
  if (n < 0) throw new CalcError('阶乘不能对负数求值', 0)
  // 整数化（很接近整数时四舍五入）
  const rounded = Math.round(n)
  if (Math.abs(rounded - n) > 1e-10) {
    // 使用 Gamma 函数近似（Stirling）
    if (n > 20) return stirling(n)
    let r = 1
    for (let i = 2; i <= n; i++) r *= i
    return r
  }
  let r = 1
  for (let i = 2; i <= rounded; i++) r *= i
  return r
}

function stirling(n: number): number {
  return Math.sqrt(2 * Math.PI * n) * Math.pow(n / Math.E, n)
}

// ============================================================
// 公开 API
// ============================================================

export function evaluate(input: string, options: EvalOptions = {}): EvalResult {
  const angleMode: AngleMode = options.angleMode ?? 'rad'
  const ans = options.ans ?? 0
  try {
    const trimmed = input.trim()
    if (trimmed === '') return { ok: false, error: '表达式为空' }
    let tokens = tokenize(trimmed)
    tokens = insertImplicitMul(tokens)
    const parser = new Parser(tokens, ans, angleMode)
    const value = parser.parse()
    if (!isFinite(value)) {
      return { ok: false, error: '结果为无穷大或 NaN' }
    }
    return { ok: true, value }
  } catch (e: any) {
    const msg = e?.message ?? '表达式错误'
    const pos = e?.pos
    return {
      ok: false,
      error: pos != null && pos >= 0 ? `${msg}（位置 ${pos + 1}）` : msg,
    }
  }
}

/**
 * 把数字格式化为适合计算器显示的字符串。
 * 整数直接显示；浮点最多保留 12 位有效数字，去除末尾 0。
 */
export function formatNumber(n: number): string {
  if (!isFinite(n)) return String(n)
  if (n === 0) return '0'
  // 用 toPrecision 自动按有效位截断，再 Number() 去尾 0
  const abs = Math.abs(n)
  // 大数 / 小数用科学计数
  if (abs >= 1e15 || (abs > 0 && abs < 1e-9)) {
    return n.toExponential(10).replace(/\.?0+e/, 'e')
  }
  // toPrecision(12) 保留 12 位有效数字
  const s = Number(n.toPrecision(12)).toString()
  return s
}

export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI
