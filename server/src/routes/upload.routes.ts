import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma';
import { r2 } from '../config/r2';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    }
});

// Apply authentication middleware to ALL upload routes
router.post('/', authenticateUser, upload.single('image'), async (req, res) => {
    try {
        // 1. Verify authentication (done by middleware)
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 2. Backend decides the userId (NEVER from frontend)
        const userId = req.user.id;

        // 3. Validate file upload
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        // 4. Generate R2 key with userId in path
        const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
        const key = `profiles/${userId}/${Date.now()}.${fileExtension}`;

        // 5. Upload image to R2 with userId-based key
        await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            })
        );

        // 6. Store image key in database
        const imageUrl = `https://${process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_ACCOUNT_ID + '.r2.cloudflarestorage.com'}/${process.env.R2_BUCKET_NAME}/${key}`;

        // Get the next position for this user's photos
        const existingPhotos = await prisma.photo.findMany({
            where: { userId },
            orderBy: { position: 'desc' },
            take: 1,
        });

        const nextPosition = existingPhotos.length > 0 ? existingPhotos[0].position + 1 : 0;

        // Create photo record
        const photo = await prisma.photo.create({
            data: {
                userId,
                imageUrl: key, // Store the R2 key, not the full URL
                position: nextPosition,
                isPrimary: nextPosition === 0, // First photo is primary
            },
        });

        res.json({
            success: true,
            key,
            imageUrl,
            photo: {
                id: photo.id,
                position: photo.position,
                isPrimary: photo.isPrimary,
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

export default router;

