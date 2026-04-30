import { ProfilePreviewContent, ProfilePreviewData } from '@/components/ProfilePreviewContent';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth/AuthContext';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import FilterModal from '@/components/FilterModal';
import { useAppStore, CachedProfile } from '@/lib/store';

// ─── Slim cache converters ────────────────────────────────────────────────────
// Fix #6: Cache is preview-only. Full data always fetched fresh on profile open.
const toSlimCache = (p: ProfilePreviewData): CachedProfile => ({
    id: p.id,
    displayName: p.displayName,
    age: p.age,
    gender: p.gender,
    bio: p.bio,
    primaryPhotoUrl: p.photos[0]?.uri,
    viewerQuestion: p.viewerQuestion,
    viewerPollOptions: p.viewerPollOptions,
    viewerPollAnswer: p.viewerPollAnswer,
});

const fromSlimCache = (c: CachedProfile): ProfilePreviewData => ({
    id: c.id,
    displayName: c.displayName,
    age: c.age,
    gender: c.gender,
    bio: c.bio ?? '',
    photos: c.primaryPhotoUrl ? [{ uri: c.primaryPhotoUrl }] : [],
    viewerQuestion: c.viewerQuestion,
    viewerPollOptions: c.viewerPollOptions,
    viewerPollAnswer: c.viewerPollAnswer,
    height: undefined,
    prompts: [],
});

export default function Dashboard() {
    const { user } = useAuthContext();
    const router = useRouter();
    const [profiles, setProfiles] = useState<ProfilePreviewData[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchedUser, setMatchedUser] = useState<ProfilePreviewData | null>(null);
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    const { userCaches, updateUserCache, isProfilesCacheStale } = useAppStore();

    // ─── Fix #1: Race condition guard ─────────────────────────────────────────
    // Track which profile IDs we've already acted on to drop duplicate fast-tap events
    const pendingActionsRef = useRef<Set<string>>(new Set());

    // ─── Fix #2: Stale-while-revalidate ref ──────────────────────────────────
    // Background fetch doesn't cancel in-progress swipes — we merge carefully
    const isFetchingRef = useRef(false);

    useEffect(() => {
        if (!user) return;

        const cache = userCaches[user.id];
        const hasFreshCache = cache?.profiles?.length > 0 && !isProfilesCacheStale(user.id);

        if (hasFreshCache) {
            // Fix #2: stale-while-revalidate — show cached immediately, refresh in bg
            setProfiles(cache.profiles.map(fromSlimCache));
            setLoading(false);
            supabase.rpc('update_last_active', { p_user_id: user.id }).then(() => {});
            // Background refresh — merge new data without jumpy UI
            fetchOtherUsers(null, /* backgroundRefresh */ true);
        } else {
            fetchOtherUsers(null, false);
        }
    }, [user]);

    // ─── Fix #3: Track which cursor/page combos are cached ───────────────────
    // If stale after TTL, we reset cursor so page 1+2 conflict never happens
    const fetchOtherUsers = async (cursor: string | null = null, isBackgroundRefresh = false) => {
        if (!user) return;
        if (isFetchingRef.current && !cursor) return; // prevent parallel fetches
        isFetchingRef.current = true;

        if (!cursor && !isBackgroundRefresh) setLoading(true);

        try {
            supabase.rpc('update_last_active', { p_user_id: user.id }).then(() => {});

            const { data, error } = await supabase.rpc('get_discovery_users', {
                p_user_id: user.id,
                p_limit: 20,
                p_cursor_last_active: cursor,
            });

            if (error) {
                console.error('Error fetching discovery users:', error);
                if (!cursor && !isBackgroundRefresh) setProfiles([]);
                return;
            }

            if (!data || data.length === 0) {
                if (!cursor && !isBackgroundRefresh) setProfiles([]);
                return;
            }

            const mappedProfiles: ProfilePreviewData[] = data.map((row: any) => {
                const u = row.profile_data;
                const profileData = u.profiles || {};
                return {
                    id: u.id,
                    displayName: u.displayName || 'User',
                    bio: profileData.bio || '',
                    viewerQuestion: profileData.viewerQuestion || undefined,
                    viewerPollOptions: profileData.viewerPollOptions || undefined,
                    viewerPollAnswer: profileData.viewerPollAnswer ?? undefined,
                    photos: (u.photos || []).map((p: any) => ({
                        uri: p.imageUrl.startsWith('http')
                            ? p.imageUrl
                            : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${p.imageUrl}`,
                    })),
                    gender: u.gender,
                    age: u.dob ? calculateAge(u.dob) : undefined,
                    height: u.height,
                    prompts: [],
                };
            });

            if (cursor) {
                // Fix #3: Pagination append — dedup by ID so cursor conflicts don't duplicate cards
                setProfiles(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const merged = [...prev, ...mappedProfiles.filter(p => !existingIds.has(p.id))];
                    updateUserCache(user.id, {
                        profiles: merged.map(toSlimCache),
                        profilesLastFetchedAt: Date.now(),
                    });
                    return merged;
                });
            } else if (isBackgroundRefresh) {
                // Fix #2: Background revalidation — merge by preserving cards user hasn't seen
                // Keep any cards already on screen (user may be mid-swipe), append truly new ones
                setProfiles(prev => {
                    const currentIds = new Set(prev.map(p => p.id));
                    const freshIds = new Set(mappedProfiles.map(p => p.id));
                    // Keep existing cards still on screen + add new ones not yet shown
                    const stillOnScreen = prev.filter(p => freshIds.has(p.id));
                    const brandNew = mappedProfiles.filter(p => !currentIds.has(p.id));
                    const merged = [...stillOnScreen, ...brandNew];
                    updateUserCache(user.id, {
                        profiles: merged.map(toSlimCache),
                        profilesLastFetchedAt: Date.now(),
                    });
                    return merged;
                });
            } else {
                // Full fresh fetch (cold start or filter change)
                setProfiles(mappedProfiles);
                updateUserCache(user.id, {
                    profiles: mappedProfiles.map(toSlimCache),
                    profilesLastFetchedAt: Date.now(),
                });
            }
        } catch (error) {
            console.error('Error in fetchOtherUsers:', error);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    };

    // ─── Fix #1: Race condition guard on like ────────────────────────────────
    const handleLike = async (likedId: string) => {
        if (!user) return;

        // If this profile is already being processed (spam tap), ignore
        if (pendingActionsRef.current.has(likedId)) return;
        pendingActionsRef.current.add(likedId);

        const likedProfile = profiles.find(p => p.id === likedId);

        // Optimistic UI — remove card immediately
        setProfiles(prev => {
            const next = prev.filter(p => p.id !== likedId);
            updateUserCache(user.id, { profiles: next.map(toSlimCache) });
            return next;
        });

        try {
            const { data: existingLike } = await supabase
                .from('likes')
                .select('liker_id')
                .eq('liker_id', likedId)
                .eq('liked_id', user.id)
                .single();

            if (existingLike) {
                await supabase.from('likes').delete().eq('liker_id', likedId).eq('liked_id', user.id);

                const matchId = Crypto.randomUUID();
                const [u1, u2] = [user.id, likedId].sort();
                const { data: matchData } = await supabase
                    .from('matches')
                    .insert([{ id: matchId, user1Id: u1, user2Id: u2 }])
                    .select()
                    .single();

                if (matchData) {
                    await supabase.from('chats').insert([{ id: Crypto.randomUUID(), matchId: matchData.id }]);
                }

                // Invalidate matches cache so Messages tab refreshes next open
                updateUserCache(user.id, { matchesLastFetchedAt: null });
                if (likedProfile) setMatchedUser(likedProfile);
            } else {
                await supabase.from('likes').insert([{ liker_id: user.id, liked_id: likedId }]);
            }
        } catch (error) {
            console.error('Error in handleLike:', error);
        } finally {
            // Fix #1: Release the lock regardless of success/failure
            pendingActionsRef.current.delete(likedId);
        }
    };

    // ─── Fix #1: Race condition guard on dislike ─────────────────────────────
    const handleDislike = useCallback((dislikedId: string) => {
        if (!user) return;
        if (pendingActionsRef.current.has(dislikedId)) return;
        pendingActionsRef.current.add(dislikedId);

        setProfiles(prev => {
            const next = prev.filter(p => p.id !== dislikedId);
            updateUserCache(user.id, { profiles: next.map(toSlimCache) });
            return next;
        });

        // Dislike is fire-and-forget (no need to await)
        (async () => {
            try {
                await supabase.from('rejects').insert([{ rejecter_id: user.id, rejected_id: dislikedId }]);
            } catch { /* ignore */ } finally {
                pendingActionsRef.current.delete(dislikedId);
            }
        })();
    }, [user, updateUserCache]);

    const calculateAge = (dob: string) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#F2F3F5] items-center justify-center">
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#F2F3F5]" edges={['top']}>
            <StatusBar style="dark" />

            <View className="flex-1">
                <View className="flex-row items-center px-4 py-3 bg-[#F2F3F5] z-10">
                    <TouchableOpacity onPress={() => setFilterModalVisible(true)} className="p-1 active:opacity-60">
                        <Ionicons name="options" size={24} color="black" />
                    </TouchableOpacity>
                </View>

                {profiles.length > 0 ? (
                    <FlatList
                        data={profiles}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <View className="h-[750px] mb-10">
                                <ProfilePreviewContent
                                    profile={item}
                                    onLike={handleLike}
                                    onDislike={handleDislike}
                                    scrollEnabled={false}
                                />
                            </View>
                        )}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View className="px-6 py-6">
                                <Text className="text-4xl font-bold text-black mb-1">Discover</Text>
                                <Text className="text-lg text-gray-500">Meet new people near you</Text>
                            </View>
                        }
                    />
                ) : (
                    <View className="flex-1 justify-center items-center px-10">
                        <Text className="text-4xl mb-4">🏠</Text>
                        <Text className="text-2xl font-semibold text-black text-center mb-2">Dashboard</Text>
                        <Text className="text-base text-gray-500 text-center">
                            No other users found at the moment. Check back later!
                        </Text>
                    </View>
                )}
            </View>

            {/* Match Celebration Modal */}
            <Modal visible={!!matchedUser} animationType="fade" transparent={true} onRequestClose={() => setMatchedUser(null)}>
                {matchedUser && (
                    <View className="flex-1 bg-black/95 justify-center items-center p-6">
                        <Text className="text-[48px] font-[900] text-emerald-500 italic mb-10 text-center">IT'S A MATCH!</Text>
                        <View className="flex-row items-center justify-center mb-14">
                            <View className="w-[120px] h-[120px] rounded-full bg-gray-700 border-4 border-emerald-500 z-[2] items-center justify-center overflow-hidden">
                                <Ionicons name="person" size={50} color="#9ca3af" />
                            </View>
                            <View className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center z-[3] -mx-5">
                                <Ionicons name="heart" size={24} color="white" />
                            </View>
                            <View className="w-[120px] h-[120px] rounded-full bg-gray-700 border-4 border-emerald-500 z-[1] overflow-hidden">
                                {matchedUser.photos[0]?.uri ? (
                                    <Image source={{ uri: matchedUser.photos[0].uri }} className="w-full h-full" contentFit="cover" />
                                ) : (
                                    <View className="flex-1 items-center justify-center">
                                        <Ionicons name="person" size={50} color="#9ca3af" />
                                    </View>
                                )}
                            </View>
                        </View>
                        <Text className="text-white text-lg text-center mb-10">
                            You and {matchedUser.displayName} liked each other.
                        </Text>
                        <TouchableOpacity
                            onPress={() => { setMatchedUser(null); router.push('/(tabs)/messages'); }}
                            className="bg-emerald-500 w-full py-4 rounded-full items-center mb-4"
                        >
                            <Text className="text-white text-base font-bold">Send a Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setMatchedUser(null)}
                            className="bg-transparent w-full py-4 rounded-full items-center border-2 border-white/20"
                        >
                            <Text className="text-white text-base font-bold">Keep Swiping</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </Modal>

            <FilterModal
                visible={filterModalVisible}
                onClose={() => setFilterModalVisible(false)}
                onApply={() => {
                    // Filter change = full cache reset + fresh fetch (Fix #3: no cursor conflict)
                    updateUserCache(user!.id, { profiles: [], profilesLastFetchedAt: null });
                    setProfiles([]);
                    setLoading(true);
                    fetchOtherUsers(null, false);
                }}
            />
        </SafeAreaView>
    );
}
