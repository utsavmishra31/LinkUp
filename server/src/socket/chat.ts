import { createClient } from '@supabase/supabase-js';
import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function setupSocket(io: SocketIOServer) {
    io.on('connection', (socket) => {
        console.log('🔌 Socket connected:', socket.id);

        // User joins a chat room (chatId acts as room ID)
        socket.on('join_room', ({ chat_id }: { chat_id: string }) => {
            socket.join(chat_id);
            console.log(`Socket ${socket.id} joined room: ${chat_id}`);
        });

        // User sends a message
        socket.on('send_message', async ({
            chat_id,
            sender_id,
            text,
        }: {
            chat_id: string;
            sender_id: string;
            text: string;
        }) => {
            try {
                // Save to Supabase (Prisma requires manual UUID here)
                const msgId = crypto.randomUUID();
                const { data, error } = await supabase
                    .from('messages')
                    .insert([{ id: msgId, chatId: chat_id, senderId: sender_id, text: text }])
                    .select()
                    .single();

                if (error) {
                    console.error('Error saving message:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                    return;
                }

                // Broadcast to everyone in the room (including sender for confirmation)
                io.to(chat_id).emit('new_message', data);
            } catch (err) {
                console.error('Socket send_message error:', err);
            }
        });

        socket.on('leave_room', ({ chat_id }: { chat_id: string }) => {
            socket.leave(chat_id);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected:', socket.id);
        });
    });
}
