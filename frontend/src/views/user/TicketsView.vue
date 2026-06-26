<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <Select
            v-model="filters.status"
            class="w-40"
            :options="statusFilterOptions"
            @change="handleStatusChange"
          />
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-secondary" :disabled="loading" :title="t('common.refresh')" @click="loadTickets">
            <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
          </button>
          <button class="btn btn-primary" @click="openCreateDialog">
            <Icon name="plus" size="md" />
            <span>{{ t('tickets.create') }}</span>
          </button>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="card overflow-hidden">
          <DataTable
            :columns="columns"
            :data="tickets"
            :loading="loading"
            :server-side-sort="true"
            default-sort-key="last_reply_at"
            default-sort-order="desc"
            @sort="handleSort"
          >
            <template #cell-title="{ row }">
              <button class="block min-w-0 text-left" @click="openDetail(row.id)">
                <span class="block truncate font-medium text-gray-900 dark:text-white">{{ row.title }}</span>
                <span class="mt-1 block text-xs text-gray-500 dark:text-dark-400">
                  #{{ row.id }} · {{ formatDateTime(row.created_at) }}
                </span>
              </button>
            </template>

            <template #cell-status="{ value }">
              <span :class="['badge', value === 'open' ? 'badge-success' : 'badge-gray']">
                {{ statusLabel(value) }}
              </span>
            </template>

            <template #cell-last_reply_at="{ row }">
              <span class="text-sm text-gray-500 dark:text-dark-400">
                {{ formatDateTime(row.last_reply_at || row.updated_at) }}
              </span>
            </template>

            <template #cell-actions="{ row }">
              <div class="flex items-center gap-1">
                <button
                  class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-dark-700 dark:hover:text-gray-200"
                  :title="t('tickets.view')"
                  @click="openDetail(row.id)"
                >
                  <Icon name="eye" size="sm" />
                </button>
                <button
                  v-if="row.status === 'open'"
                  class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                  :title="t('tickets.close')"
                  @click="askCloseTicket(row)"
                >
                  <Icon name="xCircle" size="sm" />
                </button>
              </div>
            </template>
          </DataTable>
        </div>

        <div class="card flex min-h-[520px] flex-col overflow-hidden">
          <div class="border-b border-gray-100 px-5 py-4 dark:border-dark-700">
            <div v-if="selectedDetail" class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">
                  {{ selectedDetail.ticket.title }}
                </h2>
                <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">
                  #{{ selectedDetail.ticket.id }} · {{ statusLabel(selectedDetail.ticket.status) }}
                </p>
              </div>
              <button
                v-if="selectedDetail.ticket.status === 'open'"
                class="btn btn-secondary btn-sm text-red-600 dark:text-red-400"
                @click="askCloseTicket(selectedDetail.ticket)"
              >
                {{ t('tickets.close') }}
              </button>
            </div>
            <div v-else>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('tickets.detailTitle') }}</h2>
              <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('tickets.selectHint') }}</p>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-5">
            <div v-if="detailLoading" class="flex h-full items-center justify-center">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600 dark:border-dark-700 dark:border-t-primary-400"></div>
            </div>
            <div v-else-if="selectedDetail" class="space-y-3">
              <div
                v-for="message in selectedDetail.messages"
                :key="message.id"
                :class="[
                  'rounded-lg border p-3',
                  message.sender_role === 'admin'
                    ? 'border-blue-100 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20'
                    : 'border-gray-100 bg-gray-50 dark:border-dark-700 dark:bg-dark-900/50'
                ]"
              >
                <div class="mb-2 flex items-center justify-between gap-2">
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {{ senderLabel(message.sender_role) }}
                  </span>
                  <time class="text-xs text-gray-400 dark:text-dark-400">{{ formatDateTime(message.created_at) }}</time>
                </div>
                <p class="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 dark:text-gray-200">
                  {{ message.content }}
                </p>
              </div>
            </div>
            <div v-else class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-dark-400">
              {{ t('tickets.emptyDetail') }}
            </div>
          </div>

          <form
            v-if="selectedDetail?.ticket.status === 'open'"
            class="border-t border-gray-100 p-4 dark:border-dark-700"
            @submit.prevent="sendReply"
          >
            <textarea
              v-model="replyContent"
              rows="3"
              class="input resize-none"
              :placeholder="t('tickets.replyPlaceholder')"
            ></textarea>
            <div class="mt-3 flex justify-end">
              <button class="btn btn-primary btn-sm" type="submit" :disabled="replying || !replyContent.trim()">
                <Icon v-if="replying" name="refresh" size="sm" class="animate-spin" />
                <Icon v-else name="chat" size="sm" />
                <span>{{ replying ? t('tickets.sending') : t('tickets.sendReply') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <Pagination
        v-if="pagination.total > 0"
        :page="pagination.page"
        :total="pagination.total"
        :page-size="pagination.page_size"
        @update:page="handlePageChange"
        @update:pageSize="handlePageSizeChange"
      />
    </div>

    <BaseDialog
      :show="showCreateDialog"
      :title="t('tickets.create')"
      width="normal"
      @close="closeCreateDialog"
    >
      <form id="ticket-create-form" class="space-y-4" @submit.prevent="createTicket">
        <div>
          <label class="input-label">{{ t('tickets.form.title') }}</label>
          <input v-model="createForm.title" class="input" maxlength="200" required />
        </div>
        <div>
          <label class="input-label">{{ t('tickets.form.content') }}</label>
          <textarea v-model="createForm.content" class="input resize-none" rows="6" required></textarea>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="btn btn-secondary" @click="closeCreateDialog">{{ t('common.cancel') }}</button>
          <button type="submit" form="ticket-create-form" class="btn btn-primary" :disabled="creating">
            {{ creating ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </template>
    </BaseDialog>

    <ConfirmDialog
      :show="closeDialog.show"
      :title="t('tickets.close')"
      :message="t('tickets.closeConfirm')"
      :confirm-text="t('tickets.close')"
      :cancel-text="t('common.cancel')"
      danger
      @confirm="closeTicket"
      @cancel="closeDialog.show = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ticketsAPI from '@/api/tickets'
import { useAppStore } from '@/stores/app'
import { useNotificationStore } from '@/stores/notifications'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import type { Ticket, TicketSenderRole, TicketStatus, TicketWithMessages } from '@/types'
import type { Column } from '@/components/common/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select from '@/components/common/Select.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()
const notificationStore = useNotificationStore()

const tickets = ref<Ticket[]>([])
const loading = ref(false)
const detailLoading = ref(false)
const selectedDetail = ref<TicketWithMessages | null>(null)
const replyContent = ref('')
const replying = ref(false)
const creating = ref(false)
const showCreateDialog = ref(false)

const filters = reactive<{ status: TicketStatus | '' }>({ status: '' })
const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
  pages: 0,
})
const sortState = reactive({
  sort_by: 'last_reply_at',
  sort_order: 'desc' as 'asc' | 'desc',
})
const createForm = reactive({
  title: '',
  content: '',
})
const closeDialog = reactive<{ show: boolean; ticket: Ticket | null }>({
  show: false,
  ticket: null,
})

let listController: AbortController | null = null
let lastOpenedQueryTicketId: number | null = null

const statusFilterOptions = computed(() => [
  { value: '', label: t('tickets.status.all') },
  { value: 'open', label: t('tickets.status.open') },
  { value: 'closed', label: t('tickets.status.closed') },
])

const columns = computed<Column[]>(() => [
  { key: 'title', label: t('tickets.columns.title'), sortable: true },
  { key: 'status', label: t('tickets.columns.status'), sortable: true },
  { key: 'last_reply_at', label: t('tickets.columns.lastReply'), sortable: true },
  { key: 'actions', label: t('tickets.columns.actions') },
])

function statusLabel(status: string): string {
  return status === 'closed' ? t('tickets.status.closed') : t('tickets.status.open')
}

function senderLabel(role: TicketSenderRole): string {
  return role === 'admin' ? t('tickets.sender.admin') : t('tickets.sender.user')
}

async function loadTickets() {
  listController?.abort()
  const ctrl = new AbortController()
  listController = ctrl
  loading.value = true
  try {
    const res = await ticketsAPI.list(
      pagination.page,
      pagination.page_size,
      {
        status: filters.status || undefined,
        sort_by: sortState.sort_by,
        sort_order: sortState.sort_order,
      },
      { signal: ctrl.signal },
    )
    if (ctrl.signal.aborted || listController !== ctrl) return
    tickets.value = res.items
    pagination.total = res.total
    pagination.pages = res.pages
    pagination.page = res.page
    pagination.page_size = res.page_size
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return
    appStore.showError(extractApiErrorMessage(err, t('tickets.loadFailed')))
  } finally {
    if (listController === ctrl) {
      loading.value = false
      listController = null
    }
  }
}

async function openDetail(id: number) {
  detailLoading.value = true
  try {
    selectedDetail.value = await ticketsAPI.getById(id)
    replyContent.value = ''
    notificationStore.markTicketRead(id, selectedDetail.value.messages.at(-1)?.created_at)
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('tickets.detailLoadFailed')))
  } finally {
    detailLoading.value = false
  }
}

async function openTicketFromQuery() {
  const raw = route.query.ticket_id
  const value = Array.isArray(raw) ? raw[0] : raw
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0 || id === lastOpenedQueryTicketId) return

  lastOpenedQueryTicketId = id
  await openDetail(id)
}

function handleStatusChange() {
  pagination.page = 1
  void loadTickets()
}

function handlePageChange(page: number) {
  pagination.page = page
  void loadTickets()
}

function handlePageSizeChange(pageSize: number) {
  pagination.page_size = pageSize
  pagination.page = 1
  void loadTickets()
}

function handleSort(key: string, order: 'asc' | 'desc') {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  void loadTickets()
}

function openCreateDialog() {
  createForm.title = ''
  createForm.content = ''
  showCreateDialog.value = true
}

function closeCreateDialog() {
  showCreateDialog.value = false
}

async function createTicket() {
  if (!createForm.title.trim() || !createForm.content.trim()) return
  creating.value = true
  try {
    const created = await ticketsAPI.create({
      title: createForm.title.trim(),
      content: createForm.content.trim(),
    })
    showCreateDialog.value = false
    appStore.showSuccess(t('tickets.created'))
    await loadTickets()
    selectedDetail.value = created
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('tickets.createFailed')))
  } finally {
    creating.value = false
  }
}

async function sendReply() {
  if (!selectedDetail.value || !replyContent.value.trim() || replying.value) return
  replying.value = true
  try {
    await ticketsAPI.reply(selectedDetail.value.ticket.id, { content: replyContent.value.trim() })
    replyContent.value = ''
    await openDetail(selectedDetail.value.ticket.id)
    await loadTickets()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('tickets.replyFailed')))
  } finally {
    replying.value = false
  }
}

function askCloseTicket(ticket: Ticket) {
  closeDialog.ticket = ticket
  closeDialog.show = true
}

async function closeTicket() {
  if (!closeDialog.ticket) return
  try {
    const closed = await ticketsAPI.close(closeDialog.ticket.id)
    appStore.showSuccess(t('tickets.closed'))
    closeDialog.show = false
    if (selectedDetail.value?.ticket.id === closed.id) {
      selectedDetail.value.ticket = closed
    }
    await loadTickets()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('tickets.closeFailed')))
  } finally {
    closeDialog.ticket = null
  }
}

onMounted(() => {
  void (async () => {
    await loadTickets()
    await openTicketFromQuery()
  })()
})

onBeforeUnmount(() => {
  listController?.abort()
})

watch(
  () => route.query.ticket_id,
  () => {
    void openTicketFromQuery()
  },
)
</script>
