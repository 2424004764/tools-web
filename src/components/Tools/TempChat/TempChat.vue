<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted, nextTick, computed, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";
import { ElMessage } from "element-plus";
import { CopyDocument, Close } from "@element-plus/icons-vue";
import QrcodeVue3 from "qrcode-vue3";
import { supabase, chatDb } from "@/utils/supabase";

const info = reactive({
  title: "临时聊天室",
});

const route = useRoute();

// 聊天状态
const roomId = ref("");
const nickname = ref("");
const isJoined = ref(false);
const messages = ref<Array<{
  id: string;
  nickname: string;
  content: string;
  timestamp: number;
  isSelf: boolean;
}>>([]);
const inputMessage = ref("");
const messagesContainer = ref<HTMLElement | null>(null);
const onlineUsers = ref<string[]>([]);
const isConnecting = ref(false);
const isSending = ref(false);
const isConnected = ref(false);
const showQrcode = ref(false);
const showAllOnlineUsers = ref(false);

// Supabase channel 实例
let messageChannel: any = null;
let presenceChannel: any = null;
let heartbeatInterval: any = null;

// 当前用户的唯一ID
const currentUserId = ref(`user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

// 生成随机房间ID
const generateRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  roomId.value = result;
};

// 生成随机昵称
const generateNickname = () => {
  const adjectives = ['快乐的', '聪明的', '可爱的', '勇敢的', '温柔的', '活泼的', '神秘的', '优雅的'];
  const nouns = ['小猫', '小狗', '兔子', '熊猫', '狐狸', '松鼠', '海豚', '企鹅'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  nickname.value = adj + noun;
};

// 获取房间链接
const getRoomLink = computed(() => {
  if (!roomId.value) return '';
  const baseUrl = window.location.origin + '/temp-chat';
  return `${baseUrl}?room=${roomId.value}`;
});

// 从 URL 参数中获取房间号
const loadRoomFromUrl = () => {
  const roomParam = route.query.room as string;
  if (roomParam) {
    roomId.value = roomParam.toUpperCase();
    return true;
  }
  return false;
};

// 检查 Supabase 是否已配置
const isSupabaseConfigured = computed(() => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return url && key && !url.includes('your-project') && !key.includes('your-anon-key');
});

// 获取配置步骤说明
const configSteps = [
  '1. 访问 https://supabase.com 创建免费项目',
  '2. 在 SQL Editor 执行：CREATE TABLE chat_messages (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, room_id TEXT NOT NULL, nickname TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());',
  '3. 启用 Realtime：ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;',
  '4. 在 Project Settings > API 复制 URL 和 anon key',
  '5. 将配置填入项目的 .env.development 文件',
];

// 初始化 Supabase 连接
const initSupabase = async () => {
  // 检查 Supabase 配置
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key || url.includes('your-project') || key.includes('your-anon-key')) {
    return false;
  }

  try {
    // 添加超时保护
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('连接超时')), 5000)
    );

    const connectPromise = supabase.from('chat_messages').select('id').limit(1);

    const { error } = await Promise.race([connectPromise, timeoutPromise]) as any;
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    isConnected.value = true;
    return true;
  } catch (error: any) {
    console.error("Supabase 连接失败:", error);
    isConnected.value = false;
    return false;
  }
};

// 加入房间
const joinRoom = async () => {
  if (!roomId.value.trim()) {
    ElMessage.warning("请输入房间号");
    return;
  }
  if (!nickname.value.trim()) {
    ElMessage.warning("请输入昵称");
    return;
  }

  isConnecting.value = true;

  try {
    // 初始化连接
    const connected = await initSupabase();
    if (!connected) {
      isConnecting.value = false;
      return;
    }

    const normalizedRoomId = roomId.value.toUpperCase();

    // 加载历史消息
    let isNewRoom = false;
    try {
      const historyData = await chatDb.getMessages(normalizedRoomId, 50);
      if (!historyData || historyData.length === 0) {
        isNewRoom = true;
      }
      messages.value = historyData
        .filter((msg: any) => {
          // 只显示最近1小时的消息
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          return new Date(msg.created_at).getTime() > oneHourAgo;
        })
        .map((msg: any) => ({
          id: msg.id,
          nickname: msg.nickname,
          content: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          isSelf: msg.nickname === nickname.value,
        }));

      nextTick(() => scrollToBottom());
    } catch (error: any) {
      // 如果表不存在，标记为新房间
      isNewRoom = true;
      console.error("加载历史消息失败:", error);
    }

    // 如果是新房间，发送一条系统消息标记房间创建
    if (isNewRoom) {
      try {
        await chatDb.sendMessage(normalizedRoomId, '系统', `房间 ${normalizedRoomId} 已创建`);
      } catch (e) {
        // 忽略错误
      }
    }

    // 订阅新消息
    messageChannel = chatDb.subscribeToRoom(normalizedRoomId, (payload: any) => {
      const newMsg = payload.new;
      const exists = messages.value.some(m => m.id === newMsg.id);
      if (exists) return;

      messages.value.push({
        id: newMsg.id,
        nickname: newMsg.nickname,
        content: newMsg.content,
        timestamp: new Date(newMsg.created_at).getTime(),
        isSelf: newMsg.nickname === nickname.value,
      });

      nextTick(() => scrollToBottom());
    });

    // 订阅在线用户
    presenceChannel = supabase.channel(`chat-presence-${normalizedRoomId}`);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        updateOnlineUsers();
      })
      .on('presence', { event: 'join' }, () => {
        updateOnlineUsers();
      })
      .on('presence', { event: 'leave' }, () => {
        updateOnlineUsers();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // 追踪当前用户
          presenceChannel.track({
            user_id: currentUserId.value,
            nickname: nickname.value,
            online_at: new Date().toISOString(),
          });
          updateOnlineUsers();
        }
      });

    // 心跳更新在线状态
    heartbeatInterval = setInterval(() => {
      if (presenceChannel) {
        presenceChannel.track({
          user_id: currentUserId.value,
          nickname: nickname.value,
          online_at: new Date().toISOString(),
        });
      }
    }, 30000);

    isJoined.value = true;
    isConnecting.value = false;
    showQrcode.value = false;

    // 更新 URL 添加房间号参数，刷新后可恢复状态
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', normalizedRoomId);
    window.history.replaceState({}, '', newUrl.toString());

    // 等待 DOM 更新后滚动到底部
    nextTick(() => {
      scrollToBottom();
    });

    ElMessage.success("成功加入聊天室");
  } catch (error: any) {
    console.error("加入房间失败:", error);
    ElMessage.error("加入房间失败: " + (error.message || "未知错误"));
    isConnecting.value = false;
  }
};

// 更新在线用户列表
const updateOnlineUsers = () => {
  if (!presenceChannel) return;

  const state = presenceChannel.presenceState();
  const users: string[] = [];

  if (state) {
    Object.keys(state).forEach((key: string) => {
      const presences = state[key] as any[];
      presences.forEach((presence: any) => {
        if (presence.nickname && !users.includes(presence.nickname)) {
          users.push(presence.nickname);
        }
      });
    });
  }

  onlineUsers.value = users;
};

// 发送消息
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isSending.value) return;

  isSending.value = true;
  try {
    await chatDb.sendMessage(roomId.value, nickname.value, inputMessage.value.trim());
    inputMessage.value = "";
  } catch (error: any) {
    console.error("发送消息失败:", error);
    ElMessage.error("发送失败，请重试");
  } finally {
    isSending.value = false;
  }
};

// 离开房间
const leaveRoom = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // 取消订阅
  if (messageChannel) {
    supabase.removeChannel(messageChannel);
    messageChannel = null;
  }

  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }

  messages.value = [];
  onlineUsers.value = [];
  isJoined.value = false;

  // 生成新的房间号和昵称
  generateRoomId();
  generateNickname();

  // 清除 URL 参数
  if (route.query.room) {
    window.history.pushState({}, '', '/temp-chat');
  }
};

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: 'smooth'
    });
  }
};

// 复制房间号
const copyRoomId = async () => {
  try {
    await navigator.clipboard.writeText(roomId.value);
    ElMessage.success("房间号已复制");
  } catch {
    ElMessage.error("复制失败");
  }
};

// 复制房间链接
const copyRoomLink = async () => {
  try {
    await navigator.clipboard.writeText(getRoomLink.value);
    ElMessage.success("链接已复制，分享给好友即可加入");
  } catch {
    ElMessage.error("复制失败");
  }
};

// 复制消息
const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    ElMessage.success("消息已复制");
  } catch {
    ElMessage.error("复制失败");
  }
};

// 显示二维码
const toggleQrcode = () => {
  showQrcode.value = !showQrcode.value;
};

// 刷新页面
const refreshPage = () => {
  window.location.reload();
};

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
};

// 按回车发送
const handleKeydown = (e: Event | KeyboardEvent) => {
  if (e instanceof KeyboardEvent && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};

// 组件挂载
onMounted(() => {
  generateNickname();

  // 检查 URL 中是否有房间号
  const hasRoomParam = loadRoomFromUrl();

  // 如果有房间号参数，自动加入聊天室
  if (hasRoomParam && roomId.value) {
    nextTick(() => {
      joinRoom();
    });
  } else {
    // 没有房间号才生成随机房间号
    generateRoomId();
  }
});

// 组件卸载
onUnmounted(() => {
  leaveRoom();
});

onBeforeUnmount(() => {
  leaveRoom();
});
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="bg-white rounded-lg shadow-sm p-4 md:p-6">
      <!-- Supabase 未配置时显示配置提示 -->
      <div v-if="!isSupabaseConfigured" class="max-w-2xl mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">⚙️</div>
          <h2 class="text-xl font-semibold text-gray-800 mb-2">需要配置 Supabase</h2>
          <p class="text-gray-500 text-sm">临时聊天室功能需要先配置 Supabase 服务</p>
        </div>

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 class="font-semibold text-blue-800 mb-3">📋 配置步骤：</h3>
          <ol class="space-y-2 text-sm text-blue-700">
            <li v-for="(step, index) in configSteps" :key="index" class="flex gap-2">
              <span class="font-shrink-0 w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">{{ index + 1 }}</span>
              <span>{{ step }}</span>
            </li>
          </ol>
        </div>

        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 class="font-semibold text-gray-800 mb-2">📝 环境变量配置</h3>
          <p class="text-sm text-gray-600 mb-2">在项目根目录的 <code class="bg-gray-200 px-1 rounded">.env.development</code> 文件中添加：</p>
          <pre class="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto"><code>VITE_SUPABASE_URL='https://your-project.supabase.co'
VITE_SUPABASE_ANON_KEY='your-anon-key'</code></pre>
          <p class="text-sm text-gray-500 mt-3">⚠️ 配置完成后需要重启开发服务器才能生效</p>
        </div>

        <div class="mt-4 text-center">
          <el-button @click="refreshPage" type="primary">
            配置完成，刷新页面
          </el-button>
        </div>
      </div>

      <!-- 未加入房间时显示加入界面 -->
      <div v-else-if="!isJoined" class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">💬</div>
          <h2 class="text-xl font-semibold text-gray-800 mb-2">临时聊天室</h2>
          <p class="text-gray-500 text-sm">无需注册，扫码或分享链接即可开始聊天</p>
        </div>

        <div class="space-y-4">
          <!-- 房间号输入 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">房间号</label>
            <div class="flex gap-2">
              <el-input
                v-model="roomId"
                placeholder="输入房间号加入，或使用随机房间号"
                maxlength="10"
                class="flex-1"
                @keyup.enter="joinRoom"
              />
              <el-button @click="generateRoomId">随机</el-button>
            </div>
          </div>

          <!-- 昵称输入 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">昵称</label>
            <div class="flex gap-2">
              <el-input
                v-model="nickname"
                placeholder="输入你的昵称"
                maxlength="20"
                class="flex-1"
                @keyup.enter="joinRoom"
              />
              <el-button @click="generateNickname">随机</el-button>
            </div>
          </div>

          <!-- 加入按钮 -->
          <el-button
            type="primary"
            class="w-full"
            size="large"
            :loading="isConnecting"
            @click="joinRoom"
          >
            {{ isConnecting ? '连接中...' : '加入聊天室' }}
          </el-button>
        </div>
      </div>

      <!-- 已加入房间时显示聊天界面 -->
      <div v-else class="flex flex-col gap-3">
        <!-- 顶部信息栏 -->
        <div class="space-y-3 pb-3 border-b border-gray-200">
          <!-- 第一行：房间信息 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-sm text-gray-500 flex-shrink-0">房间:</span>
              <span class="font-mono font-semibold text-primary truncate">{{ roomId }}</span>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <el-button size="small" text @click="copyRoomId">
                <el-icon :size="16"><CopyDocument /></el-icon>
              </el-button>
              <div class="hidden md:flex items-center gap-1 ml-2">
                <span class="text-sm text-gray-500">在线:</span>
                <span class="text-sm text-green-600">{{ onlineUsers.length }} 人</span>
              </div>
            </div>
          </div>
          <!-- 第二行：操作按钮 -->
          <div class="flex items-center justify-between">
            <div class="md:hidden flex items-center gap-1">
              <span class="text-sm text-gray-500">在线: {{ onlineUsers.length }} 人</span>
            </div>
            <div class="flex items-center gap-1 ml-auto">
              <el-button size="small" @click="toggleQrcode">
                二维码
              </el-button>
              <el-button size="small" @click="copyRoomLink">
                复制链接
              </el-button>
              <el-button type="danger" size="small" @click="leaveRoom">
                离开
              </el-button>
            </div>
          </div>
        </div>

        <!-- 二维码弹窗 -->
        <div v-if="showQrcode" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="toggleQrcode">
          <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4" @click.stop>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold">扫码加入聊天室</h3>
              <el-button text @click="toggleQrcode">
                <el-icon :size="20"><Close /></el-icon>
              </el-button>
            </div>
            <div class="flex flex-col items-center">
              <div class="bg-white p-4 rounded-lg border-2 border-gray-200">
                <QrcodeVue3
                  :value="getRoomLink"
                  :size="200"
                  :margin="2"
                  :level="'M'"
                />
              </div>
              <p class="mt-4 text-sm text-gray-500 mb-2">房间号: <span class="font-mono font-bold">{{ roomId }}</span></p>
              <el-button size="small" @click="copyRoomLink">复制链接分享给好友</el-button>
            </div>
          </div>
        </div>

        <!-- 在线用户列表 -->
        <div class="flex items-center gap-2 pb-2 text-sm text-gray-500 flex-wrap">
          <span class="flex-shrink-0">在线 ({{ onlineUsers.length }}):</span>
          <template v-if="onlineUsers.length > 5 && !showAllOnlineUsers">
            <span v-for="user in onlineUsers.slice(0, 5)" :key="user" class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs whitespace-nowrap">
              {{ user }}
            </span>
            <span class="text-xs text-blue-500 cursor-pointer hover:underline" @click="showAllOnlineUsers = true">
              还有 {{ onlineUsers.length - 5 }} 人...
            </span>
          </template>
          <template v-else>
            <span v-for="user in onlineUsers" :key="user" class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs whitespace-nowrap">
              {{ user }}
            </span>
            <span v-if="onlineUsers.length > 5" class="text-xs text-blue-500 cursor-pointer hover:underline" @click="showAllOnlineUsers = false">
              收起
            </span>
          </template>
        </div>

        <!-- 消息列表 -->
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto space-y-3 pr-2 bg-gray-50 rounded-lg p-4"
          style="min-height: 350px; max-height: 55vh;"
        >
          <div v-if="messages.length === 0" class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
              <div class="text-4xl mb-2">🎉</div>
              <p>聊天室已创建，分享房间号或二维码邀请好友加入吧！</p>
            </div>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex group"
            :class="msg.isSelf ? 'justify-end' : 'justify-start'"
          >
            <!-- 普通消息 -->
            <div class="max-w-[90%] md:max-w-[80%]">
              <div class="flex items-end gap-2" :class="msg.isSelf ? 'flex-row-reverse' : ''">
                <!-- 头像 -->
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                  :class="msg.isSelf ? 'bg-blue-500' : 'bg-green-500'"
                >
                  {{ msg.nickname.charAt(0) }}
                </div>

                <!-- 消息内容 -->
                <div class="relative">
                  <div class="text-xs text-gray-400 mb-1" :class="msg.isSelf ? 'text-right' : ''">
                    {{ msg.nickname }} · {{ formatTime(msg.timestamp) }}
                  </div>
                  <div
                    class="px-4 py-2 rounded-2xl shadow-sm whitespace-pre-wrap break-words overflow-wrap-break-word cursor-pointer"
                    :class="msg.isSelf ? 'bg-blue-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md'"
                    @click="copyMessage(msg.content)"
                  >
                    {{ msg.content }}
                  </div>
                  <!-- 复制按钮 -->
                  <div
                    class="absolute left-1/2 -translate-x-1/2 -bottom-9 opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:block hidden z-10"
                    @click.stop="copyMessage(msg.content)"
                  >
                    <div class="bg-gray-800 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg cursor-pointer hover:bg-gray-700 whitespace-nowrap">
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                      <span>复制</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="pt-3 border-t border-gray-200 mt-3">
          <div class="flex gap-2 items-end">
            <el-input
              v-model="inputMessage"
              type="textarea"
              :rows="1"
              :autosize="{ minRows: 1, maxRows: 5 }"
              placeholder="输入消息..."
              maxlength="500"
              show-word-limit
              @keydown="handleKeydown"
              class="flex-1"
            />
            <el-button type="primary" @click="sendMessage" :disabled="!inputMessage.trim()" :loading="isSending">
              发送
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 功能说明 -->
    <ToolDetail title="功能说明" class="mt-4">
      <el-text>
        临时聊天室，基于 Supabase Realtime 实现实时通信。
        <br>• <strong>无需注册</strong>：输入昵称即可加入
        <br>• <strong>临时房间</strong>：房间号可自定义或随机生成
        <br>• <strong>扫码加入</strong>：生成二维码，扫码即可加入
        <br>• <strong>链接分享</strong>：复制链接分享给好友
        <br>• <strong>口令进入</strong>：分享房间号即可
        <br>• <strong>实时同步</strong>：消息实时同步到所有在线用户
        <br><br>
        <strong>使用方法：</strong>
        <br>1. 创建或输入房间号
        <br>2. 设置你的昵称
        <br>3. 点击加入聊天室
        <br>4. 通过二维码/链接/房间号邀请好友
        <br>5. 开始聊天！
        <br><br>
        <strong>实现原理：</strong>
        <br>• 使用 <strong>Supabase Realtime</strong> 实现 WebSocket 实时通信，消息秒级同步
        <br>• 消息存储在云端数据库，支持历史消息加载（最近1小时）
        <br>• 通过 Presence 功能追踪在线用户状态
        <br>• 房间通过唯一标识符区分，只有相同房间号的用户才能互相通信
        <br>• 前端采用 Vue3 响应式设计，界面自适应各种屏幕尺寸
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.text-primary {
  color: #409eff;
}

/* 消息换行样式 */
.overflow-wrap-break-word {
  overflow-wrap: break-word;
  word-break: break-word;
}
</style>
