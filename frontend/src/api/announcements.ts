/**
 * User Announcements API endpoints
 */

import { apiClient } from './client'
import type { AnnouncementComment, UserAnnouncement } from '@/types'

export async function list(unreadOnly: boolean = false): Promise<UserAnnouncement[]> {
  const { data } = await apiClient.get<UserAnnouncement[]>('/announcements', {
    params: unreadOnly ? { unread_only: 1 } : {}
  })
  return data
}

export async function markRead(id: number): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(`/announcements/${id}/read`)
  return data
}

export async function listComments(id: number): Promise<AnnouncementComment[]> {
  const { data } = await apiClient.get<AnnouncementComment[]>(`/announcements/${id}/comments`)
  return data
}

export async function createComment(
  id: number,
  request: { content: string; parent_id?: number },
): Promise<AnnouncementComment> {
  const { data } = await apiClient.post<AnnouncementComment>(`/announcements/${id}/comments`, request)
  return data
}

export async function deleteComment(id: number, commentId: number): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(`/announcements/${id}/comments/${commentId}`)
  return data
}

const announcementsAPI = {
  list,
  markRead,
  listComments,
  createComment,
  deleteComment
}

export default announcementsAPI
