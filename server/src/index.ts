import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { CONFIG } from './config.js';
import { evidenceUpload } from './middleware/upload.js';
import { verifyComplaint } from './services/verificationEngine.js';
import type { ComplaintInput, ExistingComplaint } from './types/verification.js';
import { authRouter } from './routes/authRoutes.js';
import { complaintRouter } from './routes/complaintRoutes.js';
import { officerRouter } from './routes/officerRoutes.js';
import { followthroughRouter } from './routes/followthroughRoutes.js';
import { routingRouter } from './routes/routingRoutes.js';
import { getMysuruWardsGeoJson } from './services/wardService.js';
import { initDatabase } from './db/sqlite.js';
import { seedDemoData } from './db/seedDemoData.js';

// Initialize SQLite database
initDatabase();

// Only seed synthetic demo data if explicitly commanded via environment variable
if (process.env.SEED_DEMO_DATA === 'true') {
  seedDemoData();
}

export const app = express();

// Middlewares
app.use(
  cors({
    origin: CONFIG.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/complaints', complaintRouter);
app.use('/api/officer', officerRouter);
app.use('/api/followthrough', followthroughRouter);
app.use('/api/routing', routingRouter);

// Ward Boundaries GeoJSON Endpoint
app.get('/api/wards/geojson', (_req, res) => {
  const geojson = getMysuruWardsGeoJson();
  if (!geojson) {
    res.status(404).json({ error: 'Ward boundaries GeoJSON not found.' });
    return;
  }
  res.status(200).json(geojson);
});

// 1. Health-check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Civic Trust Verification Service',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// 2. Direct Verification Endpoint (JSON payload)
app.post('/api/verify', (req, res) => {
  const input = req.body as ComplaintInput;
  const referencePool = (req.body.referencePool as ExistingComplaint[]) || [];

  if (!input || !input.category || !input.description) {
    res.status(400).json({
      error: 'Missing required complaint parameters (category, description).',
    });
    return;
  }

  const result = verifyComplaint(input, referencePool);
  res.status(200).json(result);
});

// 3. Multipart Upload & Verify Endpoint
app.post('/api/verify/multipart', evidenceUpload.single('evidenceImage'), (req, res) => {
  const { category, customCategory, description, observedDate, locationArea, addressText } = req.body;

  const hasImage = !!req.file;
  const input: ComplaintInput = {
    category,
    customCategory,
    description,
    observedDate,
    locationArea,
    addressText,
    hasImage,
  };

  const referencePool: ExistingComplaint[] = [];
  const result = verifyComplaint(input, referencePool);

  res.status(200).json({
    ...result,
    evidenceFile: req.file
      ? {
          filename: req.file.originalname,
          sizeBytes: req.file.size,
          mimetype: req.file.mimetype,
          note: 'Photo accepted as citizen-submitted evidence only. Authenticity unverified.',
        }
      : null,
  });
});

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: `File is too large. Maximum allowed size is ${CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
        });
        return;
      }
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    }

    if (err && err.message) {
      res.status(400).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error.' });
  }
);

// Only listen if not imported by test runner
if (process.env.NODE_ENV !== 'test') {
  app.listen(CONFIG.PORT, () => {
    console.log(`[Civic Trust] Backend listening on http://localhost:${CONFIG.PORT}`);
  });
}
