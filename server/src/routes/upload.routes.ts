import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

        // 6. Handle Replacement vs New Creation
        const replaceId = req.body.replaceId; // Check if we are replacing an existing photo
        let photo;

        if (replaceId) {
            // --- REPLACEMENT LOGIC ---
            // 1. Verify ownership
            const existingPhoto = await prisma.photo.findUnique({
                where: { id: replaceId },
            });

            if (!existingPhoto) {
                return res.status(404).json({ error: 'Photo to replace not found' });
            }

            if (existingPhoto.userId !== userId) {
                return res.status(403).json({ error: 'Unauthorized to replace this photo' });
            }

            // 2. Delete old image from R2 (optional but good for cleanup)
            if (existingPhoto.imageUrl) {
                try {
                    await r2.send(
                        new DeleteObjectCommand({
                            Bucket: process.env.R2_BUCKET_NAME,
                            Key: existingPhoto.imageUrl,
                        })
                    );
                } catch (r2Error) {
                    console.error('Error deleting old image from R2 during replacement:', r2Error);
                    // Non-critical, continue
                }
            }

            // 3. Update DB record (keep position and ID same)
            photo = await prisma.photo.update({
                where: { id: replaceId },
                data: {
                    imageUrl: key,
                    // Position and isPrimary remain unchanged
                },
            });

        } else {
            // --- CREATE NEW LOGIC ---
            // Create photo record with retry logic for position conflicts
            let retries = 3;
            while (retries > 0) {
                try {
                    // Get the next position for this user's photos
                    const existingPhotos = await prisma.photo.findMany({
                        where: { userId },
                        orderBy: { position: 'desc' },
                        take: 1,
                    });

                    const nextPosition = existingPhotos.length > 0 ? existingPhotos[0].position + 1 : 0;

                    photo = await prisma.photo.create({
                        data: {
                            userId,
                            imageUrl: key,
                            position: nextPosition,
                            isPrimary: nextPosition === 0,
                        },
                    });
                    break; // Success, exit loop
                } catch (error: any) {
                    // Check for P2002 (Unique constraint failed) on position
                    if (error.code === 'P2002' &&
                        (error.meta?.target?.includes('position') ||
                            JSON.stringify(error.meta).includes('position'))) {
                        retries--;
                        if (retries === 0) throw error;
                        // Wait a bit before retrying to let other transaction finish
                        await new Promise(resolve => setTimeout(resolve, 100));
                        continue;
                    }
                    throw error; // Other error, rethrow
                }
            }
        }

        if (!photo) {
            throw new Error('Failed to create or update photo record');
        }

        res.json({
            success: true,
            id: photo.id,          // ✅ frontend expects this
            imageUrl: key,         // ✅ store R2 key only
            position: photo.position,
            isPrimary: photo.isPrimary,
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Upload failed',
            details: JSON.stringify(error)
        });
    }
});

// Delete photo route
router.delete('/:id', authenticateUser, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.user.id;
        const photoId = req.params.id;

        if (!photoId) {
            return res.status(400).json({ error: 'Photo ID is required' });
        }

        console.log(`[DELETE] Attempting to delete photoId: ${photoId} for user: ${userId}`);

        // 1. Find the photo to ensure it belongs to the user
        const photo = await prisma.photo.findUnique({
            where: { id: photoId },
        });

        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        if (photo.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this photo' });
        }

        // 2. Delete from R2
        if (photo.imageUrl) {
            try {
                // The imageUrl in DB is actually the key (based on the POST route logic)
                // If it's a full URL, we might need to parse it, but looking at POST it saves 'key'
                await r2.send(
                    new DeleteObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: photo.imageUrl,
                    })
                );
            } catch (r2Error) {
                console.error('Error deleting from R2:', r2Error);
                // Continue to delete from DB even if R2 fails? 
                // Usually yes, to keep DB clean. Orphaned files can be cleaned up later.
            }
        }

        // 3. Delete from Database
        await prisma.photo.delete({
            where: { id: photoId },
        });

        // 4. Reorder remaining photos
        const remainingPhotos = await prisma.photo.findMany({
            where: { userId },
            orderBy: { position: 'asc' },
        });

        // Update sequentially to avoid unique constraint violations (e.g. updating 2->1 while 1 is still at 1)
        for (let i = 0; i < remainingPhotos.length; i++) {
            const p = remainingPhotos[i];
            if (p.position !== i) {
                await prisma.photo.update({
                    where: { id: p.id },
                    data: { position: i },
                });
            }
        }

        // 5. Ensure one primary photo exists
        const primaryExists = await prisma.photo.findFirst({
            where: { userId, isPrimary: true },
        });

        if (!primaryExists) {
            const firstPhoto = await prisma.photo.findFirst({
                where: { userId },
                orderBy: { position: 'asc' },
            });

            if (firstPhoto) {
                await prisma.photo.update({
                    where: { id: firstPhoto.id },
                    data: { isPrimary: true },
                });
            }
        }

        res.json({ success: true, message: 'Photo deleted successfully' });

    } catch (error: any) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Delete failed',
            details: JSON.stringify(error)
        });
    }
});

// Reorder photos route
router.patch('/reorder', authenticateUser, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.user.id;
        const { photos } = req.body as { photos: { id: string; position: number }[] };


        if (!photos || !Array.isArray(photos)) {
            return res.status(400).json({ error: 'Invalid request: photos array required' });
        }

        // Validate all photos belong to the user
        const photoIds = photos.map(p => p.id);
        const existingPhotos = await prisma.photo.findMany({
            where: {
                id: { in: photoIds },
                userId,
            },
        });


        if (existingPhotos.length !== photoIds.length) {
            return res.status(403).json({ error: 'Some photos do not belong to this user' });
        }

        // Update positions in a transaction
        // To avoid unique constraint violations, use an offset approach:
        // Add 1000 to all positions first, then set to final positions
        const OFFSET = 1000;

        await prisma.$transaction([
            // Step 1: Add offset to all positions to avoid conflicts
            ...photos.map(({ id }, index) =>
                prisma.photo.update({
                    where: { id },
                    data: { position: OFFSET + index },
                })
            ),
            // Step 2: Set to final positions
            ...photos.map(({ id, position }) =>
                prisma.photo.update({
                    where: { id },
                    data: {
                        position,
                        isPrimary: position === 0,
                    },
                })
            ),
        ]);

        res.json({ success: true, message: 'Photos reordered successfully' });

    } catch (error: any) {
        console.error('[REORDER] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Reorder failed',
        });
    }
});

export default router;

