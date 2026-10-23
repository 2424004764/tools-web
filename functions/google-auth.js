// 谷歌登录回调
import { verifyGoogleIdToken } from './utils/google-idtoken.js';

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

    // 完整校验 Google ID Token：JWKS 验签（仅 RS256）+ iss / aud / exp /
    // email_verified。此前只 Base64 解码就信任 payload，伪造 token 填任意
    // 邮箱即可登录任意账号，属认证绕过漏洞；现在校验不过一律 401。
    const expectedClientId = env.GOOGLE_CLIENT_ID;
    if (!expectedClientId) {
      throw new Error('缺少 GOOGLE_CLIENT_ID 环境变量配置');
    }

    let payload;
    try {
      payload = await verifyGoogleIdToken(credential, expectedClientId);
    } catch (verifyError) {
      console.error('[google-auth] ID token 校验失败:', verifyError.message);
      return new Response(JSON.stringify({
        success: false,
        error: '认证凭据无效',
        message: '登录凭据校验未通过，请重新登录'
      }), { status: 401 });
    }

    const email = payload.email;
    const googleAvatar = payload.picture || '';
    const googleUsername = payload.name || email.split('@')[0];
    const thirdPartyUid = payload.sub;

    // D1: user 表写入/更新
    const db = env.DB;
    const nowStr = formatNow();

    // 优先通过邮箱查找用户（统一账号）
    let found = await db.prepare(`
      SELECT id, username, avatar FROM user WHERE email = ?
    `).bind(email).first();

    let userId;
    let avatar = googleAvatar;
    let username = googleUsername;
    if (found && found.id) {
      userId = found.id;
      // 已存在用户：username / avatar 已存在则不覆盖（保留管理员改名/改头像的改动），
      // 仅在当前为空或为空字符串时使用 Google 返回值填充。
      avatar = (found.avatar && found.avatar.trim()) ? found.avatar : googleAvatar;
      username = (found.username && found.username.trim()) ? found.username : googleUsername;
      await db.prepare(`
        UPDATE user SET
          avatar = ?,
          last_login = ?,
          username = ?,
          third_party_uid = ?,
          third_party_type = 'google',
          user_level = ?
        WHERE id = ?
      `).bind(avatar, nowStr, username, thirdPartyUid, 0, userId).run();
    } else {
      userId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO user (id, email, avatar, created_at, last_login, third_party_uid, username, user_level, third_party_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, email, avatar, nowStr, nowStr, thirdPartyUid, username, 0, 'google').run();
    }

    // 查询 is_admin（确保 JWT 反映最新管理员状态）
    const adminRow = await db.prepare('SELECT is_admin FROM user WHERE id = ?').bind(userId).first();
    const isAdmin = adminRow?.is_admin ? 1 : 0;

    // 生成JWT（HS256）
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
        thirdPartyType: 'google',
        thirdPartyUid,
        thirdPartyLevel: 0,  // Google没有等级概念，默认0
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 * 7
      },
      env.JWT_SECRET
    );

    return new Response(JSON.stringify({
      success: true,
      token,
      message: '登录成功'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',

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

      }
    });
  }
}

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {

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