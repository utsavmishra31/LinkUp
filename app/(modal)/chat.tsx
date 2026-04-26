import { useAuthContext } from '@/lib/auth/AuthContext';
import { getSocket } from '@/lib/socket';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GLOBAL_CHAT_ID = '71000000-0000-0000-0000-000000000000';
const TYPING_STOP_DELAY = 3000; // 3s inactivity = stop typing (WhatsApp standard)

type Message = {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    createdAt: string;
    seenAt: string | null;
};

// ─── Animated Typing Dots (iMessage / WhatsApp style) ───────────────────────
function TypingIndicator() {
    const dots = [
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
    ];

    useEffect(() => {
        const animations = dots.map((dot, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 150),
                    Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                    Animated.delay(600),
                ])
            )
        );
        animations.forEach(a => a.start());
        return () => animations.forEach(a => a.stop());
    }, []);

    return (
        <View className="flex-row pl-4 pb-2 pt-1">
            <View className="flex-row bg-gray-100 rounded-[18px] rounded-tl-[4px] px-3.5 py-3 items-center gap-1">
                {dots.map((dot, i) => (
                    <Animated.View
                        key={i}
                        style={{ transform: [{ translateY: dot }] }}
                        className="w-[7px] h-[7px] rounded-full bg-gray-400"
                    />
                ))}
            </View>
        </View>
    );
}

// ─── Main Chat Screen ────────────────────────────────────────────────────────
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
    const [isOtherTyping, setIsOtherTyping] = useState(false);

    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false); // track if we've emitted typing_start

    // Instagram-style: only show "Seen" under the LAST seen message I sent
    const lastSeenMyMessageId = useMemo(() => {
        const mine = messages.filter(m => {
            const sId = (m as any).senderId || (m as any).sender_id;
            return sId === user?.id && (m as any).seenAt;
        });
        return mine.length > 0 ? mine[mine.length - 1].id : null;
    }, [messages, user?.id]);

    // Mark received messages as seen (1:1 only, not global)
    const markMessagesAsSeen = async (cId: string) => {
        if (!user || cId === GLOBAL_CHAT_ID) return;
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
                if (!activeChatId) {
                    if (matchId) {
                        const { data: chatData, error } = await supabase
                            .from('chats').select('id').eq('matchId', matchId).single();
                        if (error && error.code !== 'PGRST116') throw error;
                        if (chatData?.id) {
                            activeChatId = chatData.id;
                        }
                    } else if (params.otherUserId) {
                        // Search for an existing 1:1 chat between these two users
                        const { data: existingChats, error: searchError } = await supabase
                            .from('chat_participants')
                            .select('chatId')
                            .eq('userId', user.id);
                        
                        if (searchError) throw searchError;

                        if (existingChats && existingChats.length > 0) {
                            const chatIds = existingChats.map(c => c.chatId);
                            const { data: commonChat, error: commonError } = await supabase
                                .from('chat_participants')
                                .select('chatId')
                                .in('chatId', chatIds)
                                .eq('userId', params.otherUserId)
                                .maybeSingle();
                            
                            if (commonError) throw commonError;
                            if (commonChat) {
                                activeChatId = commonChat.chatId;
                            }
                        }

                        // If no chat exists, create one
                        if (!activeChatId) {
                            const { data: newChat, error: chatError } = await supabase
                                .from('chats')
                                .insert([{}])
                                .select()
                                .single();
                            
                            if (chatError) throw chatError;
                            activeChatId = newChat.id;

                            // Add both participants
                            await supabase.from('chat_participants').insert([
                                { chatId: activeChatId, userId: user.id },
                                { chatId: activeChatId, userId: params.otherUserId }
                            ]);
                        }
                    }
                    
                    if (activeChatId) {
                        setChatId(activeChatId);
                    }
                }

                if (!activeChatId) return;

                // Global chat setup
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

                await fetchMessages(activeChatId);
                await markMessagesAsSeen(activeChatId);

                socket.emit('join_room', { chat_id: activeChatId });

                // New message received
                socket.on('new_message', (msg: any) => {
                    setMessages(prev => {
                        if (prev.some(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                    if (msg.senderId !== user.id && activeChatId !== GLOBAL_CHAT_ID) {
                        markMessagesAsSeen(activeChatId!);
                    }
                    // Hide typing indicator when message arrives
                    setIsOtherTyping(false);
                });

                // ── Typing indicators ────────────────────────────────────
                socket.on('user_typing', ({ user_id }: { user_id: string }) => {
                    if (user_id !== user.id) setIsOtherTyping(true);
                });

                socket.on('user_stopped_typing', ({ user_id }: { user_id: string }) => {
                    if (user_id !== user.id) setIsOtherTyping(false);
                });

                // Supabase Realtime — seen status updates (1:1 only)
                if (activeChatId !== GLOBAL_CHAT_ID) {
                    realtimeChannel = supabase
                        .channel(`seen-${activeChatId}`)
                        .on('postgres_changes', {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'messages',
                            filter: `chatId=eq.${activeChatId}`,
                        }, (payload: any) => {
                            setMessages(prev =>
                                prev.map(m => m.id === payload.new.id ? { ...m, seenAt: payload.new.seenAt } : m)
                            );
                        })
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
                socket.off('user_typing');
                socket.off('user_stopped_typing');
                // Stop typing if user leaves chat mid-type
                if (isTypingRef.current) {
                    socket.emit('typing_stop', { chat_id: activeChatId, sender_id: user.id });
                }
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        };
    }, [user, matchId, chatId]);

    const fetchMessages = async (cId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages').select('*').eq('chatId', cId)
                .order('createdAt', { ascending: true });
            if (error) throw error;
            setMessages(data || []);
            setLoading(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
        } catch (err) {
            console.error('Error fetching messages:', err);
            setLoading(false);
        }
    };

    // ── Industry-standard debounced typing logic ─────────────────────────────
    // emit typing_start ONCE per session, auto-stop after 3s inactivity
    const handleTextChange = (text: string) => {
        setInputText(text);
        if (!chatId || !user || isGlobal) return;

        const socket = getSocket();

        if (text.length === 0) {
            // Input cleared — stop immediately
            if (isTypingRef.current) {
                isTypingRef.current = false;
                socket.emit('typing_stop', { chat_id: chatId, sender_id: user.id });
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            return;
        }

        // Emit typing_start only once per session (not on every keystroke)
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit('typing_start', { chat_id: chatId, sender_id: user.id });
        }

        // Reset the auto-stop timer (debounce: 3s of silence = stop typing)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            socket.emit('typing_stop', { chat_id: chatId, sender_id: user.id });
        }, TYPING_STOP_DELAY);
    };

    const handleSend = () => {
        if (!inputText.trim() || !user || !chatId) return;
        const content = inputText.trim();
        setInputText('');

        // Stop typing indicator immediately on send
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (isTypingRef.current && !isGlobal) {
            isTypingRef.current = false;
            getSocket().emit('typing_stop', { chat_id: chatId, sender_id: user.id });
        }

        getSocket().emit('send_message', { chat_id: chatId, sender_id: user.id, text: content });
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const senderId = (item as any).senderId || (item as any).sender_id;
        const isMyMessage = senderId === user?.id;
        const msgText = (item as any).text || (item as any).content || '';

        return (
            <View className={`w-full flex-row my-0.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                <View className="max-w-[80%] items-end">
                    <View className={`rounded-[18px] px-3.5 py-2.5 ${isMyMessage ? 'bg-blue-500 rounded-tr-[4px]' : 'bg-gray-100 rounded-tl-[4px] self-start'}`}>
                        <Text className={isMyMessage ? 'text-white text-[15px]' : 'text-gray-900 text-[15px]'}>{msgText}</Text>
                    </View>
                    {/* Show "Seen" only under last seen message (Instagram-style) */}
                    {isMyMessage && !isGlobal && item.id === lastSeenMyMessageId && (
                        <Text className="text-[11px] text-gray-400 mt-0.5 mr-0.5">Seen</Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-white">
                <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-[17px] font-bold text-black">{otherUserName || 'Chat'}</Text>
                    {/* Show typing under name in header — like Instagram */}
                    {isOtherTyping && (
                        <Text className="text-[12px] text-gray-400 mt-0.5">typing...</Text>
                    )}
                </View>
            </View>

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
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' }}
                        showsVerticalScrollIndicator={false}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        // Animated dots at bottom of list when other user is typing
                        ListFooterComponent={isOtherTyping ? <TypingIndicator /> : null}
                    />
                )}

                {/* Input */}
                <View className="flex-row items-end px-4 py-3 border-t border-gray-100 bg-white">
                    <TextInput
                        className="flex-1 bg-gray-50 rounded-[24px] px-5 pt-3 pb-3 text-[15px] text-gray-900 max-h-[120px] mr-3"
                        placeholder="Type a message..."
                        placeholderTextColor="#9ca3af"
                        value={inputText}
                        onChangeText={handleTextChange}
                        multiline
                        blurOnSubmit={false}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
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
