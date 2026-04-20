import { ProfilePreviewContent, ProfilePreviewData } from '@/components/ProfilePreviewContent';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth/AuthContext';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
    const { user } = useAuthContext();
    const [profiles, setProfiles] = useState<ProfilePreviewData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOtherUsers();
    }, [user]);

    const fetchOtherUsers = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*, photos(*)')
                .neq('id', user.id)
                .limit(10);

            if (error) {
                console.error('Error fetching users:', error);
            } else {
                // Map the data to ProfilePreviewData format
                const mappedProfiles: ProfilePreviewData[] = (data || []).map((u: any) => ({
                    displayName: u.displayName || 'User',
                    bio: u.bio || '',
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
                    prompts: [], // We can add prompts if needed later
                }));
                setProfiles(mappedProfiles);
            }
        } catch (error) {
            console.error('Error in fetchOtherUsers:', error);
        } finally {
            setLoading(false);
        }
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
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item }) => (
                            <View className="h-[750px] mb-10">
                                <ProfilePreviewContent profile={item} />
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
        </SafeAreaView>
    );
}
