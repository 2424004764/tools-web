// Gitee 登录认证
import { handleCORSPreflight, createCORSResponse, createCORSErrorResponse, isOriginAllowed } from './utils/cors.js'
import { buildStateCookie, clearStateCookie, readStateCookie } from './utils/oauth-state.js'
import { grantRegistrationRewards } from './services/registrationRewardService.js'
import { MAIN_JWT_TTL_SECONDS } from './config/auth.js'

export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin')

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return handleCORSPreflight(origin)
    }

// 处理回调请求
if (request.method === 'GET') {
    return handleAuthCallback(request, env, origin);
}

    // 处理获取授权链接请求
    if (request.method === 'POST') {
        return getAuthUrl(request, env, origin);
    }

    return new Response('Method not allowed', { status: 405 });
}

// ---------- OAuth state CSRF 防护 ----------
// 实现在 ./utils/oauth-state.js（github / gitee / linuxdo / qq 共用）：
// 发起授权时把 state 同时放进授权链接和 HttpOnly cookie，回调时比对，用后即删。

// 生成授权链接
async function getAuthUrl(request, env, origin) {
    try {
        // Gitee OAuth配置信息
        const CLIENT_ID = env.GITEE_CLIENT_ID;
        const AUTH_URL = 'https://gitee.com/oauth/authorize';

        // 检查必要的配置
        if (!CLIENT_ID) {
            throw new Error('缺少GITEE_CLIENT_ID环境变量配置');
        }

        // 回调地址固定用 /api/gitee-auth：站点是 PWA，Service Worker 的
        // navigateFallback 会拦截非 /api/ 路径的页面导航并返回缓存的 SPA 壳
        // （旧版 SW 的 denylist 只有 /^\/api\//），导致 OAuth 回调页到不了函数、
        // 弹窗落在 /404。/api/ 路径任何版本的 SW 都放行（与 github-auth 相同策略）。
        const redirectUri = `${new URL(request.url).origin}/api/gitee-auth`;

        // 生成state参数防止CSRF攻击
        const state = crypto.randomUUID();

        // 生成授权链接参数
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'user_info',
            state
        });

        const authUrl = AUTH_URL + '?' + params.toString();

        const response = createCORSResponse({
            success: true,
            auth_url: authUrl
        }, origin);
        // state 种入 HttpOnly cookie，供回调时比对（弹窗顶级导航会携带 SameSite=Lax cookie）；
        // 同时绑定发起页 origin，回调时作为 postMessage 的 targetOrigin。
        // 发起页 origin 只接受 CORS 白名单内的值，跨站伪造发起一律回退本站 origin
        response.headers.append('Set-Cookie', buildStateCookie('gitee', state, request.url, {
            origin: isOriginAllowed(origin) ? origin : new URL(request.url).origin
        }));
        return response;

    } catch (error) {
        console.error('获取 Gitee 授权链接错误:', error);
        return createCORSErrorResponse('获取授权链接失败', origin);
    }
}

// 处理OAuth回调：无论成败都作废 state cookie，保证 state 一次性
async function handleAuthCallback(request, env, origin) {
    const response = await doHandleAuthCallback(request, env);
    response.headers.append('Set-Cookie', clearStateCookie('gitee'));
    return response;
}

async function doHandleAuthCallback(request, env) {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const state = url.searchParams.get('state');
        const ownOrigin = url.origin;

        if (error) {
            // 登录失败，关闭弹窗并发送错误信息
            return createCallbackResponse('error', {
                success: false,
                message: '用户取消登录或授权失败'
            }, ownOrigin);
        }

        if (!code) {
            return createCallbackResponse('error', {
                success: false,
                message: '缺少授权码'
            }, ownOrigin);
        }

        // CSRF 校验：回跳的 state 必须与发起授权时种下的 cookie 一致。
        // 部署前发起的旧授权没有 state，会得到明确提示重新登录。
        const cookieState = readStateCookie('gitee', request);
        if (!state || !cookieState || state !== cookieState.state) {
            return createCallbackResponse('error', {
                success: false,
                message: '登录状态校验失败，请重新发起登录'
            }, ownOrigin);
        }

        // 登录结果 postMessage 回发起页：目标 origin 用发起时绑定进 cookie 的值，
        // 未绑定时回退本站 origin，绝不使用 '*'（防止 token 落入恶意 opener）
        const targetOrigin = cookieState.origin || ownOrigin;

        // redirect_uri 必须与授权链接里的一致才能换 token；
        // 从回调请求自身重建（origin + path），/api/gitee-auth 与旧版 /gitee-auth 链接都能对上
        const callbackUrl = new URL(request.url);
        const redirectUri = callbackUrl.origin + callbackUrl.pathname;

        // 交换访问令牌
        const tokenResponse = await exchangeCodeForToken(code, env, redirectUri);
        if (!tokenResponse.success) {
            return createCallbackResponse('error', {
                success: false,
                message: '令牌交换失败'
            }, targetOrigin);
        }

        // 获取用户信息
        const userInfo = await fetchUserInfo(tokenResponse.access_token);
        if (!userInfo.success) {
            return createCallbackResponse('error', {
                success: false,
                message: '获取用户信息失败'
            }, targetOrigin);
        }

        // 处理用户登录
        const loginResult = await processUserLogin(userInfo.data, env);
        if (!loginResult.success) {
            return createCallbackResponse('error', {
                success: false,
                message: loginResult.error || '登录失败'
            }, targetOrigin);
        }

        // 登录成功，关闭弹窗并发送用户信息
        return createCallbackResponse('success', {
            success: true,
            data: {
                user: loginResult.user,
                token: loginResult.token
            },
            message: loginResult.message
        }, targetOrigin);

    } catch (error) {
        console.error('Gitee callback error:', error);
        // 不回显 error.message：内部异常信息可能携带上游响应细节，统一对外文案
        return createCallbackResponse('error', {
            success: false,
            message: '登录处理异常，请稍后重试'
        }, new URL(request.url).origin);
    }
}

// 创建回调响应的工具函数
function createCallbackResponse(type, data, targetOrigin) {
    // JSON 嵌入 <script> 前必须转义 <（写成等价的 \u003c）：HTML 解析器不认识
    // JS 字符串边界，内容中出现字面量 </script> 会提前闭合标签注入脚本。
    // U+2028/U+2029 是 JS 行终止符，一并转义。nonce + CSP 为纵深防御。
    const json = JSON.stringify({ type, ...data })
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    // targetOrigin 由调用方传入（发起时绑定的发起页 origin 或本站 origin）；
    // 绝不使用 '*'，否则含 JWT 的消息可能被恶意 opener 收走
    const origin = targetOrigin;
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const script = `
    window.opener && window.opener.postMessage(${json}, ${JSON.stringify(origin)});
    window.close();
  `;

    return new Response(`<script nonce="${nonce}">${script}</script>`, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'`
        }
    });
}

// 交换授权码为访问令牌
async function exchangeCodeForToken(code, env, redirectUri) {
    try {
        const clientId = env.GITEE_CLIENT_ID;
        const clientSecret = env.GITEE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('缺少Gitee应用配置');
        }

        const tokenEndpoint = 'https://gitee.com/oauth/token';

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri
        });

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'Tools-Web/1.0'
            },
            body: params
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Token exchange failed:', errorText);
            throw new Error(`令牌交换失败: ${response.status}`);
        }

        const tokenData = await response.json();

        if (!tokenData.access_token) {
            throw new Error('未能获取访问令牌');
        }

        return {
            success: true,
            access_token: tokenData.access_token,
            token_type: tokenData.token_type,
            expires_in: tokenData.expires_in,
            refresh_token: tokenData.refresh_token,
            scope: tokenData.scope
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 获取用户信息
async function fetchUserInfo(accessToken) {
    try {
        const userEndpoint = `https://gitee.com/api/v5/user?access_token=${accessToken}`;

        const response = await fetch(userEndpoint, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Tools-Web/1.0'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('User info fetch failed:', errorText);
            throw new Error(`获取用户信息失败: ${response.status}`);
        }

        const userData = await response.json();

        return {
            success: true,
            data: userData
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 处理用户登录
async function processUserLogin(userData, env) {
    try {
        const db = env.DB;
        const nowStr = formatNow();

        // 构建用户信息
        const thirdPartyUid = userData.id.toString();
        const username = userData.name || userData.login || '用户' + userData.id;
        const email = userData.email || `${userData.login}@gitee.user`; // 使用用户邮箱或虚拟邮箱
        const avatar = userData.avatar_url || '';
        const bio = userData.bio || '';
        const location = userData.location || '';
        const blog = userData.blog || '';

        // 先按第三方 uid 查找：同一 Gitee 账号始终命中同一用户，
        // 邮箱为空 / 使用虚拟邮箱时也不会每次登录都新建账号
        let found = await db.prepare(
            `SELECT id FROM user WHERE third_party_uid = ? AND third_party_type = 'gitee'`
        ).bind(thirdPartyUid).first();

        // 未命中再按邮箱合并。Gitee 不提供"邮箱已验证"标志，直接合并进
        // 密码注册或其他第三方的账号会被未验证邮箱接管，因此仅当命中的
        // 是既有 gitee 账号时才合并，其余一律拒绝并提示用原方式登录
        if (!found && email && email.indexOf('@') > -1 && !email.endsWith('@gitee.user')) {
            const byEmail = await db.prepare(
                `SELECT id, third_party_type FROM user WHERE email = ? COLLATE NOCASE`
            ).bind(email.toLowerCase()).first();
            if (byEmail) {
                if (byEmail.third_party_type === 'gitee') {
                    found = byEmail;
                } else {
                    return {
                        success: false,
                        error: '该邮箱已被其他登录方式注册，请使用原方式登录'
                    };
                }
            }
        }

        let userId;
        if (found && found.id) {
            userId = found.id;
            // 更新用户信息并关联 Gitee 账号
            await db.prepare(`
        UPDATE user SET
          avatar = ?,
          last_login = ?,
          username = ?,
          third_party_uid = ?,
          third_party_type = 'gitee'
        WHERE id = ?
      `).bind(avatar, nowStr, username, thirdPartyUid, userId).run();
        } else {
            // 创建新用户
            userId = crypto.randomUUID();
            await db.prepare(`
        INSERT INTO user (id, email, avatar, created_at, last_login, third_party_uid, username, user_level, third_party_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, email, avatar, nowStr, nowStr, thirdPartyUid, username, 0, 'gitee').run();
      await grantRegistrationRewards(db, userId);
        }

        // 管理员状态 / 封禁 / token 版本一次查齐（JWT 反映最新权限，封禁即时拦截）
        const stateRow = await db.prepare(
            'SELECT is_admin, is_disabled, token_version FROM user WHERE id = ?'
        ).bind(userId).first();
        if (stateRow && stateRow.is_disabled) {
            return { success: false, error: '该账号已被禁用，如有疑问请联系站长' };
        }
        const isAdmin = stateRow?.is_admin ? 1 : 0;

        // 生成JWT
        if (!env.JWT_SECRET) {
            throw new Error('缺少 JWT_SECRET 环境变量');
        }

        const token = await signJWT(
            {
                uid: userId,
                email,
                avatar,
                username,
                is_admin: isAdmin,
                thirdPartyType: 'gitee',
                thirdPartyUid,
                // ver 与库中 token_version 对齐：改密/重置/封禁后旧登录态立即失效
                ver: stateRow?.token_version || 0,
                bio,
                location,
                blog,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + MAIN_JWT_TTL_SECONDS
            },
            env.JWT_SECRET
        );

        return {
            success: true,
            token,
            user: {
                id: userId,
                email,
                avatar,
                username,
                thirdPartyType: 'gitee',
                bio,
                location,
                blog
            },
            message: `欢迎回来，${username}！`
        };

    } catch (error) {
        console.error('User login processing error:', error);
        // 对外固定文案，内部错误细节只进日志（会经回调页回显给用户）
        return {
            success: false,
            error: '登录处理失败，请稍后重试'
        };
    }
}

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions() {
    return new Response(null, {
        status: 200,
        headers: {

            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

// 工具函数：统一写 UTC 的 "YYYY-MM-DD HH:mm:ss"，与 github-auth 等保持一致
function formatNow() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function signJWT(payload, secret) {
    const enc = new TextEncoder();
    const header = { alg: 'HS256', typ: 'JWT' };
    const base64url = (buf) =>
        btoa(String.fromCharCode(...new Uint8Array(buf)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    const headerB64 = base64url(enc.encode(JSON.stringify(header)));
    const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
    const data = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    const sigB64 = base64url(sig);

    return `${data}.${sigB64}`;
}
