import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Wait for navigation to be fully mounted before rendering
    if (!rootNavState?.key) return null;

    useEffect(() => {
        if (user) fetchMatches();
    }, [user]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim()) {
                handleSearch(searchQuery.trim());
            } else {
                setSearchResults([]);
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSearch = async (query: string) => {
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, displayName, username, photos(imageUrl, position)')
                .ilike('username', `%${query}%`)
                .neq('id', user?.id) // Don't show current user
                .limit(10);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setIsSearching(false);
        }
    };

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
                className="flex-row items-center p-4 bg-white border-b border-gray-100"
                activeOpacity={0.7}
            >
                <View className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 mr-4">
                    {photoUri ? (
                        <Image source={{ uri: photoUri }} className="w-full h-full" contentFit="cover" />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <Ionicons name="person" size={24} color="#9ca3af" />
                        </View>
                    )}
                </View>
                <View className="flex-1">
                    <Text className="text-[17px] font-bold text-gray-900 mb-0.5">{u.displayName}</Text>
                    <Text className="text-[13px] text-gray-500" numberOfLines={1}>Tap to start chatting...</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
        );
    };

    const renderSearchItem = ({ item }: { item: any }) => {
        const sortedPhotos = (item.photos || []).sort((a: any, b: any) => a.position - b.position);
        const rawPhotoUrl = sortedPhotos[0]?.imageUrl;
        const photoUri = rawPhotoUrl
            ? (rawPhotoUrl.startsWith('http') ? rawPhotoUrl : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${rawPhotoUrl}`)
            : null;

        return (
            <TouchableOpacity
                onPress={() => router.push({ pathname: '/(modal)/chat', params: { otherUserId: item.id, otherUserName: item.displayName || 'User' } })}
                className="flex-row items-center p-4 bg-white border-b border-gray-100"
                activeOpacity={0.7}
            >
                <View className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 mr-4">
                    {photoUri ? (
                        <Image source={{ uri: photoUri }} className="w-full h-full" contentFit="cover" />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <Ionicons name="person" size={24} color="#9ca3af" />
                        </View>
                    )}
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center">
                        <Text className="text-[17px] font-bold text-gray-900 mb-0.5">{item.displayName}</Text>
                        {item.username && (
                            <Text className="ml-1.5 text-[13px] text-gray-400 font-medium">@{item.username}</Text>
                        )}
                    </View>
                    <Text className="text-[13px] text-gray-500" numberOfLines={1}>Tap to view profile and chat</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
        );
    };

    if (loading && !searchQuery) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            {/* Header */}
            <View className="px-6 pt-10 pb-4">
                <Text className="text-[36px] font-extrabold text-black mb-6">Messages</Text>

                {/* Search Bar */}
                <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 mb-5">
                    <Ionicons name="search" size={20} color="#9ca3af" style={{ marginRight: 10 }} />
                    <TextInput
                        placeholder="Search by username..."
                        placeholderTextColor="#9ca3af"
                        className="flex-1 text-base text-black py-1"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tab switcher */}
                {!searchQuery && (
                    <View className="flex-row bg-gray-100 rounded-[16px] p-1.5">
                        <TouchableOpacity
                            onPress={() => setActiveTab('personal')}
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${activeTab === 'personal' ? 'bg-white shadow-sm' : ''}`}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="person" size={18} color={activeTab === 'personal' ? '#000' : '#9ca3af'} />
                            <Text className={`ml-1.5 font-bold text-[14px] ${activeTab === 'personal' ? 'text-black' : 'text-gray-400'}`}>
                                Personal
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('global')}
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${activeTab === 'global' ? 'bg-white shadow-sm' : ''}`}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="globe-outline" size={18} color={activeTab === 'global' ? '#3b82f6' : '#9ca3af'} />
                            <Text className={`ml-1.5 font-bold text-[14px] ${activeTab === 'global' ? 'text-blue-500' : 'text-gray-400'}`}>
                                Global
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Content */}
            {searchQuery ? (
                <View className="flex-1">
                    <Text className="text-lg font-bold text-black mx-6 mt-2.5 mb-2.5">Search Results</Text>
                    {isSearching ? (
                        <ActivityIndicator className="mt-5" color="#000" />
                    ) : searchResults.length > 0 ? (
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item.id}
                            renderItem={renderSearchItem}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <View className="flex-1 items-center justify-center px-8 pb-20">
                            <Text className="text-xl font-bold text-black text-center mb-2">No users found</Text>
                            <Text className="text-[15px] text-gray-500 text-center leading-[22px]">Try searching for a different username.</Text>
                        </View>
                    )}
                </View>
            ) : activeTab === 'personal' ? (
                matches.length > 0 ? (
                    <FlatList
                        data={matches}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMatchItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                ) : (
                    <View className="flex-1 items-center justify-center px-8 pb-20">
                        <View className="w-24 h-24 rounded-full bg-gray-50 items-center justify-center mb-6">
                            <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
                        </View>
                        <Text className="text-xl font-bold text-black text-center mb-2">No matches yet</Text>
                        <Text className="text-[15px] text-gray-500 text-center leading-[22px]">
                            Keep swiping! When you match with someone, you can start chatting here.
                        </Text>
                    </View>
                )
            ) : (
                <View className="flex-1 px-6 pt-2">
                    {/* Global Group Card */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(modal)/chat', params: { chatId: GLOBAL_CHAT_ID, otherUserName: 'Global Chat' } })}
                        className="flex-row items-center bg-white border border-gray-100 rounded-[24px] p-5 shadow-sm"
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={['#3b82f6', '#2563eb']}
                            className="w-16 h-16 rounded-2xl items-center justify-center mr-4"
                        >
                            <Ionicons name="globe" size={32} color="white" />
                        </LinearGradient>
                        <View className="flex-1">
                            <Text className="text-lg font-bold text-gray-900 mb-1">Global Group</Text>
                            <Text className="text-[13px] text-gray-500" numberOfLines={2}>
                                Connect with everyone on LinkUp! Join the conversation now.
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Info box */}
                    <View className="mt-6 bg-blue-50 p-5 rounded-[20px] border border-blue-200">
                        <View className="flex-row items-center mb-2.5">
                            <Ionicons name="information-circle" size={20} color="#3b82f6" />
                            <Text className="ml-2 font-bold text-blue-600 text-[14px]">About Global Chat</Text>
                        </View>
                        <Text className="text-[13px] text-blue-800 leading-5 opacity-80">
                            The global group is an open space for all LinkUp members. You don't need a mutual match to participate. Be respectful and have fun!
                        </Text>
                    </View>

                    <View className="flex-1" />

                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(modal)/chat', params: { chatId: GLOBAL_CHAT_ID, otherUserName: 'Global Chat' } })}
                        className="bg-blue-500 py-4 rounded-2xl items-center mb-10 shadow-lg shadow-blue-500"
                    >
                        <Text className="text-white text-[17px] font-bold">Enter Global Chat</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}
