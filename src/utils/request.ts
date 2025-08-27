import axios from "axios";
import { ElMessage } from "element-plus";
import { handle401Error, handleHttpError } from './errorHandler'

//创建axios实例
let request = axios.create({
    baseURL: import.meta.env.VITE_IS_MOCK == 'true' ? import.meta.env.VITE_APP_BASE_API :  import.meta.env.VITE_SERVE + import.meta.env.VITE_APP_BASE_API,
    timeout: 5000
});  

//请求拦截器
request.interceptors.request.use(config => {
    const token = localStorage.getItem('TOKEN');
    if (token) {
        config.headers = config.headers || {};
        (config.headers as any).Authorization = `${token}`;
    }
    return config;
});
//响应拦截器
request.interceptors.response.use((response) => {
    if (response.data.code == 401) {
        //登录过期 - 使用统一错误处理
        handle401Error({
            autoRedirectLogin: false, // 保持原有的刷新页面逻辑
            showMessage: false // 避免重复提示
        })
        location.reload()
    }
    return response.data;
}, (error) => {
    if (error.code == 'ERR_CANCELED') {
        //拒绝响应
        return Promise.race([]);
    }
    
    //处理网络错误 - 使用统一错误处理
    if (error.response) {
        handleHttpError(error.response.status, {
            isSpecialApi: false
        })
    } else {
        ElMessage.error('无网络')
    }
    
    return Promise.reject(error);
});
export default request;