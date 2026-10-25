// GitHub 登录认证
import { handleCORSPreflight, createCORSResponse, createCORSErrorResponse, isOriginAllowed } from './utils/cors.js'
import { buildStateCookie, clearStateCookie, readStateCookie } from './utils/oauth-state.js'

const base64url = (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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

// 生成授权链接
async function getAuthUrl(request, env, origin) {
    try {
        const CLIENT_ID = env.GITHUB_CLIENT_ID;
        const AUTH_URL = 'https://github.com/login/oauth/authorize';

        if (!CLIENT_ID) {
            throw new Error('缺少GITHUB_CLIENT_ID环境变量配置');
        }

        // 生成state参数防止CSRF攻击
        const state = crypto.randomUUID();

        // PKCE（S256，GitHub 支持）：verifier 存入 state cookie，回调换 token 时携带，
        // 授权码即使被拦截也无法单独使用
        const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const codeChallenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)));

        // 回调地址固定用 /api/github-auth 而非环境变量里的 /github-auth：
        // 站点是 PWA，Service Worker 的 navigateFallback 会拦截非 /api/ 路径的
        // 页面导航并返回缓存的 SPA 壳（旧版 SW 的 denylist 只有 /^\/api\//），
        // 导致 OAuth 回调页永远到不了函数、弹窗落在 /404。/api/ 路径任何版本
        // 的 SW 都放行。GitHub OAuth App 只要求 redirect_uri 与后台回调 URL 同域。
        const redirectUri = `${new URL(request.url).origin}/api/github-auth`;

        // 根据GitHub文档生成授权链接参数
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            scope: 'user:email',
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        const authUrl = AUTH_URL + '?' + params.toString();

        const response = createCORSResponse({
            success: true,
            auth_url: authUrl
        }, origin);
        // state 种入 HttpOnly cookie，供回调时比对（弹窗顶级导航会携带 SameSite=Lax cookie）；
        // 同时绑定发起页 origin（回调时作为 postMessage targetOrigin）与 PKCE verifier。
        // 发起页 origin 只接受 CORS 白名单内的值，跨站伪造发起一律回退本站 origin
        response.headers.append('Set-Cookie', buildStateCookie('github', state, request.url, {
            origin: isOriginAllowed(origin) ? origin : new URL(request.url).origin,
            verifier: codeVerifier
        }));
        return response;

    } catch (error) {
        console.error('[github-auth] getAuthUrl error:', error.message);
        // 不回显 error.message（可能含环境变量细节），细节只进服务端日志
        return createCORSErrorResponse('获取授权链接失败', origin);
    }
}

// 处理OAuth回调：无论成败都作废 state cookie，保证 state 一次性
async function handleAuthCallback(request, env, origin) {
    const response = await doHandleAuthCallback(request, env);
    response.headers.append('Set-Cookie', clearStateCookie('github'));
    return response;
}

async function doHandleAuthCallback(request, env) {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const error_description = url.searchParams.get('error_description');
        const state = url.searchParams.get('state');
        const ownOrigin = url.origin;

        if (error) {
            console.error('[github-auth] 授权错误:', { error, error_description });
            // 文案固定：error_description 是攻击者可控的 URL 参数，且此分支
            // 先于 state 校验执行，回显会成为反射型 XSS 注入点
            return createCallbackResponse('error', {
                success: false,
                message: 'GitHub授权失败，请重新发起登录'
            }, ownOrigin);
        }

        if (!code) {
            console.error('[github-auth] 缺少授权码');
            return createCallbackResponse('error', {
                success: false,
                message: '缺少授权码'
            }, ownOrigin);
        }

        // CSRF 校验：回跳的 state 必须与发起授权时种下的 cookie 一致。
        // 部署前发起的旧授权没有 state，会得到明确提示重新登录。
        const cookieState = readStateCookie('github', request);
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
        // 从回调请求自身重建（origin + path），/api/github-auth 与旧版 /github-auth 链接都能对上
        const callbackUrl = new URL(request.url);
        const redirectUri = callbackUrl.origin + callbackUrl.pathname;

        const tokenResponse = await exchangeCodeForToken(code, env, redirectUri, cookieState.verifier);
        if (!tokenResponse.success) {
            return createCallbackResponse('error', {
                success: false,
                message: tokenResponse.error || '令牌交换失败'
            }, targetOrigin);
        }

        const userInfo = await fetchUserInfo(tokenResponse.access_token);
        if (!userInfo.success) {
            return createCallbackResponse('error', {
                success: false,
                message: userInfo.error || '获取用户信息失败'
            }, targetOrigin);
        }

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
        console.error('[github-auth] callback error:', error.message);
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
    // targetOrigin 由调用方传入（发起时绑定进 state cookie 的发起页 origin，
    // 或回调页自身 origin）；绝不使用 '*'，否则含 JWT 的消息可能被恶意 opener 收走
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
async function exchangeCodeForToken(code, env, redirectUri, codeVerifier) {
    try {
        const clientId = env.GITHUB_CLIENT_ID;
        const clientSecret = env.GITHUB_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('缺少GitHub应用配置');
        }

        const tokenEndpoint = 'https://github.com/login/oauth/access_token';

        // 根据GitHub文档，推荐使用application/x-www-form-urlencoded格式
        const requestBody = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri
        });
        // PKCE：发起授权时带了 S256 challenge，换 token 必须携带 verifier
        if (codeVerifier) {
            requestBody.set('code_verifier', codeVerifier);
        }

        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        try {
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Tools-Web/1.0'
                },
                body: requestBody.toString(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`令牌交换失败: ${response.status} - ${errorText}`);
            }

            const responseText = await response.text();

            let tokenData;
            try {
                tokenData = JSON.parse(responseText);
            } catch (parseError) {
                // GitHub可能返回URL编码格式：access_token=xxx&token_type=bearer&scope=xxx
                const params = new URLSearchParams(responseText);
                tokenData = {
                    access_token: params.get('access_token'),
                    token_type: params.get('token_type'),
                    scope: params.get('scope'),
                    error: params.get('error'),
                    error_description: params.get('error_description')
                };
            }

            if (tokenData.error) {
                throw new Error(`GitHub错误: ${tokenData.error_description || tokenData.error}`);
            }

            if (!tokenData.access_token) {
                throw new Error('未能获取访问令牌');
            }

            return {
                success: true,
                access_token: tokenData.access_token,
                token_type: tokenData.token_type,
                scope: tokenData.scope
            };

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                throw new Error('请求超时：GitHub API响应时间过长');
            }
            throw fetchError;
        }

    } catch (error) {
        // 如果是网络问题，提供更详细的错误信息
        if (error.message.includes('fetch')) {
            return {
                success: false,
                error: '网络连接GitHub API失败，请检查网络连接或稍后重试'
            };
        }

        return {
            success: false,
            error: error.message
        };
    }
}

// 获取用户信息
async function fetchUserInfo(accessToken) {
    try {
        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时

        try {
            const userResponse = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Tools-Web/1.0',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!userResponse.ok) {
                const errorText = await userResponse.text();
                throw new Error(`获取用户信息失败: ${userResponse.status} - ${errorText}`);
            }

            const userData = await userResponse.json();

            // 获取用户邮箱信息（需要user:email权限）
            let primaryEmail = userData.email;

            try {
                const emailController = new AbortController();
                const emailTimeoutId = setTimeout(() => emailController.abort(), 10000); // 10秒超时

                const emailResponse = await fetch('https://api.github.com/user/emails', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Tools-Web/1.0',
                        'X-GitHub-Api-Version': '2022-11-28'
                    },
                    signal: emailController.signal
                });

                clearTimeout(emailTimeoutId);

                if (emailResponse.ok) {
                    const emails = await emailResponse.json();
                    const primary = emails.find(email => email.primary && email.verified);
                    if (primary) {
                        primaryEmail = primary.email;
                    }
                } else {
                    console.warn('[github-auth] 获取邮箱列表失败:', emailResponse.status);
                }
            } catch (emailError) {
                if (emailError.name === 'AbortError') {
                    console.warn('[github-auth] 获取邮箱列表超时');
                } else {
                    console.warn('[github-auth] 获取邮箱信息异常:', emailError.message);
                }
            }

            return {
                success: true,
                data: {
                    ...userData,
                    email: primaryEmail || `${userData.login}@github.user`,
                    // 仅当邮箱来自 /user/emails 的"primary + verified"结果时才标记可信，
                    // 公开资料里的 userData.email 未经 GitHub 验证，不可用于账号合并
                    emailVerified: !!primary
                }
            };

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                throw new Error('获取用户信息超时：GitHub API响应时间过长');
            }
            throw fetchError;
        }

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
        if (!db) {
            throw new Error('数据库连接不可用');
        }

        const nowStr = formatNow();

        // 构建用户信息
        const thirdPartyUid = userData.id.toString();
        const username = userData.name || userData.login || '用户' + userData.id;
        const email = userData.email || `${userData.login}@github.user`;
        const avatar = userData.avatar_url || '';

        // 先按第三方 uid 查找：同一 GitHub 账号始终命中同一用户，
        // 邮箱为空 / 使用虚拟邮箱时也不会每次登录都新建账号
        let found = await db.prepare(
            `SELECT id FROM user WHERE third_party_uid = ? AND third_party_type = 'github'`
        ).bind(thirdPartyUid).first();

        // 未命中再按邮箱合并（统一账号）：仅当邮箱是 GitHub 返回的
        // 已验证主邮箱（fetchUserInfo 标记 emailVerified）。未验证的
        // 公开资料邮箱不能用于合并，否则可借未验证邮箱接管既有账号
        if (!found && userData.emailVerified && email && email.indexOf('@') > -1 && !email.endsWith('@github.user')) {
            found = await db.prepare(
                `SELECT id FROM user WHERE email = ? COLLATE NOCASE`
            ).bind(email.toLowerCase()).first();
        }

        let userId;
        let isNewUser = false;

        if (found && found.id) {
            // 用户已存在，更新信息并关联 GitHub 账号
            userId = found.id;

            await db.prepare(`
                UPDATE user SET
                    avatar = ?,
                    last_login = ?,
                    username = ?,
                    third_party_uid = ?,
                    third_party_type = 'github'
                WHERE id = ?
            `).bind(avatar, nowStr, username, thirdPartyUid, userId).run();
        } else {
            // 新用户，创建记录
            isNewUser = true;

            userId = crypto.randomUUID();

            await db.prepare(`
                INSERT INTO user (id, email, avatar, created_at, last_login, third_party_uid, username, user_level, third_party_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(userId, email, avatar, nowStr, nowStr, thirdPartyUid, username, 0, 'github').run();
        }

        // 管理员状态 / 封禁 / token 版本一次查齐（JWT 反映最新权限，封禁即时拦截）
        const stateRow = await db.prepare(
            'SELECT is_admin, is_disabled, token_version FROM user WHERE id = ?'
        ).bind(userId).first();
        if (stateRow && stateRow.is_disabled) {
            return { success: false, error: '该账号已被禁用，如有疑问请联系站长' };
        }
        const isAdmin = stateRow?.is_admin ? 1 : 0;

        // 生成JWT令牌
        const jwtSecret = env.JWT_SECRET;

        if (!jwtSecret) {
            throw new Error('缺少 JWT_SECRET 环境变量');
        }

        const payload = {
            uid: userId,
            username: username,
            email: email,
            is_admin: isAdmin,
            thirdPartyType: 'github',
            // ver 与库中 token_version 对齐：改密/重置/封禁后旧登录态立即失效
            ver: stateRow?.token_version || 0,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7天过期
        };

        const token = await signJWT(payload, jwtSecret);

        // 获取完整的用户信息
        const userInfo = await db.prepare('SELECT id, username, email, avatar, third_party_type, user_level, created_at FROM user WHERE id = ?')
            .bind(userId)
            .first();

        return {
            success: true,
            user: userInfo,
            token: token,
            message: isNewUser ? '注册成功' : '登录成功'
        };

    } catch (error) {
        console.error('[github-auth] processUserLogin failed:', error.message);
        // 对外固定文案，内部错误细节只进日志（会经回调页回显给用户）
        return {
            success: false,
            error: '登录处理失败，请稍后重试'
        };
    }
}

// 工具函数：格式化当前时间
function formatNow() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// 工具函数：生成JWT (修正为标准实现)
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