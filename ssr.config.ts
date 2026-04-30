import {constantRoute} from "./src/router/router"
import vitePluginSeoPrerender from "vite-plugin-seo-prerender";
export function seoperender(){
    // 排除不适合预渲染或会触发网络/权限的路径
    const filterPath = [
        '/:pathMatch(.*)*',
        '/404',
        // 动态强网络依赖或需要权限/设备能力
        '/ai-text-to-image',
        '/qrcode-scan',
        '/postman',
        '/ip',
        '/webinfo',
        '/ai-chat',
        '/ai-interview',
        '/notes',
        '/userinfo',
        '/userinfo/todos',
        '/gomoku-online',
        '/temp-chat',
        // 可能加载较重的页面
        '/math-equation-3d',
        '/algorithm-visualization',
        '/stringclean',
    ];

    // 排除动态路由（包含:的路由）
    const isDynamicRoute = (path: string) => path.includes(':');

    return vitePluginSeoPrerender({
        routes: constantRoute
            .filter(route => !(route.meta && route.meta.prerender === false))
            .map(routeConfig => routeConfig.path)
            .filter(path => !filterPath.includes(path))
            .filter(path => !isDynamicRoute(path)), // 排除动态路由
        // 注意: 不设置 network 选项，使用默认的 load 事件等待策略
        // 设置为 network 选项会导致插件使用 networkidle0（等待网络完全空闲），
        // 部分页面因持续的网络请求（如 AI 对话、WebSocket 等）将永远无法达到空闲状态而超时

        concurrency: 2, // 并发降低到2，减少资源竞争
        headless: true,
        // removeStyle: true
    })
}