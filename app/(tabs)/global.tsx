import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GlobalScreen() {
    const router = useRouter();
    const [creators, setCreators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCreators = async () => {
        setLoading(true);
        // Fetch from subscription_plans and join users
        const { data, error } = await supabase
            .from('subscription_plans')
            .select(`
                id,
                price,
                creatorId,
                creator:users (
                    id, 
                    displayName,
                    photos (imageUrl, position)
                )
            `);
            
        if (data && !error) {
            setCreators(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCreators();
    }, []);

    const getImageUrl = (path: string | null | undefined) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${path}`;
    };

    const renderCreator = ({ item }: { item: any }) => {
        const user = item.creator;
        if (!user) return null;

        const primaryPhoto = user.photos?.find((p: any) => p.position === 0) || user.photos?.[0];
        const imageUrl = getImageUrl(primaryPhoto?.imageUrl);
        const name = user.displayName || 'User';
        const priceINR = item.price / 100;

        return (
            <TouchableOpacity 
                className="bg-white mx-5 my-2 p-4 rounded-2xl flex-row items-center shadow-sm border border-gray-100"
                onPress={() => router.push(`/(modal)/creator/${user.id}`)}
            >
                <View className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                    {imageUrl && (
                        <Image source={imageUrl} className="w-full h-full" contentFit="cover" />
                    )}
                </View>
                <View className="ml-4 flex-1">
                    <Text className="text-xl font-bold text-black">{name}</Text>
                    <View className="flex-row items-center mt-1">
                        <Ionicons name="star" size={14} color="#f59e0b" />
                        <Text className="text-gray-500 font-medium ml-1">Creator</Text>
                    </View>
                </View>
                <View className="bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <Text className="text-blue-600 font-bold">₹{priceINR}/mo</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
            <View className="px-5 py-4 border-b border-gray-200 bg-white">
                <Text className="text-2xl font-extrabold text-black">Subscriptions</Text>
                <Text className="text-gray-500 mt-1">Discover exclusive content from creators.</Text>
            </View>

            <FlatList
                data={creators}
                keyExtractor={(item) => item.id}
                renderItem={renderCreator}
                contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchCreators} />}
                ListEmptyComponent={
                    !loading ? (
                        <View className="flex-1 justify-center items-center mt-20">
                            <Ionicons name="people-outline" size={64} color="#d1d5db" />
                            <Text className="text-gray-400 mt-4 text-lg">No creators available yet</Text>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}
