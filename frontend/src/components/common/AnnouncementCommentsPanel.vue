<template>
  <div v-if="announcement.comments_enabled" class="border-t border-gray-100 pt-6 dark:border-dark-700">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">
        {{ t('announcements.comments.title') }}
      </h3>
      <button
        @click="loadComments"
        :disabled="commentsLoading"
        class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-dark-700 dark:hover:text-gray-200"
        :title="t('common.refresh')"
      >
        <Icon name="refresh" size="sm" :class="commentsLoading ? 'animate-spin' : ''" />
      </button>
    </div>

    <div v-if="commentsLoading" class="flex items-center justify-center py-8">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-dark-600 dark:border-t-blue-400"></div>
    </div>

    <div
      v-else-if="commentRows.length === 0"
      class="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-dark-700 dark:text-gray-400"
    >
      {{ t('announcements.comments.empty') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="row in commentRows"
        :key="row.comment.id"
        class="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-dark-700 dark:bg-dark-900/50"
        :style="{ marginLeft: `${Math.min(row.depth, 3) * 1.25}rem` }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="truncate text-sm font-medium text-gray-900 dark:text-white">
                {{ commentAuthorLabel(row.comment) }}
              </span>
              <span
                :class="[
                  'rounded px-1.5 py-0.5 text-[11px] font-medium',
                  row.comment.author_role === 'admin'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-200 text-gray-600 dark:bg-dark-700 dark:text-gray-300'
                ]"
              >
                {{ row.comment.author_role === 'admin' ? t('announcements.comments.admin') : t('announcements.comments.user') }}
              </span>
              <time class="text-xs text-gray-400 dark:text-gray-500">
                {{ formatRelativeWithDateTime(row.comment.created_at) }}
              </time>
            </div>
            <p class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-300">
              {{ row.comment.content }}
            </p>
          </div>
          <div class="flex flex-shrink-0 items-center gap-1">
            <button
              @click="startReply(row.comment)"
              class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-blue-600 dark:text-gray-400 dark:hover:bg-dark-800 dark:hover:text-blue-300"
              :title="t('announcements.comments.reply')"
            >
              <Icon name="chat" size="sm" />
            </button>
            <button
              v-if="row.comment.can_delete"
              @click="deleteAnnouncementComment(row.comment)"
              :disabled="deletingCommentId === row.comment.id"
              class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-dark-800 dark:hover:text-red-300"
              :title="t('common.delete')"
            >
              <Icon name="trash" size="sm" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <form class="mt-4 space-y-3" @submit.prevent="submitComment">
      <div
        v-if="replyTo"
        class="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
      >
        <span>{{ t('announcements.comments.replyingTo', { name: commentAuthorLabel(replyTo) }) }}</span>
        <button type="button" class="font-medium hover:underline" @click="cancelReply">
          {{ t('common.cancel') }}
        </button>
      </div>
      <textarea
        v-model="commentContent"
        rows="3"
        class="input resize-none"
        :placeholder="t('announcements.comments.placeholder')"
      ></textarea>
      <div class="flex justify-end">
        <button
          type="submit"
          class="btn btn-primary btn-sm"
          :disabled="commentSubmitting || !commentContent.trim()"
        >
          <Icon v-if="commentSubmitting" name="refresh" size="sm" class="animate-spin" />
          <Icon v-else name="chat" size="sm" />
          <span>{{ commentSubmitting ? t('announcements.comments.sending') : t('announcements.comments.send') }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import announcementsAPI from '@/api/announcements'
import adminAnnouncementsAPI from '@/api/admin/announcements'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatRelativeWithDateTime } from '@/utils/format'
import type { AnnouncementComment, UserAnnouncement } from '@/types'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{
  announcement: UserAnnouncement
}>()

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

const comments = ref<AnnouncementComment[]>([])
const commentsLoading = ref(false)
const commentSubmitting = ref(false)
const deletingCommentId = ref<number | null>(null)
const commentContent = ref('')
const replyTo = ref<AnnouncementComment | null>(null)

const activeAnnouncementAPI = computed(() => {
  return authStore.isAdmin ? adminAnnouncementsAPI : announcementsAPI
})

const commentRows = computed(() => {
  const byParent = new Map<number | null, AnnouncementComment[]>()
  for (const comment of comments.value) {
    const key = comment.parent_id ?? null
    const list = byParent.get(key) ?? []
    list.push(comment)
    byParent.set(key, list)
  }

  const rows: Array<{ comment: AnnouncementComment; depth: number }> = []
  const visited = new Set<number>()
  const append = (parentId: number | null, depth: number) => {
    for (const comment of byParent.get(parentId) ?? []) {
      if (visited.has(comment.id)) continue
      visited.add(comment.id)
      rows.push({ comment, depth })
      append(comment.id, depth + 1)
    }
  }

  append(null, 0)
  for (const comment of comments.value) {
    if (!visited.has(comment.id)) rows.push({ comment, depth: 0 })
  }
  return rows
})

function resetComments() {
  comments.value = []
  commentContent.value = ''
  replyTo.value = null
  commentsLoading.value = false
  commentSubmitting.value = false
  deletingCommentId.value = null
}

function commentAuthorLabel(comment: AnnouncementComment): string {
  return comment.author_name || comment.author_email || `#${comment.user_id}`
}

async function loadComments() {
  if (!props.announcement.comments_enabled) return
  const announcementId = props.announcement.id
  commentsLoading.value = true
  try {
    comments.value = await activeAnnouncementAPI.value.listComments(announcementId)
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('announcements.comments.loadFailed')))
  } finally {
    commentsLoading.value = false
  }
}

function startReply(comment: AnnouncementComment) {
  replyTo.value = comment
}

function cancelReply() {
  replyTo.value = null
}

async function submitComment() {
  if (!props.announcement || !commentContent.value.trim() || commentSubmitting.value) return
  commentSubmitting.value = true
  try {
    await activeAnnouncementAPI.value.createComment(props.announcement.id, {
      content: commentContent.value.trim(),
      parent_id: replyTo.value?.id,
    })
    commentContent.value = ''
    replyTo.value = null
    await loadComments()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('announcements.comments.sendFailed')))
  } finally {
    commentSubmitting.value = false
  }
}

async function deleteAnnouncementComment(comment: AnnouncementComment) {
  if (!props.announcement || deletingCommentId.value !== null) return
  deletingCommentId.value = comment.id
  try {
    await activeAnnouncementAPI.value.deleteComment(props.announcement.id, comment.id)
    appStore.showSuccess(t('announcements.comments.deleted'))
    await loadComments()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('announcements.comments.deleteFailed')))
  } finally {
    deletingCommentId.value = null
  }
}

watch(
  () => [props.announcement.id, props.announcement.comments_enabled] as const,
  ([, enabled]) => {
    resetComments()
    if (enabled) void loadComments()
  },
  { immediate: true }
)
</script>
