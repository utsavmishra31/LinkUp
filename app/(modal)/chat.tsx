import { useAuthContext } from '@/lib/auth/AuthContext';
import { disconnectSocket, getSocket } from '@/lib/socket';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GLOBAL_CHAT_ID = '71000000-0000-0000-0000-000000000000';

type Message = {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    createdAt: string;
    seenAt: string | null;
};

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function ChatScreen() {
    const { user } = useAuthContext();
    const router = useRouter();
    const params = useLocalSearchParams();
    const matchId = params.matchId as string;
    const otherUserName = params.otherUserName as string;
    const isGlobal = (params.chatId as string) === GLOBAL_CHAT_ID;

    const [chatId, setChatId] = useState<string | null>(params.chatId as string || null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    // Only show 'Seen' under the LAST message sent by me that has been seen (Instagram-style)
    const lastSeenMyMessageId = useMemo(() => {
        const mySeenMessages = messages.filter(m => {
            const sId = (m as any).senderId || (m as any).sender_id;
            return sId === user?.id && (m as any).seenAt;
        });
        return mySeenMessages.length > 0 ? mySeenMessages[mySeenMessages.length - 1].id : null;
    }, [messages, user?.id]);

    // Mark other user's unread messages as seen (only for 1:1 personal chats)
    const markMessagesAsSeen = async (cId: string) => {
        if (!user || cId === GLOBAL_CHAT_ID) return; // skip for global chat
        await supabase
            .from('messages')
            .update({ seenAt: new Date().toISOString() })
            .eq('chatId', cId)
            .neq('senderId', user.id)
            .is('seenAt', null);
    };

    useEffect(() => {
        if (!user) return;

        let activeChatId: string | null = chatId;
        const socket = getSocket();
        let realtimeChannel: any = null;

        const initChat = async () => {
            try {
                if (!activeChatId && matchId) {
                    const { data: chatData, error } = await supabase
                        .from('chats')
                        .select('id')
                        .eq('matchId', matchId)
                        .single();
                    if (error) throw error;
                    if (!chatData?.id) return;
                    activeChatId = chatData.id;
                    setChatId(activeChatId);
                }

                if (!activeChatId) return;

                // Global Chat setup
                if (activeChatId === GLOBAL_CHAT_ID) {
                    const { data: globalChat } = await supabase
                        .from('chats').select('id').eq('id', activeChatId).maybeSingle();
                    if (!globalChat) {
                        const { error: insertError } = await supabase
                            .from('chats').insert([{ id: activeChatId }]);
                        if (insertError) console.error('❌ Global chat create failed:', insertError.message);
                    }
                    const { data: existingMember } = await supabase
                        .from('chat_participants').select('id')
                        .eq('chatId', activeChatId).eq('userId', user.id).maybeSingle();
                    if (!existingMember) {
                        await supabase.from('chat_participants').insert([{ chatId: activeChatId, userId: user.id }]);
                    }
                }

                // Fetch existing messages
                await fetchMessages(activeChatId);

                // Mark received messages as seen
                await markMessagesAsSeen(activeChatId);

                // Socket: join room and listen for new messages
                socket.emit('join_room', { chat_id: activeChatId });
                socket.on('new_message', (msg: any) => {
                    setMessages((prev) => {
                        if (prev.some(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                    // Mark as seen if receiver is viewing
                    if (msg.senderId !== user.id && activeChatId !== GLOBAL_CHAT_ID) {
                        markMessagesAsSeen(activeChatId!);
                    }
                });

                // Supabase Realtime: listen for seenAt updates on sent messages (1:1 only)
                // This lets the sender see the "Seen" tick update in real-time without refresh
                if (activeChatId !== GLOBAL_CHAT_ID) {
                    realtimeChannel = supabase
                        .channel(`seen-${activeChatId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: 'UPDATE',
                                schema: 'public',
                                table: 'messages',
                                filter: `chatId=eq.${activeChatId}`,
                            },
                            (payload: any) => {
                                setMessages(prev =>
                                    prev.map(m =>
                                        m.id === payload.new.id
                                            ? { ...m, seenAt: payload.new.seenAt }
                                            : m
                                    )
                                );
                            }
                        )
                        .subscribe();
                }
            } catch (err) {
                console.error('Error initializing chat:', err);
                setLoading(false);
            }
        };

        initChat();

        return () => {
            if (activeChatId) {
                socket.emit('leave_room', { chat_id: activeChatId });
                socket.off('new_message');
            }
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        };
    }, [user, matchId, chatId]);

    const fetchMessages = async (cId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chatId', cId)
                .order('createdAt', { ascending: true });
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
        socket.emit('send_message', { chat_id: chatId, sender_id: user.id, text: content });
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const senderId = (item as any).senderId || (item as any).sender_id;
        const isMyMessage = senderId === user?.id;
        const msgText = (item as any).text || (item as any).content || '';
        const seenAt = (item as any).seenAt;

        return (
            <View style={[msgStyles.row, isMyMessage ? msgStyles.rowRight : msgStyles.rowLeft]}>
                <View style={msgStyles.msgWrapper}>
                    <View style={[msgStyles.bubble, isMyMessage ? msgStyles.bubbleMine : msgStyles.bubbleOther]}>
                        <Text style={isMyMessage ? msgStyles.textMine : msgStyles.textOther}>{msgText}</Text>
                    </View>

                    {/* Seen status — only for sender, only in personal chats */}
                    {isMyMessage && !isGlobal && item.id === lastSeenMyMessageId && (
                        <Text style={msgStyles.seenText}>Seen</Text>
                    )}
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
                <View style={msgStyles.inputRow}>
                    <TextInput
                        style={msgStyles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#9ca3af"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        blurOnSubmit={false}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                        style={[msgStyles.sendBtn, inputText.trim() ? msgStyles.sendBtnActive : msgStyles.sendBtnDisabled]}
                    >
                        <Ionicons name="send" size={20} color="white" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const msgStyles = StyleSheet.create({
    row: { width: '100%', flexDirection: 'row', marginVertical: 4 },
    rowRight: { justifyContent: 'flex-end' },
    rowLeft: { justifyContent: 'flex-start' },
    msgWrapper: { maxWidth: '80%', alignItems: 'flex-end' },
    bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
    bubbleMine: { backgroundColor: '#3b82f6', borderTopRightRadius: 4 },
    bubbleOther: { backgroundColor: '#f3f4f6', borderTopLeftRadius: 4, alignSelf: 'flex-start' },
    textMine: { color: '#fff', fontSize: 15 },
    textOther: { color: '#111', fontSize: 15 },

    // Seen status row below my bubble
    seenText: { fontSize: 11, color: '#9ca3af', marginTop: 2, marginRight: 2, textAlign: 'right' },

    // Input area
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
    input: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: '#111', maxHeight: 120, marginRight: 12 },
    sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    sendBtnActive: { backgroundColor: '#3b82f6' },
    sendBtnDisabled: { backgroundColor: '#e5e7eb' },
});
