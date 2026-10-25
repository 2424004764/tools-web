// OAuth state CSRF 防护（github / gitee / linuxdo / qq 认证共用）
// 发起授权时把 state 同时放进授权链接和 HttpOnly cookie（限定回调路径、10 分钟），
// 回调时两者必须一致才继续换 token，且无论成败都用后即删，保证一次性。
//
// cookie 值为 JSON：{ s: state, o: 发起页 origin, v: PKCE code_verifier }。
//   o —— 回调时作为 postMessage 的 targetOrigin，防止登录 token 发给恶意 opener；
//        仅接受 CORS 白名单（含 localhost 开发源）内的值，其余回退回调页自身 origin。
//   v —— 仅 GitHub 使用（PKCE S256），其他提供方为空。
// 兼容：升级前种下的裸 state 字符串按 { state, origin: null, verifier: null } 解析，
// state 比对仍通过，只是 origin 回退默认值。

const STATE_MAX_AGE = 600;

function stateCookieName(provider) {
    return `${provider}_oauth_state`;
}

export function buildStateCookie(provider, state, requestUrl, extras = {}) {
    // Secure 只在 https 下加：本地 wrangler 是 http，加了会导致 cookie 种不上
    const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
    const value = JSON.stringify({
        s: state,
        o: extras.origin || '',
        v: extras.verifier || ''
    });
    return `${stateCookieName(provider)}=${encodeURIComponent(value)}; Path=/api/${provider}-auth; HttpOnly; SameSite=Lax; Max-Age=${STATE_MAX_AGE}${secure}`;
}

export function clearStateCookie(provider) {
    return `${stateCookieName(provider)}=; Path=/api/${provider}-auth; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// 返回 { state, origin, verifier } | null；origin/verifier 无值时为 null
// origin 读取时再做一次格式校验：cookie 可被篡改，只放行规范的 http(s) origin
const ORIGIN_RE = /^https?:\/\/[^\s\/]+$/
export function readStateCookie(provider, req) {
    const name = stateCookieName(provider);
    const cookie = req.headers.get('Cookie') || '';
    const pair = cookie.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length + 1));
    if (raw.startsWith('{')) {
        try {
            const j = JSON.parse(raw);
            if (typeof j.s !== 'string') return null;
            const origin = (typeof j.o === 'string' && ORIGIN_RE.test(j.o)) ? j.o : null;
            return { state: j.s, origin, verifier: (typeof j.v === 'string' && j.v) ? j.v : null };
        } catch (e) {
            return null;
        }
    }
    // 旧格式：裸 state 字符串
    return { state: raw, origin: null, verifier: null };
}
