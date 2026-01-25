import { useAuthContext } from '@/lib/auth/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
    const { profile } = useAuthContext();
    const router = useRouter();
    const primaryPhoto = profile?.photos?.find((p: any) => p.position === 0) || profile?.photos?.[0];
    const firstName = profile?.displayName?.split(' ')[0] || 'User';

    const getImageUrl = (path: string | null | undefined) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${path}`;
    };

    const imageUrl = getImageUrl(primaryPhoto?.imageUrl);

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-row justify-between items-center px-5 py-2.5">
                <Text className="text-2xl font-extrabold text-black" style={{ fontFamily: 'System' }}>LinkUp</Text>
                <TouchableOpacity onPress={() => { /* TODO: Navigate to settings */ }}>
                    <Ionicons name="menu" size={28} color="black" />
                </TouchableOpacity>
            </View>

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
                    <TouchableOpacity className="ml-6 px-10 py-2 bg-black rounded-3xl border border-gray-900" onPress={() => router.push('/(modal)/edit-profile')}

                    >
                        <Text className="font-semibold text-white">Edit Profile</Text>
                    </TouchableOpacity>
                </View>
                <Text className="text-xl ml-1 font-bold mt-4 text-black">{firstName}</Text>
            </View>
        </SafeAreaView>
    );
}
