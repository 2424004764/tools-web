// OAuth state CSRF 防护（github / gitee / linuxdo / qq 认证共用）
// 发起授权时把 state 同时放进授权链接和 HttpOnly cookie（限定回调路径、10 分钟），
// 回调时两者必须一致才继续换 token，且无论成败都用后即删，保证一次性。

const STATE_MAX_AGE = 600;

function stateCookieName(provider) {
    return `${provider}_oauth_state`;
}

export function buildStateCookie(provider, state, requestUrl) {
    // Secure 只在 https 下加：本地 wrangler 是 http，加了会导致 cookie 种不上
    const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
    return `${stateCookieName(provider)}=${encodeURIComponent(state)}; Path=/api/${provider}-auth; HttpOnly; SameSite=Lax; Max-Age=${STATE_MAX_AGE}${secure}`;
}

export function clearStateCookie(provider) {
    return `${stateCookieName(provider)}=; Path=/api/${provider}-auth; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readStateCookie(provider, req) {
    const name = stateCookieName(provider);
    const cookie = req.headers.get('Cookie') || '';
    const pair = cookie.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}
