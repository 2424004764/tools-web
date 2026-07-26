// GitHub 登录认证
import { handleCORSPreflight, createCORSResponse, createCORSErrorResponse } from './utils/cors.js'

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
        const REDIRECT_URI = env.GITHUB_REDIRECT_URI;
        const AUTH_URL = 'https://github.com/login/oauth/authorize';

        if (!CLIENT_ID) {
            throw new Error('缺少GITHUB_CLIENT_ID环境变量配置');
        }

        // 生成state参数防止CSRF攻击
        const state = crypto.randomUUID();

        // 根据GitHub文档生成授权链接参数
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            scope: 'user:email',
            state: state
        });

        const authUrl = AUTH_URL + '?' + params.toString();

        return createCORSResponse({
            success: true,
            auth_url: authUrl
        }, origin);

    } catch (error) {
        console.error('[github-auth] getAuthUrl error:', error.message);
        return createCORSErrorResponse('获取授权链接失败: ' + error.message, origin);
    }
}

// 处理OAuth回调
async function handleAuthCallback(request, env, origin) {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const error_description = url.searchParams.get('error_description');

        if (error) {
            console.error('[github-auth] 授权错误:', { error, error_description });
            return createCallbackResponse('error', {
                success: false,
                message: `GitHub授权失败: ${error_description || error}`
            });
        }

        if (!code) {
            console.error('[github-auth] 缺少授权码');
            return createCallbackResponse('error', {
                success: false,
                message: '缺少授权码'
            });
        }

        const tokenResponse = await exchangeCodeForToken(code, env);
        if (!tokenResponse.success) {
            return createCallbackResponse('error', {
                success: false,
                message: tokenResponse.error || '令牌交换失败'
            });
        }

        const userInfo = await fetchUserInfo(tokenResponse.access_token);
        if (!userInfo.success) {
            return createCallbackResponse('error', {
                success: false,
                message: userInfo.error || '获取用户信息失败'
            });
        }

        const loginResult = await processUserLogin(userInfo.data, env);
        if (!loginResult.success) {
            return createCallbackResponse('error', {
                success: false,
                message: loginResult.error || '登录失败'
            });
        }

        // 登录成功，关闭弹窗并发送用户信息
        return createCallbackResponse('success', {
            success: true,
            data: {
                user: loginResult.user,
                token: loginResult.token
            },
            message: loginResult.message
        });

    } catch (error) {
        console.error('[github-auth] callback error:', error.message);
        return createCallbackResponse('error', {
            success: false,
            message: error.message
        });
    }
}

// 创建回调响应的工具函数
function createCallbackResponse(type, data) {
    const script = `
    window.opener && window.opener.postMessage(${JSON.stringify({ type, ...data })}, '*');
    window.close();
  `;

    return new Response(`<script>${script}</script>`, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

// 交换授权码为访问令牌
async function exchangeCodeForToken(code, env) {
    try {
        const clientId = env.GITHUB_CLIENT_ID;
        const clientSecret = env.GITHUB_CLIENT_SECRET;
        const redirectUri = env.GITHUB_REDIRECT_URI;

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
                    email: primaryEmail || `${userData.login}@github.user`
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

        // 优先通过邮箱查找用户（统一账号）
        let found = null;
        if (email && email.indexOf('@') > -1 && !email.endsWith('@github.user')) {
            found = await db.prepare(`SELECT id FROM user WHERE email = ?`).bind(email).first();
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
                    third_party_type = 'github',
                    user_level = ?
                WHERE id = ?
            `).bind(avatar, nowStr, username, thirdPartyUid, 0, userId).run();
        } else {
            // 新用户，创建记录
            isNewUser = true;

            userId = crypto.randomUUID();

            await db.prepare(`
                INSERT INTO user (id, email, avatar, created_at, last_login, third_party_uid, username, user_level, third_party_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(userId, email, avatar, nowStr, nowStr, thirdPartyUid, username, 0, 'github').run();
        }

        // 查询最新的 is_admin（无论新老用户都要重新取，确保 JWT 反映当前权限）
        const adminRow = await db.prepare('SELECT is_admin FROM user WHERE id = ?').bind(userId).first();
        const isAdmin = adminRow?.is_admin ? 1 : 0;

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
        return {
            success: false,
            error: error.message
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