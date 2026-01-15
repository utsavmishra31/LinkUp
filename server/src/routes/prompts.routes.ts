import { Router } from 'express';
import { prisma } from '../config/prisma';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

interface Prompt {
    question: string;
    answer: string;
}

// Apply authentication middleware to ALL prompts routes
router.post('/', authenticateUser, async (req, res) => {
    try {
        // 1. Verify authentication (done by middleware)
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 2. Backend decides the userId (NEVER from frontend)
        const userId = req.user.id;

        // 3. Validate prompts data
        const { prompts } = req.body;

        if (!prompts || !Array.isArray(prompts)) {
            return res.status(400).json({
                success: false,
                error: 'Prompts must be an array'
            });
        }

        // Filter out empty prompts and validate structure
        const validPrompts = prompts.filter((p: Prompt) =>
            p &&
            typeof p.question === 'string' &&
            typeof p.answer === 'string' &&
            p.question.trim() !== '' &&
            p.answer.trim() !== ''
        );

        // Require at least 1 prompt
        if (validPrompts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one prompt is required'
            });
        }

        // Limit to 3 prompts max
        if (validPrompts.length > 3) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 3 prompts allowed'
            });
        }

        // 4. Save prompts to profile (upsert to handle both create and update)
        const profile = await prisma.profile.upsert({
            where: { userId },
            create: {
                userId,
                prompts: validPrompts,
            },
            update: {
                prompts: validPrompts,
            },
        });

        res.json({
            success: true,
            prompts: profile.prompts,
        });
    } catch (error) {
        console.error('Prompts save error:', error);
        res.status(500).json({ success: false, error: 'Failed to save prompts' });
    }
});

export default router;
