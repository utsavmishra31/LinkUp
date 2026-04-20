import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TouchableOpacity, View } from 'react-native';
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

export default function MessagesScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchMatches();
        }
    }, [user]);

    const fetchMatches = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Get all matches for the current user
            const { data: matchRows, error: matchError } = await supabase
                .from('matches')
                .select('*')
                .or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`);

            if (matchError) throw matchError;

            if (!matchRows || matchRows.length === 0) {
                setMatches([]);
                return;
            }

            // For each match, we need the OTHER user's info
            const matchesWithUsers = await Promise.all(
                matchRows.map(async (matchRow) => {
                    const otherUserId = matchRow.user1Id === user.id ? matchRow.user2Id : matchRow.user1Id;

                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('id, displayName, photos(*)')
                        .eq('id', otherUserId)
                        .single();

                    if (userError) {
                        console.error('Error fetching matched user:', userError);
                        return null;
                    }

                    return {
                        id: matchRow.id,
                        created_at: matchRow.created_at,
                        matchedUser: userData
                    };
                })
            );

            const validMatches = matchesWithUsers.filter((m): m is Match => m !== null);
            // Sort by newest match first
            validMatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
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
                        <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <Ionicons name="person" size={24} color="#9ca3af" />
                        </View>
                    )}
                </View>
                <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 mb-1">{u.displayName}</Text>
                    <Text className="text-gray-500 text-sm" numberOfLines={1}>
                        Tap to start chatting...
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-10 pb-4">
                <Text className="text-4xl font-bold text-black border-b border-gray-100 pb-4">
                    Messages
                </Text>
            </View>

            {matches.length > 0 ? (
                <FlatList
                    data={matches}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMatchItem}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View className="flex-1 justify-center items-center px-8">
                    <Text className="text-6xl mb-4">💬</Text>
                    <Text className="text-2xl font-semibold text-black text-center mb-2">
                        No matches yet
                    </Text>
                    <Text className="text-base text-gray-500 text-center">
                        Keep swiping! When you match with someone, you can start chatting here.
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
}
