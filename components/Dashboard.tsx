import { ProfilePreviewContent, ProfilePreviewData } from '@/components/ProfilePreviewContent';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth/AuthContext';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import FilterModal from '@/components/FilterModal';

export default function Dashboard() {
    const { user } = useAuthContext();
    const router = useRouter();
    const [profiles, setProfiles] = useState<ProfilePreviewData[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchedUser, setMatchedUser] = useState<ProfilePreviewData | null>(null);
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    const toggleItem = (list: string[], item: string, setList: (v: string[]) => void) => {
        setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
    };

    useEffect(() => {
        if (user) {
            fetchOtherUsers();
        }
    }, [user]);


    const fetchOtherUsers = async (cursor: string | null = null) => {
        if (!user) return;
        if (!cursor) setLoading(true);
        
        try {
            // 0. Update current user's lastActiveAt in background
            supabase.rpc('update_last_active', { p_user_id: user.id }).then(() => {});

            // 1. ONE SINGLE SOURCE OF TRUTH (Backend handles EVERYTHING + returns JSON + Pagination)
            const { data, error } = await supabase
                .rpc('get_discovery_users', { 
                    p_user_id: user.id, 
                    p_limit: 20,
                    p_cursor_last_active: cursor 
                });

            if (error) {
                console.error('Error fetching discovery users from backend:', error);
                if (!cursor) setProfiles([]);
                setLoading(false);
                return;
            }

            if (!data || data.length === 0) {
                if (!cursor) setProfiles([]);
                setLoading(false);
                return;
            }

            // 2. Parse the exact JSON payloads constructed by Postgres
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
                            : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${p.imageUrl}`
                    })),
                    gender: u.gender,
                    age: u.dob ? calculateAge(u.dob) : undefined,
                    height: u.height,
                    prompts: [],
                };
            });

            if (cursor) {
                setProfiles(prev => {
                    const existing = new Set(prev.map(p => p.id));
                    const newOnes = mappedProfiles.filter(p => !existing.has(p.id));
                    return [...prev, ...newOnes];
                });
            } else {
                setProfiles(mappedProfiles);
            }
        } catch (error) {
            console.error('Error in fetchOtherUsers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (likedId: string) => {
        if (!user) return;
        const likedProfile = profiles.find(p => p.id === likedId);

        // Optimistic UI: remove immediately
        setProfiles(prev => prev.filter(p => p.id !== likedId));
        
        try {
            // 1. Check if they already liked us
            const { data: existingLike } = await supabase
                .from('likes')
                .select('liker_id')
                .eq('liker_id', likedId)
                .eq('liked_id', user.id)
                .single();

            if (existingLike) {
                 // MUTUAL MATCH!
                 // Delete the original like
                 await supabase
                     .from('likes')
                     .delete()
                     .eq('liker_id', likedId)
                     .eq('liked_id', user.id);
                     
                 // Insert match
                 const matchId = Crypto.randomUUID();
                 const [u1, u2] = [user.id, likedId].sort();
                 const { data: matchData } = await supabase
                     .from('matches')
                     .insert([{ id: matchId, user1Id: u1, user2Id: u2 }])
                     .select()
                     .single();
                 
                 // Create chat for the match
                 if (matchData) {
                     const chatId = Crypto.randomUUID();
                     await supabase
                        .from('chats')
                        .insert([{ id: chatId, matchId: matchData.id }]);
                 }
                 
                 // Show matched modal
                 if (likedProfile) {
                     setMatchedUser(likedProfile);
                 }
            } else {
                 // 2. Normal like
                 await supabase
                     .from('likes')
                     .insert([{ liker_id: user.id, liked_id: likedId }]);
            }
        } catch (error) {
            console.error('Error in handleLike:', error);
        }
    };

    const handleDislike = (dislikedId: string) => {
        setProfiles(prev => prev.filter(p => p.id !== dislikedId));
    };

    const calculateAge = (dob: string) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <StatusBar style="dark" />
            
            <View className="flex-1">
                {/* Top Filter Bar */}
                <View className="flex-row items-center px-4 py-3 bg-white z-10">
                    <TouchableOpacity 
                        onPress={() => setFilterModalVisible(true)}
                        className="p-1 active:opacity-60"
                    >
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
                                <Text className="text-4xl font-bold text-black mb-1">
                                    Discover
                                </Text>
                                <Text className="text-lg text-gray-500">
                                    Meet new people near you
                                </Text>
                            </View>
                        }
                    />
                ) : (
                    <View className="flex-1 justify-center items-center px-10">
                        <Text className="text-4xl mb-4">🏠</Text>
                        <Text className="text-2xl font-semibold text-black text-center mb-2">
                            Dashboard
                        </Text>
                        <Text className="text-base text-gray-500 text-center">
                            No other users found at the moment. Check back later!
                        </Text>
                    </View>
                )}
            </View>

            {/* Match Celebration Modal */}
            <Modal
                visible={!!matchedUser}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setMatchedUser(null)}
            >
                {matchedUser && (
                    <View className="flex-1 bg-black/95 justify-center items-center p-6">
                        <Text className="text-[48px] font-[900] text-emerald-500 italic mb-10 text-center">
                            IT'S A MATCH!
                        </Text>
                        
                        <View className="flex-row items-center justify-center mb-14">
                            {/* Current User */}
                            <View className="w-[120px] h-[120px] rounded-full bg-gray-700 border-4 border-emerald-500 z-[2] items-center justify-center overflow-hidden">
                                <Ionicons name="person" size={50} color="#9ca3af" />
                            </View>
                            
                            <View className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center z-[3] -mx-5">
                                <Ionicons name="heart" size={24} color="white" />
                            </View>
                            
                            {/* Matched User */}
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
                            onPress={() => {
                                setMatchedUser(null);
                                router.push('/(tabs)/messages');
                            }}
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
                onApply={() => fetchOtherUsers()}
            />
        </SafeAreaView>

    );
}
