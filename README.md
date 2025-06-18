# Smart Metering 3D Simulator

This project allows you to visualize OSM maps and simulate intelligent metering networks in 3D using Vue 3 + Three.js.

## How to start

1. Place your `.osm` map file in:

```
frontend/public/data/manizales.osm
```

2. Install dependencies:

```
cd frontend
npm install
```

3. Start the development server:

```
npm run dev
```

4. Open your browser at:

```
http://localhost:5173
```

The component `ThreeManizales.vue` will render the OSM map in 2D.

## Notes

- Verify first that your `.osm` file contains buildings (`building` tags).
