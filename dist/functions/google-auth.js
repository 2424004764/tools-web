export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { credential } = await request.json();

    if (!credential) {
      return new Response('Missing credential', { status: 400 });
    }

    // 安全地解析JWT token
    let payload;
    try {
      const parts = credential.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      const payloadBase64 = parts[1];
      let base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decodedString = new TextDecoder('utf-8').decode(bytes);
      payload = JSON.parse(decodedString);
      console.log('Decoded payload:', payload);
    } catch (parseError) {
      console.error('JWT parsing error:', parseError);
      console.error('Original credential:', credential);
      return new Response(JSON.stringify({
        success: false,
        error: '无效的认证凭据',
        message: 'JWT解析失败: ' + parseError.message
      }), { status: 400 });
    }

    // 验证token的有效性
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      return new Response(JSON.stringify({
        success: false,
        error: '认证凭据已过期',
        message: '请重新登录'
      }), { status: 401 });
    }

    // 验证必要的字段
    if (!payload.email) {
      return new Response(JSON.stringify({
        success: false,
        error: '认证凭据不完整',
        message: '缺少必要的用户信息'
      }), { status: 400 });
    }

    const email = payload.email;
    const avatar = payload.picture || '';
    const username = payload.name || email.split('@')[0];

    // D1: user 表写入/更新
    const db = env.DB;
    const nowStr = formatNow();

    // 查是否已有用户
    const found = await db.prepare('SELECT id FROM user WHERE google_sub = ?').bind(payload.sub).first();

    let userId;
    if (found && found.id) {
      userId = found.id;
      await db.prepare('UPDATE user SET avatar = ?, last_login = ? WHERE id = ?')
        .bind(avatar, nowStr, userId)
        .run();
    } else {
      userId = crypto.randomUUID();
      await db.prepare('INSERT INTO user (id, email, avatar, reg_type, created_at, last_login, google_sub) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(userId, email, avatar, 'google', nowStr, nowStr, payload.sub)
        .run();
    }

    // 生成JWT（HS256）
    if (!env.JWT_SECRET) {
      throw new Error('缺少 JWT_SECRET 环境变量');
    }
    const token = await signJWT(
      {
        sub: userId,
        email,
        avatar,
        username,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60
      },
      env.JWT_SECRET
    );

    const userInfo = {
      id: userId,
      name: username,
      email,
      picture: avatar,
      loginType: 'google',
    };

    return new Response(JSON.stringify({
      success: true,
      token,
      user: userInfo,
      message: '登录成功'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '认证失败',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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