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
| `GET https://tool.fologde.com/api/oauth/userinfo` | 获取用户资料（需 access_token，scope: profile） |
| `GET https://tool.fologde.com/api/oauth/storage-quota` | 获取用户存储额度（需 access_token，scope: storage） |
| `POST https://tool.fologde.com/api/oauth/storage-upload-credential` | 下发子站直传上传凭证（需 access_token，scope: storage） |
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
| `profile` | 用户资料（用户名、邮箱、头像） |
| `storage` | 存储额度查询 + 子站直传上传（额度统一由主站预扣与实扣） |

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

### 5. 获取用户资料

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
  "created_at": "注册时间"
}
```

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

### 3. 错误码

| error | HTTP | 说明 |
| --- | --- | --- |
| `invalid_token` | 401 | access_token 无效或过期 |
| `insufficient_scope` | 403 | 令牌未授予 `storage` scope |
| `upload_not_enabled` | 403 | 该应用未登记 R2 桶，未开通上传 |
| `quota_exceeded` | 402 | 剩余额度不足（附 `remaining_bytes` / `need_bytes`） |
| `invalid_request` | 400 | 缺 `bytes` / 超单文件上限 / `content_type` 不合法 |

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

# 4. 用 access_token 拉用户信息：
curl https://tool.fologde.com/api/oauth/userinfo -H "Authorization: Bearer oat_xxx"

# 5. 拉存储额度（授权时需带 scope=profile storage）：
curl https://tool.fologde.com/api/oauth/storage-quota -H "Authorization: Bearer oat_xxx"
```
