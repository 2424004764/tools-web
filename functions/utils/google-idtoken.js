// Google ID Token 校验（Google One Tap / GIS 按钮回传的 credential）
// 前端 GIS 拿到的 credential 是 Google 签发的 RS256 JWT，此前 google-auth.js 只做
// Base64 解码就信任 payload，伪造 token 填任意邮箱即可登录任意账号（含管理员）。
// 这里按 Google 官方建议做完整校验：JWKS 验签 + iss / aud / exp / email_verified，
// 任何一项不通过都抛错，调用方统一回 401 —— 不存在"解码即信任"的分支。

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
// JWKS 缓存 1 小时；Google 轮换密钥后按 kid 未命中强制刷新兜底
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
// exp / nbf 的小幅时钟偏差容忍
const CLOCK_SKEW_SECONDS = 30;
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const MAX_TOKEN_LENGTH = 8192;

let cachedJwks = null; // { keys: JWK[], fetchedAt: number }
let inflightFetch = null;

function reject(reason) {
    throw new Error(reason);
}

function base64UrlToBytes(input) {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function fetchJwks() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(JWKS_URL, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`获取 Google JWKS 失败: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data.keys) || data.keys.length === 0) {
            throw new Error('Google JWKS 格式异常');
        }
        cachedJwks = { keys: data.keys, fetchedAt: Date.now() };
    } finally {
        clearTimeout(timer);
    }
}

async function getGoogleJwks(forceRefresh = false) {
    const fresh = cachedJwks && Date.now() - cachedJwks.fetchedAt < JWKS_CACHE_TTL_MS;
    if (!forceRefresh && fresh) {
        return cachedJwks;
    }
    // 并发请求去重，避免冷启动时同时打多次 JWKS 端点
    if (!inflightFetch) {
        inflightFetch = fetchJwks().finally(() => {
            inflightFetch = null;
        });
    }
    await inflightFetch;
    return cachedJwks;
}

async function importRsaKey(jwk) {
    // 只取 importKey 需要的成员，避免 JWKS 里的 x5c 等附加字段影响不同运行时
    return crypto.subtle.importKey(
        'jwk',
        { kty: jwk.kty, n: jwk.n, e: jwk.e },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );
}

// 校验入口：通过则返回 payload，否则抛错（错误信息只进日志，不回给客户端）
export async function verifyGoogleIdToken(token, expectedClientId) {
    const jwks = await getGoogleJwks();
    try {
        return await verifyJwtAgainstJwks(token, jwks, expectedClientId);
    } catch (error) {
        // kid 未命中可能是 Google 刚轮换密钥而缓存还是旧的，强制刷新一次再试
        const kidMissing = error.message.includes('kid');
        if (!kidMissing) {
            throw error;
        }
        const refreshed = await getGoogleJwks(true);
        return verifyJwtAgainstJwks(token, refreshed, expectedClientId);
    }
}

// 与网络解耦的核心校验（便于本地用自制 JWKS 做单测）
export async function verifyJwtAgainstJwks(token, jwks, expectedClientId) {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
        reject('token 格式非法');
    }
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
        reject('token 结构非法');
    }

    let header;
    let payload;
    try {
        header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
        payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
    } catch {
        reject('token 解码失败');
    }

    // 显式拒绝非 RS256（含 alg=none / 算法混淆攻击）
    if (header.alg !== 'RS256') {
        reject(`不支持的算法: ${header.alg}`);
    }
    if (!header.kid) {
        reject('缺少 kid');
    }

    const jwk = (jwks.keys || []).find((key) => key.kid === header.kid && key.alg === 'RS256');
    if (!jwk) {
        reject(`JWKS 中找不到 kid: ${header.kid}`);
    }

    // RS256 验签：签名覆盖 header.payload 原文
    let signatureValid = false;
    try {
        const key = await importRsaKey(jwk);
        const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        signatureValid = await crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5',
            key,
            base64UrlToBytes(parts[2]),
            data
        );
    } catch {
        reject('验签执行失败');
    }
    if (!signatureValid) {
        reject('签名不匹配');
    }

    // —— 签名可信后才校验 claims ——
    if (!VALID_ISSUERS.has(payload.iss)) {
        reject(`iss 非法: ${payload.iss}`);
    }
    if (payload.aud !== expectedClientId) {
        reject('aud 与本站 client_id 不符');
    }

    const now = Math.floor(Date.now() / 1000);
    // exp 必须存在且未过期（缺失 exp 的 token 一律拒绝）
    if (typeof payload.exp !== 'number' || now - CLOCK_SKEW_SECONDS > payload.exp) {
        reject('token 已过期或缺少 exp');
    }
    if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_SECONDS > now) {
        reject('token 尚未生效');
    }

    if (!payload.sub) {
        reject('缺少 sub');
    }
    if (!payload.email || typeof payload.email !== 'string') {
        reject('缺少 email');
    }
    // 站点以 email 作为统一账号键，必须要求 Google 侧已验证该邮箱
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
        reject('email 未验证');
    }

    return payload;
}
