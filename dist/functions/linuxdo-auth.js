// Linux.do 登录认证
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

// 生成授权链接 (新增功能)
async function getAuthUrl(request, env, origin) {
  try {
    // 配置信息
    const CLIENT_ID = env.LINUXDO_CLIENT_ID;
    const REDIRECT_URI = env.LINUXDO_REDIRECT_URI || `${new URL(request.url).origin}/functions/linuxdo-auth`;
    const AUTH_URL = 'https://connect.linux.do/oauth2/authorize';
    
    // 检查必要的配置
    if (!CLIENT_ID) {
      throw new Error('缺少LINUXDO_CLIENT_ID环境变量配置');
    }
    
    // 生成授权链接参数
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'user'
    });
    
    const authUrl = AUTH_URL + '?' + params.toString();
    
    return createCORSResponse({
      success: true,
      auth_url: authUrl
    }, origin);
    
  } catch (error) {
    console.error('获取 LinuxDo 授权链接错误:', error);
    return createCORSErrorResponse('获取授权链接失败', origin);
  }
}

// 处理OAuth回调
async function handleAuthCallback(request, env, origin) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    
    if (error) {
      // 登录失败，关闭弹窗并发送错误信息
      return createCallbackResponse('error', {
        success: false,
        message: '用户取消登录或授权失败'
      });
    }
    
    if (!code) {
      return createCallbackResponse('error', {
        success: false,
        message: '缺少授权码'
      });
    }
    
    // 交换访问令牌
    const tokenResponse = await exchangeCodeForToken(code, env);
    if (!tokenResponse.success) {
      return createCallbackResponse('error', {
        success: false,
        message: '令牌交换失败'
      });
    }
    
    // 获取用户信息
    const userInfo = await fetchUserInfo(tokenResponse.access_token);
    if (!userInfo.success) {
      return createCallbackResponse('error', {
        success: false,
        message: '获取用户信息失败'
      });
    }
    
    // 处理用户登录
    const loginResult = await processUserLogin(userInfo.data, env);
    if (!loginResult.success) {
      return createCallbackResponse('error', {
        success: false,
        message: '登录失败'
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
    console.error('Linux.do callback error:', error);
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
    const clientId = env.LINUXDO_CLIENT_ID;
    const clientSecret = env.LINUXDO_CLIENT_SECRET;
    const redirectUri = env.LINUXDO_REDIRECT_URI || `${env.SITE_URL || 'https://tools.ranblogs.com'}/functions/linuxdo-auth`;
    
    if (!clientId || !clientSecret) {
      throw new Error('缺少Linux.do应用配置');
    }
    
    const tokenEndpoint = 'https://connect.linux.do/oauth2/token';
    const credentials = btoa(`${clientId}:${clientSecret}`);
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Tools-Web/1.0'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`令牌交换失败: ${response.status}`);
    }
    
    const tokenData = await response.json();
    
    return {
      success: true,
      access_token: tokenData.access_token,
      token_type: tokenData.token_type
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
    const userEndpoint = 'https://connect.linux.do/api/user';
    
    const response = await fetch(userEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
    const username = userData.username || userData.name || '用户' + thirdPartyUid;
    const email = userData.email || `${userData.username}@linux.do`;
    const avatar = userData.avatar_template ? 
      `${userData.avatar_template.replace('{size}', '120')}` : 
      '';
    const thirdPartyLevel = userData.trust_level || 0;  // Linux.do的trust_level
    
    // 查询是否已有用户
    const found = await db.prepare(`
      SELECT id FROM user 
      WHERE third_party_uid = ? AND third_party_type = 'linuxdo'
    `).bind(thirdPartyUid).first();
    
    let userId;
    if (found && found.id) {
      userId = found.id;
      // 更新用户信息
      await db.prepare(`
        UPDATE user SET 
          avatar = ?,
          last_login = ?,
          email = ?,
          username = ?,
          user_level = ?
        WHERE id = ?
      `).bind(avatar, nowStr, email, username, thirdPartyLevel, userId).run();
    } else {
      // 创建新用户
      userId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO user (id, email, avatar, created_at, last_login, third_party_uid, username, user_level, third_party_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, email, avatar, nowStr, nowStr, thirdPartyUid, username, thirdPartyLevel, 'linuxdo').run();
    }
    
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
        thirdPartyType: 'linuxdo',
        thirdPartyUid,
        thirdPartyLevel,  // Linux.do的trust_level
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 * 7
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
        thirdPartyType: 'linuxdo',
        thirdPartyLevel
      },
      message: `欢迎回来，${username}！`
    };
    
  } catch (error) {
    console.error('User login processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// 工具函数
function formatNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = p(d.getMonth() + 1);
  const day = p(d.getDate());
  const hh = p(d.getHours());
  const mm = p(d.getMinutes());
  const ss = p(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
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
