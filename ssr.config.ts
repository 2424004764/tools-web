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
    ];
    return vitePluginSeoPrerender({
        routes: constantRoute
            .filter(route => !(route.meta && route.meta.prerender === false))
            .map(routeConfig => routeConfig.path)
            .filter(path => !filterPath.includes(path)),
        network: {
            timeout: 45000, // 预渲染等待超时时间提升到45s
            // waitFor: 'networkidle0', // 可选：等待网络空闲
        },
        concurrency: 3, // 并发降低，减少资源竞争
        headless: true,
        // removeStyle: true
    })
}