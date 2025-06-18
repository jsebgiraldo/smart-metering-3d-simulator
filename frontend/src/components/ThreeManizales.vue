<template>
<div ref="threeContainer" style="width: 100%; height: 100vh; position: relative;">
  <div 
    ref="coordLabel"
    style="position: absolute; top: 10px; left: 10px; background: #fff; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 14px; z-index: 10;">
    Lat: --, Lon: --
  </div>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import osmtogeojson from 'osmtogeojson'

const threeContainer = ref(null)
const coordLabel = ref(null)

onMounted(async () => {
  // Cargar archivo OSM
  const osmText = await fetch('/data/unal.osm').then(res => res.text())
  const parser = new DOMParser()
  const xml = parser.parseFromString(osmText, 'text/xml')

  const geojson = osmtogeojson(xml)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
  camera.position.set(0, -1000, 600)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  threeContainer.value.appendChild(renderer.domElement)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
  directionalLight.position.set(100, 100, 200)
  scene.add(directionalLight)

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableRotate = false
  controls.enablePan = true
  controls.minPolarAngle = 0                    // 0° (zenit)
  controls.maxPolarAngle = Math.PI          // 90° (horizonte)
  controls.update()



  // Encontrar centro del mapa
  let centerLon = 0
  let centerLat = 0
  let count = 0

  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon' && feature.properties.building) {
      const coords = feature.geometry.coordinates[0]
      coords.forEach(([lon, lat]) => {
        centerLon += lon
        centerLat += lat
        count++
      })
    }
  })

  centerLon /= count
  centerLat /= count

  const scale = 100000
  // Conversión lat/lon a X/Y
  function project(lon, lat) {
    
    const x = (lon - centerLon) * scale
    const y = (lat - centerLat) * scale
    return { x, y }
  }

  function inverseProject(x, y) {
    return {
      lon: x / scale + centerLon,
      lat: y / scale + centerLat
    };
  }

   // --- Dibujar capas ---
  geojson.features.forEach(feature => {
    const props = feature.properties

  // Edificios
  if (feature.geometry.type === 'Polygon' && props.building) {
    const coords = feature.geometry.coordinates[0]
    const shape = new THREE.Shape()

    coords.forEach(([lon, lat], i) => {
      const { x, y } = project(lon, lat)
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })

    const height = props.height ? parseFloat(props.height) :
                  (props.building === 'construction' ? 5 : 15 + Math.random() * 40)

    const color = props.building === 'construction' ? 0xffa500 : 0xcccccc

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })

    // --- Ajustar UVs para que la textura cubra toda la fachada ---
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const uvAttribute = geometry.attributes.uv;
    for (let i = 0; i < uvAttribute.count; i++) {
      const u = (uvAttribute.getX(i) - bbox.min.x) / size.x;
      const v = (uvAttribute.getY(i) - bbox.min.y) / size.y;
      uvAttribute.setXY(i, u, v);
    }
    // -------------------------------------------------------------

    const material = new THREE.MeshLambertMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.z = 0
    scene.add(mesh)
  }

    // Calles
    if (feature.geometry.type === 'LineString' && props.highway) {
      const coords = feature.geometry.coordinates.map(([lon, lat]) => {
        const { x, y } = project(lon, lat)
        return new THREE.Vector3(x, y, 0.1)
      })

      const geometry = new THREE.BufferGeometry().setFromPoints(coords)
      const material = new THREE.LineBasicMaterial({ color: 0x444444 })
      const line = new THREE.Line(geometry, material)
      scene.add(line)
    }

    // Parques / zonas verdes
    if (feature.geometry.type === 'Polygon' && (
        props.leisure === 'park' || props.leisure === 'playground' || props.leisure === 'pitch' ||
        props.landuse === 'grass' || props.landuse === 'forest' || props.natural === 'wood'
      )) {
      const coords = feature.geometry.coordinates[0]
      const shape = new THREE.Shape()

      coords.forEach(([lon, lat], i) => {
        const { x, y } = project(lon, lat)
        if (i === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      })

      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
      const material = new THREE.MeshLambertMaterial({ color: 0x228b22 })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.z = 0
      scene.add(mesh)
    }

    // Hospitales
    if (feature.geometry.type === 'Polygon' && (
        props.amenity === 'hospital' || props.healthcare === 'hospital'
      )) {
      const coords = feature.geometry.coordinates[0]
      const shape = new THREE.Shape()

      coords.forEach(([lon, lat], i) => {
        const { x, y } = project(lon, lat)
        if (i === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      })

      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false })
      const material = new THREE.MeshLambertMaterial({ color: 0xff0000 })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.z = 0
      scene.add(mesh)
    }
  })


// Ejemplo de nodos (puedes ponerlos donde quieras en el campus)
const nodos = [
  { lon: -75.471239, lat: 5.028960, label: 'Nodo 1' },
  { lon: -75.471239, lat: 5.029992, label: 'Nodo 2' },
  { lon: -75.472559, lat: 5.029018, label: 'Nodo 3' }
];

nodos.forEach(nodo => {
  const { x, y } = project(nodo.lon, nodo.lat);
  const geometry = new THREE.SphereGeometry(5, 16, 16);
  const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 40); // Altura sobre el suelo
  scene.add(mesh);
  // Puedes agregar etiquetas o tooltips si lo deseas
});



let isDragging = false
let previousMousePosition = { x: 0, y: 0 }

renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button === 0) { // solo botón izquierdo
    isDragging = true
    previousMousePosition.x = event.clientX
    previousMousePosition.y = event.clientY
  }
})

renderer.domElement.addEventListener('mousemove', (event) => {
  if (isDragging) {
    const deltaX = event.clientX - previousMousePosition.x
    const deltaY = event.clientY - previousMousePosition.y

    const panSpeed = 1.0 // ajusta la velocidad de pan

    camera.position.x -= deltaX * panSpeed
    camera.position.y += deltaY * panSpeed

    controls.target.x -= deltaX * panSpeed
    controls.target.y += deltaY * panSpeed

    previousMousePosition.x = event.clientX
    previousMousePosition.y = event.clientY
  }
})

renderer.domElement.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    isDragging = false
  }
})

renderer.domElement.addEventListener('mouseleave', () => {
  isDragging = false
})

renderer.domElement.addEventListener('mousemove', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1
  };

  // Proyectar a plano XY (z=0)
  const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
  const t = -camera.position.z / (vector.z - camera.position.z);
  const x = camera.position.x + (vector.x - camera.position.x) * t;
  const y = camera.position.y + (vector.y - camera.position.y) * t;

  // Convertir a lat/lon
  const { lat, lon } = inverseProject(x, y);

  if (coordLabel.value) {
    coordLabel.value.textContent = `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
  }
});

  // Animación
  function animate() {
    requestAnimationFrame(animate)
    controls.update() // importante!
    renderer.render(scene, camera)
  }
  animate()

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
})
</script>
