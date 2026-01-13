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
        // 可能加载较重的页面
        '/math-equation-3d',
        '/algorithm-visualization',
        '/stringclean', // 新增的工具
    ];

    // 排除动态路由（包含:的路由）
    const isDynamicRoute = (path: string) => path.includes(':');

    return vitePluginSeoPrerender({
        routes: constantRoute
            .filter(route => !(route.meta && route.meta.prerender === false))
            .map(routeConfig => routeConfig.path)
            .filter(path => !filterPath.includes(path))
            .filter(path => !isDynamicRoute(path)), // 排除动态路由
        network: {
            timeout: 60000, // 预渲染等待超时时间提升到60s
            waitFor: 'domcontentloaded', // 等待 DOM 加载完成
        },
        concurrency: 2, // 并发降低到2，减少资源竞争
        headless: true,
        // removeStyle: true
    })
}