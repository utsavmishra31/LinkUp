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

export default function Dashboard() {
    const { user } = useAuthContext();
    const router = useRouter();
    const [profiles, setProfiles] = useState<ProfilePreviewData[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchedUser, setMatchedUser] = useState<ProfilePreviewData | null>(null);

    useEffect(() => {
        fetchOtherUsers();
    }, [user]);

    const fetchOtherUsers = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Get all IDs we should exclude (likes, rejects, matches)
            const [{ data: likesOut }, { data: rejectsOut }, { data: matches }] = await Promise.all([
                supabase.from('likes').select('liked_id').eq('liker_id', user.id),
                supabase.from('rejects').select('rejected_id').eq('rejecter_id', user.id),
                supabase.from('matches').select('user1Id, user2Id').or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)
            ]);
            
            const excludeIds = new Set<string>();
            excludeIds.add(user.id);
            (likesOut || []).forEach(l => excludeIds.add(l.liked_id));
            (rejectsOut || []).forEach(r => excludeIds.add(r.rejected_id));
            (matches || []).forEach(m => {
                excludeIds.add(m.user1Id);
                excludeIds.add(m.user2Id);
            });
            const excludeArray = Array.from(excludeIds);

            // Fetch users not in the exclude list
            const { data, error } = await supabase
                .from('users')
                .select('id, displayName, gender, dob, height, photos(*), profiles(bio)')
                .not('id', 'in', `(${excludeArray.join(',')})`)
                .limit(10);

            if (error) {
                console.error('Error fetching users:', error);
            } else {
                const mappedProfiles: ProfilePreviewData[] = (data || []).map((u: any) => {
                    const profileData = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
                    return {
                        id: u.id,
                        displayName: u.displayName || 'User',
                        bio: profileData?.bio || '',
                        photos: (u.photos || [])
                            .sort((a: any, b: any) => a.position - b.position)
                            .map((p: any) => ({
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
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                        <Text style={{ fontSize: 48, fontWeight: '900', color: '#10B981', fontStyle: 'italic', marginBottom: 40, textAlign: 'center' }}>
                            IT'S A MATCH!
                        </Text>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 60 }}>
                            {/* Current User */}
                            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#374151', borderWidth: 4, borderColor: '#10B981', zIndex: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                <Ionicons name="person" size={50} color="#9ca3af" />
                            </View>
                            
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', zIndex: 3, marginHorizontal: -20 }}>
                                <Ionicons name="heart" size={24} color="white" />
                            </View>
                            
                            {/* Matched User */}
                            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#374151', borderWidth: 4, borderColor: '#10B981', zIndex: 1, overflow: 'hidden' }}>
                                {matchedUser.photos[0]?.uri ? (
                                    <Image source={{ uri: matchedUser.photos[0].uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                ) : (
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="person" size={50} color="#9ca3af" />
                                    </View>
                                )}
                            </View>
                        </View>

                        <Text style={{ color: 'white', fontSize: 18, textAlign: 'center', marginBottom: 40 }}>
                            You and {matchedUser.displayName} liked each other.
                        </Text>

                        <TouchableOpacity
                            onPress={() => {
                                setMatchedUser(null);
                                router.push('/(tabs)/messages');
                            }}
                            style={{ backgroundColor: '#10B981', width: '100%', paddingVertical: 16, borderRadius: 999, alignItems: 'center', marginBottom: 16 }}
                        >
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Send a Message</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setMatchedUser(null)}
                            style={{ backgroundColor: 'transparent', width: '100%', paddingVertical: 16, borderRadius: 999, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
                        >
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Keep Swiping</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </Modal>
        </SafeAreaView>
    );
}
