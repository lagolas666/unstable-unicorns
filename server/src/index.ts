import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cardsRouter from './routes/cards';
import uploadRouter from './routes/upload';
import gameRouter from './routes/game';
import { registerSocketHandlers } from './socket/handlers';
import importRouter from './routes/import';
import unicornsRouter from './routes/unicorns';
import lobbyRouter from './routes/lobby';
import botRouter from './routes/bot';
import simRouter from './routes/sim';

const app = express();

// Enable CORS and expose X-Total-Count header for pagination
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Do not restrict allowedHeaders; let cors reflect request headers by default
  exposedHeaders: ['X-Total-Count', 'x-total-count', '*'],
}));
// Additionally ensure header exposure in case of proxies
app.use((_req, res, next) => {
  // Expose all headers plus explicit total-count variants
  res.setHeader('Access-Control-Expose-Headers', '*, X-Total-Count, x-total-count');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Static for uploads
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/cards', cardsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/game', gameRouter);
app.use('/api/import', importRouter);
app.use('/api/unicorns', unicornsRouter);
// Lobby API routes
app.use('/api/lobby', lobbyRouter);
// Bot API routes
app.use('/api/bot', botRouter);
// Simulation API
app.use('/api/sim', simRouter);

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uu_new';

let server: http.Server | null = null;
let io: SocketIOServer | null = null;

function startServer(retry = 0) {
  if (server) {
    // Already started in this process
    return;
  }
  try {
    // Create HTTP server and attach Socket.IO
    server = http.createServer(app);
    io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
    // Expose IO to routes
    (app as any).set('io', io);
    // Единый socket-слой полного движка (задача 6b-3b):
    // REST-роуты и socket-события работают с одним и тем же gameStore.
    // Легаси-обработчики gameInstance (join_room / start_game / end_turn) убраны:
    // они создавали второе состояние, в котором нельзя разыграть ни одну карту.
    registerSocketHandlers(io);

    server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
    server.on('error', (err: any) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error('Error: port in use, will retry...', err.message);
        if (server) {
          try { server.close(); } catch {}
          server = null;
        }
        io = null;
        const nextRetry = Math.min(retry + 1, 5);
        const delay = 300 + nextRetry * 200;
        setTimeout(() => startServer(nextRetry), delay);
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (err: any) {
    if (err && err.code === 'EADDRINUSE') {
      console.error('Listen threw EADDRINUSE, retrying...');
      const nextRetry = Math.min(retry + 1, 5);
      const delay = 300 + nextRetry * 200;
      setTimeout(() => startServer(nextRetry), delay);
    } else {
      throw err;
    }
  }
}

// In non-test environment, connect to MongoDB and start server
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('MongoDB connected');
      startServer();
    })
    .catch(err => {
      console.error('MongoDB connection error', err);
      process.exit(1);
    });
}

export default app;
