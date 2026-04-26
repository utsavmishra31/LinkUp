import cors from 'cors';
import express from 'express';

import promptsRoutes from './routes/prompts.routes';
import uploadRoutes from './routes/upload.routes';
import premiumRoutes from './routes/premium.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/upload', uploadRoutes);
app.use('/prompts', promptsRoutes);
app.use('/premium', premiumRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.status(500).json({ error: 'Internal server error' });
});

export default app;

