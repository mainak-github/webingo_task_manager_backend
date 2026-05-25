import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

let isCloudinaryConfigured = false;

if (env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
  isCloudinaryConfigured = true;
  console.log('[Upload] Cloudinary configured successfully.');
} else {
  console.warn('[Upload] Cloudinary variables missing, local file server fallback active.');
}

export { cloudinary, isCloudinaryConfigured };
