/**
 * User Channels API endpoints (non-admin)
 * 使用者側「可用渠道」聚合查詢：渠道 + 使用者可訪問的分組 + 支援模型（含定價）。
 */

import { apiClient } from './client'
import type { BillingMode } from '@/constants/channel'

export interface UserAvailableGroup {
  id: number
  name: string
  platform: string
  /** 'standard' | 'subscription' — 訂閱分組視覺加深，和 API 金鑰頁保持一致。 */
  subscription_type: string
  /** 分組預設倍率。使用者專屬倍率（若有）通過 /groups/rates 獲取後在前端 join。 */
  rate_multiplier: number
  /** true = 專屬分組（小範圍授權）；false = 公開分組。 */
  is_exclusive: boolean
}

export interface UserPricingInterval {
  min_tokens: number
  max_tokens: number | null
  tier_label?: string
  input_price: number | null
  output_price: number | null
  cache_write_price: number | null
  cache_read_price: number | null
  per_request_price: number | null
}

export interface UserSupportedModelPricing {
  billing_mode: BillingMode
  input_price: number | null
  output_price: number | null
  cache_write_price: number | null
  cache_read_price: number | null
  image_output_price: number | null
  per_request_price: number | null
  intervals: UserPricingInterval[]
}

export interface UserSupportedModel {
  name: string
  platform: string
  pricing: UserSupportedModelPricing | null
}

/**
 * 渠道下單個平台的子檢視：使用者可訪問的分組 + 該平台支援的模型。
 * 後端把一個渠道按平台聚合成 sections，前端可以把渠道名作為 row-group
 * 一次渲染，後面按 sections 順序用 rowspan 鋪開。
 */
export interface UserChannelPlatformSection {
  platform: string
  groups: UserAvailableGroup[]
  supported_models: UserSupportedModel[]
}

export interface UserAvailableChannel {
  name: string
  description: string
  platforms: UserChannelPlatformSection[]
}

/** 列出當前使用者可見的「可用渠道」（與 /groups/available 保持一致，返回平陣列）。 */
export async function getAvailable(options?: { signal?: AbortSignal }): Promise<UserAvailableChannel[]> {
  const { data } = await apiClient.get<UserAvailableChannel[]>('/channels/available', {
    signal: options?.signal
  })
  return data
}

export const userChannelsAPI = { getAvailable }

export default userChannelsAPI
