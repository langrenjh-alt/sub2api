import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomepageStatusResponse } from '@/api/homepageStatus'
import JourneyChapters from '../JourneyChapters.vue'

const { copyToClipboard } = vi.hoisted(() => ({ copyToClipboard: vi.fn() }))
vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard, copied: ref(false) }),
}))
vi.mock('vue-i18n', async (getActual) => ({
  ...(await getActual<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('vue-router', async (getActual) => ({
  ...(await getActual<typeof import('vue-router')>()),
  RouterLink: defineComponent({ props:['to'], template:'<a :href="to"><slot /></a>' }),
}))

const feed: HomepageStatusResponse = {
  enabled:true,
  groups: [{id:1,name:'Standard',platform:'openai',rate_multiplier:.75}],
  monitors: [
    {id:2,name:'Online channel',provider:'openai',status:'operational',uptime_7d:98.6},
    {id:3,name:'Degraded',provider:'anthropic',status:'degraded',uptime_7d:96},
    {id:4,name:'Unmeasured',provider:'gemini',status:'unknown',uptime_7d:null},
  ],
}
function render(props: Partial<InstanceType<typeof JourneyChapters>['$props']> = {}) {
  return mount(JourneyChapters, {
    props: {
      progress:.44, reduced:false, modelPlaza:true, workspacePath:'/login', baseUrl:'https://example.test/v1',
      docUrl:'https://docs.example.test', status:null, statusState:'ready', authenticated:false,
      rechargeUrl:'https://example.test/buy', ...props,
    },
  })
}

describe('JourneyChapters', () => {
  beforeEach(() => {
    copyToClipboard.mockClear()
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches:false } as MediaQueryList)
  })

  it('keeps only the current scroll chapter keyboard-accessible and gates the model plaza link', async() => {
    const wrapper = render()
    expect(wrapper.findAll('.j-scene:not([inert])')).toHaveLength(1)
    expect(wrapper.get('.j-scene:not([inert])').attributes('data-journey')).toBe('gallery')
    expect(wrapper.get('a[href="/model-plaza"]').exists()).toBe(true)
    await wrapper.setProps({modelPlaza:false, progress:.24})
    expect(wrapper.find('a[href="/model-plaza"]').exists()).toBe(false)
    expect(wrapper.get('.j-scene:not([inert])').attributes('data-journey')).toBe('manifesto')
  })

  it('copies the selected configured URL and routes visitors through login for API keys', async() => {
    const wrapper = render({
      progress:.66, customEndpoints:[{name:'Internal',endpoint:'https://internal.test/v2'}],
    })
    const active = wrapper.get('.j-scene:not([inert])')
    expect(active.attributes('data-journey')).toBe('access')
    await active.get('select').setValue('1')
    await active.get('.endpoint-line button').trigger('click')
    expect(copyToClipboard).toHaveBeenCalledWith('https://internal.test/v2')
    expect(active.get('.console-links a').attributes('href')).toBe('/login?redirect=%2Fkeys')
    expect(active.get('a[href="/key-usage"]').exists()).toBe(true)
    await wrapper.setProps({authenticated:true})
    expect(active.get('a[href="/keys"]').exists()).toBe(true)
  })

  it.each([
    ['loading',null,'busy'], ['error',feed,'unavailable'],
    ['ready',{...feed,enabled:false},'private'], ['ready',{enabled:true,groups:[],monitors:[]},'empty'],
  ] as const)('does not invent service status for %s', (state, response, key) => {
    const wrapper = render({ progress:.93,statusState:state,status:response as HomepageStatusResponse|null })
    expect(wrapper.get('.no-readings').text()).toBe(`home.journey.${key}`)
    expect(wrapper.find('[data-testid="homepage-status-section"]').exists()).toBe(false)
  })

  it('reports only an actually measured successful query and emits refresh on demand', async() => {
    const wrapper = render({progress:.94, sampleMs:12.6})
    expect(wrapper.get('.sample-value').text()).toContain('13 ms')
    await wrapper.get('.feed-sample button').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    await wrapper.setProps({statusState:'loading'})
    expect(wrapper.find('.sample-value').exists()).toBe(false)
    expect(wrapper.get('.feed-sample button').attributes('disabled')).toBeDefined()
    await wrapper.setProps({statusState:'ready',sampleMs:null})
    expect(wrapper.find('.sample-value').exists()).toBe(false)
  })

  it('shows real rates, monitor status and uptime, and provides access to every reading', async() => {
    const wrapper = render({progress:.91,status:feed})
    expect(wrapper.get('[data-testid="homepage-status-group-1"]').text()).toContain('0.75x')
    expect(wrapper.get('[data-testid="homepage-status-monitor-2"]').text()).toContain('98.6%')
    expect(wrapper.get('[data-testid="homepage-status-monitor-3"]').text()).toContain('monitorCommon.status.degraded')
    await wrapper.get('button[aria-label="home.journey.next"]').trigger('click')
    expect(wrapper.get('[data-testid="homepage-status-monitor-4"]').text()).toContain('—')
    expect(wrapper.get('.j-enter').attributes('href')).toBe('/login')
  })
})
