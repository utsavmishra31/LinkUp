import { useAuthContext } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases from 'react-native-purchases';
import { API_URL } from '@/lib/api/client';

export default function CreatorProfileModal() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { profile: currentUser } = useAuthContext();
    const router = useRouter();

    const [creator, setCreator] = useState<any>(null);
    const [plan, setPlan] = useState<any>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [exclusiveMedia, setExclusiveMedia] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const getImageUrl = (path: string | null | undefined) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${path}`;
    };

    useEffect(() => {
        const fetchCreatorData = async () => {
            if (!id || !currentUser?.id) return;
            setLoading(true);

            // Fetch creator
            const { data: creatorData } = await supabase
                .from('users')
                .select(`
                    id, 
                    displayName,
                    photos (imageUrl, position)
                `)
                .eq('id', id)
                .single();
                
            setCreator(creatorData);

            // Fetch Plan
            const { data: planData } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('creatorId', id)
                .single();
            setPlan(planData);

            // Check subscription
            const { data: subData } = await supabase
                .from('subscriptions')
                .select('id, endDate, isActive')
                .eq('userId', currentUser.id)
                .eq('creatorId', id)
                .eq('isActive', true)
                .maybeSingle();

            // Check if end date is in future
            const isActive = subData && new Date(subData.endDate) > new Date();
            setIsSubscribed(!!isActive);

            if (isActive) {
                // Secure Backend Call
                try {
                    const session = await supabase.auth.getSession();
                    const token = session.data.session?.access_token;
                    const res = await fetch(`${API_URL}/premium/content/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setExclusiveMedia(data.content || []);
                    }
                } catch (e) {
                    console.error('Failed to fetch premium content securely', e);
                }
            }

            setLoading(false);
        };

        fetchCreatorData();
    }, [id, currentUser?.id]);

    const handleSubscribe = async () => {
        if (!plan || !currentUser) return;

        const priceINR = plan.price / 100;
        const productId = `tier_${priceINR}`;
        
        try {
            // 1. Purchase via RevenueCat (Apple/Google)
            const { customerInfo, productIdentifier } = await Purchases.purchaseProduct(productId);

            // 2. Verify and Map with our Backend
            const response = await fetch(`${API_URL}/premium/verify-purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                    creatorId: id,
                    planId: plan.id,
                    rcAppUserId: currentUser.id
                })
            });

            if (!response.ok) throw new Error('Backend verification failed');

            setIsSubscribed(true);
            Alert.alert('Success', 'You are now subscribed! 🚀');
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert('Error purchasing', e.message);
            }
        }
    };

    if (loading || !creator) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text>Loading...</Text>
            </SafeAreaView>
        );
    }

    const primaryPhoto = creator.photos?.find((p: any) => p.position === 0) || creator.photos?.[0];
    const imageUrl = getImageUrl(primaryPhoto?.imageUrl);
    const priceINR = plan ? plan.price / 100 : 0;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color="black" />
                </TouchableOpacity>
                <Text className="text-xl font-bold ml-4">Creator Profile</Text>
            </View>

            <FlatList
                data={isSubscribed ? exclusiveMedia : []}
                keyExtractor={(item) => item.id}
                numColumns={3}
                ListHeaderComponent={
                    <View className="items-center px-5 pt-8 pb-4 border-b border-gray-100">
                        <View className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-sm">
                            {imageUrl && <Image source={imageUrl} className="w-full h-full" contentFit="cover" />}
                        </View>
                        <Text className="text-2xl font-bold text-black mt-4">{creator.displayName}</Text>
                        
                        {plan && (
                            <View className="bg-blue-50 px-3 py-1 rounded-full mt-2">
                                <Text className="text-blue-600 font-bold text-sm">₹{priceINR}/mo</Text>
                            </View>
                        )}

                        {!isSubscribed ? (
                            <TouchableOpacity 
                                className="mt-6 bg-blue-600 w-full py-4 rounded-full flex-row items-center justify-center"
                                onPress={handleSubscribe}
                                disabled={!plan}
                            >
                                <Ionicons name="lock-closed" size={20} color="white" className="mr-2" />
                                <Text className="text-white font-bold text-lg ml-2">Unlock Exclusive Content</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="mt-6 bg-green-50 w-full py-4 rounded-full flex-row items-center justify-center border border-green-200">
                                <Ionicons name="checkmark-circle" size={20} color="#16a34a" className="mr-2" />
                                <Text className="text-green-700 font-bold text-lg ml-2">Subscribed</Text>
                            </View>
                        )}
                        
                        <Text className="text-left w-full font-bold text-lg mt-8 mb-4">
                            Exclusive Posts
                        </Text>
                        {!isSubscribed && (
                            <View className="bg-gray-50 rounded-2xl w-full p-8 items-center border border-gray-100">
                                <Ionicons name="images-outline" size={48} color="#9ca3af" />
                                <Text className="text-gray-500 font-medium mt-4 text-center">Subscribe to see {creator.displayName}'s exclusive photos and videos.</Text>
                            </View>
                        )}
                    </View>
                }
                renderItem={({ item }) => (
                    <View className="w-1/3 p-0.5 aspect-square">
                        <Image source={getImageUrl(item.mediaUrl)} className="w-full h-full rounded-lg bg-gray-200" contentFit="cover" />
                    </View>
                )}
            />
        </SafeAreaView>
    );
}
