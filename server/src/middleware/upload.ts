import multer from 'multer';
import type { Request } from 'express';
import { CONFIG } from '../config.js';

// Safe memory storage for incoming evidence images
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (CONFIG.ACCEPTED_MIME_TYPES.includes(file.mimetype as any)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type '${file.mimetype}'. Only JPEG, PNG, and WebP images are accepted.`
      )
    );
  }
};

export const evidenceUpload = multer({
  storage,
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE_BYTES,
    files: 1, // Single image upload per complaint in this foundation
  },
  fileFilter,
});
