/**
 * Admin Channel Monitor Request Template API.
 *
 * 模板 = 一組可複用的 headers + 可選 body 覆蓋配置。
 * 套用到監控 = 複製快照；模板後續變動不自動同步，需手動點「套用到關聯監控」重新整理。
 */

import { apiClient } from '../client'
import type { APIMode, BodyOverrideMode, Provider } from './channelMonitor'

export interface ChannelMonitorTemplate {
  id: number
  name: string
  provider: Provider
  api_mode: APIMode
  description: string
  extra_headers: Record<string, string>
  body_override_mode: BodyOverrideMode
  body_override: Record<string, unknown> | null
  created_at: string
  updated_at: string
  /** 關聯的監控數量（快照來自此模板，僅 template_id 匹配即可） */
  associated_monitors: number
}

export interface ListParams {
  provider?: Provider
  api_mode?: APIMode
}

export interface ListResponse {
  items: ChannelMonitorTemplate[]
}

export interface CreateParams {
  name: string
  provider: Provider
  api_mode?: APIMode
  description?: string
  extra_headers?: Record<string, string>
  body_override_mode?: BodyOverrideMode
  body_override?: Record<string, unknown> | null
}

export interface UpdateParams {
  name?: string
  api_mode?: APIMode
  description?: string
  extra_headers?: Record<string, string>
  body_override_mode?: BodyOverrideMode
  body_override?: Record<string, unknown> | null
}

export interface ApplyResponse {
  affected: number
}

export interface AssociatedMonitorBrief {
  id: number
  name: string
  provider: Provider
  api_mode: APIMode
  enabled: boolean
}

export interface AssociatedMonitorsResponse {
  items: AssociatedMonitorBrief[]
}

export async function list(params: ListParams = {}): Promise<ListResponse> {
  const { data } = await apiClient.get<ListResponse>('/admin/channel-monitor-templates', {
    params,
  })
  return data
}

export async function get(id: number): Promise<ChannelMonitorTemplate> {
  const { data } = await apiClient.get<ChannelMonitorTemplate>(
    `/admin/channel-monitor-templates/${id}`,
  )
  return data
}

export async function create(params: CreateParams): Promise<ChannelMonitorTemplate> {
  const { data } = await apiClient.post<ChannelMonitorTemplate>(
    '/admin/channel-monitor-templates',
    params,
  )
  return data
}

export async function update(id: number, params: UpdateParams): Promise<ChannelMonitorTemplate> {
  const { data } = await apiClient.put<ChannelMonitorTemplate>(
    `/admin/channel-monitor-templates/${id}`,
    params,
  )
  return data
}

export async function del(id: number): Promise<void> {
  await apiClient.delete(`/admin/channel-monitor-templates/${id}`)
}

/**
 * Apply the template to the specified associated monitors (overwrite snapshot fields).
 * monitorIds must be a non-empty subset of the template's associated monitors.
 * Returns count of actually affected monitors.
 */
export async function apply(id: number, monitorIds: number[]): Promise<ApplyResponse> {
  const { data } = await apiClient.post<ApplyResponse>(
    `/admin/channel-monitor-templates/${id}/apply`,
    { monitor_ids: monitorIds },
  )
  return data
}

/**
 * List monitors currently associated to this template (used by apply picker).
 */
export async function listAssociatedMonitors(id: number): Promise<AssociatedMonitorsResponse> {
  const { data } = await apiClient.get<AssociatedMonitorsResponse>(
    `/admin/channel-monitor-templates/${id}/monitors`,
  )
  return data
}

export const channelMonitorTemplateAPI = {
  list,
  get,
  create,
  update,
  del,
  apply,
  listAssociatedMonitors,
}

export default channelMonitorTemplateAPI
