<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            class="input w-full sm:w-64"
            :placeholder="t('admin.tickets.searchPlaceholder')"
            @input="handleSearch"
          />
          <Select
            v-model="filters.status"
            class="w-40"
            :options="statusFilterOptions"
            @change="handleStatusChange"
          />
        </div>
        <button class="btn btn-secondary" :disabled="loading" :title="t('common.refresh')" @click="loadTickets">
          <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
        </button>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
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

            <template #cell-user_id="{ value }">
              <span class="text-sm text-gray-700 dark:text-gray-300">#{{ value }}</span>
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
                  :title="t('admin.tickets.view')"
                  @click="openDetail(row.id)"
                >
                  <Icon name="eye" size="sm" />
                </button>
                <button
                  v-if="row.status === 'open'"
                  class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                  :title="t('admin.tickets.close')"
                  @click="askCloseTicket(row)"
                >
                  <Icon name="xCircle" size="sm" />
                </button>
              </div>
            </template>
          </DataTable>
        </div>

        <div class="card flex min-h-[560px] flex-col overflow-hidden">
          <div class="border-b border-gray-100 px-5 py-4 dark:border-dark-700">
            <div v-if="selectedDetail" class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">
                  {{ selectedDetail.ticket.title }}
                </h2>
                <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">
                  #{{ selectedDetail.ticket.id }} · {{ t('admin.tickets.userId', { id: selectedDetail.ticket.user_id }) }} · {{ statusLabel(selectedDetail.ticket.status) }}
                </p>
              </div>
              <button
                v-if="selectedDetail.ticket.status === 'open'"
                class="btn btn-secondary btn-sm text-red-600 dark:text-red-400"
                @click="askCloseTicket(selectedDetail.ticket)"
              >
                {{ t('admin.tickets.close') }}
              </button>
            </div>
            <div v-else>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.tickets.detailTitle') }}</h2>
              <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('admin.tickets.selectHint') }}</p>
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
              {{ t('admin.tickets.emptyDetail') }}
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
              :placeholder="t('admin.tickets.replyPlaceholder')"
            ></textarea>
            <div class="mt-3 flex justify-end">
              <button class="btn btn-primary btn-sm" type="submit" :disabled="replying || !replyContent.trim()">
                <Icon v-if="replying" name="refresh" size="sm" class="animate-spin" />
                <Icon v-else name="chat" size="sm" />
                <span>{{ replying ? t('admin.tickets.sending') : t('admin.tickets.sendReply') }}</span>
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

    <ConfirmDialog
      :show="closeDialog.show"
      :title="t('admin.tickets.close')"
      :message="t('admin.tickets.closeConfirm')"
      :confirm-text="t('admin.tickets.close')"
      :cancel-text="t('common.cancel')"
      danger
      @confirm="closeTicket"
      @cancel="closeDialog.show = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import adminTicketsAPI from '@/api/admin/tickets'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import type { Ticket, TicketSenderRole, TicketStatus, TicketWithMessages } from '@/types'
import type { Column } from '@/components/common/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select from '@/components/common/Select.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()
const appStore = useAppStore()

const tickets = ref<Ticket[]>([])
const loading = ref(false)
const detailLoading = ref(false)
const selectedDetail = ref<TicketWithMessages | null>(null)
const replyContent = ref('')
const replying = ref(false)
const searchQuery = ref('')

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
const closeDialog = reactive<{ show: boolean; ticket: Ticket | null }>({
  show: false,
  ticket: null,
})

let listController: AbortController | null = null
let searchTimer: number | null = null

const statusFilterOptions = computed(() => [
  { value: '', label: t('admin.tickets.status.all') },
  { value: 'open', label: t('admin.tickets.status.open') },
  { value: 'closed', label: t('admin.tickets.status.closed') },
])

const columns = computed<Column[]>(() => [
  { key: 'title', label: t('admin.tickets.columns.title'), sortable: true },
  { key: 'user_id', label: t('admin.tickets.columns.user') },
  { key: 'status', label: t('admin.tickets.columns.status'), sortable: true },
  { key: 'last_reply_at', label: t('admin.tickets.columns.lastReply'), sortable: true },
  { key: 'actions', label: t('admin.tickets.columns.actions') },
])

function statusLabel(status: string): string {
  return status === 'closed' ? t('admin.tickets.status.closed') : t('admin.tickets.status.open')
}

function senderLabel(role: TicketSenderRole): string {
  return role === 'admin' ? t('admin.tickets.sender.admin') : t('admin.tickets.sender.user')
}

async function loadTickets() {
  listController?.abort()
  const ctrl = new AbortController()
  listController = ctrl
  loading.value = true
  try {
    const res = await adminTicketsAPI.list(
      pagination.page,
      pagination.page_size,
      {
        status: filters.status || undefined,
        search: searchQuery.value.trim() || undefined,
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
    appStore.showError(extractApiErrorMessage(err, t('admin.tickets.loadFailed')))
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
    selectedDetail.value = await adminTicketsAPI.getById(id)
    replyContent.value = ''
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('admin.tickets.detailLoadFailed')))
  } finally {
    detailLoading.value = false
  }
}

function handleStatusChange() {
  pagination.page = 1
  void loadTickets()
}

function handleSearch() {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    pagination.page = 1
    void loadTickets()
  }, 300)
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

async function sendReply() {
  if (!selectedDetail.value || !replyContent.value.trim() || replying.value) return
  replying.value = true
  try {
    await adminTicketsAPI.reply(selectedDetail.value.ticket.id, { content: replyContent.value.trim() })
    replyContent.value = ''
    await openDetail(selectedDetail.value.ticket.id)
    await loadTickets()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('admin.tickets.replyFailed')))
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
    const closed = await adminTicketsAPI.close(closeDialog.ticket.id)
    appStore.showSuccess(t('admin.tickets.closed'))
    closeDialog.show = false
    if (selectedDetail.value?.ticket.id === closed.id) {
      selectedDetail.value.ticket = closed
    }
    await loadTickets()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('admin.tickets.closeFailed')))
  } finally {
    closeDialog.ticket = null
  }
}

onMounted(() => {
  void loadTickets()
})

onBeforeUnmount(() => {
  listController?.abort()
  if (searchTimer) window.clearTimeout(searchTimer)
})
</script>
