import { createClient } from '@supabase/supabase-js';
import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';
import { setUserOnline, setUserOffline } from '../controllers/discovery.controller';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function setupSocket(io: SocketIOServer) {
    io.on('connection', (socket) => {
        console.log('🔌 Socket connected:', socket.id);

        // Fix #5: Mark user online in Redis on Socket connect
        socket.on('identify', ({ user_id }: { user_id: string }) => {
            (socket as any).userId = user_id;
            setUserOnline(user_id);
        });

        socket.on('join_room', ({ chat_id }: { chat_id: string }) => {
            socket.join(chat_id);
            console.log(`Socket ${socket.id} joined room: ${chat_id}`);
        });

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

                io.to(chat_id).emit('new_message', data);
            } catch (err) {
                console.error('Socket send_message error:', err);
            }
        });

        socket.on('leave_room', ({ chat_id }: { chat_id: string }) => {
            socket.leave(chat_id);
        });

        socket.on('typing_start', ({ chat_id, sender_id }: { chat_id: string; sender_id: string }) => {
            socket.to(chat_id).emit('user_typing', { user_id: sender_id });
        });

        socket.on('typing_stop', ({ chat_id, sender_id }: { chat_id: string; sender_id: string }) => {
            socket.to(chat_id).emit('user_stopped_typing', { user_id: sender_id });
        });

        // Fix #5: Mark user offline on disconnect — prevents ghost online status
        socket.on('disconnect', () => {
            const userId = (socket as any).userId;
            if (userId) setUserOffline(userId);
            console.log('🔌 Socket disconnected:', socket.id);
        });
    });
}
