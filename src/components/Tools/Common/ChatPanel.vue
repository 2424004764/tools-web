<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { ElMessage } from "element-plus";
import { chatDb } from "@/utils/supabase";
import { supabase } from "@/utils/supabase";

// Props
interface Props {
  roomId: string;
  nickname: string;
  myNicknames: string[];
  collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
});

// 状态
const messages = ref<Array<{
  id: string;
  nickname: string;
  content: string;
  timestamp: number;
  isSelf: boolean;
  revoked?: boolean;
  mentioned?: boolean;
}>>([]);

const inputMessage = ref("");
const messagesContainer = ref<HTMLElement | null>(null);
const onlineUsers = ref<string[]>([]);
const isConnected = ref(false);
const showEmojiPicker = ref(false);
const recentEmojis = ref<string[]>([]);

// 发送频率限制
const lastSendTime = ref(0);
const SEND_COOLDOWN = 1000;

// 表情分类
const emojiCategories = [
  { name: '笑脸', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'] },
  { name: '爱心', emojis: ['😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏'] },
  { name: '手势', emojis: ['👋', '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦵', '🦶', '👂', '👃', '🧠'] },
  { name: '动物', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'] },
  { name: '食物', emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅'] },
];

const activeEmojiCategory = ref('笑脸');

// Supabase channel 实例
let messageChannel: any = null;
let presenceChannel: any = null;

// 当前用户的唯一ID
const currentUserId = ref(`user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);

// 判断消息是否是自己发送的
const isMyMessage = (msgNickname: string) => {
  return props.myNicknames.includes(msgNickname);
};

// 初始化聊天
const initChat = async () => {
  if (!props.roomId) return;

  try {
    const normalizedRoomId = props.roomId.toUpperCase();

    // 加载历史消息
    const historyData = await chatDb.getMessages(normalizedRoomId, 50);
    messages.value = (historyData || [])
      .map((msg: any) => {
        const amIMentioned = props.myNicknames.some(myName =>
          msg.content.includes(`@${myName}`) || msg.content.includes(`@${myName} `)
        );
        return {
          id: msg.id,
          nickname: msg.nickname,
          content: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          isSelf: isMyMessage(msg.nickname),
          revoked: msg.revoked || false,
          mentioned: amIMentioned,
        };
      });

    nextTick(() => scrollToBottom());

    // 订阅新消息
    messageChannel = chatDb.subscribeToRoom(normalizedRoomId, (payload: any) => {
      const newMsg = payload.new;
      const exists = messages.value.some(m => m.id === newMsg.id);
      if (exists) return;

      const isMyMsg = isMyMessage(newMsg.nickname);
      const amIMentioned = props.myNicknames.some(myName =>
        newMsg.content.includes(`@${myName}`) || newMsg.content.includes(`@${myName} `)
      );

      messages.value.push({
        id: newMsg.id,
        nickname: newMsg.nickname,
        content: newMsg.content,
        timestamp: new Date(newMsg.created_at).getTime(),
        isSelf: isMyMsg,
        revoked: newMsg.revoked || false,
        mentioned: amIMentioned,
      });

      if (amIMentioned && !isMyMsg) {
        ElMessage.warning(`${newMsg.nickname} 在消息中提到了你！`);
      }

      nextTick(() => scrollToBottom());
    });

    // 订阅在线用户
    presenceChannel = supabase.channel(`chat-presence-${normalizedRoomId}`);

    presenceChannel
      .on('presence', { event: 'sync' }, () => updateOnlineUsers())
      .on('presence', { event: 'join' }, () => updateOnlineUsers())
      .on('presence', { event: 'leave' }, () => updateOnlineUsers())
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          presenceChannel.track({
            user_id: currentUserId.value,
            nickname: props.nickname,
            online_at: new Date().toISOString(),
          });
          updateOnlineUsers();
        }
      });

    isConnected.value = true;
  } catch (error) {
    console.error("初始化聊天失败:", error);
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
  if (!inputMessage.value.trim()) return;

  const now = Date.now();
  if (now - lastSendTime.value < SEND_COOLDOWN) {
    ElMessage.warning("发送太频繁，请稍后再试");
    return;
  }

  const content = inputMessage.value.trim();
  lastSendTime.value = now;

  try {
    await chatDb.sendMessage(props.roomId, props.nickname, content);
    inputMessage.value = "";
  } catch (error: any) {
    console.error("发送消息失败:", error);
    ElMessage.error("发送失败，请重试");
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

// 复制消息
const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    ElMessage.success("消息已复制");
  } catch {
    ElMessage.error("复制失败");
  }
};

// 选择表情
const selectEmoji = (emoji: string) => {
  inputMessage.value += emoji;

  const index = recentEmojis.value.indexOf(emoji);
  if (index > -1) {
    recentEmojis.value.splice(index, 1);
  }
  recentEmojis.value.unshift(emoji);

  if (recentEmojis.value.length > 16) {
    recentEmojis.value = recentEmojis.value.slice(0, 16);
  }

  localStorage.setItem('chatpanel-recent-emojis', JSON.stringify(recentEmojis.value));
};

// 时间格式化
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
};

// 解析消息内容（URL和@提及）
const parseMessageContent = (content: string) => {
  const parts: Array<{ text: string; isLink: boolean; url?: string; isMention?: boolean }> = [];

  const mentionRegex = /@([^\s@]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];

    const beforeText = content.slice(lastIndex, match.index);
    if (beforeText) {
      const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
      let urlLastIndex = 0;
      let urlMatch;
      while ((urlMatch = urlRegex.exec(beforeText)) !== null) {
        if (urlMatch.index > urlLastIndex) {
          parts.push({ text: beforeText.slice(urlLastIndex, urlMatch.index), isLink: false });
        }
        parts.push({ text: urlMatch[1], isLink: true, url: urlMatch[1] });
        urlLastIndex = urlRegex.lastIndex;
      }
      if (urlLastIndex < beforeText.length) {
        parts.push({ text: beforeText.slice(urlLastIndex), isLink: false });
      }
    }

    const isRealUser = onlineUsers.value.includes(username);
    parts.push({ text: match[0], isLink: false, isMention: isRealUser });
    lastIndex = mentionRegex.lastIndex;
  }

  const remainingText = content.slice(lastIndex);
  if (remainingText) {
    const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    let urlLastIndex = 0;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(remainingText)) !== null) {
      if (urlMatch.index > urlLastIndex) {
        parts.push({ text: remainingText.slice(urlLastIndex, urlMatch.index), isLink: false });
      }
      parts.push({ text: urlMatch[1], isLink: true, url: urlMatch[1] });
      urlLastIndex = urlRegex.lastIndex;
    }
    if (urlLastIndex < remainingText.length) {
      parts.push({ text: remainingText.slice(urlLastIndex), isLink: false });
    }
  }

  return parts;
};

// 键盘事件处理
const handleKeydown = (e: Event | KeyboardEvent) => {
  if (e instanceof KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
};

// 清理资源
const cleanup = () => {
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
  isConnected.value = false;
};

// 监听房间变化
watch(() => props.roomId, () => {
  cleanup();
  if (props.roomId) {
    initChat();
  }
});

// 监听昵称变化
watch(() => props.nickname, (newNickname) => {
  if (presenceChannel && newNickname) {
    presenceChannel.track({
      user_id: currentUserId.value,
      nickname: newNickname,
      online_at: new Date().toISOString(),
    });
  }
});

// 组件挂载
onMounted(() => {
  const saved = localStorage.getItem('chatpanel-recent-emojis');
  if (saved) {
    try {
      recentEmojis.value = JSON.parse(saved);
    } catch {
      recentEmojis.value = [];
    }
  }

  if (props.roomId) {
    initChat();
  }
});

// 组件卸载
onUnmounted(() => {
  cleanup();
});
</script>

<template>
  <div class="chat-panel flex flex-col h-full bg-white rounded-lg overflow-hidden">
    <!-- 聊天头部 -->
    <div class="chat-header flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-700">聊天</span>
        <span v-if="onlineUsers.length > 0" class="text-xs text-green-600">({{ onlineUsers.length }}人在线)</span>
      </div>
    </div>

    <!-- 消息列表 -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50"
    >
      <div v-if="messages.length === 0" class="flex items-center justify-center h-full text-gray-400 text-sm">
        <div class="text-center">
          <div class="text-2xl mb-1">💬</div>
          <p>开始聊天吧</p>
        </div>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="flex group"
        :class="msg.isSelf ? 'justify-end' : 'justify-start'"
      >
        <div class="max-w-[85%]">
          <div class="flex items-end gap-2" :class="msg.isSelf ? 'flex-row-reverse' : ''">
            <!-- 头像 -->
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
              :class="msg.isSelf ? 'bg-blue-500' : 'bg-green-500'"
            >
              {{ msg.nickname.charAt(0) }}
            </div>

            <!-- 消息内容 -->
            <div>
              <div class="text-xs text-gray-400 mb-1" :class="msg.isSelf ? 'text-right' : ''">
                {{ msg.nickname }} · {{ formatTime(msg.timestamp) }}
              </div>

              <div
                class="px-3 py-1.5 rounded-lg shadow-sm text-sm break-words"
                :class="[
                  msg.isSelf ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm',
                  msg.revoked ? 'italic text-gray-400' : ''
                ]"
              >
                <template v-if="!msg.revoked" v-for="(part, idx) in parseMessageContent(msg.content)" :key="idx">
                  <a
                    v-if="part.isLink"
                    :href="part.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-400 hover:text-blue-300 underline break-all"
                    @click.stop
                  >
                    {{ part.text }}
                  </a>
                  <span v-else-if="part.isMention" class="mention-highlight">{{ part.text }}</span>
                  <span v-else class="break-words">{{ part.text }}</span>
                </template>
                <template v-else>
                  {{ msg.content }}
                </template>
              </div>

              <!-- 操作按钮 -->
              <div class="opacity-0 group-hover:opacity-100 transition-opacity mt-1" :class="msg.isSelf ? 'text-right' : ''">
                <button
                  @click="copyMessage(msg.content)"
                  class="text-xs text-gray-400 hover:text-gray-600 mr-1"
                  title="复制"
                >
                  复制
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="border-t border-gray-200 p-2 bg-white">
      <!-- 表情选择器 -->
      <div v-if="showEmojiPicker" class="mb-2 p-2 bg-white border border-gray-200 rounded-lg shadow-lg">
        <!-- 分类标签 -->
        <div class="flex gap-1 mb-2 overflow-x-auto pb-1">
          <button
            v-for="cat in emojiCategories"
            :key="cat.name"
            @click="activeEmojiCategory = cat.name"
            :class="[
              'px-2 py-0.5 text-xs rounded-full whitespace-nowrap',
              activeEmojiCategory === cat.name
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            {{ cat.name }}
          </button>
        </div>

        <!-- 最近使用 -->
        <div v-if="recentEmojis.length > 0 && activeEmojiCategory === '笑脸'" class="mb-2">
          <div class="text-xs text-gray-400 mb-1">最近使用</div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="emoji in recentEmojis"
              :key="'recent-' + emoji"
              @click="selectEmoji(emoji)"
              class="text-lg p-1 hover:bg-gray-100 rounded"
            >
              {{ emoji }}
            </button>
          </div>
        </div>

        <!-- 当前分类的表情 -->
        <div class="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          <button
            v-for="emoji in emojiCategories.find(c => c.name === activeEmojiCategory)?.emojis || []"
            :key="emoji"
            @click="selectEmoji(emoji)"
            class="text-lg p-1 hover:bg-gray-100 rounded"
          >
            {{ emoji }}
          </button>
        </div>
      </div>

      <div class="flex gap-2 items-end">
        <el-button
          @click="showEmojiPicker = !showEmojiPicker"
          :type="showEmojiPicker ? 'primary' : 'default'"
          size="small"
        >
          {{ showEmojiPicker ? '收' : '😊' }}
        </el-button>
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="1"
          :autosize="{ minRows: 1, maxRows: 3 }"
          placeholder="输入消息..."
          maxlength="500"
          @keydown="handleKeydown"
          class="flex-1"
          size="small"
        />
        <el-button type="primary" @click="sendMessage" :disabled="!inputMessage.trim()" size="small">
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  min-height: 300px;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.break-words {
  overflow-wrap: break-word;
  word-break: break-word;
  word-wrap: break-word;
}

:deep(.mention-highlight) {
  color: #3b82f6;
  font-weight: 500;
  background-color: rgba(59, 130, 246, 0.1);
  padding: 1px 3px;
  border-radius: 3px;
}
</style>
