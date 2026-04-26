import { API_URL } from '@/lib/api/client';
import { useAuthContext } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
    const { profile } = useAuthContext();
    const router = useRouter();
    const [matchCount, setMatchCount] = useState(0);
    const [isCreator, setIsCreator] = useState(false);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [exclusiveMedia, setExclusiveMedia] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const primaryPhoto = profile?.photos?.find((p: any) => p.position === 0) || profile?.photos?.[0];
    const firstName = profile?.displayName?.split(' ')[0] || 'User';

    const getImageUrl = (path: string | null | undefined) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${path}`;
    };

    const imageUrl = getImageUrl(primaryPhoto?.imageUrl);

    const fetchUserData = async () => {
        if (!profile?.id) return;
        
        // Fetch match count
        const { count } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .or(`user1Id.eq.${profile.id},user2Id.eq.${profile.id}`);
        if (count !== null) setMatchCount(count);

        // Fetch creator status
        const { data: userData } = await supabase
            .from('users')
            .select('isCreator, creatorExpiresAt')
            .eq('id', profile.id)
            .single();
        
        if (userData) {
            const hasActiveSubscription = userData.isCreator && 
                userData.creatorExpiresAt && 
                new Date(userData.creatorExpiresAt) > new Date();
            
            setIsCreator(!!hasActiveSubscription);
            setExpiresAt(userData.creatorExpiresAt);

            // Fetch exclusive media only if they are an active creator
            if (hasActiveSubscription) {
                const { data: media } = await supabase
                    .from('exclusive_media')
                    .select('*')
                    .eq('creatorId', profile.id)
                    .order('createdAt', { ascending: false });
                if (media) setExclusiveMedia(media);
            }
        }
    };

    useEffect(() => {
        fetchUserData();
    }, [profile?.id]);

    const handleUnlockCreator = async () => {
        Alert.alert(
            'Unlock Creator Mode',
            'Pay ₹99 / Month to unlock exclusive content uploading and set your own subscription price!',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Pay ₹99',
                    onPress: async () => {
                        try {
                            const session = await supabase.auth.getSession();
                            const token = session.data.session?.access_token;
                            const res = await fetch(`${API_URL}/premium/unlock-creator`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const data = await res.json();
                            if (data.success) {
                                await fetchUserData(); // Refresh data
                                Alert.alert('Success!', 'Your Creator subscription is now active! 🚀');
                            } else {
                                throw new Error(data.error);
                            }
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        }
                    }
                }
            ]
        );
    };

    const handleUploadExclusive = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsEditing: true,
            videoMaxDuration: 15,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setIsUploading(true);
            try {
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;
                
                const formData = new FormData();
                const asset = result.assets[0];
                const uriParts = asset.uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                
                formData.append('media', {
                    uri: asset.uri,
                    name: `media.${fileType}`,
                    type: asset.type === 'video' ? `video/${fileType}` : `image/${fileType}`,
                } as any);

                const res = await fetch(`${API_URL}/premium/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    body: formData,
                });

                const data = await res.json();
                if (data.success) {
                    setExclusiveMedia([data.media, ...exclusiveMedia]);
                    Alert.alert('Success', 'Exclusive content uploaded!');
                } else {
                    throw new Error(data.error);
                }
            } catch (error: any) {
                console.error(error);
                Alert.alert('Upload failed', error.message);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-row justify-between items-center px-5 py-2.5 bg-white z-10 border-b border-gray-100">
                <Text className="text-2xl font-extrabold text-black" style={{ fontFamily: 'System' }}>LinkUp</Text>
                <TouchableOpacity onPress={() => { /* TODO: Navigate to settings */ }}>
                    <Ionicons name="menu" size={28} color="black" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="px-5 mt-5">
                    <View className="flex-row items-center">
                        <View className=" bg-white rounded-full">
                            {imageUrl ? (
                                <Image
                                    source={imageUrl}
                                    className="w-[90px] h-[90px] rounded-full bg-gray-100"
                                    contentFit="cover"
                                    transition={200}
                                    priority="high"
                                />
                            ) : (
                                <View className="w-[120px] h-[120px] rounded-full bg-gray-200" />
                            )}
                        </View>
                        <TouchableOpacity className="ml-6 px-10 py-2 bg-black rounded-3xl border border-gray-900" onPress={() => router.push('/(modal)/edit-profile')}>
                            <Text className="font-semibold text-white">Edit Profile</Text>
                        </TouchableOpacity>
                    </View>
                    <Text className="text-xl ml-1 font-bold mt-4 text-black">{firstName}</Text>
                    
                    {/* Stats Section */}
                    <View className="flex-row mt-6 gap-x-4">
                        <View className="bg-gray-50 px-5 py-4 rounded-3xl flex-1 items-center border border-gray-100">
                            <Text className="text-3xl font-extrabold text-black mb-1">{matchCount}</Text>
                            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Matches</Text>
                        </View>
                        <View className="bg-gray-50 px-5 py-4 rounded-3xl flex-1 items-center border border-gray-100 opacity-50">
                            <Text className="text-3xl font-extrabold text-black mb-1">0</Text>
                            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Super Likes</Text>
                        </View>
                    </View>

                    {/* Manage Subscription Button */}
                    <TouchableOpacity 
                        className="mt-6 bg-blue-500 rounded-3xl py-4 flex-row justify-center items-center"
                        onPress={() => router.push('/(modal)/manage-subscription')}
                    >
                        <Ionicons name="star" size={20} color="white" className="mr-2" />
                        <Text className="text-white font-bold text-lg ml-2">Manage Subscription Prices</Text>
                    </TouchableOpacity>

                    {/* Creator Upload Section */}
                    <View className="mt-8 pt-8 border-t border-gray-100">
                        <Text className="text-xl font-bold text-black mb-4">Creator Studio</Text>
                        
                        {!isCreator ? (
                            <View className="bg-purple-50 p-6 rounded-3xl border border-purple-100 items-center">
                                <Ionicons name="lock-closed" size={40} color="#9333ea" className="mb-2" />
                                <Text className="text-center text-purple-900 font-medium mb-4">
                                    Subscribe to creator mode for ₹99 / Month to upload exclusive content.
                                </Text>
                                <TouchableOpacity 
                                    className="bg-purple-600 px-8 py-3 rounded-full"
                                    onPress={handleUnlockCreator}
                                >
                                    <Text className="text-white font-bold">Subscribe for ₹99/mo</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <View className="flex-row items-center mb-4 bg-green-50 px-4 py-2 rounded-xl self-start border border-green-100">
                                    <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                                    <Text className="text-green-700 font-medium ml-2">
                                        Subscription Active (Expires: {expiresAt ? new Date(expiresAt).toLocaleDateString() : '-'})
                                    </Text>
                                </View>

                                <TouchableOpacity 
                                    className="bg-purple-600 rounded-3xl py-4 flex-row justify-center items-center mb-6"
                                    onPress={handleUploadExclusive}
                                    disabled={isUploading}
                                >
                                    {isUploading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Ionicons name="cloud-upload" size={20} color="white" className="mr-2" />
                                            <Text className="text-white font-bold text-lg ml-2">Upload Exclusive Media</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Exclusive Media Grid */}
                                {exclusiveMedia.length > 0 ? (
                                    <View className="flex-row flex-wrap -mx-1">
                                        {exclusiveMedia.map((media) => (
                                            <View key={media.id} className="w-1/3 p-1 aspect-square">
                                                <Image 
                                                    source={getImageUrl(media.mediaUrl)} 
                                                    className="w-full h-full rounded-xl bg-gray-200" 
                                                    contentFit="cover" 
                                                />
                                                {media.type === 'video' && (
                                                    <View className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                                                        <Ionicons name="play" size={12} color="white" />
                                                    </View>
                                                )}
                                                <View className="absolute bottom-2 right-2 bg-purple-500 rounded-full p-1">
                                                    <Ionicons name="star" size={10} color="white" />
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View className="items-center py-10">
                                        <Ionicons name="images-outline" size={40} color="#d1d5db" />
                                        <Text className="text-gray-400 mt-2">No exclusive media yet.</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
