import { Router } from 'express';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../config/prisma';
import { r2 } from '../config/r2';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed!'));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for videos
    }
});

// RevenueCat REST API endpoint (example API key)
const RC_API_KEY = process.env.RC_API_KEY || 'goog_example_key_replace_me';

// 1. Verify Purchase and Store Creator Mapping
router.post('/verify-purchase', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { creatorId, planId, rcAppUserId } = req.body;

        if (!userId || !creatorId || !planId || !rcAppUserId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Ideally, we verify with RevenueCat REST API
        // GET https://api.revenuecat.com/v1/subscribers/{rcAppUserId}
        // For production, you fetch it using the RC_API_KEY
        // Example logic:
        /*
        const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${rcAppUserId}`, {
            headers: { Authorization: `Bearer ${RC_API_KEY}` }
        });
        const rcData = await rcRes.json();
        // Check if rcData.subscriber.entitlements["creator_access"] is active
        */

        // Assuming verification success for MVP
        // Calculate endDate (e.g. +30 days)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        // Store Mapping in our DB
        const subscription = await prisma.subscription.upsert({
            where: {
                userId_creatorId: {
                    userId,
                    creatorId
                }
            },
            update: {
                planId,
                endDate,
                isActive: true
            },
            create: {
                userId,
                creatorId,
                planId,
                endDate,
                isActive: true
            }
        });

        res.json({ success: true, subscription });
    } catch (error: any) {
        console.error('Verify purchase error:', error);
        res.status(500).json({ error: 'Failed to verify purchase' });
    }
});

// 2. Fetch Premium Content securely
router.get('/content/:creatorId', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.id;
        const creatorId = req.params.creatorId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Secure Access Check!
        const activeSub = await prisma.subscription.findFirst({
            where: {
                userId,
                creatorId,
                isActive: true,
                endDate: { gt: new Date() } // MUST be in the future
            }
        });

        // Also allow access if the user IS the creator
        if (!activeSub && userId !== creatorId) {
            return res.status(403).json({ error: 'Access denied. Active subscription required.' });
        }

        // Fetch the exclusive media
        const content = await prisma.exclusiveMedia.findMany({
            where: { creatorId },
            orderBy: { createdAt: 'desc' }
        });

        // In a real app, generate Cloudflare R2 Signed URLs here
        // const signedContent = content.map(item => ({ ...item, url: generateSignedUrl(item.mediaUrl) }));
        
        res.json({ success: true, content });
    } catch (error: any) {
        console.error('Fetch premium content error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// 3. Upload Exclusive Content (Only for Creators)
router.post('/upload', authenticateUser, upload.single('media'), async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Check if user is a creator
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.isCreator) {
            return res.status(403).json({ error: 'You must become a creator to upload exclusive content.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No media file provided.' });
        }

        const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
        const isVideo = req.file.mimetype.startsWith('video/');
        const key = `exclusive/${userId}/${Date.now()}.${fileExtension}`;

        // Upload to Cloudflare R2
        await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            })
        );

        // Save in Database
        const media = await prisma.exclusiveMedia.create({
            data: {
                creatorId: userId,
                mediaUrl: key,
                type: isVideo ? 'video' : 'image',
                caption: req.body.caption || null
            }
        });

        res.json({ success: true, media });
    } catch (error: any) {
        console.error('Upload exclusive media error:', error);
        res.status(500).json({ error: 'Failed to upload media' });
    }
});

// 4. Unlock Creator Mode (Platform Fee)
router.post('/unlock-creator', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { 
                isCreator: true,
                creatorExpiresAt: expiryDate
            }
        });

        res.json({ 
            success: true, 
            isCreator: updatedUser.isCreator,
            expiresAt: updatedUser.creatorExpiresAt
        });
    } catch (error: any) {
        console.error('Unlock creator mode error:', error);
        res.status(500).json({ error: 'Failed to unlock creator mode' });
    }
});

export default router;
