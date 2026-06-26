import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import ticketsAPI from '@/api/tickets'
import adminTicketsAPI from '@/api/admin/tickets'
import announcementsAPI from '@/api/announcements'
import adminAnnouncementsAPI from '@/api/admin/announcements'
import { useAuthStore } from '@/stores/auth'
import { useAnnouncementStore } from '@/stores/announcements'
import type {
  AnnouncementComment,
  Ticket,
  TicketMessage,
  TicketWithMessages,
  UserAnnouncement,
} from '@/types'

const STORAGE_PREFIX = 'sub2api:notification-cursors:v1'
const POLL_INTERVAL_MS = 60 * 1000
const REFRESH_THROTTLE_MS = 30 * 1000
const TICKET_SCAN_LIMIT = 15
const ANNOUNCEMENT_SCAN_LIMIT = 10

export type NotificationItemType = 'ticket_reply' | 'announcement_comment_reply'

export interface NotificationItem {
  id: string
  type: NotificationItemType
  title: string
  created_at: string
  target_timestamp: string
  ticket_id?: number
  announcement_id?: number
  announcement?: UserAnnouncement
  actor_name?: string
  count?: number
}

interface NotificationCursors {
  tickets: Record<string, string>
  announcementComments: Record<string, string>
}

function defaultCursors(): NotificationCursors {
  return {
    tickets: {},
    announcementComments: {},
  }
}

function timeValue(timestamp?: string | null): number {
  if (!timestamp) return 0
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : 0
}

function isAfter(left?: string | null, right?: string | null): boolean {
  return timeValue(left) > timeValue(right)
}

function setCursorIfNewer(target: Record<string, string>, key: string, timestamp?: string | null): boolean {
  if (!timestamp) return false
  const current = target[key]
  if (current && !isAfter(timestamp, current)) return false
  target[key] = timestamp
  return true
}

function latestMessage(detail: TicketWithMessages): TicketMessage | null {
  if (detail.messages.length === 0) return null
  return detail.messages[detail.messages.length - 1]
}

function ticketCursorTimestamp(ticket: Ticket): string {
  return ticket.last_reply_at || ticket.updated_at || ticket.created_at
}

function ticketUserLabel(message: TicketMessage): string {
  const user = message.user
  if (user?.username) return user.username
  if (user?.email) return user.email
  return `#${message.user_id}`
}

function commentAuthorLabel(comment: AnnouncementComment): string {
  return comment.author_name || comment.author_email || `#${comment.user_id}`
}

export const useNotificationStore = defineStore('notifications', () => {
  const authStore = useAuthStore()
  const announcementStore = useAnnouncementStore()

  const items = ref<NotificationItem[]>([])
  const loading = ref(false)
  const lastRefreshTime = ref(0)
  let pollingTimer: number | null = null
  let refreshPromise: Promise<void> | null = null

  const unreadCount = computed(() => items.value.length)

  function storageKey(): string | null {
    const user = authStore.user
    if (!user) return null
    return `${STORAGE_PREFIX}:${user.role}:${user.id}`
  }

  function loadCursors(): NotificationCursors {
    const key = storageKey()
    if (!key) return defaultCursors()

    try {
      const raw = localStorage.getItem(key)
      if (!raw) return defaultCursors()
      const parsed = JSON.parse(raw) as Partial<NotificationCursors>
      return {
        tickets: parsed.tickets && typeof parsed.tickets === 'object' ? parsed.tickets : {},
        announcementComments:
          parsed.announcementComments && typeof parsed.announcementComments === 'object'
            ? parsed.announcementComments
            : {},
      }
    } catch {
      return defaultCursors()
    }
  }

  function saveCursors(cursors: NotificationCursors): void {
    const key = storageKey()
    if (!key) return

    try {
      localStorage.setItem(key, JSON.stringify(cursors))
    } catch {
      // Ignore storage failures; notifications still work for the current session.
    }
  }

  async function getTicketDetail(id: number): Promise<TicketWithMessages> {
    return authStore.isAdmin ? adminTicketsAPI.getById(id) : ticketsAPI.getById(id)
  }

  async function listRecentTickets(): Promise<Ticket[]> {
    const filters = {
      sort_by: 'last_reply_at',
      sort_order: 'desc' as const,
    }
    const response = authStore.isAdmin
      ? await adminTicketsAPI.list(1, TICKET_SCAN_LIMIT, filters)
      : await ticketsAPI.list(1, TICKET_SCAN_LIMIT, filters)
    return response.items
  }

  async function collectTicketNotifications(cursors: NotificationCursors): Promise<NotificationItem[]> {
    try {
      const expectedRole = authStore.isAdmin ? 'user' : 'admin'
      const tickets = await listRecentTickets()
      const candidates = tickets.filter((ticket) => {
        const cursor = cursors.tickets[String(ticket.id)]
        return !cursor || isAfter(ticketCursorTimestamp(ticket), cursor)
      })

      const details = await Promise.all(
        candidates.map(async (ticket) => {
          try {
            return await getTicketDetail(ticket.id)
          } catch {
            return null
          }
        }),
      )

      return details.flatMap((detail) => {
        if (!detail) return []
        const message = latestMessage(detail)
        if (!message || message.sender_role !== expectedRole) return []

        const timestamp = message.created_at || ticketCursorTimestamp(detail.ticket)
        const cursor = cursors.tickets[String(detail.ticket.id)]
        if (cursor && !isAfter(timestamp, cursor)) return []

        return [{
          id: `ticket:${detail.ticket.id}:${message.id}`,
          type: 'ticket_reply' as const,
          title: detail.ticket.title,
          created_at: timestamp,
          target_timestamp: timestamp,
          ticket_id: detail.ticket.id,
          actor_name: authStore.isAdmin ? ticketUserLabel(message) : undefined,
        }]
      })
    } catch (error) {
      console.debug('Failed to collect ticket notifications:', error)
      return []
    }
  }

  async function collectAnnouncementCommentNotifications(
    cursors: NotificationCursors,
  ): Promise<NotificationItem[]> {
    const userId = authStore.user?.id
    if (!userId) return []

    try {
      await announcementStore.fetchAnnouncements()
      const api = authStore.isAdmin ? adminAnnouncementsAPI : announcementsAPI
      const announcements = announcementStore.announcements
        .filter((announcement) => announcement.comments_enabled)
        .slice(0, ANNOUNCEMENT_SCAN_LIMIT)

      const scanned = await Promise.all(
        announcements.map(async (announcement): Promise<NotificationItem | null> => {
          try {
            const comments = await api.listComments(announcement.id)
            const ownCommentIds = new Set(
              comments.filter((comment) => comment.user_id === userId).map((comment) => comment.id),
            )
            if (ownCommentIds.size === 0) return null

            const cursor = cursors.announcementComments[String(announcement.id)]
            const replies = comments
              .filter((comment) => {
                return (
                  comment.parent_id !== undefined &&
                  ownCommentIds.has(comment.parent_id) &&
                  comment.user_id !== userId &&
                  (!cursor || isAfter(comment.created_at, cursor))
                )
              })
              .sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at))

            const latest = replies[0]
            if (!latest) return null

            return {
              id: `announcement-comment:${announcement.id}:${latest.id}`,
              type: 'announcement_comment_reply' as const,
              title: announcement.title,
              created_at: latest.created_at,
              target_timestamp: latest.created_at,
              announcement_id: announcement.id,
              announcement,
              actor_name: commentAuthorLabel(latest),
              count: replies.length,
            }
          } catch {
            return null
          }
        }),
      )

      return scanned.filter((item): item is NotificationItem => item !== null)
    } catch (error) {
      console.debug('Failed to collect announcement comment notifications:', error)
      return []
    }
  }

  async function refresh(force = false): Promise<void> {
    if (!authStore.isAuthenticated || !authStore.user) {
      reset()
      return
    }

    const now = Date.now()
    if (!force && now - lastRefreshTime.value < REFRESH_THROTTLE_MS) return
    if (refreshPromise) return refreshPromise

    lastRefreshTime.value = now
    loading.value = true
    refreshPromise = (async () => {
      const cursors = loadCursors()
      const [ticketItems, announcementItems] = await Promise.all([
        collectTicketNotifications(cursors),
        collectAnnouncementCommentNotifications(cursors),
      ])
      items.value = [...ticketItems, ...announcementItems]
        .sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at))
        .slice(0, 30)
    })()

    try {
      await refreshPromise
    } finally {
      loading.value = false
      refreshPromise = null
    }
  }

  function markTicketRead(ticketId: number, timestamp?: string | null): void {
    const cursors = loadCursors()
    if (setCursorIfNewer(cursors.tickets, String(ticketId), timestamp)) {
      saveCursors(cursors)
    }
    items.value = items.value.filter((item) => item.ticket_id !== ticketId)
  }

  function markAnnouncementCommentsRead(announcementId: number, timestamp?: string | null): void {
    const cursors = loadCursors()
    if (setCursorIfNewer(cursors.announcementComments, String(announcementId), timestamp)) {
      saveCursors(cursors)
    }
    items.value = items.value.filter((item) => item.announcement_id !== announcementId)
  }

  function markItemRead(item: NotificationItem): void {
    if (item.type === 'ticket_reply' && item.ticket_id !== undefined) {
      markTicketRead(item.ticket_id, item.target_timestamp)
      return
    }

    if (item.type === 'announcement_comment_reply' && item.announcement_id !== undefined) {
      markAnnouncementCommentsRead(item.announcement_id, item.target_timestamp)
    }
  }

  function markAllAsRead(): void {
    const cursors = loadCursors()
    for (const item of items.value) {
      if (item.type === 'ticket_reply' && item.ticket_id !== undefined) {
        setCursorIfNewer(cursors.tickets, String(item.ticket_id), item.target_timestamp)
      } else if (item.type === 'announcement_comment_reply' && item.announcement_id !== undefined) {
        setCursorIfNewer(
          cursors.announcementComments,
          String(item.announcement_id),
          item.target_timestamp,
        )
      }
    }
    saveCursors(cursors)
    items.value = []
  }

  function startPolling(): void {
    stopPolling()
    void refresh(true)
    pollingTimer = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
  }

  function stopPolling(): void {
    if (pollingTimer !== null) {
      window.clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  function reset(): void {
    stopPolling()
    items.value = []
    loading.value = false
    lastRefreshTime.value = 0
    refreshPromise = null
  }

  return {
    items,
    loading,
    unreadCount,
    refresh,
    markTicketRead,
    markAnnouncementCommentsRead,
    markItemRead,
    markAllAsRead,
    startPolling,
    stopPolling,
    reset,
  }
})
