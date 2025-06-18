<template>
  <div ref="sceneContainer" style="width: 100%; height: 100vh;"></div>
</template>

<script setup>
import { h, onMounted, ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import osmtogeojson from 'osmtogeojson';

const sceneContainer = ref(null);

onMounted(() => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a192f);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1000, 0); // Vista top-down

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  sceneContainer.value.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI / 2; // Limita la rotación para vista top-down
  controls.minPolarAngle = Math.PI / 2;
  controls.update();

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const refLon = -75.51481895;
  const refLat = 4.9972378;
  const scaleLon = 10000;
  const scaleLat = 10000;

  // Cargar el OSM
  fetch('/data/manizales.osm')
    .then(response => response.text())
    .then(xmlString => {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlString, 'text/xml');
      const geojson = osmtogeojson(xml);

      console.log('GeoJSON generado:', geojson);

      let featureCount = 0;

      geojson.features.forEach((feature, i) => {
        if (1) {
          featureCount++;

          const coords = feature.geometry.coordinates;
          coords.forEach((polygon, j) => {
            const shape = new THREE.Shape();

            polygon[0].forEach((point, index) => {
              const [lon, lat] = point;
              const x = (lon - refLon) * scaleLon;
              const z = (lat - refLat) * scaleLat;

              if (index === 0) {
                shape.moveTo(x, z);
                console.log(`Feature[${i}] Polygon[${j}] start point (x,z)=(${x.toFixed(2)}, ${z.toFixed(2)})`);
              } else {
                shape.lineTo(x, z);
              }
            });

            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({
              color: 0x00ccff,
              side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0;
            scene.add(mesh);
          });
        }
      });

      console.log(`Features 2D dibujadas: ${featureCount}`);
    });

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
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