<template>
  <div class="flex gap-4 h-[600px]">
    <!-- 左侧：会话列表 -->
    <ChatSessionList
      :sessions="sessions"
      :currentSessionId="currentSessionId"
      :modelValue="localChatModel"
      :isChatting="isChatting"
      @update:modelValue="localChatModel = $event"
      @create-session="$emit('new-session')"
      @select-session="$emit('select-session', $event)"
      @delete-session="$emit('delete-session', $event)"
    />

    <!-- 右侧：消息区 -->
    <ChatMessageArea
      :currentSession="currentSession"
      :inputValue="localChatInput"
      :isChatting="isChatting"
      @update:inputValue="localChatInput = $event"
      @send="$emit('send-message')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import ChatSessionList from './ChatSessionList.vue'
import ChatMessageArea from './ChatMessageArea.vue'

interface Session {
  id: string
  title: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

interface Props {
  sessions: Session[]
  currentSessionId: string | null
  currentSession: Session | undefined
  chatModel: string
  chatInput: string
  isChatting: boolean
  chatContainerRef: HTMLDivElement | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:chatModel': [value: string]
  'update:chatInput': [value: string]
  'new-session': []
  'select-session': [id: string]
  'delete-session': [id: string]
  'send-message': []
}>()

const localChatModel = ref(props.chatModel)
const localChatInput = ref(props.chatInput)

watch(() => props.chatModel, (val) => localChatModel.value = val)
watch(() => props.chatInput, (val) => localChatInput.value = val)

watch(localChatModel, (val) => emit('update:chatModel', val))
watch(localChatInput, (val) => emit('update:chatInput', val))
</script>
