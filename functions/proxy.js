export async function onRequest(context) {
    const { request } = context
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    // 允许的前端来源
    const allowedOrigins = [
        'https://tool.fologde.com',  // 生产环境前端
        'http://127.0.0.1:5173',    // 本地开发调试
        'http://localhost:5173'      // 本地开发调试
    ]

    // 允许代理的目标接口（此处限制只能访问指定目标）
    const allowedTargets = ['https://image.pollinations.ai']

    // 处理预检请求（OPTIONS）
    if (request.method === 'OPTIONS') {
        if (allowedOrigins.includes(origin)) {
            return new Response(null, {
                status: 204,
                headers: getCORSHeaders(origin)
            })
        } else {
            return new Response('CORS origin not allowed', { status: 403 })
        }
    }

    // 获取目标 API 的 URL 参数
    const targetParam = url.searchParams.get('target')
    if (!targetParam) {
        return new Response('Missing "target" parameter', { status: 400 })
    }

    // 检查目标域名是否被允许
    const matched = allowedTargets.some(domain => targetParam.startsWith(domain))
    if (!matched) {
        return new Response('Target not allowed', { status: 403 })
    }

    // 拼接最终目标地址
    const targetUrl = new URL(targetParam)

    // 拼接请求路径和查询参数
    const path = url.searchParams.get('path') || '';
    const params = new URLSearchParams();

    // 获取所有的查询参数并添加到 params 对象中
    url.searchParams.forEach((value, key) => {
        if (key !== 'target' && key !== 'path') {  // 排除 target 和 path 参数
            params.set(key, value);
        }
    });

    // 合并目标 URL 的路径和查询参数
    if (path) {
        targetUrl.pathname = path;  // 设置目标 URL 的路径
    }

    // 拼接查询参数到目标 URL（确保正确地拼接）
    const finalParams = params.toString();
    if (finalParams) {
        targetUrl.search = finalParams;  // 设置目标 URL 的查询参数
    }

    return new Response(JSON.stringify({
        "pathname": targetUrl.pathname,
        "params": finalParams,
        "targetUrl": targetUrl.toString(),
        "targetUrl2": targetUrl,
    }), { status: 200 })

    // 创建新的请求配置
    const newRequestInit = {
        method: request.method,
        headers: new Headers(request.headers),
        body: request.method === 'POST' ? await request.clone().arrayBuffer() : undefined,
        redirect: 'follow'
    }

    // 向目标 API 发起请求
    const response = await fetch(targetUrl, newRequestInit)

    // 复制目标 API 的响应头并设置 CORS
    const newHeaders = new Headers(response.headers)
    if (allowedOrigins.includes(origin)) {
        newHeaders.set('Access-Control-Allow-Origin', origin)
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST')
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    })
}

// 设置 CORS 响应头的通用函数
function getCORSHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    }
}
