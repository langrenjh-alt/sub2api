<template>
  <div
    ref="containerRef"
    class="gateway-field"
    aria-hidden="true"
    data-renderer="three-webgl"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <canvas ref="canvasRef" class="gateway-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps<{
  active?: boolean
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let moonGroup: THREE.Group | null = null
let moon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let width = 1
let height = 1
let compact = false
let lastTime = 0
let targetPointerX = 0
let targetPointerY = 0
let currentPointerX = 0
let currentPointerY = 0
let targetScrollProgress = 0
let currentScrollProgress = 0
let disposed = false

const desktopPosition = new THREE.Vector3(3.35, -0.35, 0)
const compactPosition = new THREE.Vector3(0.35, -3.15, 0)

function getBasePosition() {
  return compact ? compactPosition : desktopPosition
}

function renderOnce() {
  if (scene && camera && renderer) renderer.render(scene, camera)
}

function loadMoonTextures(material: THREE.MeshStandardMaterial) {
  const loader = new THREE.TextureLoader()

  loader.load(
    '/assets/home/moon-lroc-color-2k.jpg',
    (texture) => {
      if (disposed) {
        texture.dispose()
        return
      }
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() ?? 1)
      material.map = texture
      material.needsUpdate = true
      renderOnce()
    },
    undefined,
    () => renderOnce(),
  )

  loader.load(
    '/assets/home/moon-ldem-bump.jpg',
    (texture) => {
      if (disposed) {
        texture.dispose()
        return
      }
      texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() ?? 1)
      material.bumpMap = texture
      material.needsUpdate = true
      renderOnce()
    },
    undefined,
    () => renderOnce(),
  )
}

function createMoon() {
  if (!scene) return

  moonGroup = new THREE.Group()
  const geometry = new THREE.SphereGeometry(3.15, compact ? 96 : 144, compact ? 64 : 96)
  const material = new THREE.MeshStandardMaterial({
    color: 0xa9bbd2,
    roughness: 0.94,
    metalness: 0,
    bumpScale: 0.085,
  })

  moon = new THREE.Mesh(geometry, material)
  moon.rotation.set(0.07, -1.72, -0.045)
  moonGroup.add(moon)
  moonGroup.position.copy(getBasePosition())
  scene.add(moonGroup)
  loadMoonTextures(material)
}

function configureLayout() {
  const container = containerRef.value
  if (!container || !camera || !renderer || !moonGroup) return

  const bounds = container.getBoundingClientRect()
  width = Math.max(1, bounds.width)
  height = Math.max(1, bounds.height)
  compact = width < 720

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.8))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.fov = compact ? 48 : 40
  camera.position.set(0, compact ? 0.05 : 0, compact ? 10.7 : 10.4)
  camera.updateProjectionMatrix()

  moonGroup.position.copy(getBasePosition())
  moonGroup.scale.setScalar(compact ? 0.88 : 1)
  renderOnce()
}

function updateScene(time: number) {
  if (!camera || !moonGroup || !moon || !renderer || !scene) return

  const elapsed = time * 0.001
  const delta = Math.min(0.05, Math.max(0.001, (time - lastTime) * 0.001))
  lastTime = time
  currentPointerX += (targetPointerX - currentPointerX) * Math.min(1, delta * 2.4)
  currentPointerY += (targetPointerY - currentPointerY) * Math.min(1, delta * 2.4)
  currentScrollProgress += (targetScrollProgress - currentScrollProgress) * Math.min(1, delta * 4.2)

  const base = getBasePosition()
  const pointerStrength = compact ? 0.09 : 0.18
  const fallDistance = compact ? 6.5 : 7.5
  moonGroup.position.x = base.x + currentPointerX * pointerStrength - currentScrollProgress * (compact ? 0.16 : 0.48)
  moonGroup.position.y = base.y - currentPointerY * pointerStrength - currentScrollProgress * fallDistance
  moonGroup.position.z = currentScrollProgress * 0.48
  moonGroup.rotation.x = currentPointerY * 0.025 - currentScrollProgress * 0.16
  moonGroup.rotation.y = currentPointerX * 0.035 + currentScrollProgress * 0.24

  const baseScale = compact ? 0.88 : 1
  const scrollScale = 1 + currentScrollProgress * (compact ? 0.1 : 0.16)
  moonGroup.scale.setScalar(baseScale * scrollScale)
  moon.rotation.y = -1.72 + elapsed * 0.024

  camera.position.x = currentPointerX * -0.08
  camera.position.y = (compact ? 0.05 : 0) + currentPointerY * 0.055
  camera.lookAt(compact ? 0 : 1.45, compact ? -1.3 : -0.25, 0)
  renderer.render(scene, camera)

  if (props.active !== false) animationFrame = requestAnimationFrame(updateScene)
}

function startAnimation() {
  cancelAnimationFrame(animationFrame)
  lastTime = performance.now()
  animationFrame = requestAnimationFrame(updateScene)
}

function setupScene() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  disposed = false
  compact = container.getBoundingClientRect().width < 720
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x030303)

  camera = new THREE.PerspectiveCamera(compact ? 48 : 40, 1, 0.1, 40)
  camera.position.set(0, compact ? 0.05 : 0, compact ? 10.7 : 10.4)

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !compact,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setClearColor(0x030303, 1)

  scene.add(new THREE.HemisphereLight(0x9aa4b6, 0x050505, 0.055))
  const keyLight = new THREE.DirectionalLight(0xf0f5ff, 3.35)
  keyLight.position.set(5.5, 3.6, 4)
  scene.add(keyLight)

  const edgeLight = new THREE.DirectionalLight(0x9aabc2, 0.12)
  edgeLight.position.set(-5, -2, 1.5)
  scene.add(edgeLight)

  createMoon()
  configureLayout()
  renderOnce()

  resizeObserver = new ResizeObserver(configureLayout)
  resizeObserver.observe(container)
  if (props.active !== false) startAnimation()
}

function handlePointerMove(event: PointerEvent) {
  const container = containerRef.value
  if (!container) return

  const bounds = container.getBoundingClientRect()
  targetPointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
  targetPointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
}

function handlePointerLeave() {
  targetPointerX = 0
  targetPointerY = 0
}

function setScrollProgress(progress: number) {
  targetScrollProgress = Math.min(1, Math.max(0, progress))
  if (props.active === false) {
    currentScrollProgress = targetScrollProgress
    updateScene(performance.now())
  }
}

function disposeScene() {
  disposed = true
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()

  scene?.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    renderable.geometry?.dispose()
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : []
    materials.forEach((material) => {
      const moonMaterial = material as THREE.MeshStandardMaterial
      moonMaterial.map?.dispose()
      moonMaterial.bumpMap?.dispose()
      material?.dispose()
    })
  })

  renderer?.renderLists.dispose()
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
  scene = null
  camera = null
  moonGroup = null
  moon = null
}

watch(
  () => props.active,
  (active) => {
    cancelAnimationFrame(animationFrame)
    if (active !== false) startAnimation()
    else renderOnce()
  },
)

onMounted(setupScene)
onBeforeUnmount(disposeScene)

defineExpose({ setScrollProgress })
</script>

<style scoped>
.gateway-field,
.gateway-canvas {
  width: 100%;
  height: 100%;
}

.gateway-field {
  position: relative;
  overflow: hidden;
  background: #030303;
}

.gateway-canvas {
  display: block;
}
</style>
