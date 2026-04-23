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
    StyleSheet,
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
        <View style={typingStyles.container}>
            <View style={typingStyles.bubble}>
                {dots.map((dot, i) => (
                    <Animated.View
                        key={i}
                        style={[typingStyles.dot, { transform: [{ translateY: dot }] }]}
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
                if (!activeChatId && matchId) {
                    const { data: chatData, error } = await supabase
                        .from('chats').select('id').eq('matchId', matchId).single();
                    if (error) throw error;
                    if (!chatData?.id) return;
                    activeChatId = chatData.id;
                    setChatId(activeChatId);
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
            <View style={[msgStyles.row, isMyMessage ? msgStyles.rowRight : msgStyles.rowLeft]}>
                <View style={msgStyles.msgWrapper}>
                    <View style={[msgStyles.bubble, isMyMessage ? msgStyles.bubbleMine : msgStyles.bubbleOther]}>
                        <Text style={isMyMessage ? msgStyles.textMine : msgStyles.textOther}>{msgText}</Text>
                    </View>
                    {/* Show "Seen" only under last seen message (Instagram-style) */}
                    {isMyMessage && !isGlobal && item.id === lastSeenMyMessageId && (
                        <Text style={msgStyles.seenText}>Seen</Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={headerStyles.bar}>
                <TouchableOpacity onPress={() => router.back()} style={headerStyles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={headerStyles.title}>{otherUserName || 'Chat'}</Text>
                    {/* Show typing under name in header — like Instagram */}
                    {isOtherTyping && (
                        <Text style={headerStyles.typingText}>typing...</Text>
                    )}
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {loading ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
                <View style={msgStyles.inputRow}>
                    <TextInput
                        style={msgStyles.input}
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
                        style={[msgStyles.sendBtn, inputText.trim() ? msgStyles.sendBtnActive : msgStyles.sendBtnDisabled]}
                    >
                        <Ionicons name="send" size={20} color="white" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const headerStyles = StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
    backBtn: { padding: 4, marginRight: 12 },
    title: { fontSize: 17, fontWeight: '700', color: '#000' },
    typingText: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
});

const msgStyles = StyleSheet.create({
    row: { width: '100%', flexDirection: 'row', marginVertical: 2 },
    rowRight: { justifyContent: 'flex-end' },
    rowLeft: { justifyContent: 'flex-start' },
    msgWrapper: { maxWidth: '80%', alignItems: 'flex-end' },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
    bubbleMine: { backgroundColor: '#3b82f6', borderTopRightRadius: 4 },
    bubbleOther: { backgroundColor: '#f3f4f6', borderTopLeftRadius: 4, alignSelf: 'flex-start' },
    textMine: { color: '#fff', fontSize: 15 },
    textOther: { color: '#111', fontSize: 15 },
    seenText: { fontSize: 11, color: '#9ca3af', marginTop: 2, marginRight: 2 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
    input: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: '#111', maxHeight: 120, marginRight: 12 },
    sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    sendBtnActive: { backgroundColor: '#3b82f6' },
    sendBtnDisabled: { backgroundColor: '#e5e7eb' },
});

const typingStyles = StyleSheet.create({
    container: { flexDirection: 'row', paddingLeft: 16, paddingBottom: 8, paddingTop: 4 },
    bubble: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', gap: 4 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9ca3af' },
});
