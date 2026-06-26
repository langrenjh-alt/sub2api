/**
 * Admin Announcements API endpoints
 */

import { apiClient } from '../client'
import type {
  Announcement,
  AnnouncementComment,
  AnnouncementUserReadStatus,
  BasePaginationResponse,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest
} from '@/types'

export async function list(
  page: number = 1,
  pageSize: number = 20,
  filters?: {
    status?: string
    search?: string
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  },
  options?: {
    signal?: AbortSignal
  }
): Promise<BasePaginationResponse<Announcement>> {
  const { data } = await apiClient.get<BasePaginationResponse<Announcement>>('/admin/announcements', {
    params: { page, page_size: pageSize, ...filters },
    signal: options?.signal
  })
  return data
}

export async function getById(id: number): Promise<Announcement> {
  const { data } = await apiClient.get<Announcement>(`/admin/announcements/${id}`)
  return data
}

export async function create(request: CreateAnnouncementRequest): Promise<Announcement> {
  const { data } = await apiClient.post<Announcement>('/admin/announcements', request)
  return data
}

export async function update(id: number, request: UpdateAnnouncementRequest): Promise<Announcement> {
  const { data } = await apiClient.put<Announcement>(`/admin/announcements/${id}`, request)
  return data
}

export async function deleteAnnouncement(id: number): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/announcements/${id}`)
  return data
}

export async function getReadStatus(
  id: number,
  page: number = 1,
  pageSize: number = 20,
  filters?: {
    search?: string
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  },
  options?: {
    signal?: AbortSignal
  }
): Promise<BasePaginationResponse<AnnouncementUserReadStatus>> {
  const { data } = await apiClient.get<BasePaginationResponse<AnnouncementUserReadStatus>>(
    `/admin/announcements/${id}/read-status`,
    {
      params: { page, page_size: pageSize, ...filters },
      signal: options?.signal
    }
  )
  return data
}

export async function listComments(id: number): Promise<AnnouncementComment[]> {
  const { data } = await apiClient.get<AnnouncementComment[]>(`/admin/announcements/${id}/comments`)
  return data
}

export async function createComment(
  id: number,
  request: { content: string; parent_id?: number },
): Promise<AnnouncementComment> {
  const { data } = await apiClient.post<AnnouncementComment>(`/admin/announcements/${id}/comments`, request)
  return data
}

export async function deleteComment(id: number, commentId: number): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/announcements/${id}/comments/${commentId}`)
  return data
}

const announcementsAPI = {
  list,
  getById,
  create,
  update,
  delete: deleteAnnouncement,
  getReadStatus,
  listComments,
  createComment,
  deleteComment
}

export default announcementsAPI
