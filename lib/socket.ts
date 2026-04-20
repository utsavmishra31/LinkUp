import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_URL } from './api/client';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(API_URL, {
            transports: ['websocket'],
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log('🔌 Socket connected:', socket?.id);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
