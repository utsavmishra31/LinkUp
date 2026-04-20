import { useAuthContext } from '@/lib/auth/AuthContext';
import { disconnectSocket, getSocket } from '@/lib/socket';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Message = {
    id: string;
    text: string; // our prop for rendering
    content: string; // from db
    sender_id: string;
    created_at: string;
};

export default function ChatScreen() {
    const { user } = useAuthContext();
    const router = useRouter();
    const params = useLocalSearchParams();
    const matchId = params.matchId as string;
    const otherUserName = params.otherUserName as string;

    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!user || !matchId) return;

        let activeChatId: string;
        const socket = getSocket();

        const initChat = async () => {
            try {
                // Determine chatId from matchId
                const { data: chatData, error } = await supabase
                    .from('chats')
                    .select('id')
                    .eq('matchId', matchId)
                    .single();

                if (error) throw error;
                if (!chatData?.id) return;

                activeChatId = chatData.id;
                setChatId(activeChatId);

                // Fetch existing messages
                await fetchMessages(activeChatId);

                // Connect socket
                socket.emit('join_room', { chat_id: activeChatId });

                socket.on('new_message', (msg: any) => {
                    setMessages((prev) => {
                        if (prev.some(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                });
            } catch (err) {
                console.error("Error initializing chat:", err);
                setLoading(false);
            }
        };

        initChat();

        return () => {
            if (activeChatId) {
                socket.emit('leave_room', { chat_id: activeChatId });
                socket.off('new_message');
            }
        };
    }, [user, matchId]);

    const fetchMessages = async (cId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chatId', cId)
                .order('createdAt', { ascending: true }); // Prisma usually generates createdAt

            if (error) throw error;
            
            setMessages(data || []);
            setLoading(false);
            
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
        } catch (error) {
            console.error('Error fetching messages:', error);
            setLoading(false);
        }
    };

    const handleSend = () => {
        if (!inputText.trim() || !user || !chatId) return;

        const content = inputText.trim();
        setInputText('');

        const socket = getSocket();
        const tempId = `temp-${Date.now()}`;
        setMessages(prev => [...prev, { id: tempId, text: content, content: content, sender_id: user.id, senderId: user.id, created_at: new Date().toISOString(), createdAt: new Date().toISOString() } as unknown as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        socket.emit('send_message', {
            chat_id: chatId,
            sender_id: user.id,
            text: content
        });
    };

    const renderMessage = ({ item }: { item: Message }) => {
        // Handle both older schema field (sender_id) and new Prisma field (senderId) during temp transition if needed
        const sId = (item as any).senderId || item.sender_id;
        const isMyMessage = sId === user?.id;

        return (
            <View className={`w-full flex-row my-1 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                <View className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMyMessage ? 'bg-blue-500 rounded-tr-sm' : 'bg-gray-100 rounded-tl-sm'}`}>
                    <Text className={`text-base ${isMyMessage ? 'text-white' : 'text-gray-900'}`}>{item.text}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-white" style={{ zIndex: 10 }}>
                <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-lg font-bold text-black">{otherUserName || 'Chat'}</Text>
                </View>
            </View>

            {/* Chat Area */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color="#000" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1, justifyContent: 'flex-end' }}
                        showsVerticalScrollIndicator={false}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    />
                )}

                {/* Input Area */}
                <View className="px-4 py-3 border-t border-gray-100 bg-white flex-row items-end">
                    <TextInput
                        className="flex-1 bg-gray-50 rounded-3xl px-5 py-3 pt-3 text-base text-black max-h-32 mr-3"
                        placeholder="Type a message..."
                        placeholderTextColor="#9ca3af"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity 
                        onPress={handleSend} 
                        disabled={!inputText.trim()}
                        className={`w-12 h-12 rounded-full items-center justify-center ${inputText.trim() ? 'bg-blue-500' : 'bg-gray-200'}`}
                    >
                        <Ionicons name="send" size={20} color="white" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
