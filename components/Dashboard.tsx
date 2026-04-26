import { ProfilePreviewContent, ProfilePreviewData } from '@/components/ProfilePreviewContent';
import { AvailabilityPicker } from '@/components/AvailabilityPicker';
import AgeRangeSlider from '@/components/AgeRangeSlider';
import DistanceSlider from '@/components/DistanceSlider';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth/AuthContext';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [selectedAvailability, setSelectedAvailability] = useState<number | null>(null);
    const [ageRange, setAgeRange] = useState({ low: 18, high: 45 });
    const [distance, setDistance] = useState(50);
    const [interestedIn, setInterestedIn] = useState<string[]>([]);
    const [savingFilters, setSavingFilters] = useState(false);

    const toggleItem = (list: string[], item: string, setList: (v: string[]) => void) => {
        setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
    };

    useEffect(() => {
        if (user) {
            loadUserPreferences();
            fetchOtherUsers();
        }
    }, [user]);

    // Load existing preferences from the DB to pre-populate the filter
    const loadUserPreferences = async () => {
        if (!user) return;
        try {
            const [{ data: userData }, { data: profileData }, { data: filterData }] = await Promise.all([
                supabase.from('users').select('interestedIn').eq('id', user.id).single(),
                supabase.from('profiles').select('availableNext8Days').eq('userId', user.id).single(),
                supabase.from('filter_preferences').select('minAge, maxAge, maxDistanceKm').eq('userId', user.id).single(),
            ]);

            if (userData?.interestedIn?.length) setInterestedIn(userData.interestedIn);
            if (filterData) {
                setAgeRange({ low: filterData.minAge ?? 18, high: filterData.maxAge ?? 45 });
                setDistance(filterData.maxDistanceKm ?? 50);
            }
            // Map boolean array back to selected day index
            if (profileData?.availableNext8Days?.length) {
                const idx = (profileData.availableNext8Days as boolean[]).findIndex(v => v === true);
                if (idx !== -1) setSelectedAvailability(idx);
            }
        } catch (e) {
            console.error('Error loading user preferences:', e);
        }
    };

    // Save all filter preferences back to correct tables
    const applyFilters = async () => {
        if (!user) return;
        setSavingFilters(true);
        try {
            // Build availableNext8Days boolean array (8 days, only selected index is true)
            const availability = Array(8).fill(false);
            if (selectedAvailability !== null) availability[selectedAvailability] = true;

            await Promise.all([
                // interestedIn lives on users table
                supabase.from('users').update({ interestedIn }).eq('id', user.id),
                // availableNext8Days lives on profiles table
                supabase.from('profiles').update({ availableNext8Days: availability }).eq('userId', user.id),
                // minAge, maxAge, maxDistanceKm live in filter_preferences
                supabase.from('filter_preferences').upsert({
                    userId: user.id,
                    minAge: ageRange.low,
                    maxAge: ageRange.high,
                    maxDistanceKm: distance,
                }),
            ]);
        } catch (e) {
            console.error('Error saving filters:', e);
        } finally {
            setSavingFilters(false);
            setFilterModalVisible(false);
            fetchOtherUsers();
        }
    };


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
                .select('id, displayName, gender, dob, height, photos(*), profiles(bio, viewerQuestion, viewerPollOptions, viewerPollAnswer)')
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
                        viewerQuestion: profileData?.viewerQuestion || undefined,
                        viewerPollOptions: profileData?.viewerPollOptions || undefined,
                        viewerPollAnswer: profileData?.viewerPollAnswer ?? undefined,
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

            {/* Full-Screen Filter Modal */}
            <Modal
                visible={filterModalVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
                        <TouchableOpacity
                            onPress={() => setFilterModalVisible(false)}
                            className="p-1"
                        >
                            <Ionicons name="arrow-back" size={24} color="black" />
                        </TouchableOpacity>
                        <Text className="text-xl font-bold text-black">Filters</Text>
                        <View className="w-8" />
                    </View>

                    <ScrollView
                        className="flex-1"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 }}
                    >
                        {/* Interested In */}
                        <View className="mb-8">
                            <Text className="text-base font-bold text-black mb-3">Interested In</Text>
                            <View className="flex-row flex-wrap gap-3">
                                {[
                                    { label: 'Men', value: 'MALE' },
                                    { label: 'Women', value: 'FEMALE' },
                                    { label: 'Everyone', value: 'OTHER' },
                                ].map(({ label, value }) => {
                                    const selected = interestedIn.includes(value);
                                    return (
                                        <TouchableOpacity
                                            key={value}
                                            onPress={() => toggleItem(interestedIn, value, setInterestedIn)}
                                            style={{
                                                paddingHorizontal: 20,
                                                paddingVertical: 10,
                                                borderRadius: 999,
                                                backgroundColor: selected ? '#111827' : '#F3F4F6',
                                            }}
                                        >
                                            <Text style={{ color: selected ? 'white' : '#111827', fontWeight: '600', fontSize: 14 }}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>



                        {/* Age Range */}
                        <View className="mb-8">
                            <Text className="text-base font-bold text-black mb-1">Age Range</Text>
                            <AgeRangeSlider
                                minAge={18}
                                maxAge={80}
                                initialLow={ageRange.low}
                                initialHigh={ageRange.high}
                                onValuesChange={(low, high) => setAgeRange({ low, high })}
                            />
                        </View>

                        {/* Distance */}
                        <View className="mb-8">
                            <Text className="text-base font-bold text-black mb-1">Distance</Text>
                            <DistanceSlider
                                minDist={1}
                                maxDist={155}
                                initialValue={distance}
                                onValueChange={setDistance}
                            />
                        </View>

                        {/* Available Date */}
                        <View className="mb-8">
                            <Text className="text-base font-bold text-black mb-3">Available Date</Text>
                            <AvailabilityPicker
                                selectedDayIndex={selectedAvailability}
                                onSelectDay={setSelectedAvailability}
                            />
                        </View>
                    </ScrollView>

                    {/* Apply Button */}
                    <View className="px-5 pb-8 pt-3 border-t border-gray-100">
                        <TouchableOpacity
                            onPress={applyFilters}
                            disabled={savingFilters}
                            className="bg-black py-4 rounded-2xl items-center flex-row justify-center"
                        >
                            {savingFilters ? (
                                <ActivityIndicator color="white" className="mr-2" />
                            ) : null}
                            <Text className="text-white font-bold text-base">
                                {savingFilters ? 'Saving...' : 'Apply Filters'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>

    );
}
