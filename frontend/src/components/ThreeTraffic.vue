<template>
  <div style="width: 100%; height: 100vh; position: relative;">
    <div ref="threeContainer" style="width: 100%; height: 100vh;"></div>
    <button @click="addNode" style="position: absolute; top: 10px; left: 10px; z-index: 10;">Agregar Nodo</button>
    <div v-if="selectedNodeObj" style="position: absolute; top: 60px; left: 10px; background: #fff; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px #0002; z-index: 10;">
      <div><b>Nodo seleccionado: {{ selectedNodeObj.id }}</b></div>
      <button @click="deleteNode(selectedNodeObj.id)">Eliminar Nodo</button>
      <button @click="startLink(selectedNodeObj.id)" :disabled="linkStart !== null">Crear Enlace</button>
      <button @click="toggleTraffic(selectedNodeObj.id)" :disabled="!hasLinks(selectedNodeObj.id)">
        {{ trafficActive[selectedNodeObj.id] ? 'Detener Tráfico' : 'Generar Tráfico' }}
      </button>
      <div v-if="linkStart !== null && linkStart !== selectedNodeObj.id">
        <button @click="finishLink(selectedNodeObj.id)">Enlazar con Nodo {{ selectedNodeObj.id }}</button>
        <button @click="cancelLink">Cancelar Enlace</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const threeContainer = ref(null)
const nodes = reactive([])
const links = reactive([])
let nodeId = 1

const selectedNode = ref(null)
const hoveredNode = ref(null)
const linkStart = ref(null)
const trafficActive = reactive({}) // { nodeId: true/false }

let scene, camera, renderer, controls

const selectedNodeObj = computed(() => nodes.find(n => n.id === selectedNode.value) || null)

function addNode() {
  const x = Math.random() * 80 - 40
  const y = Math.random() * 80 - 40
  const z = 0
  nodes.push({ id: nodeId++, pos: new THREE.Vector3(x, y, z) })
  drawScene()
}

function deleteNode(id) {
  const idx = nodes.findIndex(n => n.id === id)
  if (idx !== -1) nodes.splice(idx, 1)
  // Elimina enlaces asociados
  for (let i = links.length - 1; i >= 0; i--) {
    if (links[i].from === id || links[i].to === id) links.splice(i, 1)
  }
  if (selectedNode.value === id) selectedNode.value = null
  trafficActive[id] = false
  drawScene()
}

function startLink(id) {
  linkStart.value = id
}

function finishLink(id) {
  if (linkStart.value !== null && linkStart.value !== id) {
    links.push({ from: linkStart.value, to: id })
  }
  linkStart.value = null
  drawScene()
}

function cancelLink() {
  linkStart.value = null
}

function hasLinks(id) {
  return links.some(l => l.from === id || l.to === id)
}

// Path loss (FSPL) y alcance
function calcPathLoss(from, to) {
  const d = from.pos.distanceTo(to.pos)
  const freq = 915 // MHz
  // FSPL (dB) = 20*log10(d) + 20*log10(f) - 27.55
  const pathLoss = 20 * Math.log10(d || 1) + 20 * Math.log10(freq) - 27.55
  return { pathLoss, distance: d }
}
function getReachColor(pathLoss) {
  // Verde < 110dB, Amarillo < 120dB, Rojo >= 120dB
  if (pathLoss < 110) return 0x00ff00
  if (pathLoss < 120) return 0xffff00
  return 0xff0000
}

// Tráfico animado
const trafficSpheres = reactive({}) // { nodeId: { mesh, t, from, to } }
function toggleTraffic(id) {
  if (trafficActive[id]) {
    trafficActive[id] = false
    if (trafficSpheres[id]) {
      scene.remove(trafficSpheres[id].mesh)
      delete trafficSpheres[id]
    }
  } else {
    trafficActive[id] = true
    startTrafficAnimation(id)
  }
}

function startTrafficAnimation(id) {
  // Busca el primer enlace desde este nodo
  const link = links.find(l => l.from === id || l.to === id)
  if (!link) return
  const fromNode = nodes.find(n => n.id === link.from)
  const toNode = nodes.find(n => n.id === link.to)
  if (!fromNode || !toNode) return

  // Si ya existe, no crear otro
  if (trafficSpheres[id]) return

  const trafficSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  )
  scene.add(trafficSphere)
  trafficSpheres[id] = { mesh: trafficSphere, t: 0, from: fromNode, to: toNode }
}

function animateTraffic() {
  Object.keys(trafficSpheres).forEach(id => {
    const obj = trafficSpheres[id]
    if (!trafficActive[id]) return
    obj.t += 0.01
    if (obj.t > 1) obj.t = 0
    obj.mesh.position.lerpVectors(obj.from.pos, obj.to.pos, obj.t)
  })
}

function drawScene() {
  // Limpia la escena (excepto cámara y luz)
  while (scene.children.length > 2) scene.remove(scene.children[scene.children.length - 1])

  // Dibuja nodos
  nodes.forEach(node => {
    let color = 0x2196f3
    if (node.id === selectedNode.value) color = 0xff9800
    else if (node.id === hoveredNode.value) color = 0x4caf50
    const geometry = new THREE.SphereGeometry(3, 16, 16)
    const material = new THREE.MeshPhongMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(node.pos)
    mesh.userData.nodeId = node.id
    scene.add(mesh)
  })

  // Dibuja enlaces y muestra path loss
  links.forEach(link => {
    const fromNode = nodes.find(n => n.id === link.from)
    const toNode = nodes.find(n => n.id === link.to)
    if (fromNode && toNode) {
      const { pathLoss, distance } = calcPathLoss(fromNode, toNode)
      const color = getReachColor(pathLoss)
      const geometry = new THREE.BufferGeometry().setFromPoints([fromNode.pos, toNode.pos])
      const material = new THREE.LineBasicMaterial({ color, linewidth: 2 })
      const line = new THREE.Line(geometry, material)
      scene.add(line)

      // Etiqueta de path loss
      const mid = new THREE.Vector3().addVectors(fromNode.pos, toNode.pos).multiplyScalar(0.5)
      const sprite = makeTextSprite(`${pathLoss.toFixed(1)} dB`, color)
      sprite.position.copy(mid)
      scene.add(sprite)
    }
  })

  // Dibuja esferas de tráfico activas
  Object.values(trafficSpheres).forEach(obj => {
    scene.add(obj.mesh)
  })

  renderer.render(scene, camera)
}

// Utilidad para crear etiquetas de texto en Three.js
function makeTextSprite(message, color) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = '20px Arial'
  canvas.width = ctx.measureText(message).width + 20
  canvas.height = 32
  ctx.font = '20px Arial'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
  ctx.fillText(message, 10, 24)
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(canvas.width / 10, canvas.height / 10, 1)
  return sprite
}

// --- Drag & Drop de nodos ---
let draggingNodeId = null
let dragOffset = new THREE.Vector3()

function getIntersectedNode(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj.type === 'Mesh'))
  if (intersects.length > 0) {
    return intersects[0]
  }
  return null
}

onMounted(() => {
  // Escena, cámara y renderer
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, -120, 60)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  threeContainer.value.appendChild(renderer.domElement)

  // Luz
  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5)
  dirLight.position.set(50, 50, 100)
  scene.add(dirLight)

  // OrbitControls solo para pan y zoom (sin rotación)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableRotate = false
  controls.enablePan = true
  controls.screenSpacePanning = true
  controls.target.set(0, 0, 0)
  controls.update()

  // Click para seleccionar nodos
  renderer.domElement.addEventListener('click', (event) => {
    if (draggingNodeId !== null) return // No seleccionar mientras se arrastra
    const intersect = getIntersectedNode(event)
    if (intersect) {
      const nodeId = intersect.object.userData.nodeId
      selectedNode.value = nodeId
    } else {
      selectedNode.value = null
    }
    drawScene()
  })

  // Hover para nodos
  renderer.domElement.addEventListener('mousemove', (event) => {
    if (draggingNodeId !== null) return // No hover mientras se arrastra
    const intersect = getIntersectedNode(event)
    if (intersect) {
      hoveredNode.value = intersect.object.userData.nodeId
    } else {
      hoveredNode.value = null
    }
    drawScene()
  })

  // Drag & Drop
  renderer.domElement.addEventListener('mousedown', (event) => {
    const intersect = getIntersectedNode(event)
    if (intersect) {
      draggingNodeId = intersect.object.userData.nodeId
      dragOffset.copy(intersect.point).sub(intersect.object.position)
      controls.enabled = false
    }
  })

  renderer.domElement.addEventListener('mousemove', (event) => {
    if (draggingNodeId !== null) {
      // Proyecta el mouse al plano z=0
      const rect = renderer.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const intersection = new THREE.Vector3()
      raycaster.ray.intersectPlane(planeZ, intersection)
      const node = nodes.find(n => n.id === draggingNodeId)
      if (node) {
        node.pos.copy(intersection.sub(dragOffset))
        drawScene()
      }
    }
  })

  renderer.domElement.addEventListener('mouseup', () => {
    if (draggingNodeId !== null) {
      draggingNodeId = null
      controls.enabled = true
      drawScene()
    }
  })

  renderer.domElement.addEventListener('mouseleave', () => {
    if (draggingNodeId !== null) {
      draggingNodeId = null
      controls.enabled = true
      drawScene()
    }
  })

  drawScene()

  // Render loop para controles y tráfico
  function animate() {
    requestAnimationFrame(animate)
    controls.update()
    animateTraffic()
    renderer.render(scene, camera)
  }
  animate()
})
</script>