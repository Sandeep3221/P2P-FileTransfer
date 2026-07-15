const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const setupWebSocket = require('./websocket');
const configController = require('./controllers/config');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` here its per 15 minutes
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api/', apiLimiter);

// API Routes
app.get('/api/config', configController.getConfig);

// WebSocket setup
const wss = new WebSocketServer({
    server,
    maxPayload: 64 * 1024, // 64 KB
    path: '/ws'
});

setupWebSocket(wss);

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
