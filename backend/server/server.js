// src/server/server.js

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static('src/public'));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});