export interface UserInfo {
    uid: string;
    email: string;
    avatar: string;
    username: string;
    iat: number;
    exp: number;
}

/**
 * 读取本地存储的 TOKEN
 */
export function getLocalToken(): string | null {
    const t = localStorage.getItem('TOKEN') || '';
    const token = t.trim();
    return token ? token : null;
}

/**
 * base64url 解码
 */
function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
        base64 += '='.repeat(4 - pad);
    }
    try {
        return decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
    } catch {
        return '';
    }
}

/**
 * 解析 JWT 的 payload
 */
export function parseJwt<T = any>(token: string): T | null {
    if (!token) return null;
    const pure = token.startsWith('Bearer ') ? token.slice(7) : token;
    const parts = pure.split('.');
    if (parts.length < 2) return null;
    const json = base64UrlDecode(parts[1]);
    if (!json) return null;
    try {
        return JSON.parse(json) as T;
    } catch {
        return null;
    }
}

/**
 * 从 TOKEN 中获取用户信息
 */
export function getUserFromToken(): UserInfo | null {
    const token = getLocalToken();
    if (!token) return null;
    return parseJwt<UserInfo>(token);
}

/**
 * TOKEN 是否过期
 */
export function isTokenExpired(token?: string): boolean {
    const t = token ?? getLocalToken() ?? '';
    const payload = parseJwt<{ exp?: number }>(t);
    if (!payload || !payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
}

/**
 * 退出登录，清除本地存储的 TOKEN
 */
export function logout(): void {
    localStorage.removeItem('TOKEN');
}