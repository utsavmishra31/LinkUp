import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Router } from 'express';
import multer from 'multer';
import { r2 } from '../config/r2';

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const key = `profiles/${Date.now()}-${req.file.originalname}`;

        await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            })
        );

        res.json({ success: true, key });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

export default router;
