import cors from 'cors';
import express from 'express';

import uploadRoutes from './routes/upload.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/upload', uploadRoutes);

export default app;
