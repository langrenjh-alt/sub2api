export interface RegionServiceTermsSection {
  key: string
  title: string
  paragraphs: string[]
}

export interface RegionServiceTermsConsentRecord {
  revision: string
  accepted_at: string
}

export const REGION_SERVICE_TERMS_REVISION = '2026-06-28-v1'
export const REGION_SERVICE_TERMS_STORAGE_KEY = 'sub2api_region_service_terms_consent'
export const REGION_SERVICE_TERMS_TARGET_ROUTES = ['/home', '/login', '/register'] as const

export const REGION_SERVICE_TERMS_SECTIONS: RegionServiceTermsSection[] = [
  {
    key: 'zh-hans',
    title: '简体中文',
    paragraphs: [
      '为遵守各地法律法规及合规监管要求，本平台即日起停止为中国大陆及其他受限地区的 IP 提供 AI 中转服务。受限地区 IP 访问时将显示提示页面，合规许可地区的用户可继续正常使用服务。对于此次调整给您带来的不便，我们深表歉意，感谢您的理解与支持。',
      '用户一旦进行注册、登录、创建 API Key 或使用本平台的任何 API 服务，即视为自动声明并承诺您不是中国大陆地区及其他受限地区的用户。',
      '若用户使用代理、VPN 等任何技术手段规避上述地理限制，违反本服务政策，由此引发的一切法律责任及后果均由用户自行承担，本平台对此概不负责，并保留随时暂停或终止向违规账号提供服务的权利。'
    ]
  },
  {
    key: 'en',
    title: 'English',
    paragraphs: [
      'To comply with regional laws, regulations, and compliance requirements, our platform is ceasing the provision of AI relay services to IP addresses in Mainland China and other restricted regions with immediate effect. Visitors from restricted IPs will be directed to a notification page, while users in compliant regions may continue to access our services normally. We sincerely apologize for any inconvenience this may cause and greatly appreciate your understanding and support.',
      'By registering, logging in, creating an API Key, or using any of our API services, you automatically declare and warrant that you are not a user from Mainland China or any other restricted region.',
      'If a user employs proxies, VPNs, or any other technical means to bypass these geographical restrictions in violation of this policy, the user shall bear sole responsibility for all legal liabilities and consequences that arise. The platform assumes no liability for such actions and reserves the right to suspend or terminate services to violating accounts at any time.'
    ]
  }
]

export function isRegionServiceTermsRoute(path: string): boolean {
  return REGION_SERVICE_TERMS_TARGET_ROUTES.some((route) => route === path)
}

export function readRegionServiceTermsConsentRevision(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem(REGION_SERVICE_TERMS_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<RegionServiceTermsConsentRecord>
    return typeof parsed.revision === 'string' ? parsed.revision : null
  } catch {
    return null
  }
}

export function saveRegionServiceTermsConsentRevision(revision: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(
      REGION_SERVICE_TERMS_STORAGE_KEY,
      JSON.stringify({
        revision,
        accepted_at: new Date().toISOString()
      } satisfies RegionServiceTermsConsentRecord)
    )
  } catch {
    // Ignore persistence failures and keep the modal session-local.
  }
}
