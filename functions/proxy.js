import { allowedOrigins, isOriginAllowed, handleCORSPreflight, getCORSHeaders } from './utils/cors.js'

export async function onRequest(context) {
    const { request } = context
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    // 允许代理的目标主机（必须 https、无 userinfo、默认端口、主机名全等匹配）
    // 注意：不能用 startsWith 前缀匹配，否则
    //   https://gen.pollinations.ai@evil.com      （@ 前是 userinfo，真实主机是 evil.com）
    //   https://gen.pollinations.ai.evil.com      （evil.com 的子域）
    // 都能绕过白名单，把本接口当任意 SSRF 跳板
    const allowedHosts = new Set([
        'image.pollinations.ai',
        'text.pollinations.ai',
        'gen.pollinations.ai',
        'platform.aitools.cfd',
    ])

    const isAllowedTarget = (u) =>
        u.protocol === 'https:' &&
        u.username === '' &&
        u.password === '' &&
        u.port === '' &&
        allowedHosts.has(u.hostname.toLowerCase())

    // 处理预检请求（OPTIONS）
    if (request.method === 'OPTIONS') {
        return handleCORSPreflight(origin)
    }

    // 获取目标 API 的 URL 参数
    const targetParam = url.searchParams.get('target')
    if (!targetParam) {
        return new Response('Missing "target" parameter', { status: 400 })
    }

    // 先结构化解析，再按主机名白名单校验（见上方 isAllowedTarget 说明）
    let targetUrl
    try {
        targetUrl = new URL(targetParam)
    } catch {
        return new Response('Invalid "target" parameter', { status: 400 })
    }

    if (!isAllowedTarget(targetUrl)) {
        return new Response('Target not allowed', { status: 403 })
    }

    // 拼接请求路径（如果 target 参数已经包含完整路径，则不再添加 path）
    const path = url.searchParams.get('path') || '';
    if (path && !targetParam.includes('/v1/')) {
        targetUrl.pathname = path;
    }

    // 处理查询参数
    const params = new URLSearchParams();

    // 获取 params 参数的值并解析为查询参数
    const paramsValue = url.searchParams.get('params');
    if (paramsValue) {
        // 用 URLSearchParams 解析，避免手动 split 造成的二次编码
        // （例如 model=vendouple%2Fflux-2 会被再编码成 %252F 导致目标接口 404）
        new URLSearchParams(paramsValue).forEach((value, key) => {
            params.set(key, value);
        });
    }

    // 获取其他查询参数（除了 target、path、params）
    url.searchParams.forEach((value, key) => {
        if (key !== 'target' && key !== 'path' && key !== 'params') {
            params.set(key, value);
        }
    });

    // 将查询参数拼接到目标 URL
    if (params.toString()) {
        targetUrl.search = params.toString();
    }

    // 创建新的请求配置
    // 只复制安全的headers
    const safeHeaders = new Headers();
    const allowedHeaders = ['content-type', 'authorization', 'user-agent', 'accept', 'accept-language', 'accept-encoding'];

    request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (allowedHeaders.includes(lowerKey)) {
            try {
                safeHeaders.set(key, value);
            } catch (e) {
                console.warn(`跳过有问题的header: ${key}`, e);
            }
        }
    });

    // POST/PUT/PATCH 才转发请求体；读成 ArrayBuffer 以便重定向后可重放
    const hasRequestBody = request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH';
    const requestBody = hasRequestBody ? await request.arrayBuffer() : undefined;

    // 手动跟随重定向：每一跳都重新过一遍白名单校验，
    // 防止白名单域上的开放重定向把本代理导向任意外部主机
    console.log(`Proxy request to: ${targetUrl.href}`)
    let currentUrl = targetUrl
    let currentMethod = request.method
    let currentBody = requestBody
    let response = await fetch(currentUrl, {
        method: currentMethod,
        headers: safeHeaders,
        body: currentBody,
        redirect: 'manual',
    })

    for (let hop = 0; response.status >= 300 && response.status < 400 && hop < 5; hop++) {
        const location = response.headers.get('location')
        if (!location) break

        let nextUrl
        try {
            nextUrl = new URL(location, currentUrl)
        } catch {
            break
        }

        if (!isAllowedTarget(nextUrl)) {
            return new Response('Redirect target not allowed', { status: 403 })
        }

        // 与 fetch redirect:'follow' 的标准行为一致：301/302/303 改为 GET 并丢弃请求体
        if (response.status === 301 || response.status === 302 || response.status === 303) {
            currentMethod = 'GET'
            currentBody = undefined
        }

        currentUrl = nextUrl
        console.log(`Proxy redirect to: ${currentUrl.href}`)
        response = await fetch(currentUrl, {
            method: currentMethod,
            headers: safeHeaders,
            body: currentBody,
            redirect: 'manual',
        })
    }

    // 复制目标 API 的响应头并设置 CORS
    const newHeaders = new Headers(response.headers)
    if (isOriginAllowed(origin)) {
        const corsHeaders = getCORSHeaders(origin)
        Object.entries(corsHeaders).forEach(([key, value]) => {
            newHeaders.set(key, value)
        })
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    })
}
