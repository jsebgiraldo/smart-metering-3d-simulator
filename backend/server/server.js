const express = require('express');
const app = express();
const http = require('http').createServer(app);
const WebSocket = require('ws');

const wss = new WebSocket.Server({ server: http });

const PORT = process.env.PORT || 3000;

app.use(require('cors')());
app.use(express.static('../frontend/dist')); // Servir la app de Vue en producción

app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' });
});

// WebSocket para simulación de red
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected.');

  const sendPacket = () => {
    ws.send(JSON.stringify({
      type: 'packet',
      timestamp: Date.now(),
      from: 'AP1',
      to: 'STA',
      latency: Math.random() * 100 + 50
    }));
  };

  const interval = setInterval(sendPacket, 1000);

  ws.on('close', () => {
    console.log('WebSocket client disconnected.');
    clearInterval(interval);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});