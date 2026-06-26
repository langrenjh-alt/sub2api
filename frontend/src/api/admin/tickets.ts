/**
 * Admin ticket API endpoints
 */

import { apiClient } from '../client'
import type {
  BasePaginationResponse,
  ReplyTicketRequest,
  Ticket,
  TicketMessage,
  TicketStatus,
  TicketWithMessages,
} from '@/types'

export async function list(
  page: number = 1,
  pageSize: number = 20,
  filters?: {
    status?: TicketStatus | ''
    search?: string
    user_id?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  },
  options?: { signal?: AbortSignal },
): Promise<BasePaginationResponse<Ticket>> {
  const { data } = await apiClient.get<BasePaginationResponse<Ticket>>('/admin/tickets', {
    params: { page, page_size: pageSize, ...filters },
    signal: options?.signal,
  })
  return data
}

export async function getById(id: number): Promise<TicketWithMessages> {
  const { data } = await apiClient.get<TicketWithMessages>(`/admin/tickets/${id}`)
  return data
}

export async function reply(id: number, request: ReplyTicketRequest): Promise<TicketMessage> {
  const { data } = await apiClient.post<TicketMessage>(`/admin/tickets/${id}/messages`, request)
  return data
}

export async function close(id: number): Promise<Ticket> {
  const { data } = await apiClient.post<Ticket>(`/admin/tickets/${id}/close`)
  return data
}

const ticketsAPI = {
  list,
  getById,
  reply,
  close,
}

export default ticketsAPI
