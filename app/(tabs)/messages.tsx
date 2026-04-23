import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Match = {
    id: string;
    matchedUser: {
        id: string;
        displayName: string;
        photos: { imageUrl: string; position: number }[];
    };
    created_at: string;
};

const GLOBAL_CHAT_ID = '71000000-0000-0000-0000-000000000000';

export default function MessagesScreen() {
    const rootNavState = useRootNavigationState();
    const { user } = useAuth();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');

    // Wait for navigation to be fully mounted before rendering
    if (!rootNavState?.key) return null;

    useEffect(() => {
        if (user) fetchMatches();
    }, [user]);

    const fetchMatches = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // ✅ Single query with JOIN — no N+1 problem
            // Fetches matches + other user's profile + photos in ONE round trip
            const { data: matchRows, error } = await supabase
                .from('matches')
                .select(`
                    id,
                    created_at:createdAt,
                    user1:users!matches_user1Id_fkey(id, displayName, photos(imageUrl, position)),
                    user2:users!matches_user2Id_fkey(id, displayName, photos(imageUrl, position))
                `)
                .or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)
                .order('createdAt', { ascending: false });

            if (error) throw error;
            if (!matchRows || matchRows.length === 0) { setMatches([]); return; }

            const validMatches: Match[] = matchRows.map((row: any) => {
                // Pick the other user (not current user)
                const matchedUser = row.user1?.id === user.id ? row.user2 : row.user1;
                return {
                    id: row.id,
                    created_at: row.created_at,
                    matchedUser,
                };
            }).filter((m: any) => m.matchedUser != null);

            setMatches(validMatches);
        } catch (error) {
            console.error('Error in fetchMatches:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderMatchItem = ({ item }: { item: Match }) => {
        const u = item.matchedUser;
        const sortedPhotos = (u.photos || []).sort((a: any, b: any) => a.position - b.position);
        const rawPhotoUrl = sortedPhotos[0]?.imageUrl;
        const photoUri = rawPhotoUrl
            ? (rawPhotoUrl.startsWith('http') ? rawPhotoUrl : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${rawPhotoUrl}`)
            : null;

        return (
            <TouchableOpacity
                onPress={() => router.push({ pathname: '/(modal)/chat', params: { matchId: item.id, otherUserId: u.id, otherUserName: u.displayName || 'User' } })}
                style={styles.matchRow}
                activeOpacity={0.7}
            >
                <View style={styles.avatarWrap}>
                    {photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.avatarImg} contentFit="cover" />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={24} color="#9ca3af" />
                        </View>
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.matchName}>{u.displayName}</Text>
                    <Text style={styles.matchSub} numberOfLines={1}>Tap to start chatting...</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Messages</Text>

                {/* Tab switcher — all styles via StyleSheet, no dynamic className */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('personal')}
                        style={[styles.tabBtn, activeTab === 'personal' && styles.tabBtnActive]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="person" size={18} color={activeTab === 'personal' ? '#000' : '#9ca3af'} />
                        <Text style={[styles.tabLabel, activeTab === 'personal' && styles.tabLabelActive]}>
                            Personal
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('global')}
                        style={[styles.tabBtn, activeTab === 'global' && styles.tabBtnActive]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="globe-outline" size={18} color={activeTab === 'global' ? '#3b82f6' : '#9ca3af'} />
                        <Text style={[styles.tabLabel, activeTab === 'global' && styles.tabLabelActiveBlue]}>
                            Global
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            {activeTab === 'personal' ? (
                matches.length > 0 ? (
                    <FlatList
                        data={matches}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMatchItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
                        </View>
                        <Text style={styles.emptyTitle}>No matches yet</Text>
                        <Text style={styles.emptyBody}>
                            Keep swiping! When you match with someone, you can start chatting here.
                        </Text>
                    </View>
                )
            ) : (
                <View style={styles.globalContainer}>
                    {/* Global Group Card */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(modal)/chat', params: { chatId: GLOBAL_CHAT_ID, otherUserName: 'Global Chat' } })}
                        style={styles.globalCard}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={['#3b82f6', '#2563eb']}
                            style={styles.globalIcon}
                        >
                            <Ionicons name="globe" size={32} color="white" />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.globalCardTitle}>Global Group</Text>
                            <Text style={styles.globalCardSub} numberOfLines={2}>
                                Connect with everyone on LinkUp! Join the conversation now.
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Info box */}
                    <View style={styles.infoBox}>
                        <View style={styles.infoRow}>
                            <Ionicons name="information-circle" size={20} color="#3b82f6" />
                            <Text style={styles.infoTitle}>About Global Chat</Text>
                        </View>
                        <Text style={styles.infoBody}>
                            The global group is an open space for all LinkUp members. You don't need a mutual match to participate. Be respectful and have fun!
                        </Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(modal)/chat', params: { chatId: GLOBAL_CHAT_ID, otherUserName: 'Global Chat' } })}
                        style={styles.enterBtn}
                    >
                        <Text style={styles.enterBtnText}>Enter Global Chat</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    header: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
    title: { fontSize: 36, fontWeight: '800', color: '#000', marginBottom: 24 },

    // Tab bar
    tabBar: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 16, padding: 6 },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
    tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
    tabLabel: { marginLeft: 6, fontWeight: '700', color: '#9ca3af', fontSize: 14 },
    tabLabelActive: { color: '#000' },
    tabLabelActiveBlue: { color: '#3b82f6' },

    // Match list
    matchRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    avatarWrap: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: '#f3f4f6', marginRight: 16 },
    avatarImg: { width: '100%', height: '100%' },
    avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    matchName: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 2 },
    matchSub: { fontSize: 13, color: '#6b7280' },

    // Empty state
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
    emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    emptyTitle: { fontSize: 22, fontWeight: '700', color: '#000', textAlign: 'center', marginBottom: 8 },
    emptyBody: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },

    // Global tab
    globalContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
    globalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    globalIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    globalCardTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
    globalCardSub: { fontSize: 13, color: '#6b7280' },
    infoBox: { marginTop: 24, backgroundColor: '#eff6ff', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#bfdbfe' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    infoTitle: { marginLeft: 8, fontWeight: '700', color: '#2563eb', fontSize: 14 },
    infoBody: { fontSize: 13, color: '#1e40af', lineHeight: 20, opacity: 0.8 },
    enterBtn: { backgroundColor: '#3b82f6', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 40, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    enterBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
