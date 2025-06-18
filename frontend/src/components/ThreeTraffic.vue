<template>
  <div ref="sceneContainer" style="width: 100%; height: 100vh;"></div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import osmtogeojson from 'osmtogeojson';

const sceneContainer = ref(null);

onMounted(() => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a192f);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(150, 100, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  sceneContainer.value.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 40, 0);
  controls.update();

  // Lights
  const ambientLight = new THREE.AmbientLight(0x404040, 2);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(100, 200, 100);
  scene.add(directionalLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(500, 500);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.8 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  scene.add(ground);

  // Cargar edificios desde OSM
  const refLon = -75.5144;
  const refLat = 5.0703;
  const scaleLon = 10000;
  const scaleLat = 10000;

  fetch('/data/manizales.osm')
  .then(response => response.text())
  .then(xmlString => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlString, 'text/xml');
    const geojson = osmtogeojson(xml);

    geojson.features.forEach(feature => {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const coords = feature.geometry.coordinates;
        coords.forEach(polygon => {
          const shape = new THREE.Shape();

          polygon[0].forEach((point, index) => {
            const [lon, lat] = point;
            const x = (lon - refLon) * scaleLon;
            const z = (lat - refLat) * scaleLat;

            if (index === 0) {
              shape.moveTo(x, z);
            } else {
              shape.lineTo(x, z);
            }
          });

          const height = (feature.properties.tags?.height
            ? parseFloat(feature.properties.tags.height)
            : 10);

          const extrudeSettings = { depth: height, bevelEnabled: false };
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const material = new THREE.MeshStandardMaterial({ color: 0x999999 });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.y = 0;
          scene.add(mesh);
        });
      }
    });
  });

  // AP positions
  const apPositions = [
    new THREE.Vector3(-50, 0, -30),
    new THREE.Vector3(0, 0, 50),
    new THREE.Vector3(50, 0, -40)
  ];

  const staPosition = new THREE.Vector3(0, 80, 0);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const apMeshes = [];

  let hoveredAP = null;

  apPositions.forEach((pos, index) => {
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, shininess: 100 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 4), material);
    box.position.copy(pos);
    box.position.y = 4;
    scene.add(box);

    apMeshes.push({ mesh: box, info: { ip: `192.168.1.${index + 1}`, label: `AP-${index + 1}` } });

    const points = [pos, staPosition];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x00ffff }));
    scene.add(line);
  });

  const staMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff, shininess: 150 });
  const sta = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 12, 32), staMaterial);
  sta.position.copy(staPosition);
  scene.add(sta);

  const packetMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const packets = [];

  apPositions.forEach(pos => {
    const packet = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), packetMaterial);
    scene.add(packet);
    packets.push({
      mesh: packet,
      start: pos.clone(),
      end: staPosition.clone(),
      t: Math.random()
    });
  });

  sceneContainer.value.addEventListener('mousedown', event => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(apMeshes.map(item => item.mesh));

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const apData = apMeshes.find(item => item.mesh === clickedMesh);
      if (apData) {
        alert(`IP: ${apData.info.ip}\nLabel: ${apData.info.label}`);
      }
    }
  });

  sceneContainer.value.addEventListener('mousemove', event => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(apMeshes.map(item => item.mesh));

    if (intersects.length > 0) {
      const hoveredMesh = intersects[0].object;
      if (hoveredAP !== hoveredMesh) {
        if (hoveredAP) {
          hoveredAP.material.color.set(0x00ff00);
        }
        hoveredAP = hoveredMesh;
        hoveredAP.material.color.set(0xffff00);
      }
    } else {
      if (hoveredAP) {
        hoveredAP.material.color.set(0x00ff00);
        hoveredAP = null;
      }
    }
  });

  let clock = new THREE.Clock();

  const animate = () => {
    requestAnimationFrame(animate);

    let delta = clock.getDelta();

    controls.update();

    packets.forEach(packet => {
      packet.t += 0.01 * delta * 60;
      if (packet.t > 1) packet.t = 0;

      packet.mesh.position.lerpVectors(packet.start, packet.end, packet.t);
    });

    renderer.render(scene, camera);
  };

  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
});
</script>