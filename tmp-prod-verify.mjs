// 临时验证脚本：确认线上 /google-auth 已拒绝伪造 token（跑完即删）
const SITE = 'https://tool.fologde.com';

const b64url = (objOrBuf) => {
  const buf = typeof objOrBuf === 'string' ? Buffer.from(objOrBuf) : objOrBuf instanceof Buffer ? objOrBuf : Buffer.from(JSON.stringify(objOrBuf));
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: 'https://accounts.google.com',
  aud: '825228691844-jflrvsfqa82gs1s225qbcaa4raujmp1f.apps.googleusercontent.com',
  sub: '9999999999',
  email: 'probe-should-never-login@example.com',
  email_verified: true,
  name: 'Probe',
  iat: now,
  exp: now + 3600,
};

const forgedTokens = {
  'alg=none 伪造 token': `${b64url({ alg: 'none', typ: 'JWT', kid: 'probe' })}.${b64url(payload)}..`,
  'RS256 假签名 token': `${b64url({ alg: 'RS256', typ: 'JWT', kid: 'probe' })}.${b64url(payload)}.${b64url(Buffer.from('fakesignaturebytes'))}`,
};

for (const [name, token] of Object.entries(forgedTokens)) {
  try {
    const res = await fetch(`${SITE}/google-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: token }),
    });
    const text = await res.text();
    let brief = text;
    try { brief = JSON.stringify(JSON.parse(text)); } catch { /* 保留原文 */ }
    const verdict = res.status === 401 ? '✅ 已拒绝' : res.status === 500 ? '⚠️ 500（可能缺 GOOGLE_CLIENT_ID 配置）' : '❌ 未按预期拒绝';
    console.log(`${verdict} [${name}] HTTP ${res.status} ${brief.slice(0, 200)}`);
  } catch (e) {
    console.log(`⚠️ [${name}] 请求失败（本机网络）: ${e.message}`);
  }
}
