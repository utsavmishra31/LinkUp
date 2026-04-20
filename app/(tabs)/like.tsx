import { ProfilePreviewContent, ProfilePreviewData } from '@/components/ProfilePreviewContent';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CARD_WIDTH = (Dimensions.get('window').width - 48 - 12) / 2;

export default function LikeScreen() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const [likers, setLikers] = useState<ProfilePreviewData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState<ProfilePreviewData | null>(null);

    const handleReject = async (rejectedId: string) => {
        if (!user) return;
        // Remove from local list and close modal immediately
        setLikers(prev => prev.filter(p => p.id !== rejectedId));
        setSelectedProfile(null);
        try {
            // Delete the like
            await supabase
                .from('likes')
                .delete()
                .eq('liker_id', rejectedId)
                .eq('liked_id', user.id);

            // Insert into rejects
            await supabase
                .from('rejects')
                .insert([{ rejecter_id: user.id, rejected_id: rejectedId }]);
        } catch (error) {
            console.error('Error rejecting user:', error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchLikers();
        }
    }, [user]);

    const fetchLikers = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Get list of profiles already rejected by current user
            const { data: rejectRows } = await supabase
                .from('rejects')
                .select('rejected_id')
                .eq('rejecter_id', user.id);

            const rejectedIds = (rejectRows || []).map((r: any) => r.rejected_id);

            // Get all liker_ids for current user
            const { data: likeRows, error: likeError } = await supabase
                .from('likes')
                .select('liker_id')
                .eq('liked_id', user.id);

            if (likeError) {
                console.error('Error fetching likes:', likeError);
                return;
            }

            if (!likeRows || likeRows.length === 0) {
                setLikers([]);
                return;
            }

            // Filter out already rejected profiles
            const likerIds = likeRows
                .map((row: any) => row.liker_id)
                .filter((id: string) => !rejectedIds.includes(id));

            if (likerIds.length === 0) {
                setLikers([]);
                return;
            }

            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, displayName, gender, dob, height, photos(*), profiles(bio)')
                .in('id', likerIds);

            if (usersError) {
                console.error('Error fetching liker profiles:', usersError);
                return;
            }

            const mappedLikers: ProfilePreviewData[] = (usersData || []).map((u: any) => {
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

            setLikers(mappedLikers);
        } catch (error) {
            console.error('Error in fetchLikers:', error);
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

    const handleLogout = async () => {
        try {
            await signOut();
            Alert.alert('Success', 'You have been logged out');
            router.replace('/(auth)');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to log out');
        }
    };

    const renderLikerCard = ({ item }: { item: ProfilePreviewData }) => {
        const firstPhoto = item.photos[0]?.uri;
        return (
            <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setSelectedProfile(item)}
                style={{
                    width: CARD_WIDTH,
                    height: CARD_WIDTH * 1.4,
                    borderRadius: 20,
                    overflow: 'hidden',
                    marginBottom: 12,
                    backgroundColor: '#f3f4f6',
                }}
            >
                {firstPhoto ? (
                    <Image
                        source={{ uri: firstPhoto }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                    />
                ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb' }}>
                        <Ionicons name="person" size={40} color="#9ca3af" />
                    </View>
                )}
                {/* Gradient overlay */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
                />
                {/* Name & Age */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 12 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                        {item.displayName}{item.age ? `, ${item.age}` : ''}
                    </Text>
                </View>
                {/* Heart badge */}
                <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: 6 }}>
                    <Ionicons name="heart" size={13} color="#EF4444" />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 40 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <View>
                        <Text style={{ fontSize: 32, fontWeight: '800', color: 'black' }}>Likes</Text>
                        {likers.length > 0 && (
                            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                                {likers.length} {likers.length === 1 ? 'person' : 'people'} liked you
                            </Text>
                        )}
                    </View>
                    <Pressable
                        onPress={handleLogout}
                        style={{ backgroundColor: '#f3f4f6', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 }}
                    >
                        <Text style={{ color: 'black', fontSize: 13, fontWeight: '600' }}>Logout</Text>
                    </Pressable>
                </View>

                {likers.length > 0 ? (
                    <FlatList
                        data={likers}
                        keyExtractor={(item) => item.id}
                        numColumns={2}
                        columnWrapperStyle={{ gap: 12 }}
                        renderItem={renderLikerCard}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 56, marginBottom: 16 }}>❤️</Text>
                        <Text style={{ fontSize: 22, fontWeight: '600', color: 'black', textAlign: 'center', marginBottom: 8 }}>
                            No likes yet
                        </Text>
                        <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', paddingHorizontal: 32 }}>
                            When someone likes you, they'll show up here!
                        </Text>
                    </View>
                )}
            </View>

            {/* Full Profile Modal */}
            <Modal
                visible={!!selectedProfile}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSelectedProfile(null)}
            >
                {selectedProfile && (
                    <View style={{ flex: 1, backgroundColor: 'white' }}>
                        <ProfilePreviewContent
                            profile={selectedProfile}
                            onClose={() => setSelectedProfile(null)}
                            onDislike={handleReject}
                        />
                    </View>
                )}
            </Modal>
        </SafeAreaView>
    );
}
