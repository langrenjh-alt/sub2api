import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

interface GatewayFieldHandle {
  setScrollProgress(progress: number): void
}

export function useHomeParallax(
  rootRef: Ref<HTMLElement | null>,
  gatewayRef: Ref<GatewayFieldHandle | null>,
) {
  let context: gsap.Context | null = null

  onMounted(async () => {
    await nextTick()
    const root = rootRef.value
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (
      !root
      || reducedMotionQuery.matches
      || typeof reducedMotionQuery.addEventListener !== 'function'
    ) return

    gsap.registerPlugin(ScrollTrigger)
    const compact = window.matchMedia('(max-width: 720px)').matches
    const strength = compact ? 0.58 : 1
    const scrub = compact ? 0.65 : 0.9
    const settleStart = compact ? 'top 94%' : 'top 90%'
    const settleEnd = compact ? 'top 60%' : 'top 58%'
    const settleScrub = true

    context = gsap.context(() => {
      const hero = root.querySelector<HTMLElement>('.home-hero')
      const field = root.querySelector<HTMLElement>('.home-field')
      const heroContent = root.querySelector<HTMLElement>('.home-hero-content')
      const lunarMeta = root.querySelector<HTMLElement>('.home-lunar-meta')
      const heroOverline = root.querySelector<HTMLElement>('.home-hero-overline')
      const heroTitle = root.querySelector<HTMLElement>('.home-hero-title')
      const heroCopy = root.querySelector<HTMLElement>('.home-hero-copy')
      const heroActions = root.querySelector<HTMLElement>('.home-hero-actions')
      const requestRail = root.querySelector<HTMLElement>('.home-request-rail')
      const actionSection = root.querySelector<HTMLElement>('#actions')
      const introElements = [heroOverline, heroTitle, heroCopy, heroActions].filter(
        (element): element is HTMLElement => element !== null,
      )

      if (hero && field && heroContent) {
        gsap.fromTo(field, { opacity: 0 }, {
          opacity: 1,
          duration: 1.2,
          ease: 'power2.out',
        })
        gsap.set(introElements, { opacity: 1 })
        gsap.fromTo(introElements, { y: 28 }, {
          y: 0,
          duration: 0.9,
          stagger: 0.09,
          delay: 0.08,
          ease: 'power3.out',
          clearProps: 'transform',
        })
        if (lunarMeta) {
          gsap.fromTo(lunarMeta, { opacity: 0 }, {
            opacity: 1,
            duration: 0.8,
            delay: 0.42,
            ease: 'power2.out',
          })
        }
        if (requestRail) {
          gsap.fromTo(requestRail, { y: 14, opacity: 0 }, {
            y: 0,
            opacity: 1,
            duration: 0.72,
            delay: 0.42,
            ease: 'power3.out',
            clearProps: 'transform',
          })
        }
        const heroTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub,
            invalidateOnRefresh: true,
          },
        })

        if (heroOverline) heroTimeline.to(heroOverline, { y: -62 * strength, opacity: 0, ease: 'none' }, 0)
        if (heroTitle) heroTimeline.to(heroTitle, { y: -148 * strength, scale: 1 - 0.08 * strength, opacity: 0.04, ease: 'none' }, 0)
        if (heroCopy) heroTimeline.to(heroCopy, { y: -104 * strength, opacity: 0, ease: 'none' }, 0)
        if (heroActions) heroTimeline.to(heroActions, { y: -68 * strength, opacity: 0, ease: 'none' }, 0)
        if (lunarMeta) heroTimeline.to(lunarMeta, { y: -38 * strength, opacity: 0, ease: 'none' }, 0)
        if (requestRail) heroTimeline.to(requestRail, { y: -24 * strength, opacity: 0.12, ease: 'none' }, 0)

        ScrollTrigger.create({
          trigger: hero,
          endTrigger: actionSection ?? hero,
          start: 'top top',
          end: 'bottom top',
          invalidateOnRefresh: true,
          onUpdate: (self) => gatewayRef.value?.setScrollProgress(self.progress),
          onLeave: () => gatewayRef.value?.setScrollProgress(1),
          onLeaveBack: () => gatewayRef.value?.setScrollProgress(0),
        })
      }

      const progressFill = root.querySelector<HTMLElement>('.home-scroll-progress-fill')
      if (progressFill) {
        gsap.set(progressFill, { scaleY: 0, transformOrigin: 'top center' })
        gsap.to(progressFill, {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.25,
          },
        })
      }

      const signalStrip = root.querySelector<HTMLElement>('.home-signal-strip')
      const signalCells = gsap.utils.toArray<HTMLElement>('.home-signal-cell', root)
      if (signalStrip && signalCells.length) {
        signalCells.forEach((cell, index) => {
          gsap.fromTo(cell,
            { y: (54 + index * 12) * strength, opacity: 0.35 },
            {
              y: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: cell,
                start: settleStart,
                end: settleEnd,
                scrub: settleScrub,
                invalidateOnRefresh: true,
              },
            },
          )
        })
      }

      const actionHeadingParts = gsap.utils.toArray<HTMLElement>('#actions .home-section-heading > *', root)
      const actionCards = gsap.utils.toArray<HTMLElement>('#actions .home-action', root)
      if (actionSection) {
        actionHeadingParts.forEach((part, index) => {
          gsap.fromTo(part, { y: (70 + index * 60) * strength }, {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: part,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        })

        actionCards.forEach((card, index) => {
          gsap.fromTo(card,
            compact
              ? { y: (86 + index * 10) * strength, opacity: 0.22 }
              : { y: 120 + index * 24, rotateX: 9, opacity: 0.18 },
            {
              y: 0,
              rotateX: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                start: settleStart,
                end: settleEnd,
                scrub: settleScrub,
                invalidateOnRefresh: true,
              },
            },
          )
        })
      }

      const missionArchive = root.querySelector<HTMLElement>('.home-mission-archive')
      const missionIntro = root.querySelector<HTMLElement>('.home-mission-intro')
      const missionPrimaryImage = root.querySelector<HTMLElement>('.home-mission-primary img')
      const missionSecondary = root.querySelector<HTMLElement>('.home-mission-secondary')
      const missionSecondaryImage = root.querySelector<HTMLElement>('.home-mission-secondary img')
      const missionCopy = root.querySelector<HTMLElement>('.home-mission-copy')
      if (missionArchive) {
        if (missionIntro) {
          gsap.fromTo(missionIntro, { y: 86 * strength, opacity: 0.36 }, {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: missionIntro,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        }
        if (missionPrimaryImage) {
          gsap.fromTo(missionPrimaryImage, { yPercent: -3, scale: 1.08 }, {
            yPercent: 3,
            scale: 1.02,
            ease: 'none',
            scrollTrigger: {
              trigger: missionPrimaryImage,
              start: 'top bottom',
              end: 'bottom top',
              scrub,
              invalidateOnRefresh: true,
            },
          })
        }
        if (missionSecondary && missionSecondaryImage) {
          gsap.fromTo(missionSecondaryImage, { y: 92 * strength }, {
            y: -38 * strength,
            ease: 'none',
            scrollTrigger: {
              trigger: missionSecondary,
              start: 'top bottom',
              end: 'bottom top',
              scrub,
            },
          })
        }
        if (missionSecondary && missionCopy) {
          gsap.fromTo(missionCopy, { y: 136 * strength, opacity: 0.3 }, {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: missionCopy,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        }
      }

      const capabilitySection = root.querySelector<HTMLElement>('#capabilities')
      const featureIntro = root.querySelector<HTMLElement>('.home-feature-intro')
      const featureCards = gsap.utils.toArray<HTMLElement>('.home-feature', root)
      if (capabilitySection) {
        if (featureIntro) {
          gsap.fromTo(featureIntro, { y: 100 * strength }, {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: featureIntro,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        }
        featureCards.forEach((card, index) => {
          gsap.fromTo(card,
            compact
              ? { y: (104 + index * 14) * strength, opacity: 0.2 }
              : { y: 160 + index * 72, opacity: 0.36 },
            {
              y: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                start: settleStart,
                end: settleEnd,
                scrub: settleScrub,
                invalidateOnRefresh: true,
              },
            },
          )
        })
      }

      const compatibilitySection = root.querySelector<HTMLElement>('#compatibility')
      const compatibilityHeading = root.querySelector<HTMLElement>('#compatibility .home-section-heading')
      const providerRows = gsap.utils.toArray<HTMLElement>('.home-provider-row', root)
      if (compatibilitySection) {
        if (compatibilityHeading) {
          gsap.fromTo(compatibilityHeading, { y: 110 * strength }, {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: compatibilityHeading,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        }
        providerRows.forEach((row, index) => {
          gsap.fromTo(row,
            {
              x: compact
                ? (index % 2 === 0 ? 72 : -52) * strength
                : index % 2 === 0 ? 110 : -70,
              opacity: compact ? 0.18 : 0.12,
            },
            {
              x: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: row,
                start: settleStart,
                end: settleEnd,
                scrub: settleScrub,
                invalidateOnRefresh: true,
              },
            },
          )
        })
      }

      const accessSection = root.querySelector<HTMLElement>('#access')
      const accessHeadingParts = gsap.utils.toArray<HTMLElement>('#access .home-section-heading > *', root)
      const accessSteps = gsap.utils.toArray<HTMLElement>('.home-step', root)
      const finalCta = root.querySelector<HTMLElement>('.home-final-cta')
      if (accessSection) {
        accessHeadingParts.forEach((part, index) => {
          gsap.fromTo(part, { y: (90 + index * 80) * strength }, {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: part,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        })
        accessSteps.forEach((step, index) => {
          gsap.fromTo(step,
            compact
              ? { y: (112 + index * 16) * strength, opacity: 0.18 }
              : { y: 170 + index * 75, rotateX: 8, opacity: 0.14 },
            {
              y: 0,
              rotateX: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: step,
                start: settleStart,
                end: settleEnd,
                scrub: settleScrub,
                invalidateOnRefresh: true,
              },
            },
          )
        })
        if (finalCta) {
          gsap.fromTo(finalCta, { x: -90 * strength, opacity: 0.2 }, {
            x: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: finalCta,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        }
      }

      const statusSection = root.querySelector<HTMLElement>('.home-status-section')
      const statusHeading = root.querySelector<HTMLElement>('.home-status-section .home-section-heading')
      const statusList = root.querySelector<HTMLElement>('.home-status-list')
      const terminalCta = root.querySelector<HTMLElement>('.home-terminal-cta')
      const terminalCtaInner = root.querySelector<HTMLElement>('.home-terminal-cta-inner')
      if (field && missionArchive && statusSection) {
        ScrollTrigger.create({
          trigger: missionArchive,
          start: 'top top',
          endTrigger: statusSection,
          end: 'top bottom',
          invalidateOnRefresh: true,
          onToggle: (self) => gsap.set(field, { opacity: self.isActive ? 0 : 1 }),
          onRefresh: (self) => gsap.set(field, { opacity: self.isActive ? 0 : 1 }),
        })
      }
      if (statusSection) {
        if (statusHeading) {
          gsap.fromTo(statusHeading, { y: 90 * strength }, {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: statusHeading,
              start: settleStart,
              end: settleEnd,
              scrub: settleScrub,
              invalidateOnRefresh: true,
            },
          })
        }
        if (statusList) {
          gsap.fromTo(statusList,
            { y: 100 * strength, opacity: 0.18 },
            {
              y: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: statusList,
                start: settleStart,
                end: settleEnd,
                scrub: settleScrub,
                invalidateOnRefresh: true,
              },
            },
          )
        }

        const returnProgress = compact ? 0.2 : 0.4
        ScrollTrigger.create({
          trigger: statusSection,
          endTrigger: terminalCta ?? statusSection,
          start: 'top bottom',
          end: 'clamp(bottom bottom)',
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            gatewayRef.value?.setScrollProgress(1 - (1 - returnProgress) * self.progress)
          },
          onLeave: () => gatewayRef.value?.setScrollProgress(returnProgress),
          onLeaveBack: () => gatewayRef.value?.setScrollProgress(1),
        })
      }

      if (terminalCta && terminalCtaInner) {
        gsap.fromTo(terminalCtaInner, { y: 72 * strength, opacity: 0.3 }, {
          y: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: terminalCtaInner,
            start: settleStart,
            end: settleEnd,
            scrub: settleScrub,
            invalidateOnRefresh: true,
          },
        })
      }
    }, root)

    requestAnimationFrame(() => ScrollTrigger.refresh())
  })

  onBeforeUnmount(() => {
    context?.revert()
    gatewayRef.value?.setScrollProgress(0)
  })
}
