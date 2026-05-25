import { Router } from 'express';
import { upload } from '../middleware/upload.middleware';
import { protect } from '../middleware/auth.middleware';
import { uploadService } from '../services/upload.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequestError } from '../errors/BadRequestError';

const router = Router();

// Generic file upload route
router.post('/', protect, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('Please provide a file to upload.');
  }
  const result = await uploadService.uploadFile(req.file);
  res.status(200).json(new ApiResponse(200, result, 'File uploaded successfully.'));
}));

export default router;
