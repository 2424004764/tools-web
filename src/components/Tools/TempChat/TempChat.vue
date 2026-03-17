<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted, nextTick, computed } from "vue";
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
  revoked?: boolean;
  replyTo?: {
    id: string;
    nickname: string;
    content: string;
  };
}>>([]);
const inputMessage = ref("");
const messagesContainer = ref<HTMLElement | null>(null);
const onlineUsers = ref<string[]>([]);
const isConnecting = ref(false);
const isSending = ref(false);
const isConnected = ref(false);
const showQrcode = ref(false);
const showAllOnlineUsers = ref(false);
const showEmojiPicker = ref(false);
const recentEmojis = ref<string[]>([]);
const hasNewMessages = ref(false);
const emojiPickerRef = ref<HTMLElement | null>(null);
const showNicknameDialog = ref(false);
const editingNickname = ref("");

// 历史昵称列表（用于判断 isSelf）
const myNicknames = ref<string[]>([]);

// 发送频率限制
const lastSendTime = ref(0);
const SEND_COOLDOWN = 1000; // 1秒冷却时间

// 消息撤回
const showRevokeDialog = ref(false);
const revokingMessageId = ref<string>('');
const REVOKE_TIME_LIMIT = 120000; // 2分钟内可撤回

// 正在输入提示
const typingUsers = ref<string[]>([]);
const typingTimeout = ref<any>(null);
const lastTypingTime = ref(0);
const isTyping = ref(false);

// 消息搜索
const showSearchDialog = ref(false);
const searchKeyword = ref('');
const searchResults = ref<Array<{
  id: string;
  nickname: string;
  content: string;
  timestamp: number;
  replyTo?: {
    id: string;
    nickname: string;
    content: string;
  };
}>>([]);
const currentSearchIndex = ref(0);

// 消息分页
const currentOffset = ref(0);
const PAGE_SIZE = 50;
const hasMoreMessages = ref(false);
const isLoadingMore = ref(false);

// 消息音效
const messageSoundEnabled = ref(true);
const audioContext = ref<AudioContext | null>(null);

// 表情分类
const emojiCategories = [
  { name: '笑脸', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'] },
  { name: '爱心', emojis: ['😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏'] },
  { name: '手势', emojis: ['👋', '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦵', '🦶', '👂', '👃', '🧠'] },
  { name: '动物', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'] },
  { name: '食物', emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅'] },
  { name: '活动', emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍'] },
  { name: '物体', emojis: ['⭐', '🌟', '✨', '💫', '🔥', '💥', '💯', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🔔', '🔕', '📢'] },
  { name: '符号', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝'] },
];
const activeEmojiCategory = ref('笑脸');

// 网络重连
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const isReconnecting = ref(false);

// 消息引用
const replyingTo = ref<{
  id: string;
  nickname: string;
  content: string;
} | null>(null);

// 快捷键
const inputHistory = ref<string[]>([]);
const historyIndex = ref(-1);

// Supabase channel 实例
let messageChannel: any = null;
let presenceChannel: any = null;
let heartbeatInterval: any = null;

// 当前用户的唯一ID
const currentUserId = ref(`user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);

// 保存昵称到本地存储
const saveNickname = (nick: string) => {
  // 获取当前存储的历史昵称
  const saved = localStorage.getItem('tempchat-mynicknames');
  let nicknames: string[] = [];
  if (saved) {
    try {
      nicknames = JSON.parse(saved);
    } catch {
      nicknames = [];
    }
  }

  // 添加新昵称（如果不存在）
  if (!nicknames.includes(nick)) {
    nicknames.push(nick);
    // 最多保留20个历史昵称
    if (nicknames.length > 20) {
      nicknames = nicknames.slice(-20);
    }
    localStorage.setItem('tempchat-mynicknames', JSON.stringify(nicknames));
  }

  myNicknames.value = nicknames;

  // 保存当前昵称
  localStorage.setItem('tempchat-current-nickname', nick);
};

// 加载保存的昵称
const loadSavedNickname = () => {
  const current = localStorage.getItem('tempchat-current-nickname');
  const saved = localStorage.getItem('tempchat-mynicknames');

  if (saved) {
    try {
      myNicknames.value = JSON.parse(saved);
    } catch {
      myNicknames.value = [];
    }
  }

  // 如果有保存的当前昵称，使用它
  if (current) {
    nickname.value = current;
    return true;
  }

  return false;
};

// 判断消息是否是自己发送的
const isMyMessage = (msgNickname: string) => {
  return myNicknames.value.includes(msgNickname);
};

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
    ElMessage.error("Supabase 未配置，请联系管理员配置服务");
    return false;
  }

  try {
    // 添加超时保护
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('连接超时')), 10000)
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

    // 根据错误类型显示不同的提示
    let errorMsg = "连接服务器失败";
    if (error.message === '连接超时') {
      errorMsg = "连接超时，请检查网络连接";
    } else if (error.message?.includes('Failed to fetch')) {
      errorMsg = "网络连接失败，请检查网络";
    } else if (error.code === 'PGRST301') {
      errorMsg = "API密钥错误，请联系管理员";
    }

    ElMessage.error(errorMsg);
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
      ElMessage.error("连接服务器失败，请检查网络或稍后重试");
      return;
    }

    // 保存昵称到本地存储
    saveNickname(nickname.value);

    const normalizedRoomId = roomId.value.toUpperCase();

    // 加载历史消息
    let isNewRoom = false;
    try {
      currentOffset.value = 0;
      const historyData = await chatDb.getMessages(normalizedRoomId, PAGE_SIZE);
      if (!historyData || historyData.length === 0) {
        isNewRoom = true;
        hasMoreMessages.value = false;
      } else {
        hasMoreMessages.value = historyData.length === PAGE_SIZE;
        currentOffset.value = historyData.length;
      }

      messages.value = (historyData || [])
        .map((msg: any) => ({
          id: msg.id,
          nickname: msg.nickname,
          content: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          isSelf: isMyMessage(msg.nickname),
          revoked: msg.revoked || false,
          replyTo: msg.reply_to ? {
            id: msg.reply_to.id,
            nickname: msg.reply_to.nickname,
            content: msg.reply_to.content,
          } : undefined,
        }));

      nextTick(() => scrollToBottom());
    } catch (error: any) {
      // 如果表不存在，标记为新房间
      isNewRoom = true;
      hasMoreMessages.value = false;
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

      const isMyMsg = isMyMessage(newMsg.nickname);
      messages.value.push({
        id: newMsg.id,
        nickname: newMsg.nickname,
        content: newMsg.content,
        timestamp: new Date(newMsg.created_at).getTime(),
        isSelf: isMyMsg,
        revoked: newMsg.revoked || false,
        replyTo: newMsg.reply_to,
      });

      // 播放提示音（不是自己的消息时）
      if (!isMyMsg && !newMsg.revoked) {
        playMessageSound();
      }

      // 如果用户不在底部，显示新消息提示
      if (!isAtBottom()) {
        hasNewMessages.value = true;
      } else {
        nextTick(() => scrollToBottom());
      }
    });

    // 订阅在线用户
    presenceChannel = supabase.channel(`chat-presence-${normalizedRoomId}`);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        updateOnlineUsers();
        updateTypingUsers();
      })
      .on('presence', { event: 'join' }, () => {
        updateOnlineUsers();
        updateTypingUsers();
      })
      .on('presence', { event: 'leave' }, () => {
        updateOnlineUsers();
        updateTypingUsers();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // 追踪当前用户
          presenceChannel.track({
            user_id: currentUserId.value,
            nickname: nickname.value,
            online_at: new Date().toISOString(),
            typing: false,
          });
          updateOnlineUsers();
        } else if (status === 'CHANNEL_ERROR') {
          handleDisconnect();
        }
      });

    // 心跳更新在线状态（改为20秒）
    heartbeatInterval = setInterval(() => {
      if (presenceChannel) {
        presenceChannel.track({
          user_id: currentUserId.value,
          nickname: nickname.value,
          online_at: new Date().toISOString(),
          typing: false,
        });
      }
    }, 20000);

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

// 更新正在输入的用户列表
const updateTypingUsers = () => {
  if (!presenceChannel) return;

  const state = presenceChannel.presenceState();
  const typing: string[] = [];

  if (state) {
    Object.keys(state).forEach((key: string) => {
      const presences = state[key] as any[];
      presences.forEach((presence: any) => {
        // 排除自己
        if (presence.typing && presence.user_id !== currentUserId.value) {
          if (presence.nickname && !typing.includes(presence.nickname)) {
            typing.push(presence.nickname);
          }
        }
      });
    });
  }

  typingUsers.value = typing;
};

// 发送消息
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isSending.value) return;

  // 频率限制
  const now = Date.now();
  if (now - lastSendTime.value < SEND_COOLDOWN) {
    ElMessage.warning("发送太频繁，请稍后再试");
    return;
  }

  const content = inputMessage.value.trim();

  // 保存到输入历史
  inputHistory.value.push(content);
  if (inputHistory.value.length > 50) {
    inputHistory.value = inputHistory.value.slice(-50);
  }
  historyIndex.value = -1;

  isSending.value = true;
  lastSendTime.value = now;

  const messageData = {
    content: content,
    reply_to: replyingTo.value ? {
      id: replyingTo.value.id,
      nickname: replyingTo.value.nickname,
      content: replyingTo.value.content,
    } : undefined,
  };

  try {
    await chatDb.sendMessage(roomId.value, nickname.value, messageData.content, messageData.reply_to);
    inputMessage.value = "";
    cancelReply(); // 清除回复状态
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

  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
    typingTimeout.value = null;
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
  typingUsers.value = [];
  isJoined.value = false;
  hasNewMessages.value = false;
  replyingTo.value = null;
  searchResults.value = [];
  currentOffset.value = 0;
  hasMoreMessages.value = false;
  inputHistory.value = [];
  historyIndex.value = -1;

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

// 检查是否在底部
const isAtBottom = () => {
  if (!messagesContainer.value) return true;
  const container = messagesContainer.value;
  const threshold = 100; // 允许100px的误差
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
};

// 滚动到底部并清除新消息提示
const scrollToBottomAndClear = () => {
  hasNewMessages.value = false;
  scrollToBottom();
};

// 检查滚动位置
const handleScroll = () => {
  if (isAtBottom()) {
    hasNewMessages.value = false;
  }

  // 检测滚动到顶部，加载更多消息
  handleScrollTop();
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

// 切换消息音效
const toggleMessageSound = () => {
  messageSoundEnabled.value = !messageSoundEnabled.value;
  localStorage.setItem('tempchat-sound-enabled', JSON.stringify(messageSoundEnabled.value));
};

// 全局键盘事件处理
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (showQrcode.value) {
      showQrcode.value = false;
    }
    if (showEmojiPicker.value) {
      showEmojiPicker.value = false;
    }
    if (showNicknameDialog.value) {
      showNicknameDialog.value = false;
    }
  }
};

// 点击外部区域关闭表情面板
const handleClickOutside = (e: MouseEvent) => {
  if (showEmojiPicker.value && emojiPickerRef.value) {
    const target = e.target as Node;
    if (!emojiPickerRef.value.contains(target)) {
      showEmojiPicker.value = false;
    }
  }
};

// ============ 新增功能函数 ============

// 消息撤回功能
const revokeMessage = async (messageId: string) => {
  const msg = messages.value.find(m => m.id === messageId);
  if (!msg) return;

  // 检查是否是自己发送的
  if (!msg.isSelf) {
    ElMessage.warning("只能撤回自己的消息");
    return;
  }

  // 检查时间限制
  const now = Date.now();
  if (now - msg.timestamp > REVOKE_TIME_LIMIT) {
    ElMessage.warning("消息发送超过2分钟，无法撤回");
    return;
  }

  showRevokeDialog.value = true;
  revokingMessageId.value = messageId;
};

const confirmRevoke = async () => {
  if (!revokingMessageId.value) return;

  try {
    await chatDb.revokeMessage(roomId.value, revokingMessageId.value);

    // 更新本地消息状态
    const msg = messages.value.find(m => m.id === revokingMessageId.value);
    if (msg) {
      msg.revoked = true;
      msg.content = '消息已撤回';
    }

    ElMessage.success("消息已撤回");
  } catch (error: any) {
    console.error("撤回消息失败:", error);
    ElMessage.error("撤回失败，请重试");
  } finally {
    showRevokeDialog.value = false;
    revokingMessageId.value = '';
  }
};

// 正在输入功能
const sendTypingIndicator = () => {
  if (!presenceChannel || isJoined.value === false) return;

  const now = Date.now();
  if (now - lastTypingTime.value > 3000) { // 3秒内只发送一次
    presenceChannel.track({
      user_id: currentUserId.value,
      nickname: nickname.value,
      online_at: new Date().toISOString(),
      typing: true,
    });
    lastTypingTime.value = now;
  }

  // 清除之前的定时器
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
  }

  // 5秒后停止"正在输入"状态
  typingTimeout.value = setTimeout(() => {
    isTyping.value = false;
  }, 5000);

  isTyping.value = true;
};

// 监听用户输入，发送正在输入状态
const handleInput = () => {
  if (inputMessage.value.trim()) {
    sendTypingIndicator();
  }
};

// 消息搜索功能
const searchMessages = () => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) {
    searchResults.value = [];
    return;
  }

  searchResults.value = messages.value.filter(msg => {
    const matchesContent = !msg.revoked && msg.content.toLowerCase().includes(keyword);
    const matchesNickname = msg.nickname.toLowerCase().includes(keyword);
    const matchesReplyTo = msg.replyTo && (
      msg.replyTo.nickname.toLowerCase().includes(keyword) ||
      msg.replyTo.content.toLowerCase().includes(keyword)
    );
    return matchesContent || matchesNickname || matchesReplyTo;
  });

  currentSearchIndex.value = 0;

  if (searchResults.value.length > 0) {
    scrollToMessage(searchResults.value[0].id);
    ElMessage.success(`找到 ${searchResults.value.length} 条匹配消息`);
  } else {
    ElMessage.info("未找到匹配消息");
  }
};

const scrollToMessage = (messageId: string) => {
  const element = document.getElementById(`msg-${messageId}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 高亮显示
    element.classList.add('highlight-message');
    setTimeout(() => {
      element.classList.remove('highlight-message');
    }, 2000);
  }
};

const navigateSearchResult = (direction: 'prev' | 'next') => {
  if (searchResults.value.length === 0) return;

  if (direction === 'next') {
    currentSearchIndex.value = (currentSearchIndex.value + 1) % searchResults.value.length;
  } else {
    currentSearchIndex.value = (currentSearchIndex.value - 1 + searchResults.value.length) % searchResults.value.length;
  }

  scrollToMessage(searchResults.value[currentSearchIndex.value].id);
};

// 消息分页加载
const loadMoreMessages = async () => {
  if (isLoadingMore.value || !hasMoreMessages.value) return;

  isLoadingMore.value = true;
  try {
    const moreMessages = await chatDb.getMessages(
      roomId.value,
      PAGE_SIZE,
      currentOffset.value
    );

    if (moreMessages && moreMessages.length > 0) {
      const formatted = moreMessages.map((msg: any) => ({
        id: msg.id,
        nickname: msg.nickname,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        isSelf: isMyMessage(msg.nickname),
        revoked: msg.revoked || false,
        replyTo: msg.reply_to ? {
          id: msg.reply_to.id,
          nickname: msg.reply_to.nickname,
          content: msg.reply_to.content,
        } : undefined,
      }));

      // 插入到开头
      messages.value.unshift(...formatted.reverse());
      currentOffset.value += moreMessages.length;

      // 检查是否还有更多消息
      hasMoreMessages.value = moreMessages.length === PAGE_SIZE;

      // 保持滚动位置
      nextTick(() => {
        if (messagesContainer.value) {
          const oldHeight = messagesContainer.value.scrollHeight;
          requestAnimationFrame(() => {
            if (messagesContainer.value) {
              const newHeight = messagesContainer.value.scrollHeight;
              messagesContainer.value.scrollTop += newHeight - oldHeight;
            }
          });
        }
      });
    } else {
      hasMoreMessages.value = false;
    }
  } catch (error) {
    console.error("加载更多消息失败:", error);
  } finally {
    isLoadingMore.value = false;
  }
};

// 检测滚动到顶部
const handleScrollTop = () => {
  if (!messagesContainer.value) return;

  const container = messagesContainer.value;
  if (container.scrollTop < 50 && hasMoreMessages.value && !isLoadingMore.value) {
    loadMoreMessages();
  }
};

// 消息音效
const initAudioContext = () => {
  try {
    audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch (e) {
    console.warn("AudioContext not supported");
  }
};

const playMessageSound = () => {
  if (!messageSoundEnabled.value || !audioContext.value) return;

  try {
    const oscillator = audioContext.value.createOscillator();
    const gainNode = audioContext.value.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.value.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, audioContext.value.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.value.currentTime + 0.1);

    oscillator.start(audioContext.value.currentTime);
    oscillator.stop(audioContext.value.currentTime + 0.1);
  } catch (e) {
    console.warn("播放提示音失败:", e);
  }
};

// 改进的时间格式化
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  // 1分钟内
  if (diff < 60000) {
    return '刚刚';
  }

  // 1小时内
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }

  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else {
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();
    if (isYesterday) {
      return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
};

// 改进的URL解析
const parseMessageContent = (content: string) => {
  // 匹配 http/https URL（改进版）
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const parts: Array<{ text: string; isLink: boolean; url?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(content)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index), isLink: false });
    }
    // 添加链接
    parts.push({ text: match[1], isLink: true, url: match[1] });
    lastIndex = urlRegex.lastIndex;
  }

  // 添加剩余文本
  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), isLink: false });
  }

  return parts;
};

// 消息引用功能
const replyToMessage = (msg: any) => {
  replyingTo.value = {
    id: msg.id,
    nickname: msg.nickname,
    content: msg.revoked ? '消息已撤回' : msg.content,
  };

  // 聚焦到输入框
  nextTick(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.focus();
    }
  });
};

const cancelReply = () => {
  replyingTo.value = null;
};

// 快捷键支持
const handleKeydown = (e: Event | KeyboardEvent) => {
  if (e instanceof KeyboardEvent) {
    // Ctrl/Cmd + Enter 发送消息
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
      return;
    }

    // 普通回车发送（Shift+Enter 换行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }

    // 上箭头浏览历史
    if (e.key === 'ArrowUp' && !inputMessage.value) {
      e.preventDefault();
      if (historyIndex.value < inputHistory.value.length - 1) {
        historyIndex.value++;
        inputMessage.value = inputHistory.value[inputHistory.value.length - 1 - historyIndex.value];
      }
      return;
    }

    // 下箭头浏览历史
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex.value > 0) {
        historyIndex.value--;
        inputMessage.value = inputHistory.value[inputHistory.value.length - 1 - historyIndex.value];
      } else if (historyIndex.value === 0) {
        historyIndex.value = -1;
        inputMessage.value = '';
      }
      return;
    }

    // Escape 取消回复
    if (e.key === 'Escape' && replyingTo.value) {
      cancelReply();
    }

    // Ctrl+F 或 Cmd+F 打开搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      showSearchDialog.value = true;
      nextTick(() => {
        const input = document.querySelector('.search-input input') as HTMLInputElement;
        if (input) input.focus();
      });
    }
  }
};

// 网络重连
const handleDisconnect = () => {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    isReconnecting.value = true;
    reconnectAttempts++;

    const delay = Math.pow(2, reconnectAttempts) * 1000; // 指数退避

    ElMessage.info(`连接断开，${delay / 1000}秒后重连... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(() => {
      joinRoom().then(() => {
        reconnectAttempts = 0;
        isReconnecting.value = false;
      }).catch(() => {
        handleDisconnect();
      });
    }, delay);
  } else {
    ElMessage.error("连接失败，请刷新页面重试");
    isReconnecting.value = false;
  }
};

// 消息导出
const exportMessages = () => {
  if (messages.value.length === 0) {
    ElMessage.warning("没有可导出的消息");
    return;
  }

  let content = `聊天室: ${roomId.value}\n`;
  content += `导出时间: ${new Date().toLocaleString()}\n`;
  content += `消息数量: ${messages.value.length}\n`;
  content += `${'='.repeat(50)}\n\n`;

  messages.value.forEach(msg => {
    const time = formatTime(msg.timestamp);
    const prefix = msg.isSelf ? '【我】' : `【${msg.nickname}】`;
    const msgContent = msg.revoked ? '消息已撤回' : msg.content;

    // 如果是回复消息
    if (msg.replyTo) {
      content += `[${time}] ${prefix} 回复 @${msg.replyTo.nickname}:\n`;
      content += `  > ${msg.replyTo.content.substring(0, 50)}${msg.replyTo.content.length > 50 ? '...' : ''}\n`;
      content += `  ${msgContent}\n\n`;
    } else {
      content += `[${time}] ${prefix}: ${msgContent}\n\n`;
    }
  });

  // 创建下载
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${roomId.value}-${new Date().getTime()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  ElMessage.success("聊天记录已导出");
};

// 打开昵称修改对话框
const openNicknameDialog = () => {
  editingNickname.value = nickname.value;
  showNicknameDialog.value = true;
};

// 更改昵称
const changeNickname = async () => {
  const newNickname = editingNickname.value.trim();
  if (!newNickname) {
    ElMessage.warning("昵称不能为空");
    return;
  }
  if (newNickname === nickname.value) {
    showNicknameDialog.value = false;
    return;
  }

  const oldNickname = nickname.value;
  nickname.value = newNickname;
  showNicknameDialog.value = false;

  // 保存新昵称
  saveNickname(newNickname);

  // 更新 presence 中的昵称
  if (presenceChannel) {
    presenceChannel.track({
      user_id: currentUserId.value,
      nickname: newNickname,
      online_at: new Date().toISOString(),
    });
  }

  // 发送系统消息通知所有人
  try {
    await chatDb.sendMessage(roomId.value, '系统', `${oldNickname} 更改昵称为 ${newNickname}`);
  } catch (e) {
    // 忽略错误
  }

  ElMessage.success("昵称已更改");
};

// 选择表情
const selectEmoji = (emoji: string) => {
  inputMessage.value += emoji;

  // 添加到最近使用
  const index = recentEmojis.value.indexOf(emoji);
  if (index > -1) {
    recentEmojis.value.splice(index, 1);
  }
  recentEmojis.value.unshift(emoji);

  // 只保留最近16个
  if (recentEmojis.value.length > 16) {
    recentEmojis.value = recentEmojis.value.slice(0, 16);
  }

  // 保存到本地存储
  localStorage.setItem('tempchat-recent-emojis', JSON.stringify(recentEmojis.value));

  // 关闭表情面板
  showEmojiPicker.value = false;
};

// 组件挂载
onMounted(() => {
  // 先尝试加载保存的昵称
  const hasSaved = loadSavedNickname();

  // 如果没有保存的昵称，才生成新的
  if (!hasSaved) {
    generateNickname();
  }

  // 加载最近使用的表情
  const saved = localStorage.getItem('tempchat-recent-emojis');
  if (saved) {
    try {
      recentEmojis.value = JSON.parse(saved);
    } catch {
      recentEmojis.value = [];
    }
  }

  // 加载音效设置
  const soundEnabled = localStorage.getItem('tempchat-sound-enabled');
  if (soundEnabled !== null) {
    messageSoundEnabled.value = JSON.parse(soundEnabled);
  }

  // 初始化音频上下文（用户交互后）
  const initAudio = () => {
    initAudioContext();
    document.removeEventListener('click', initAudio);
  };
  document.addEventListener('click', initAudio);

  // 添加全局事件监听
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('click', handleClickOutside);

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
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('click', handleClickOutside);

  // 关闭音频上下文
  if (audioContext.value) {
    audioContext.value.close();
  }
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
          <!-- 第一行：房间信息和昵称 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-sm text-gray-500 flex-shrink-0">房间:</span>
              <span class="font-mono font-semibold text-primary truncate">{{ roomId }}</span>
              <el-button size="small" text @click="copyRoomId" class="flex-shrink-0">
                <el-icon :size="16"><CopyDocument /></el-icon>
              </el-button>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-sm text-gray-400">{{ nickname }}</span>
              <el-button size="small" text @click="openNicknameDialog" title="修改昵称">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732a2.5 2.5 0 013.536 3.536z"></path>
                </svg>
              </el-button>
            </div>
          </div>
          <!-- 第二行：在线人数和操作按钮 -->
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="hidden md:flex items-center gap-1">
              <span class="text-sm text-gray-500">在线:</span>
              <span class="text-sm text-green-600">{{ onlineUsers.length }} 人</span>
            </div>
            <div class="md:hidden flex items-center gap-1">
              <span class="text-sm text-gray-500">在线: {{ onlineUsers.length }} 人</span>
            </div>
            <div class="flex items-center gap-1 ml-auto flex-wrap">
              <el-button size="small" @click="showSearchDialog = true" title="搜索消息 (Ctrl+F)">
                🔍 搜索
              </el-button>
              <el-button size="small" @click="toggleQrcode">
                二维码
              </el-button>
              <el-button size="small" @click="copyRoomLink">
                复制链接
              </el-button>
              <el-button size="small" @click="exportMessages" title="导出聊天记录">
                📥 导出
              </el-button>
              <el-button
                size="small"
                @click="toggleMessageSound"
                :title="messageSoundEnabled ? '关闭音效' : '开启音效'"
              >
                {{ messageSoundEnabled ? '🔊' : '🔇' }}
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

        <!-- 昵称修改对话框 -->
        <el-dialog
          v-model="showNicknameDialog"
          title="修改昵称"
          width="400px"
          :close-on-click-modal="false"
        >
          <el-input
            v-model="editingNickname"
            placeholder="输入新昵称"
            maxlength="20"
            show-word-limit
            @keyup.enter="changeNickname"
          />
          <template #footer>
            <el-button @click="showNicknameDialog = false">取消</el-button>
            <el-button type="primary" @click="changeNickname" :disabled="!editingNickname.trim()">
              确定
            </el-button>
          </template>
        </el-dialog>

        <!-- 消息搜索对话框 -->
        <el-dialog
          v-model="showSearchDialog"
          title="搜索消息"
          width="500px"
        >
          <div class="space-y-4">
            <el-input
              v-model="searchKeyword"
              placeholder="输入关键词搜索..."
              class="search-input"
              @keyup.enter="searchMessages"
            >
              <template #append>
                <el-button @click="searchMessages" :disabled="!searchKeyword.trim()">
                  搜索
                </el-button>
              </template>
            </el-input>

            <div v-if="searchResults.length > 0" class="space-y-2">
              <div class="text-sm text-gray-500 flex items-center justify-between">
                <span>找到 {{ searchResults.length }} 条结果</span>
                <div class="flex gap-1">
                  <el-button size="small" @click="navigateSearchResult('prev')" :disabled="searchResults.length <= 1">
                    上一条
                  </el-button>
                  <el-button size="small" @click="navigateSearchResult('next')" :disabled="searchResults.length <= 1">
                    下一条
                  </el-button>
                </div>
              </div>
              <div class="text-xs text-gray-400">
                当前: {{ currentSearchIndex + 1 }} / {{ searchResults.length }}
              </div>
            </div>
          </div>
        </el-dialog>

        <!-- 消息撤回确认对话框 -->
        <el-dialog
          v-model="showRevokeDialog"
          title="撤回消息"
          width="400px"
        >
          <p class="text-gray-600">确定要撤回这条消息吗？撤回后无法恢复。</p>
          <template #footer>
            <el-button @click="showRevokeDialog = false">取消</el-button>
            <el-button type="danger" @click="confirmRevoke">
              确定撤回
            </el-button>
          </template>
        </el-dialog>

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
          class="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-2 bg-gray-50 rounded-lg p-4 relative"
          style="min-height: 350px; max-height: 55vh;"
          @scroll="handleScroll"
        >
          <!-- 加载更多提示 -->
          <div v-if="hasMoreMessages" class="text-center py-2">
            <el-button size="small" text @click="loadMoreMessages" :loading="isLoadingMore">
              {{ isLoadingMore ? '加载中...' : '加载更多消息' }}
            </el-button>
          </div>

          <div v-if="messages.length === 0" class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
              <div class="text-4xl mb-2">🎉</div>
              <p>聊天室已创建，分享房间号或二维码邀请好友加入吧！</p>
            </div>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            :id="`msg-${msg.id}`"
            class="flex group"
            :class="msg.isSelf ? 'justify-end' : 'justify-start'"
          >
            <!-- 普通消息 -->
            <div class="max-w-[90%] md:max-w-[80%]">
              <div class="flex items-end gap-2" :class="msg.isSelf ? 'flex-row-reverse' : ''">
                <!-- 头像 -->
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 cursor-pointer hover:opacity-80"
                  :class="msg.isSelf ? 'bg-blue-500' : 'bg-green-500'"
                  @click="replyToMessage(msg)"
                  title="点击回复"
                >
                  {{ msg.nickname.charAt(0) }}
                </div>

                <!-- 消息内容 -->
                <div class="relative">
                  <div class="text-xs text-gray-400 mb-1" :class="msg.isSelf ? 'text-right' : ''">
                    {{ msg.nickname }} · {{ formatTime(msg.timestamp) }}
                  </div>

                  <!-- 引用内容 -->
                  <div v-if="msg.replyTo" class="mb-1 pl-2 border-l-2 border-gray-300">
                    <div class="text-xs text-gray-500">@{{ msg.replyTo.nickname }}</div>
                    <div class="text-sm text-gray-600 truncate max-w-xs">{{ msg.replyTo.content }}</div>
                  </div>

                  <div
                    class="px-4 py-2 rounded-2xl shadow-sm overflow-hidden break-words"
                    :class="[
                      msg.isSelf ? 'bg-blue-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md',
                      msg.revoked ? 'italic text-gray-400' : ''
                    ]"
                    style="white-space: pre-wrap; word-break: break-word;"
                  >
                    <!-- 解析 URL 并渲染链接 -->
                    <template v-if="!msg.revoked" v-for="(part, idx) in parseMessageContent(msg.content)" :key="idx">
                      <a
                        v-if="part.isLink"
                        :href="part.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-500 hover:underline break-all inline"
                        :class="msg.isSelf ? 'text-white hover:text-blue-100' : ''"
                        @click.stop
                      >
                        {{ part.text }}
                      </a>
                      <span v-else class="break-words inline">{{ part.text }}</span>
                    </template>
                    <template v-else>
                      {{ msg.content }}
                    </template>
                  </div>

                  <!-- 操作按钮 (桌面端) -->
                  <div class="absolute left-1/2 -translate-x-1/2 -bottom-9 opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:flex hidden z-10 gap-1">
                    <div
                      v-if="msg.isSelf && !msg.revoked && Date.now() - msg.timestamp < REVOKE_TIME_LIMIT"
                      @click.stop="revokeMessage(msg.id)"
                      class="bg-gray-800 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                      title="撤回消息 (2分钟内)"
                    >
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                      </svg>
                      <span>撤回</span>
                    </div>
                    <div
                      @click.stop="copyMessage(msg.content)"
                      class="bg-gray-800 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                    >
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                      <span>复制</span>
                    </div>
                    <div
                      @click.stop="replyToMessage(msg)"
                      class="bg-gray-800 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                    >
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                      </svg>
                      <span>回复</span>
                    </div>
                  </div>

                  <!-- 移动端长按菜单 -->
                  <div
                    v-if="false"
                    class="md:hidden absolute left-1/2 -translate-x-1/2 -bottom-9 bg-gray-800 text-white text-xs px-3 py-1 rounded-full shadow-lg whitespace-nowrap"
                  >
                    长按查看操作
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 新消息提示按钮 -->
        <transition name="fade">
          <div
            v-if="hasNewMessages"
            @click="scrollToBottomAndClear"
            class="absolute bottom-24 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-600 transition-colors z-10 flex items-center gap-2"
          >
            <span>有新消息</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
            </svg>
          </div>
        </transition>

        <!-- 输入区域 -->
        <div class="pt-3 border-t border-gray-200 mt-3 relative" ref="emojiPickerRef">
          <!-- 表情选择器 -->
          <div v-if="showEmojiPicker" class="mb-3 p-3 bg-white border border-gray-200 rounded-lg shadow-lg" @click.stop>
            <!-- 分类标签 -->
            <div class="flex gap-1 mb-2 overflow-x-auto pb-1">
              <button
                v-for="cat in emojiCategories"
                :key="cat.name"
                @click="activeEmojiCategory = cat.name"
                :class="[
                  'px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
                  activeEmojiCategory === cat.name
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                ]"
              >
                {{ cat.name }}
              </button>
            </div>

            <!-- 最近使用 -->
            <div v-if="recentEmojis.length > 0 && activeEmojiCategory === '笑脸'" class="mb-3">
              <div class="text-xs text-gray-400 mb-2">最近使用</div>
              <div class="grid grid-cols-8 gap-1">
                <button
                  v-for="emoji in recentEmojis"
                  :key="'recent-' + emoji"
                  @click="selectEmoji(emoji)"
                  class="text-2xl p-1 hover:bg-gray-100 rounded transition-colors duration-150"
                  :title="emoji"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>

            <!-- 当前分类的表情 -->
            <div class="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
              <button
                v-for="emoji in emojiCategories.find(c => c.name === activeEmojiCategory)?.emojis || []"
                :key="emoji"
                @click="selectEmoji(emoji)"
                class="text-2xl p-1 hover:bg-gray-100 rounded transition-colors duration-150"
                :title="emoji"
              >
                {{ emoji }}
              </button>
            </div>
          </div>

          <!-- 回复提示 -->
          <div v-if="replyingTo" class="mb-2 p-2 bg-blue-50 rounded-lg flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <div class="text-xs text-gray-500">回复 @{{ replyingTo.nickname }}</div>
              <div class="text-sm text-gray-700 truncate">{{ replyingTo.content.substring(0, 50) }}{{ replyingTo.content.length > 50 ? '...' : '' }}</div>
            </div>
            <el-button size="small" text @click="cancelReply" class="ml-2 flex-shrink-0">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>

          <!-- 正在输入提示 -->
          <div v-if="typingUsers.length > 0" class="mb-2 text-sm text-gray-500 flex items-center gap-1">
            <span class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </span>
            {{ typingUsers.join('、') }} 正在输入...
          </div>

          <div class="flex gap-2 items-end">
            <el-button
              @click="showEmojiPicker = !showEmojiPicker"
              :type="showEmojiPicker ? 'primary' : 'default'"
            >
              {{ showEmojiPicker ? '收起' : '😊' }}
            </el-button>
            <el-input
              v-model="inputMessage"
              type="textarea"
              :rows="1"
              :autosize="{ minRows: 1, maxRows: 5 }"
              placeholder="输入消息..."
              maxlength="2000"
              show-word-limit
              @keydown="handleKeydown"
              @input="handleInput"
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
        <el-text type="danger">
          ⚠️ <strong>重要提示：</strong>本功能使用 Supabase 免费版提供服务，受存储额度限制，系统会自动清理一个月之前的消息。如存储空间告急，将优先清理最早的消息以保证服务正常运行。
        </el-text>
        <br><br>
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
        <strong>快捷键：</strong>
        <br>• <strong>Enter</strong>：发送消息
        <br>• <strong>Shift + Enter</strong>：换行
        <br>• <strong>Ctrl + F</strong>：搜索消息
        <br>• <strong>↑ / ↓</strong>：浏览输入历史
        <br><br>
        <strong>实现原理：</strong>
        <br>• 使用 <strong>Supabase Realtime</strong> 实现 WebSocket 实时通信，消息秒级同步
        <br>• 消息存储在云端数据库，支持历史消息加载
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
.break-words {
  overflow-wrap: break-word;
  word-break: break-word;
  word-wrap: break-word;
}

.break-all {
  word-break: break-all;
}

.inline {
  display: inline;
}

/* 表情选择器滚动条样式 */
.max-h-48::-webkit-scrollbar {
  width: 6px;
}

.max-h-48::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.max-h-48::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.max-h-48::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 移动端隐藏滚动条 */
@media (max-width: 768px) {
  .max-h-48::-webkit-scrollbar {
    display: none;
  }
  .max-h-48 {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 消息高亮样式 */
.highlight-message {
  animation: highlight-pulse 2s ease-in-out;
}

@keyframes highlight-pulse {
  0% {
    background-color: rgba(255, 255, 0, 0.3);
  }
  100% {
    background-color: transparent;
  }
}

/* 正在输入动画 */
.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background-color: #9ca3af;
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .group:hover .group-hover\:opacity-100 {
    opacity: 0;
  }

  .message-actions-mobile {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #e5e7eb;
    padding: 12px;
    display: flex;
    justify-content: space-around;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    z-index: 50;
  }
}
</style>
