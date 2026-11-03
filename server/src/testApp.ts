import express from 'express';
import cors from 'cors';
import gameRouter from './routes/game';

// Minimal Express app for tests (no DB, no HTTP server). Mount only routes needed.
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Provide a dummy IO so routes can safely call app.get('io')
(app as any).set('io', null);

app.use('/api/game', gameRouter);

export default app;
