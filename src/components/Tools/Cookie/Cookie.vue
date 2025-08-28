<script setup lang="ts">
import { reactive, ref, watch, nextTick, computed } from "vue";
import { Search } from "@element-plus/icons-vue";
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";
import { copy } from "@/utils/string";
import { ElMessage } from "element-plus";

type CookieRow = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | "";
};

const info = reactive({
  title: "Cookie解析/构造",
});

const state = reactive({
  raw: "",
  result: "",
  viewMode: "simple" as "simple" | "detailed", // 简单模式或详细模式
  searchText: "", // 搜索关键词
});

const cookies = ref<CookieRow[]>([
  {
    name: "",
    value: "",
    domain: "",
    path: "",
    expires: "",
    maxAge: "",
    secure: false,
    httpOnly: false,
    sameSite: "",
  },
]);

// 标记是否正在更新中，防止循环更新
let isUpdating = false;

// 计算是否有有效的Cookie数据可导出
const hasValidCookies = computed(() => {
  return cookies.value.some((c) => c.name.trim() !== "");
});

// 解析Cookie字符串
const parseCookies = () => {
  if (isUpdating) return;

  const rawCookies = state.raw.trim();
  if (!rawCookies) {
    isUpdating = true;
    cookies.value = [
      {
        name: "",
        value: "",
        domain: "",
        path: "",
        expires: "",
        maxAge: "",
        secure: false,
        httpOnly: false,
        sameSite: "",
      },
    ];
    isUpdating = false;
    buildCookies();
    return;
  }

  const parsed: CookieRow[] = [];

  // 支持两种格式：
  // 1. 请求头格式：name1=value1; name2=value2
  // 2. 响应头格式：name=value; Domain=example.com; Path=/; Expires=date; Max-Age=3600; Secure; HttpOnly; SameSite=Lax

  // 判断是否为响应头格式（包含Domain、Path等属性）
  const isSetCookieFormat =
    /(?:Domain|Path|Expires|Max-Age|Secure|HttpOnly|SameSite)=/i.test(
      rawCookies
    );

  if (isSetCookieFormat) {
    // 解析Set-Cookie格式（每行一个cookie）
    const lines = rawCookies.split("\n").filter((line) => line.trim());

    lines.forEach((line) => {
      const cookie: CookieRow = {
        name: "",
        value: "",
        domain: "",
        path: "",
        expires: "",
        maxAge: "",
        secure: false,
        httpOnly: false,
        sameSite: "",
      };
      const parts = line.split(";").map((part) => part.trim());

      // 第一部分是name=value
      if (parts[0]) {
        const [name, ...valueParts] = parts[0].split("=");
        cookie.name = name.trim();
        cookie.value = valueParts.join("=") || "";
      }

      // 解析其他属性
      parts.slice(1).forEach((part) => {
        const [key, value] = part.split("=");
        const lowerKey = key.toLowerCase();

        switch (lowerKey) {
          case "domain":
            cookie.domain = value || "";
            break;
          case "path":
            cookie.path = value || "";
            break;
          case "expires":
            cookie.expires = value || "";
            break;
          case "max-age":
            cookie.maxAge = value || "";
            break;
          case "secure":
            cookie.secure = true;
            break;
          case "httponly":
            cookie.httpOnly = true;
            break;
          case "samesite":
            cookie.sameSite = (value as any) || "";
            break;
        }
      });

      parsed.push(cookie);
    });
  } else {
    // 解析请求头Cookie格式：name1=value1; name2=value2
    const parts = rawCookies
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    parts.forEach((part) => {
      const [name, ...valueParts] = part.split("=");
      if (name) {
        parsed.push({
          name: name.trim(),
          value: valueParts.join("=") || "",
          domain: "",
          path: "",
          expires: "",
          maxAge: "",
          secure: false,
          httpOnly: false,
          sameSite: "",
        });
      }
    });
  }

  isUpdating = true;
  cookies.value =
    parsed.length > 0
      ? parsed
      : [
          {
            name: "",
            value: "",
            domain: "",
            path: "",
            expires: "",
            maxAge: "",
            secure: false,
            httpOnly: false,
            sameSite: "",
          },
        ];
  isUpdating = false;
  buildCookies();
};

// 构造Cookie字符串
const buildCookies = () => {
  const validCookies = cookies.value.filter((c) => c.name.trim() !== "");

  if (validCookies.length === 0) {
    state.result = "";
    return;
  }

  if (state.viewMode === "simple") {
    // 生成请求头格式
    const parts = validCookies.map((c) => `${c.name}=${c.value || ""}`);
    state.result = parts.join("; ");
  } else {
    // 生成Set-Cookie格式（每行一个）
    const lines = validCookies.map((cookie) => {
      const parts = [`${cookie.name}=${cookie.value || ""}`];

      if (cookie.domain) parts.push(`Domain=${cookie.domain}`);
      if (cookie.path) parts.push(`Path=${cookie.path}`);
      if (cookie.expires) parts.push(`Expires=${cookie.expires}`);
      if (cookie.maxAge) parts.push(`Max-Age=${cookie.maxAge}`);
      if (cookie.secure) parts.push("Secure");
      if (cookie.httpOnly) parts.push("HttpOnly");
      if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);

      return parts.join("; ");
    });
    state.result = lines.join("\n");
  }
};

// 根据cookies列表更新输入框内容
const updateRawFromCookies = () => {
  if (isUpdating) return;

  const validCookies = cookies.value.filter((c) => c.name.trim() !== "");

  // 如果没有有效cookie，但还有cookie项目存在，不要清空输入框
  if (validCookies.length === 0) {
    // 只有当cookies数组完全为空时才清空输入框
    if (cookies.value.length === 0) {
      isUpdating = true;
      state.raw = "";
      isUpdating = false;
    }
    return;
  }

  isUpdating = true;
  if (state.viewMode === "simple") {
    // 生成请求头格式用于输入框
    const parts = validCookies.map((c) => `${c.name}=${c.value || ""}`);
    state.raw = parts.join("; ");
  } else {
    // 生成Set-Cookie格式用于输入框
    const lines = validCookies.map((cookie) => {
      const parts = [`${cookie.name}=${cookie.value || ""}`];

      if (cookie.domain) parts.push(`Domain=${cookie.domain}`);
      if (cookie.path) parts.push(`Path=${cookie.path}`);
      if (cookie.expires) parts.push(`Expires=${cookie.expires}`);
      if (cookie.maxAge) parts.push(`Max-Age=${cookie.maxAge}`);
      if (cookie.secure) parts.push("Secure");
      if (cookie.httpOnly) parts.push("HttpOnly");
      if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);

      return parts.join("; ");
    });
    state.raw = lines.join("\n");
  }
  isUpdating = false;
};

const addCookie = async () => {
  // 检查最后一个cookie是否为空
  const lastCookie = cookies.value[cookies.value.length - 1];
  const isLastCookieEmpty = !lastCookie.name.trim() && !lastCookie.value.trim();

  let targetIndex = cookies.value.length - 1;

  // 如果最后一个cookie不为空，才添加新项目
  if (!isLastCookieEmpty) {
    cookies.value.push({
      name: "",
      value: "",
      domain: "",
      path: "",
      expires: "",
      maxAge: "",
      secure: false,
      httpOnly: false,
      sameSite: "",
    });
    targetIndex = cookies.value.length - 1;
  }

  // 等待DOM更新后滚动到目标项目并聚焦
  await nextTick();

  // 滚动到目标项目
  const targetElement = document.querySelector(
    `[data-cookie-index="${targetIndex}"]`
  );
  if (targetElement) {
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // 聚焦到name输入框
    const nameInput = targetElement.querySelector("input");
    if (nameInput) {
      nameInput.focus();
    }
  }
};

const removeCookie = (index: number) => {
  if (cookies.value.length > 1) {
    cookies.value.splice(index, 1);
  }
};

const clearAll = () => {
  isUpdating = true;
  state.raw = "";
  state.result = "";
  cookies.value = [
    {
      name: "",
      value: "",
      domain: "",
      path: "",
      expires: "",
      maxAge: "",
      secure: false,
      httpOnly: false,
      sameSite: "",
    },
  ];
  isUpdating = false;
};

const copyResult = () => copy(state.result);

const fillExample = () => {
  if (state.viewMode === "simple") {
    state.raw = "sessionId=abc123; userId=12345; theme=dark; language=zh-CN";
  } else {
    state.raw = `sessionId=abc123; Domain=example.com; Path=/; Expires=Wed, 09 Jun 2025 10:18:14 GMT; Secure; HttpOnly; SameSite=Lax
userId=12345; Domain=.example.com; Path=/; Max-Age=3600; SameSite=Strict`;
  }
};

const toggleViewMode = () => {
  state.viewMode = state.viewMode === "simple" ? "detailed" : "simple";
  updateRawFromCookies();
  buildCookies();
};

// 计算所有cookie的总字段数（name=value算作一个cookie，其他属性单独计算）
const getTotalFieldCount = () => {
  return cookies.value.reduce((total, cookie) => {
    let count = 0;
    // name=value算作一个cookie条目
    if (cookie.name.trim()) count++;
    // 其他属性字段
    if (cookie.domain?.trim()) count++;
    if (cookie.path?.trim()) count++;
    if (cookie.expires?.trim()) count++;
    if (cookie.maxAge?.trim()) count++;
    if (cookie.secure) count++;
    if (cookie.httpOnly) count++;
    if (cookie.sameSite?.trim()) count++;
    return total + count;
  }, 0);
};

// 计算Cookie的字节大小
const getCookieSize = (cookie: CookieRow) => {
  let size = 0
  size += new Blob([cookie.name]).size
  size += new Blob([cookie.value || '']).size
  if (cookie.domain) size += new Blob([cookie.domain]).size
  if (cookie.path) size += new Blob([cookie.path]).size
  if (cookie.expires) size += new Blob([cookie.expires]).size
  if (cookie.maxAge) size += new Blob([cookie.maxAge]).size
  if (cookie.sameSite) size += new Blob([cookie.sameSite]).size
  return size
}

// 计算所有Cookie的总字节数
const getTotalSize = () => {
  return cookies.value.reduce((total, cookie) => {
    return total + getCookieSize(cookie)
  }, 0)
}

// 格式化字节数显示
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 计算有效Cookie数量
const getValidCookieCount = () => {
  return cookies.value.filter(c => c.name.trim() !== '').length
}

// 导出Cookies为JSON文件
const exportCookies = () => {
  const validCookies = cookies.value.filter((c) => c.name.trim() !== "");

  if (validCookies.length === 0) {
    ElMessage.warning("没有有效的Cookie数据可导出");
    return;
  }

  const exportData = {
    exportTime: new Date().toISOString(),
    viewMode: state.viewMode,
    cookies: validCookies,
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `cookies_${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:-]/g, "")}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  ElMessage.success(`成功导出${validCookies.length}个Cookie`);
};

// 导入Cookies从JSON文件
const importCookies = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const importData = JSON.parse(e.target.result);

        // 验证数据格式
        if (!importData.cookies || !Array.isArray(importData.cookies)) {
          ElMessage.error("无效的文件格式：缺少cookies数组");
          return;
        }

        // 验证每个cookie的必要字段
        const validImportedCookies = importData.cookies.filter(
          (cookie: any) => {
            return (
              typeof cookie === "object" &&
              typeof cookie.name === "string" &&
              typeof cookie.value === "string"
            );
          }
        );

        if (validImportedCookies.length === 0) {
          ElMessage.error("文件中没有有效的Cookie数据");
          return;
        }

        // 标准化导入的数据
        const normalizedCookies = validImportedCookies.map((cookie: any) => ({
          name: cookie.name || "",
          value: cookie.value || "",
          domain: cookie.domain || "",
          path: cookie.path || "",
          expires: cookie.expires || "",
          maxAge: cookie.maxAge || "",
          secure: Boolean(cookie.secure),
          httpOnly: Boolean(cookie.httpOnly),
          sameSite: cookie.sameSite || "",
        }));

        // 询问是否替换现有数据
        if (cookies.value.some((c) => c.name.trim() !== "")) {
          const confirmReplace = confirm(
            `将导入${normalizedCookies.length}个Cookie，是否替换当前数据？\n点击"确定"替换，点击"取消"追加到现有数据`
          );

          if (confirmReplace) {
            isUpdating = true;
            cookies.value = normalizedCookies;
            isUpdating = false;
          } else {
            // 追加模式：只添加不重复的cookie
            const existingNames = new Set(
              cookies.value.map((c) => c.name.trim())
            );
            const newCookies = normalizedCookies.filter(
              (cookie: CookieRow) =>
                !existingNames.has(cookie.name.trim()) &&
                cookie.name.trim() !== ""
            );

            if (newCookies.length > 0) {
              // 移除最后的空行（如果存在）
              if (cookies.value[cookies.value.length - 1]?.name.trim() === "") {
                cookies.value.pop();
              }
              cookies.value.push(...newCookies);
            }

            ElMessage.success(`成功追加${newCookies.length}个新Cookie`);
            return;
          }
        } else {
          isUpdating = true;
          cookies.value = normalizedCookies;
          isUpdating = false;
        }

        // 如果导入数据包含视图模式，同步更新
        if (
          importData.viewMode &&
          ["simple", "detailed"].includes(importData.viewMode)
        ) {
          state.viewMode = importData.viewMode;
        }

        ElMessage.success(`成功导入${normalizedCookies.length}个Cookie`);
      } catch (error) {
        ElMessage.error("文件解析失败：请确保是有效的JSON文件");
        console.error("Import error:", error);
      }
    };

    reader.readAsText(file);
  };

  input.click();
};

// 复制单个Cookie
const copySingleCookie = (cookie: any) => {
  let cookieString = ''
  
  if (state.viewMode === 'simple') {
    // 简单模式：只复制name=value格式
    cookieString = `${cookie.name}=${cookie.value || ''}`
  } else {
    // 详细模式：复制完整的Set-Cookie格式
    const parts = [`${cookie.name}=${cookie.value || ''}`]
    
    if (cookie.domain) parts.push(`Domain=${cookie.domain}`)
    if (cookie.path) parts.push(`Path=${cookie.path}`)
    if (cookie.expires) parts.push(`Expires=${cookie.expires}`)
    if (cookie.maxAge) parts.push(`Max-Age=${cookie.maxAge}`)
    if (cookie.secure) parts.push('Secure')
    if (cookie.httpOnly) parts.push('HttpOnly')
    if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`)
    
    cookieString = parts.join('; ')
  }
  
  copy(cookieString)
  // 移除这行，避免重复提示
  // ElMessage.success(`已复制Cookie: ${cookie.name}`)
}

// 验证Cookie名称是否合规
const validateCookieName = (name: string) => {
  if (!name.trim()) {
    return { valid: false, message: 'Cookie名称不能为空' }
  }
  
  // Cookie名称不能包含这些字符：空格、分号、逗号、等号、控制字符等
  const invalidChars = /[;,\s=\(\)<>@"\/\[\]?:{}\\]/
  if (invalidChars.test(name)) {
    return { valid: false, message: '名称包含非法字符(不能包含空格、分号、逗号、等号等)' }
  }
  
  return { valid: true, message: '' }
}

// 验证Cookie值
const validateCookieValue = (value: string) => {
  // Cookie值中不能包含分号、逗号、空格(除非被引号包围)
  const invalidChars = /[;,]/
  if (invalidChars.test(value)) {
    return { valid: false, message: '值不能包含分号或逗号' }
  }
  
  return { valid: true, message: '' }
}

// 验证域名格式
const validateDomain = (domain: string) => {
  if (!domain.trim()) return { valid: true, message: '' }
  
  // 基本域名格式验证
  const domainRegex = /^(?:\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?$/
  if (!domainRegex.test(domain) && !domain.startsWith('.')) {
    return { valid: false, message: '域名格式不正确' }
  }
  
  return { valid: true, message: '' }
}

// 验证路径格式
const validatePath = (path: string) => {
  if (!path.trim()) return { valid: true, message: '' }
  
  if (!path.startsWith('/')) {
    return { valid: false, message: '路径必须以 / 开头' }
  }
  
  return { valid: true, message: '' }
}

// 验证Max-Age格式
const validateMaxAge = (maxAge: string) => {
  if (!maxAge.trim()) return { valid: true, message: '' }
  
  const num = parseInt(maxAge)
  if (isNaN(num) || num < 0) {
    return { valid: false, message: 'Max-Age必须是非负整数' }
  }
  
  return { valid: true, message: '' }
}

// 获取Cookie的验证状态
const getCookieValidation = (cookie: any) => {
  const nameValidation = validateCookieName(cookie.name || '')
  const valueValidation = validateCookieValue(cookie.value || '')
  const domainValidation = validateDomain(cookie.domain || '')
  const pathValidation = validatePath(cookie.path || '')
  const maxAgeValidation = validateMaxAge(cookie.maxAge || '')
  
  return {
    name: nameValidation,
    value: valueValidation,
    domain: domainValidation,
    path: pathValidation,
    maxAge: maxAgeValidation,
    hasErrors: !nameValidation.valid || !valueValidation.valid || !domainValidation.valid || !pathValidation.valid || !maxAgeValidation.valid
  }
}

// 获取所有Cookie的验证状态
const getAllValidationErrors = () => {
  const errors: string[] = []
  
  cookies.value.forEach((cookie, index) => {
    if (cookie.name.trim() === '') return // 跳过空的Cookie
    
    const validation = getCookieValidation(cookie)
    if (validation.hasErrors) {
      errors.push(`Cookie ${index + 1}: ${[
        validation.name.valid ? '' : validation.name.message,
        validation.value.valid ? '' : validation.value.message,
        validation.domain.valid ? '' : validation.domain.message,
        validation.path.valid ? '' : validation.path.message,
        validation.maxAge.valid ? '' : validation.maxAge.message,
      ].filter(Boolean).join(', ')}`)
    }
  })
  
  return errors
}

// 监听输入框变化，自动解析
watch(() => state.raw, parseCookies);

// 监听cookies变化，自动重建result并更新输入框
watch(
  cookies,
  () => {
    buildCookies();
    // 注释掉这行，避免循环更新导致空名称cookie被删除
    // updateRawFromCookies();
  },
  { deep: true }
);

// 监听视图模式变化
watch(
  () => state.viewMode,
  () => {
    updateRawFromCookies();
    buildCookies();
  }
);

const clearSearch = () => {
  state.searchText = "";
};

// 过滤后的Cookie列表（简化逻辑）
const filteredCookies = computed(() => {
  if (!Array.isArray(cookies.value) || cookies.value.length === 0) {
    return [];
  }

  // 没有搜索文本时，显示所有cookies
  if (!state.searchText.trim()) {
    return cookies.value.map((cookie, index) => ({
      ...cookie,
      originalIndex: index,
    }));
  }

  // 有搜索文本时，过滤匹配的cookies
  const searchLower = state.searchText.toLowerCase();
  return cookies.value
    .map((cookie, index) => ({ ...cookie, originalIndex: index }))
    .filter((item) => {
      if (!item || typeof item !== "object") return false;

      return (
        (item.name || "").toLowerCase().includes(searchLower) ||
        (item.value || "").toLowerCase().includes(searchLower) ||
        (item.domain || "").toLowerCase().includes(searchLower) ||
        (item.path || "").toLowerCase().includes(searchLower) ||
        (item.expires || "").toLowerCase().includes(searchLower) ||
        (item.maxAge || "").toLowerCase().includes(searchLower) ||
        (item.sameSite || "").toLowerCase().includes(searchLower)
      );
    });
});

// 匹配的Cookie数量（添加安全检查）
const matchedCount = computed(() => {
  if (!state.searchText.trim()) {
    return Array.isArray(cookies.value) ? cookies.value.length : 0;
  }
  return filteredCookies.value.length;
});

// 检查cookie是否匹配搜索关键词（添加安全检查）
const isHighlighted = (cookie: any) => {
  if (!state.searchText.trim() || !cookie) return false;

  const searchLower = state.searchText.toLowerCase();
  return (
    (cookie.name || "").toLowerCase().includes(searchLower) ||
    (cookie.value || "").toLowerCase().includes(searchLower) ||
    (cookie.domain || "").toLowerCase().includes(searchLower) ||
    (cookie.path || "").toLowerCase().includes(searchLower) ||
    (cookie.expires || "").toLowerCase().includes(searchLower) ||
    (cookie.maxAge || "").toLowerCase().includes(searchLower) ||
    (cookie.sameSite || "").toLowerCase().includes(searchLower)
  );
};

// 安全地更新Cookie数据
const updateCookieByOriginalIndex = (
  originalIndex: number,
  field: string,
  value: any
) => {
  if (
    originalIndex >= 0 &&
    originalIndex < cookies.value.length &&
    cookies.value[originalIndex]
  ) {
    isUpdating = true;
    cookies.value[originalIndex] = {
      ...cookies.value[originalIndex],
      [field]: value,
    };
    isUpdating = false;
  }
};

// 高亮搜索文本（处理undefined）
const highlightText = (text: string | undefined, searchText: string) => {
  if (!searchText.trim() || !text) return text || ''
  
  const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

// 检查是否需要高亮显示（处理undefined）
const shouldHighlight = (text: string | undefined) => {
  if (!state.searchText.trim() || !text) return false
  return text.toLowerCase().includes(state.searchText.toLowerCase())
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <div class="mb-2 text-sm text-gray-500">
        支持解析请求头Cookie（name1=value1;
        name2=value2）和响应头Set-Cookie格式，输入内容后自动解析，编辑Cookie列表后自动同步。
        <el-link class="ml-2" type="primary" @click="fillExample"
          >填充示例</el-link
        >
      </div>

      <el-input
        type="textarea"
        :rows="4"
        v-model="state.raw"
        :placeholder="
          state.viewMode === 'simple'
            ? '输入Cookie字符串，如：name1=value1; name2=value2（自动解析）'
            : '输入Set-Cookie格式，如：name=value; Domain=example.com; Path=/; Secure（自动解析）'
        "
      />

      <div class="mt-3 flex flex-wrap items-center gap-2 button-container">
        <el-button @click="toggleViewMode">
          切换到{{ state.viewMode === "simple" ? "详细" : "简单" }}模式
        </el-button>
        <el-button
          @click="exportCookies"
          type="success"
          :disabled="!hasValidCookies"
        >
          导出JSON{{ hasValidCookies ? "" : "(无数据)" }}
        </el-button>
        <el-button @click="importCookies" type="primary">导入JSON</el-button>
        <el-button type="danger" @click="clearAll">清空</el-button>
      </div>

      <div class="mt-4">
        <!-- 搜索框 -->
        <div class="mb-3">
          <el-input
            v-model="state.searchText"
            placeholder="搜索Cookie名称、值、域名等..."
            prefix-icon="Search"
            clearable
            class="max-w-md"
            @clear="clearSearch"
          >
            <template #suffix v-if="state.searchText.trim()">
              <span class="text-xs text-gray-400 mr-2"
                >{{ matchedCount }}/{{ cookies.length }}</span
              >
            </template>
          </el-input>
        </div>

        <div class="flex items-center justify-between mb-2">
          <div class="text-sm text-gray-600">
            Cookie列表（实时同步）- {{ getValidCookieCount() }}个有效Cookie，总计{{ getTotalFieldCount() }}个字段，
            总大小: {{ formatBytes(getTotalSize()) }}
            <span v-if="getAllValidationErrors().length > 0" class="ml-2 text-red-600">
              ({{ getAllValidationErrors().length }}个错误)
            </span>
            <span v-if="state.searchText.trim()" class="ml-2 text-blue-600">
              (显示{{ matchedCount }}个匹配项)
            </span>
            <el-tag size="small" class="ml-2">{{
              state.viewMode === "simple" ? "简单模式" : "详细模式"
            }}</el-tag>
          </div>
          <el-button size="small" @click="addCookie">添加Cookie</el-button>
        </div>

        <!-- 搜索无结果提示 -->
        <div
          v-if="state.searchText.trim() && filteredCookies.length === 0"
          class="text-center py-8 text-gray-500"
        >
          <el-icon size="48" class="mb-2"><Search /></el-icon>
          <p>没有找到匹配"{{ state.searchText }}"的Cookie</p>
          <el-button link @click="clearSearch">清除搜索条件</el-button>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="!state.searchText.trim() && cookies.length === 0"
          class="text-center py-8 text-gray-500"
        >
          <p>暂无Cookie数据，点击"添加Cookie"开始</p>
        </div>

        <!-- Cookie列表 -->
        <div v-else class="space-y-2">
          <template
            v-for="(item, index) in filteredCookies"
            :key="`cookie-${item?.originalIndex || index}`"
          >
            <div
              v-if="item && cookies[item.originalIndex ?? index]"
              :data-cookie-index="item.originalIndex || index"
              class="border rounded-md p-2 bg-gray-50 transition-colors duration-300"
              :class="{
                'ring-2 ring-blue-300':
                  item.originalIndex === cookies.length - 1 &&
                  cookies.length > 1,
                'ring-1 ring-yellow-300 bg-yellow-50':
                  state.searchText.trim() && isHighlighted(item),
              }"
            >
              <!-- 基本信息 -->
              <div class="flex gap-2 items-start mb-1">
                <div class="w-8 flex-shrink-0 text-center pt-1">
                  <span class="text-xs text-gray-500 font-mono">{{
                    (item.originalIndex ?? index) + 1
                  }}</span>
                  <div class="text-xs text-gray-400" title="Cookie大小">
                    {{ formatBytes(getCookieSize(item)) }}
                  </div>
                </div>
                <div class="basis-[35%]">
                  <el-input
                    :model-value="item.name || ''"
                    placeholder="Cookie名称"
                    size="small"
                    :status="getCookieValidation(item).name.valid ? '' : 'error'"
                    @input="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'name',
                        $event
                      )
                    "
                  >
                    <template #suffix>
                      <span class="text-xs text-gray-400">{{
                        (item.name || "").length
                      }}</span>
                    </template>
                  </el-input>
                  <!-- 高亮显示的文本 -->
                  <div 
                    v-if="state.searchText.trim() && shouldHighlight(item.name)"
                    class="text-xs text-gray-600 mt-1 px-1"
                    v-html="highlightText(item.name, state.searchText)"
                  ></div>
                  <div 
                    v-if="!getCookieValidation(item).name.valid && item.name" 
                    class="text-xs text-red-500 mt-1"
                  >
                    {{ getCookieValidation(item).name.message }}
                  </div>
                </div>
                <div class="basis-[45%]">
                  <el-input
                    :model-value="item.value || ''"
                    placeholder="Cookie值"
                    size="small"
                    :status="getCookieValidation(item).value.valid ? '' : 'error'"
                    @input="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'value',
                        $event
                      )
                    "
                  >
                    <template #suffix>
                      <span class="text-xs text-gray-400">{{
                        (item.value || "").length
                      }}</span>
                    </template>
                  </el-input>
                  <!-- 高亮显示的文本 -->
                  <div 
                    v-if="state.searchText.trim() && shouldHighlight(item.value)"
                    class="text-xs text-gray-600 mt-1 px-1 truncate"
                    v-html="highlightText(item.value, state.searchText)"
                  ></div>
                  <div 
                    v-if="!getCookieValidation(item).value.valid && item.value" 
                    class="text-xs text-red-500 mt-1"
                  >
                    {{ getCookieValidation(item).value.message }}
                  </div>
                </div>
                <el-button
                  type="primary"
                  link
                  @click="copySingleCookie(item)"
                  size="small"
                  title="复制此Cookie"
                  :disabled="getCookieValidation(item).hasErrors"
                  >复制</el-button
                >
                <el-button
                  type="danger"
                  link
                  @click="removeCookie(item.originalIndex ?? index)"
                  size="small"
                  >删除</el-button
                >
              </div>

              <!-- 详细模式的额外属性 -->
              <div
                v-if="state.viewMode === 'detailed'"
                class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1 mt-1 ml-10"
              >
                <div>
                  <el-input
                    :model-value="item.domain || ''"
                    placeholder="Domain"
                    size="small"
                    :status="getCookieValidation(item).domain.valid ? '' : 'error'"
                    @input="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'domain',
                        $event
                      )
                    "
                  />
                  <!-- 高亮显示 -->
                  <div 
                    v-if="state.searchText.trim() && shouldHighlight(item.domain || '')"
                    class="text-xs text-gray-600 mt-1 px-1"
                    v-html="highlightText(item.domain || '', state.searchText)"
                  ></div>
                  <div 
                    v-if="!getCookieValidation(item).domain.valid && item.domain" 
                    class="text-xs text-red-500 mt-1"
                  >
                    {{ getCookieValidation(item).domain.message }}
                  </div>
                </div>
                <div>
                  <el-input
                    :model-value="item.path || ''"
                    placeholder="Path"
                    size="small"
                    :status="getCookieValidation(item).path.valid ? '' : 'error'"
                    @input="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'path',
                        $event
                      )
                    "
                  />
                  <!-- 高亮显示 -->
                  <div 
                    v-if="state.searchText.trim() && shouldHighlight(item.path || '')"
                    class="text-xs text-gray-600 mt-1 px-1"
                    v-html="highlightText(item.path || '', state.searchText)"
                  ></div>
                  <div 
                    v-if="!getCookieValidation(item).path.valid && item.path" 
                    class="text-xs text-red-500 mt-1"
                  >
                    {{ getCookieValidation(item).path.message }}
                  </div>
                </div>
                <div>
                  <el-input
                    :model-value="item.expires || ''"
                    placeholder="Expires"
                    size="small"
                    @input="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'expires',
                        $event
                      )
                    "
                  />
                  <!-- 高亮显示 -->
                  <div 
                    v-if="state.searchText.trim() && shouldHighlight(item.expires || '')"
                    class="text-xs text-gray-600 mt-1 px-1"
                    v-html="highlightText(item.expires || '', state.searchText)"
                  ></div>
                </div>
                <div>
                  <el-input
                    :model-value="item.maxAge || ''"
                    placeholder="Max-Age"
                    size="small"
                    :status="getCookieValidation(item).maxAge.valid ? '' : 'error'"
                    @input="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'maxAge',
                        $event
                      )
                    "
                  />
                  <!-- 高亮显示 -->
                  <div 
                    v-if="state.searchText.trim() && shouldHighlight(item.maxAge || '')"
                    class="text-xs text-gray-600 mt-1 px-1"
                    v-html="highlightText(item.maxAge || '', state.searchText)"
                  ></div>
                  <div 
                    v-if="!getCookieValidation(item).maxAge.valid && item.maxAge" 
                    class="text-xs text-red-500 mt-1"
                  >
                    {{ getCookieValidation(item).maxAge.message }}
                  </div>
                </div>
                <!-- sameSite字段高亮 -->
                <div class="flex items-center gap-2 text-sm">
                  <el-checkbox
                    :model-value="Boolean(item.secure)"
                    size="small"
                    @change="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'secure',
                        $event
                      )
                    "
                    >Secure</el-checkbox
                  >
                  <el-checkbox
                    :model-value="Boolean(item.httpOnly)"
                    size="small"
                    @change="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'httpOnly',
                        $event
                      )
                    "
                    >HttpOnly</el-checkbox
                  >
                </div>
                <div>
                  <el-select
                    :model-value="item.sameSite || ''"
                    placeholder="SameSite"
                    size="small"
                    clearable
                    @change="
                      updateCookieByOriginalIndex(
                        item.originalIndex ?? index,
                        'sameSite',
                        $event
                      )
                    "
                  >
                    <el-option label="Strict" value="Strict" />
                    <el-option label="Lax" value="Lax" />
                    <el-option label="None" value="None" />
                  </el-select>
                  <!-- 高亮显示 -->
                  <div 
                    v-if="state.searchText.trim() && shouldHighlight(item.sameSite || '')"
                    class="text-xs text-gray-600 mt-1 px-1"
                    v-html="highlightText(item.sameSite || '', state.searchText)"
                  ></div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="mt-4">
        <div class="text-sm text-gray-600 mb-1">
          生成结果（{{
            state.viewMode === "simple" ? "请求头Cookie格式" : "Set-Cookie格式"
          }}）：
        </div>
        <el-input
          type="textarea"
          :rows="state.viewMode === 'simple' ? 2 : 4"
          v-model="state.result"
          readonly
        />
        <div class="mt-2">
          <el-button type="primary" @click="copyResult">复制结果</el-button>
        </div>
      </div>
    </div>

    <ToolDetail title="功能说明">
      <div class="space-y-2">
        <p>
          <strong>简单模式：</strong
          >适用于解析和构造请求头中的Cookie字符串（name1=value1; name2=value2）
        </p>
        <p>
          <strong>详细模式：</strong
          >适用于解析和构造响应头中的Set-Cookie字符串，包含Domain、Path、Expires、Max-Age、Secure、HttpOnly、SameSite等属性
        </p>
        <p><strong>核心功能：</strong></p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>输入内容后自动解析，无需点击按钮</li>
          <li>编辑Cookie列表后自动同步到输入框</li>
          <li>自动识别Cookie格式（请求头或响应头）</li>
          <li>添加/删除Cookie条目，支持智能防重复添加</li>
          <li>在简单模式和详细模式间切换</li>
          <li>一键复制生成结果</li>
        </ul>
        <p><strong>高级功能：</strong></p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>支持导出为JSON文件，包含时间戳和模式信息</li>
          <li>支持从JSON文件导入Cookie，可选择替换或追加模式</li>
          <li>实时搜索过滤Cookie，支持名称、值、域名等多字段搜索</li>
          <li>复制单个Cookie，根据当前模式生成对应格式</li>
          <li>显示详细统计信息：有效数量、总字段数、总字节大小</li>
          <li>显示每个Cookie的字节大小和字符长度</li>
        </ul>
        <p><strong>验证与错误提示：</strong></p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>实时验证Cookie名称格式（不能包含非法字符）</li>
          <li>验证Cookie值格式（不能包含分号、逗号）</li>
          <li>验证域名格式和路径格式</li>
          <li>验证Max-Age数值有效性</li>
          <li>错误项目显示红色边框和详细错误信息</li>
          <li>有错误的Cookie无法复制，确保数据质量</li>
        </ul>
        <p><strong>用户体验：</strong></p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>添加Cookie后自动滚动并聚焦到新项目</li>
          <li>搜索高亮匹配项目，显示匹配数量统计</li>
          <li>智能格式化字节数显示（B/KB/MB）</li>
          <li>支持键盘操作和清除功能</li>
          <li>紧凑的界面设计，一页可显示更多Cookie</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.button-container .el-button {
  margin-right: 12px;
  margin-left: 0px;
}

:deep(.search-highlight) {
  background-color: #ffeb3b;
  color: #333;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: bold;
}
</style>
