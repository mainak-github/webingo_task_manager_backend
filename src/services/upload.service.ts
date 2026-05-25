import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

export interface UploadResult {
  name: string;
  url: string;
  type: string;
  size: number;
}

export class UploadService {
  async uploadFile(file: Express.Multer.File): Promise<UploadResult> {
    const fileType = path.extname(file.originalname).toLowerCase();
    
    if (isCloudinaryConfigured) {
      try {
        // Stream / upload file to Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(file.path, {
          folder: 'collaborative_project_assets',
          resource_type: 'auto',
        });

        // Clean up local temp file synchronously
        fs.unlink(file.path, (err) => {
          if (err) console.error('[Upload] Failed to clean up temp file:', err);
        });

        return {
          name: file.originalname,
          url: uploadResponse.secure_url,
          type: fileType,
          size: file.size,
        };
      } catch (error) {
        console.error('[Upload] Cloudinary upload error, falling back to local serve:', error);
      }
    }

    // Local Fallback: return static file URL
    const relativeUrl = `/uploads/${file.filename}`;
    const localUrl = `${env.clientUrl.replace(':5173', ':5000')}${relativeUrl}`; // fallback server host url

    return {
      name: file.originalname,
      url: localUrl,
      type: fileType,
      size: file.size,
    };
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (isCloudinaryConfigured && fileUrl.includes('cloudinary')) {
      try {
        // Extract public ID from Cloudinary URL
        const parts = fileUrl.split('/');
        const folderIndex = parts.indexOf('collaborative_project_assets');
        
        if (folderIndex !== -1) {
          const publicIdWithExt = parts.slice(folderIndex).join('/');
          const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
          await cloudinary.uploader.destroy(publicId);
        }
      } catch (error) {
        console.error('[Upload] Cloudinary deletion error:', error);
      }
      return;
    }

    // Local File deletion fallback
    if (fileUrl.includes('/uploads/')) {
      const filename = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
      const filePath = path.join(__dirname, '../../uploads', filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error('[Upload] Local file deletion error:', err);
        });
      }
    }
  }
}

export const uploadService = new UploadService();
export default uploadService;
