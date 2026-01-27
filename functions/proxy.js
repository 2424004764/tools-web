import { allowedOrigins, isOriginAllowed, handleCORSPreflight, getCORSHeaders } from './utils/cors.js'

export async function onRequest(context) {
    const { request } = context
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    // 允许代理的目标接口（此处限制只能访问指定目标）
    const allowedTargets = [
        'https://image.pollinations.ai',
        'https://text.pollinations.ai',
        'https://gen.pollinations.ai',
        'https://platform.aitools.cfd',
    ]

    // 处理预检请求（OPTIONS）
    if (request.method === 'OPTIONS') {
        return handleCORSPreflight(origin)
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
        // 解析 params 参数的值作为查询字符串
        const paramPairs = paramsValue.split('&');
        paramPairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
                params.set(key, value);
            }
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
    const newRequestInit = {
        method: request.method,
        headers: (() => {
            const safeHeaders = new Headers();
            // 只复制安全的headers
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
            return safeHeaders;
        })(),
        body: request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH'
            ? await request.arrayBuffer()
            : undefined,
        redirect: 'follow'
    }

    // 向目标 API 发起请求
    console.log(`Proxy request to: ${targetUrl.href}`)
    const response = await fetch(targetUrl, newRequestInit)

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
