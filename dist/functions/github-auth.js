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
        console.log('=== GitHub OAuth 授权链接生成开始 ===');
        
        // GitHub OAuth配置信息
        const CLIENT_ID = env.GITHUB_CLIENT_ID;
        const REDIRECT_URI = env.GITHUB_REDIRECT_URI || `${env.SITE_URL || 'https://tools.ranblogs.com'}/functions/github-auth`;
        const AUTH_URL = 'https://github.com/login/oauth/authorize';

        console.log('GitHub OAuth配置详情:', {
            CLIENT_ID: CLIENT_ID ? `${CLIENT_ID.substring(0, 10)}...` : 'MISSING',
            CLIENT_ID_LENGTH: CLIENT_ID ? CLIENT_ID.length : 0,
            REDIRECT_URI,
            SITE_URL: env.SITE_URL,
            origin: origin,
            AUTH_URL
        });

        // 检查必要的配置
        if (!CLIENT_ID) {
            console.error('错误: 缺少GITHUB_CLIENT_ID环境变量');
            throw new Error('缺少GITHUB_CLIENT_ID环境变量配置');
        }

        // 生成state参数防止CSRF攻击
        const state = crypto.randomUUID();
        console.log('生成的state参数:', state);

        // 根据GitHub文档生成授权链接参数
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            scope: 'user:email',
            state: state
        });

        console.log('授权链接参数详情:', {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            scope: 'user:email',
            state: state
        });

        const authUrl = AUTH_URL + '?' + params.toString();
        
        console.log('最终生成的授权URL:', authUrl);
        console.log('URL编码后的参数字符串:', params.toString());
        console.log('=== GitHub OAuth 授权链接生成完成 ===');

        return createCORSResponse({
            success: true,
            auth_url: authUrl
        }, origin);

    } catch (error) {
        console.error('获取 GitHub 授权链接错误:', error);
        console.error('错误堆栈:', error.stack);
        return createCORSErrorResponse('获取授权链接失败: ' + error.message, origin);
    }
}

// 处理OAuth回调
async function handleAuthCallback(request, env, origin) {
    try {
        console.log('=== GitHub OAuth 回调处理开始 ===');
        console.log('请求URL:', request.url);
        console.log('请求方法:', request.method);
        console.log('请求来源:', origin);
        
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const error_description = url.searchParams.get('error_description');
        const state = url.searchParams.get('state');

        console.log('回调参数详情:', {
            code: code ? `${code.substring(0, 10)}...` : 'MISSING',
            error: error,
            error_description: error_description,
            state: state,
            allParams: Object.fromEntries(url.searchParams)
        });

        if (error) {
            console.error('GitHub授权错误:', { error, error_description });
            return createCallbackResponse('error', {
                success: false,
                message: `GitHub授权失败: ${error_description || error}`
            });
        }

        if (!code) {
            console.error('缺少授权码');
            return createCallbackResponse('error', {
                success: false,
                message: '缺少授权码'
            });
        }

        console.log('开始交换访问令牌...');
        // 交换访问令牌
        const tokenResponse = await exchangeCodeForToken(code, env);
        console.log('令牌交换结果:', {
            success: tokenResponse.success,
            error: tokenResponse.error,
            hasToken: !!tokenResponse.access_token
        });

        if (!tokenResponse.success) {
            console.error('令牌交换失败:', tokenResponse.error);
            return createCallbackResponse('error', {
                success: false,
                message: tokenResponse.error || '令牌交换失败'
            });
        }

        console.log('开始获取用户信息...');
        // 获取用户信息
        const userInfo = await fetchUserInfo(tokenResponse.access_token);
        console.log('用户信息获取结果:', {
            success: userInfo.success,
            error: userInfo.error,
            hasData: !!userInfo.data
        });

        if (!userInfo.success) {
            console.error('获取用户信息失败:', userInfo.error);
            return createCallbackResponse('error', {
                success: false,
                message: userInfo.error || '获取用户信息失败'
            });
        }

        console.log('开始处理用户登录...');
        // 处理用户登录
        const loginResult = await processUserLogin(userInfo.data, env);
        console.log('用户登录处理结果:', {
            success: loginResult.success,
            error: loginResult.error,
            message: loginResult.message
        });

        if (!loginResult.success) {
            console.error('登录处理失败:', loginResult.error);
            return createCallbackResponse('error', {
                success: false,
                message: loginResult.error || '登录失败'
            });
        }

        console.log('GitHub OAuth登录成功!');
        console.log('=== GitHub OAuth 回调处理完成 ===');

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
        console.error('GitHub callback error:', error);
        console.error('错误堆栈:', error.stack);
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
        console.log('=== 开始交换访问令牌 ===');
        
        const clientId = env.GITHUB_CLIENT_ID;
        const clientSecret = env.GITHUB_CLIENT_SECRET;
        const redirectUri = env.GITHUB_REDIRECT_URI || `${env.SITE_URL || 'https://tools.ranblogs.com'}/functions/github-auth`;

        console.log('令牌交换配置:', {
            clientId: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING',
            clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'MISSING',
            redirectUri: redirectUri,
            code: code ? `${code.substring(0, 10)}...` : 'MISSING'
        });

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

        console.log('发送令牌请求到:', tokenEndpoint);
        console.log('请求体参数:', {
            client_id: clientId,
            client_secret: clientSecret,
            code: `${code.substring(0, 10)}...`,
            redirect_uri: redirectUri
        });

        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        try {
            console.log('开始发送请求...');
            
            // 根据GitHub文档，使用POST请求交换token，推荐form格式
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
            console.log('请求完成，状态:', response.status, response.statusText);
            console.log('响应头:', Object.fromEntries(response.headers));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('令牌交换失败响应:', errorText);
                throw new Error(`令牌交换失败: ${response.status} - ${errorText}`);
            }

            const responseText = await response.text();
            console.log('原始响应内容:', responseText);

            let tokenData;
            try {
                tokenData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON解析失败，尝试解析URL编码格式');
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

            console.log('解析后的令牌数据:', {
                hasAccessToken: !!tokenData.access_token,
                tokenType: tokenData.token_type,
                scope: tokenData.scope,
                error: tokenData.error,
                errorDescription: tokenData.error_description
            });

            if (tokenData.error) {
                throw new Error(`GitHub错误: ${tokenData.error_description || tokenData.error}`);
            }

            if (!tokenData.access_token) {
                throw new Error('未能获取访问令牌');
            }

            console.log('=== 令牌交换成功 ===');
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
        console.error('=== 令牌交换失败 ===');
        console.error('错误详情:', error.message);
        console.error('错误堆栈:', error.stack);
        
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
        console.log('=== 开始获取用户信息 ===');
        console.log('访问令牌:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');

        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时

        try {
            console.log('发送用户信息请求...');
            
            // 根据GitHub API文档，获取用户基本信息
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
            console.log('用户信息请求状态:', userResponse.status, userResponse.statusText);
            console.log('用户信息响应头:', Object.fromEntries(userResponse.headers));

            if (!userResponse.ok) {
                const errorText = await userResponse.text();
                console.error('获取用户信息失败响应:', errorText);
                throw new Error(`获取用户信息失败: ${userResponse.status} - ${errorText}`);
            }

            const userData = await userResponse.json();
            console.log('GitHub用户基本信息:', {
                id: userData.id,
                login: userData.login,
                name: userData.name,
                email: userData.email,
                avatar_url: userData.avatar_url,
                bio: userData.bio,
                location: userData.location,
                blog: userData.blog,
                html_url: userData.html_url
            });

            // 获取用户邮箱信息（需要user:email权限）
            let primaryEmail = userData.email;
            
            try {
                console.log('开始获取用户邮箱列表...');
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
                console.log('邮箱请求状态:', emailResponse.status, emailResponse.statusText);

                if (emailResponse.ok) {
                    const emails = await emailResponse.json();
                    console.log('用户邮箱列表:', emails);
                    const primary = emails.find(email => email.primary && email.verified);
                    if (primary) {
                        primaryEmail = primary.email;
                        console.log('找到主邮箱:', primaryEmail);
                    }
                } else {
                    const emailError = await emailResponse.text();
                    console.warn('获取邮箱列表失败:', emailError);
                }
            } catch (emailError) {
                if (emailError.name === 'AbortError') {
                    console.warn('获取邮箱列表超时');
                } else {
                    console.warn('获取邮箱信息异常:', emailError);
                }
            }

            const finalUserData = {
                ...userData,
                email: primaryEmail || `${userData.login}@github.user`
            };

            console.log('最终用户数据:', finalUserData);
            console.log('=== 用户信息获取成功 ===');

            return {
                success: true,
                data: finalUserData
            };

        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            if (fetchError.name === 'AbortError') {
                throw new Error('获取用户信息超时：GitHub API响应时间过长');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('=== 用户信息获取失败 ===');
        console.error('错误详情:', error.message);
        console.error('错误堆栈:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// 处理用户登录
async function processUserLogin(userData, env) {
    try {
        console.log('=== 开始处理用户登录 ===');
        console.log('输入用户数据:', userData);

        const db = env.DB;
        if (!db) {
            throw new Error('数据库连接不可用');
        }

        const nowStr = formatNow();
        console.log('当前时间:', nowStr);

        // 构建用户信息
        const thirdPartyUid = userData.id.toString();
        const username = userData.name || userData.login || '用户' + userData.id;
        const email = userData.email || `${userData.login}@github.user`;
        const avatar = userData.avatar_url || '';

        console.log('处理后的用户信息:', {
            thirdPartyUid,
            username,
            email,
            avatar
        });

        // 查询是否已有用户
        console.log('检查用户是否已存在...');
        const found = await db.prepare(`
            SELECT id FROM user 
            WHERE third_party_uid = ? AND third_party_type = 'github'
        `).bind(thirdPartyUid).first();

        console.log('现有用户查询结果:', found);

        let userId;
        let isNewUser = false;

        if (found && found.id) {
            // 用户已存在，更新信息
            userId = found.id;
            console.log('用户已存在，更新信息，userId:', userId);

            // 更新用户信息
            const updateResult = await db.prepare(`
                UPDATE user SET 
                    avatar = ?,
                    last_login = ?,
                    email = ?,
                    username = ?
                WHERE id = ?
            `).bind(avatar, nowStr, email, username, userId).run();

            console.log('用户信息更新结果:', updateResult);
        } else {
            // 新用户，创建记录
            isNewUser = true;
            console.log('创建新用户...');

            // 检查邮箱是否已被其他账号使用
            if (email && email.indexOf('@') > -1 && !email.endsWith('@github.user')) {
                console.log('检查邮箱是否已被使用:', email);
                const emailExists = await db.prepare('SELECT id FROM user WHERE email = ? AND third_party_type != ?')
                    .bind(email, 'github')
                    .first();

                if (emailExists) {
                    console.error('邮箱已被其他账号使用:', email);
                    throw new Error('该邮箱已被其他账号使用');
                }
            }

            // 生成新用户ID
            userId = crypto.randomUUID();
            
            // 插入新用户
            const insertResult = await db.prepare(`
                INSERT INTO user (id, email, avatar, created_at, last_login, third_party_uid, username, user_level, third_party_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(userId, email, avatar, nowStr, nowStr, thirdPartyUid, username, 0, 'github').run();

            console.log('新用户插入结果:', insertResult);
            console.log('新用户ID:', userId);
        }

        // 生成JWT令牌
        console.log('生成JWT令牌...');
        const jwtSecret = env.JWT_SECRET || 'your-secret-key';
        
        if (!jwtSecret || jwtSecret === 'your-secret-key') {
            throw new Error('缺少 JWT_SECRET 环境变量');
        }

        const payload = {
            uid: userId,
            username: username,
            email: email,
            thirdPartyType: 'github',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7天过期
        };

        console.log('JWT载荷:', payload);

        const token = await signJWT(payload, jwtSecret);
        console.log('JWT令牌生成成功，长度:', token.length);

        // 获取完整的用户信息
        console.log('获取完整用户信息...');
        const userInfo = await db.prepare('SELECT id, username, email, avatar, third_party_type, user_level, created_at FROM user WHERE id = ?')
            .bind(userId)
            .first();

        console.log('最终用户信息:', userInfo);
        console.log('=== 用户登录处理成功 ===');

        return {
            success: true,
            user: userInfo,
            token: token,
            message: isNewUser ? '注册成功' : '登录成功'
        };

    } catch (error) {
        console.error('=== 用户登录处理失败 ===');
        console.error('错误详情:', error.message);
        console.error('错误堆栈:', error.stack);
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

// 工具函数：生成JWT (使用与linuxdo-auth相同的实现)
async function signJWT(payload, secret) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const token = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    return `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify(payload))}.${token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
}
