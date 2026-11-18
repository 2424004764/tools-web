# 子站统一登录接入指南（OAuth2 授权码模式）

工具站（`https://tool.fologde.com`）作为 **OAuth2 授权服务器**，各子站作为**客户端**接入。
用户在任一子站点「使用工具箱账号登录」，跳到工具站完成登录/授权后回跳子站，即可拿到该用户的资料。
用户只要在工具站登录过一次，之后从任何子站发起登录都会静默完成（SSO 单点登录）。

## 前置准备

在工具站管理后台 **系统 → OAuth 应用 → 新建应用** 创建客户端，获得：

- `client_id`：公开标识
- `client_secret`：客户端密钥（**仅创建时展示一次**，遗失只能重置）
- 回调地址白名单：子站接收授权码的完整 URL，每行一个，**精确匹配**

## 端点一览

| 端点 | 说明 |
| --- | --- |
| `GET https://tool.fologde.com/oauth/authorize` | 授权页（浏览器跳转） |
| `POST https://tool.fologde.com/api/oauth/token` | 授权码/刷新令牌 换取令牌（服务端调用） |
| `GET https://tool.fologde.com/api/oauth/userinfo` | 获取用户资料与积分余额（需 access_token，scope: profile） |
| `GET https://tool.fologde.com/api/oauth/storage-quota` | 获取用户存储额度（需 access_token，scope: storage） |
| `POST https://tool.fologde.com/api/oauth/storage-upload-credential` | 下发子站直传上传凭证（需 access_token，scope: storage） |
| `POST https://tool.fologde.com/api/oauth/storage-refund` | 删除文件后退还存储额度（需 access_token，scope: storage） |
| `POST https://tool.fologde.com/api/oauth/credits/consume` | 消费积分（需 access_token，scope: credits；幂等，返回扣分凭证 receipt） |
| `POST https://tool.fologde.com/api/oauth/credits/refund` | 按消费流水退款（需 access_token，scope: credits；一笔只能退一次） |
| `POST https://tool.fologde.com/api/ai-gateway` | 统一 AI 网关（需 Bearer，scope: ai；生文/生图，多厂商容灾） |
| `POST https://tool.fologde.com/api/ai-gateway/v1/chat/completions` | 网关的 OpenAI 兼容端点（同上；任意 OpenAI SDK 可直连） |
| `POST https://tool.fologde.com/api/oauth/revoke` | 撤销令牌（可选） |

## 接入步骤（标准授权码流程）

### 1. 引导用户跳转到授权页

```
https://tool.fologde.com/oauth/authorize
  ?client_id=tc_xxxx
  &redirect_uri=https://sub.example.com/auth/callback
  &state=随机字符串
  &scope=profile storage
```

- `state`：子站自行生成的随机串，回跳时原样带回，用于防 CSRF（**务必校验**）。
- `scope`：空格分隔，可选项见下表；不传默认 `profile`。

| scope | 说明 |
| --- | --- |
| `profile` | 用户资料（用户名、邮箱、头像）与积分余额 |
| `storage` | 存储额度查询 + 子站直传上传（额度统一由主站预扣与实扣） |
| `credits` | 代表用户消费积分（付费功能从用户积分余额扣除，支持退款） |
| `ai` | 调用主站统一 AI 网关（生文/生图，多厂商自动容灾，消耗由主站承担） |

### 2. 用户在工具站完成登录 + 授权

- 未登录 → 工具站展示登录页，登录后回到授权页；
- 首次授权 → 展示授权确认页，用户点「同意授权」；
- 此前已授权过、且本次请求的 scope 未超出已授权范围 → **直接静默签发授权码回跳**（这就是单点登录）；scope 有扩大时会再次展示确认页。

### 3. 回跳子站，拿到授权码

```
https://sub.example.com/auth/callback?code=oac_xxxx&state=xxxx
```

授权码 10 分钟有效、一次性。

### 4. 子站后端用授权码换令牌

```http
POST https://tool.fologde.com/api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=oac_xxxx
&redirect_uri=https://sub.example.com/auth/callback
&client_id=tc_xxxx
&client_secret=tcs_xxxx
```

响应：

```json
{
  "access_token": "oat_xxxx",
  "token_type": "Bearer",
  "expires_in": 7200,
  "refresh_token": "ort_xxxx",
  "scope": "profile storage"
}
```

`access_token` 有效期 2 小时；`refresh_token` 有效期 30 天，刷新时会轮换（旧的立即作废）：

```http
POST https://tool.fologde.com/api/oauth/token

grant_type=refresh_token
&refresh_token=ort_xxxx
&client_id=tc_xxxx
&client_secret=tcs_xxxx
```

### 5. 获取用户资料与积分

```http
GET https://tool.fologde.com/api/oauth/userinfo
Authorization: Bearer oat_xxxx
```

响应：

```json
{
  "sub": "用户唯一ID（与工具站 user.id 一致）",
  "id": "同 sub",
  "username": "用户名",
  "email": "邮箱",
  "avatar": "头像地址",
  "created_at": "注册时间",
  "credits": {
    "balance": 100,
    "total_earned": 150,
    "total_spent": 50
  }
}
```

`credits` 为用户在工具站的积分余额（与主站「个人中心-我的积分」同一数据源）：

| 字段 | 说明 |
| --- | --- |
| `credits.balance` | 当前可用积分 |
| `credits.total_earned` | 累计获得积分 |
| `credits.total_spent` | 累计消耗积分 |

- 用户从未产生过积分记录时 `credits` 各字段返回 `0`（不会缺失字段）；
- 积分只读：子站可据此展示余额、做本地预检（如余额不足引导用户去主站充值），扣减/充值只能发生在主站。

子站据此完成自家注册/登录（以 `sub` 为准建立本地账号映射），签发子站自己的会话。

### 6. 获取存储额度（scope: storage）

返回用户名下的上传空间额度（与主站「个人中心-存储额度」同一数据源）。子站可据此在上传前做本地预检、展示剩余空间等。

```http
GET https://tool.fologde.com/api/oauth/storage-quota
Authorization: Bearer oat_xxxx
```

响应（单位均为字节）：

```json
{
  "sub": "用户唯一ID（与 userinfo 的 sub 一致）",
  "quota_bytes": 1073741824,
  "used_bytes": 209715200,
  "pending_bytes": 0,
  "remaining_bytes": 864026112,
  "price": { "credits": 1, "bytes": 104857600 }
}
```

| 字段 | 说明 |
| --- | --- |
| `quota_bytes` | 总容量 |
| `used_bytes` | 已用容量（已确认上传的文件） |
| `pending_bytes` | 预留中容量（已签名、尚未完成或超时失效的上传） |
| `remaining_bytes` | 剩余可上传容量 = quota - used - pending |
| `price` | 额度定价参考：1 积分 = 100MB（子站如需展示「购买额度」入口可用） |

- 该端点要求 access_token 含 `storage` scope；令牌只有 `profile` 时返回 `403 insufficient_scope`，需引导用户重新走一次授权（带上 `scope=profile storage`）。
- 额度由主站在上传签名时预扣、完成后按实际大小结算，子站只需读取，不可直接写入。

### 7. 退出登录（可选）

```http
POST https://tool.fologde.com/api/oauth/revoke

token=oat_xxxx&client_id=tc_xxxx&client_secret=tcs_xxxx
```

撤销 access_token 或 refresh_token 均可，无论 token 是否有效都返回 200。

## 积分消费（scope: credits）

子站的付费功能可以消费用户在主站的积分余额。核心原则——**先扣后用**：

- 子站**服务端**在放行付费功能前，先同步调 `consume` 扣分；返回 200 才执行功能；
- 余额不足、超时、任何失败都**不执行功能**（宁可拒绝服务，不可先用后补，否则用户可断线逃单）；
- 扣分绝不能放在浏览器/前端做（access_token 不下发前端，前端传的"已扣分"标志可伪造）；
- 功能执行失败（如上游生成报错）时调 `refund` 把积分退还给用户。

### 1. 消费积分

```http
POST https://tool.fologde.com/api/oauth/credits/consume
Authorization: Bearer oat_xxxx
Content-Type: application/json

{
  "amount": 10,
  "reason": "AI 讲解一道题",
  "order_id": "tiji-explain-q123"
}
```

| 参数 | 说明 |
| --- | --- |
| `amount` | 必填。1~1000000 的整数（积分） |
| `reason` | 必填。≤100 字，展示给用户的消费说明（主站会自动带上应用名前缀） |
| `order_id` | 强烈建议。子站业务单号（1~64 位字母/数字/`_`/`-`/`:`）。同一单号重复请求只扣一次，网络超时重试不会双扣 |

响应：

```json
{
  "tx_id": "消费流水ID（退款时用）",
  "amount": 10,
  "balance_after": 90,
  "reason": "题迹消费：AI 讲解一道题",
  "receipt": "eyJ1aWQiOiJ1...（扣分凭证，见下文）",
  "receipt_ttl_seconds": 600
}
```

错误码：`401 invalid_token` / `403 insufficient_scope`（需引导用户带 `scope=profile credits` 重新授权）/ `400 insufficient_credits`（余额不足）/ `400 invalid_request`。

### 2. 退款

```http
POST https://tool.fologde.com/api/oauth/credits/refund
Authorization: Bearer oat_xxxx
Content-Type: application/json

{ "tx_id": "consume 返回的 tx_id", "reason": "生成失败" }
```

- 只能退**本应用对该用户**的消费流水，全额退；一笔消费只能退一次，重复调用返回首次结果（`deduplicated: true`）；
- 退款流水在用户积分明细中显示为「退还」，可追溯到原消费。

### 3. 扣分凭证（receipt）

`consume` 成功时返回 `receipt`：主站用**你的 client_secret** 做 HMAC-SHA256 签名的「已扣分发票」，10 分钟有效。

用途：子站的付费功能入口可要求**出示 receipt 才干活**（验签 + 过期检查），防止某个接口漏写扣分逻辑、或前端绕过子站后端直接打功能接口白嫖。payload 含 `uid / client_id / tx_id / amount / order_id / iat / exp`，可与业务单号比对实现一次性（防重放）。

Node 验签示例（与主站 `functions/api/oauth/_lib.js` 算法一致）：

```js
import crypto from 'node:crypto'

function verifyReceipt(receipt, clientSecret, expectClientId) {
  const [payload, sig] = String(receipt).split('.')
  if (!payload || !sig) return null
  const expect = Buffer.from(crypto.createHmac('sha256', clientSecret).update(payload).digest('hex'))
  const got = Buffer.from(sig)
  // 恒时比较（长度不同直接失败）
  if (expect.length !== got.length || !crypto.timingSafeEqual(expect, got)) return null
  const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64url').toString())
  if (data.client_id !== expectClientId) return null
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
  return data // 校验通过，可再比对 order_id / 一次性记录 tx_id
}
```

### 4. 推荐的子站接入模式（伪代码）

```js
// 子站后端：付费功能统一入口
app.post('/api/explain', auth, async (req, res) => {
  // ① 先扣分（带业务单号，天然幂等）
  const r = await mainSite.consume({
    amount: 10,
    reason: 'AI 讲解一道题',
    order_id: `explain-${req.body.questionId}-${req.user.sub}`,
  })
  if (r.status !== 200) return res.status(402).send('积分不足或扣分失败')

  try {
    // ② 扣分成功才执行功能
    const result = await runExplain(req.body)
    res.json({ result, balance: r.balance_after })
  } catch (e) {
    // ③ 功能失败 → 退款
    await mainSite.refund({ tx_id: r.tx_id, reason: '生成失败' })
    res.status(500).send('生成失败，积分已退')
  }
})
```

对账：所有消费/退款写入主站积分流水（来源「子站应用」，含应用名与业务单号），用户在主站「积分明细」可见，主站后台可按来源筛选。

## 子站直传上传（scope: storage）

用户在子站上传文件时，文件**不经过子站服务器**，浏览器携带凭证直传该子站在主站登记的专属 R2 桶；存储额度由主站统一预扣与实扣，子站不接触任何云存储密钥。

**前提**：管理员已在后台「OAuth 应用 → 编辑」中为该应用登记 `R2 桶名`（桶需在主站的 Cloudflare 账号中预先创建）。未登记桶名的应用调用凭证接口返回 `403 upload_not_enabled`。

### 1. 申请上传凭证

```http
POST https://tool.fologde.com/api/oauth/storage-upload-credential
Authorization: Bearer oat_xxxx
Content-Type: application/json

{
  "filename": "photo.png",
  "bytes": 204800,
  "content_type": "image/png"
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `filename` | 是 | 文件名（只取最后一段路径，保留中文等 unicode） |
| `bytes` | 是 | 文件字节数（**必须与实际上传大小完全一致**，原因见下方语义） |
| `content_type` | 否 | MIME 类型，缺省 `application/octet-stream` |

响应：

```json
{
  "ok": true,
  "upload_id": "0e6c8bd2-....",
  "upload_url": "https://<子站桶>.r2.cloudflarestorage.com/subsite/<uid>/<upload_id>/photo.png?X-Amz-...",
  "bucket": "subsite-notes",
  "object_key": "subsite/<uid>/<upload_id>/photo.png",
  "bytes": 204800,
  "content_type": "image/png",
  "expires_at": "2026-10-11T12:34:56.000Z",
  "expires_in": 900
}
```

**凭证语义（重要）**：

- **预扣**：凭证签发成功即预扣 `bytes` 额度（余额不足返回 `402 quota_exceeded`，附 `remaining_bytes` / `need_bytes`）；15 分钟内未完成上传，预扣自动失效归还；
- **锁定**：`upload_url` 是一次一用的预签名 PUT，`Content-Length` 与 `Content-Type` 都签进了签名——实际上传的大小或类型与申请时不符，**R2 直接返回 403 拒绝写入**，不存在"先传上去再对账"的窗口；大小不符时子站按实际情况重新申请凭证即可（原预扣已自动回滚）；
- **实扣**：上传成功后由主站通过 R2 事件通知异步实扣（`used_bytes += bytes`、释放预扣），**子站无需也不应上报结算**，下次拉取 `storage-quota` 即为扣减后的余额；
- **幂等**：实扣按 `upload_id` 幂等结算，事件重复投递不会重复扣；
- 单文件上限 500MB（`invalid_request`），大文件分片暂不支持。

### 2. 浏览器直传

```js
const res = await fetch(credential.upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': credential.content_type },
  body: file, // 大小必须与申请时的 bytes 一致
});
// 200/204 = 上传成功；403 = 大小或类型与凭证不符
```

上传跨域由主站桶的 CORS 配置统一放行，子站无需额外配置。

### 3. 删除文件、退还额度

子站删除自己桶里的对象后，调退额接口把占用的额度还给用户。**退多少由主站记账决定**（实扣时记录的字节数），子站只报「删了哪个文件」，不接受自报大小：

```http
POST https://tool.fologde.com/api/oauth/storage-refund
Authorization: Bearer oat_xxxx
Content-Type: application/json

{
  "object_key": "subsite/<uid>/<upload_id>/photo.png"
}
```

- `object_key` 就是申请凭证时返回的那个 key——子站删 R2 对象本来就要用它，**无需为退额额外存储任何东西**；传凭证响应里的 `upload_id` 效果相同。
- 每个文件只能退一次；重复删除同一文件再次调用会返回 200 + `already: true`，同样视为成功。

响应：

```json
{ "ok": true, "refunded_bytes": 204800 }
```

| HTTP | error | 子站处理 |
| --- | --- | --- |
| 200 | — | 成功（含 `already: true` 的幂等响应） |
| 409 | `not_settled_yet` | 用户刚上传就删、主站队列还没记账；等 30 秒重试，最多 3 次左右 |
| 404 | `invalid_request` | 记录不存在或未计入额度（如已废弃的自报结算时代对象）；放弃即可，不要重试 |
| 400 | `invalid_request` | 缺 `object_key` / `upload_id`，检查调用代码 |

### 4. 错误码

| error | HTTP | 说明 |
| --- | --- | --- |
| `invalid_token` | 401 | access_token 无效或过期 |
| `insufficient_scope` | 403 | 令牌未授予 `storage` scope |
| `upload_not_enabled` | 403 | 该应用未登记 R2 桶，未开通上传 |
| `quota_exceeded` | 402 | 剩余额度不足（附 `remaining_bytes` / `need_bytes`） |
| `invalid_request` | 400 | 缺 `bytes` / 超单文件上限 / `content_type` 不合法 |

## AI 网关调用（scope: ai）

主站提供**统一 AI 网关**：后台接入的各家厂商（OpenAI 兼容中转 / Anthropic / Gemini 等）组成调度组，一次调用按优先级自动容灾切换（某家 5xx/限流/超时自动换下一家）。子站用 OAuth `access_token` 即可调用，鉴权方式与 `userinfo` 完全一致（RFC 6750 Bearer），**无需任何厂商 API Key**。

- 授权时请带 `scope=profile ai`（令牌缺 `ai` 时调网关返回 `403 insufficient_scope`）；
- 所有调用记入主站网关日志（含出入参与 token 用量），消耗由主站承担；
- 生视频（video）暂未开放，当前支持 `chat` / `chat_stream`（生文）与 `image_gen`（生图）。

### 方式一：OpenAI 兼容端点（推荐）

任意 OpenAI SDK / 兼容客户端改两个参数即可接入——`apiKey` 传 access_token，`model` 传主站的**调度组 key**（不是厂商模型名）：

```js
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://tool.fologde.com/api/ai-gateway/v1',
  apiKey: oat_xxxx, // OAuth access_token（scope 含 ai）
})

// 流式
const stream = await client.chat.completions.create({
  model: 'text-default',        // 调度组 group_key（主站后台配置）
  stream: true,
  messages: [{ role: 'user', content: '你好' }],
})
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '')
}

// 非流式：const res = await client.chat.completions.create({ model: 'text-default', messages: [...] })
```

请求/响应格式与 OpenAI API 完全一致（SSE chunk、`usage`、`finish_reason`）；上游即使是 Claude / Gemini 也已由网关在服务端完成协议转换。

### 方式二：网关原生端点

功能更全（生图、直连指定模型、超时预算），报文更省：

```http
POST https://tool.fologde.com/api/ai-gateway
Authorization: Bearer oat_xxxx
Content-Type: application/json

{
  "capability": "chat_stream",        // chat | chat_stream | image_gen
  "group": "text-default",            // 调度组 group_key；或 "model": <模型ID> 直连指定模型
  "payload": {
    "messages": [{ "role": "user", "content": "你好" }],
    "max_tokens": 1024
  },
  "timeout_ms": 120000                // 可选：整条容灾链共享的总预算（5000~600000）
}
```

**生文非流式**响应：

```json
{
  "ok": true,
  "data": { "content": "……", "finish_reason": "stop", "usage": { "input_tokens": 5, "output_tokens": 7 } },
  "meta": { "provider": "命中的厂商slug", "model": "厂商侧模型ID", "group": "text-default", "attempts": [], "duration_ms": 812 }
}
```

**生文流式**（`capability: "chat_stream"`）为 SSE，每事件一行 JSON，结束发 `data: [DONE]`：

```
data: {"delta":"你"}
data: {"delta":"好"}
data: {"reasoning":"……"}          ← 部分模型的思维链（可选出现）
data: {"usage":{"input_tokens":3,"output_tokens":5}}
data: {"finish":"stop"}
data: [DONE]
```

**生图**（`capability: "image_gen"`）：`payload` 为 `{ "prompt": "...", "size": "1024x1024" }`，响应 `data.image_url` 为图片 URL 或 data URL。响应头 `X-Gateway-Provider` / `X-Gateway-Model` 标记实际命中的厂商。

### 错误码

| error / 情形 | HTTP | 说明 |
| --- | --- | --- |
| `invalid_token` | 401 | access_token 无效或已过期（oat_ 凭证，RFC 6750 风格响应） |
| `insufficient_scope` | 403 | 令牌未授予 `ai` scope，需带 `scope=profile ai` 重新授权 |
| —（`ok:false` + 文案） | 400 | 请求参数错误（payload 缺 messages、capability 非法等） |
| —（`ok:false` + 文案） | 503 | 调度组不存在或无可上游可用（文末附原因明细） |
| —（`ok:false` + 文案） | 429/5xx | 容灾链全部失败，状态码取最后一次尝试 |

OpenAI 兼容端点的错误为 OpenAI 格式 `{ "error": { "message", "type" } }`，状态码语义相同。

## 错误处理


回跳时若带 `error` 参数表示用户拒绝或其他失败：

```
https://sub.example.com/auth/callback?error=access_denied&error_description=用户拒绝了授权&state=xxx
```

`/api/oauth/token` 的错误遵循 RFC 6749：

```json
{ "error": "invalid_grant", "error_description": "授权码已过期" }
```

常见错误：`invalid_client`（密钥错误/应用被停用）、`invalid_grant`（授权码无效/过期/已用、redirect_uri 不一致）、`unsupported_grant_type`。

资源端点（userinfo / storage-quota）的错误遵循 RFC 6750：`invalid_token`（401，令牌无效/过期）、`insufficient_scope`（403，令牌未授予所需 scope，如拿只有 `profile` 的令牌调 storage-quota）。

## 安全要求

- `state` 必须校验；`client_secret` 只能存服务端，不可下发到浏览器；
- 暂不支持纯前端（无服务端）子站接入：换令牌必须提供 `client_secret`，因此子站必须有服务端；
- 回调地址必须 HTTPS（本地开发可用 http）；
- 授权码一次性，收到 `invalid_grant` 时应视为该次登录失败；
- 停用应用 / 重置密钥会立即撤销该应用所有已签发令牌。

## 快速自测（curl）

```bash
# 1. 后台创建应用拿到 client_id / client_secret，回调地址填 https://httpbin.org/get
# 2. 浏览器打开（登录工具站并同意授权）：
#    https://tool.fologde.com/oauth/authorize?client_id=tc_xxx&redirect_uri=https://httpbin.org/get&state=test123&scope=profile%20storage
# 3. 从回跳 URL 里取出 code：
curl -X POST https://tool.fologde.com/api/oauth/token \
  -d "grant_type=authorization_code" \
  -d "code=oac_上一步的授权码" \
  -d "redirect_uri=https://httpbin.org/get" \
  -d "client_id=tc_xxx" \
  -d "client_secret=tcs_xxx"

# 4. 用 access_token 拉用户信息（响应含 credits 积分余额）：
curl https://tool.fologde.com/api/oauth/userinfo -H "Authorization: Bearer oat_xxx"

# 5. 拉存储额度（授权时需带 scope=profile storage）：
curl https://tool.fologde.com/api/oauth/storage-quota -H "Authorization: Bearer oat_xxx"

# 6. 调 AI 网关（授权时需带 scope=profile ai），OpenAI 兼容端点：
curl -N -X POST https://tool.fologde.com/api/ai-gateway/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer oat_xxx" \
  -d '{"model":"text-default","stream":true,"messages":[{"role":"user","content":"你好"}]}'
```
