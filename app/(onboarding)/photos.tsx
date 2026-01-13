import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const REQUIRED_PHOTOS = 2;
const MAX_PHOTOS = 6;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

interface PhotoSlot {
    uri: string | null;
    uploading: boolean;
    uploaded: boolean;
    error: string | null;
}

export default function PhotosUpload() {
    const [photos, setPhotos] = useState<PhotoSlot[]>(
        Array(MAX_PHOTOS).fill(null).map(() => ({
            uri: null,
            uploading: false,
            uploaded: false,
            error: null,
        }))
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const requestPermission = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Permission Required',
                'Please grant photo library access to upload photos.',
                [{ text: 'OK' }]
            );
            return false;
        }
        return true;
    };

    const pickImage = async (index: number) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const hasPermission = await requestPermission();
            if (!hasPermission) return;

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;

                // Update UI immediately
                setPhotos(prev => {
                    const updated = [...prev];
                    updated[index] = { uri, uploading: true, uploaded: false, error: null };
                    return updated;
                });

                // Upload to backend
                await uploadImage(uri, index);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const uploadImage = async (uri: string, index: number) => {
        try {
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Get session token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('No access token available');
            }

            // Create form data
            const formData = new FormData();
            const filename = uri.split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('image', {
                uri,
                name: filename,
                type,
            } as any);

            // Upload to backend with JWT
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Upload failed');
            }

            // Mark as uploaded
            setPhotos(prev => {
                const updated = [...prev];
                updated[index] = { uri, uploading: false, uploaded: true, error: null };
                return updated;
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            console.error('Upload error:', error);

            setPhotos(prev => {
                const updated = [...prev];
                updated[index] = {
                    uri,
                    uploading: false,
                    uploaded: false,
                    error: error.message || 'Upload failed'
                };
                return updated;
            });

            Alert.alert('Upload Failed', error.message || 'Please try again.');
        }
    };

    const removePhoto = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPhotos(prev => {
            const updated = [...prev];
            updated[index] = { uri: null, uploading: false, uploaded: false, error: null };
            return updated;
        });
    };

    const handleContinue = async () => {
        try {
            const uploadedCount = photos.filter(p => p.uploaded).length;

            if (uploadedCount < REQUIRED_PHOTOS) {
                Alert.alert(
                    'More Photos Required',
                    `Please upload at least ${REQUIRED_PHOTOS} photos to continue.`,
                    [{ text: 'OK' }]
                );
                return;
            }

            setIsSubmitting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Mark onboarding as completed
            if (user) {
                const { error } = await supabase
                    .from('users')
                    .update({ onboardingCompleted: true })
                    .eq('id', user.id);

                if (error) throw error;

                await refreshProfile();
                router.replace('/(tabs)');
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
            Alert.alert('Error', 'Failed to complete setup. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = () => {
        const uploadedCount = photos.filter(p => p.uploaded).length;

        if (uploadedCount < REQUIRED_PHOTOS) {
            Alert.alert(
                'Cannot Skip',
                `You need to upload at least ${REQUIRED_PHOTOS} photos before continuing.`,
                [{ text: 'OK' }]
            );
            return;
        }

        handleContinue();
    };

    const uploadedCount = photos.filter(p => p.uploaded).length;
    const canContinue = uploadedCount >= REQUIRED_PHOTOS && !photos.some(p => p.uploading);

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1 px-6 pt-12" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">
                        Add Your Photos
                    </Text>
                    <Text className="text-base text-gray-600">
                        Upload at least {REQUIRED_PHOTOS} photos to show your personality
                    </Text>
                    <View className="mt-3 flex-row items-center">
                        <View className="flex-row items-center">
                            <Ionicons
                                name={uploadedCount >= REQUIRED_PHOTOS ? "checkmark-circle" : "camera"}
                                size={20}
                                color={uploadedCount >= REQUIRED_PHOTOS ? "#10b981" : "#9333ea"}
                            />
                            <Text className={`ml-2 font-semibold ${uploadedCount >= REQUIRED_PHOTOS ? 'text-green-600' : 'text-purple-600'}`}>
                                {uploadedCount} / {REQUIRED_PHOTOS} required
                            </Text>
                        </View>
                        {uploadedCount > REQUIRED_PHOTOS && (
                            <Text className="ml-4 text-gray-500">
                                +{uploadedCount - REQUIRED_PHOTOS} bonus
                            </Text>
                        )}
                    </View>
                </View>

                {/* Photo Grid */}
                <View className="mb-8">
                    <View className="flex-row flex-wrap justify-between">
                        {photos.map((photo, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => !photo.uploading && pickImage(index)}
                                activeOpacity={0.7}
                                className="mb-4"
                                style={{ width: '48%', aspectRatio: 3 / 4 }}
                            >
                                <View
                                    className={`w-full h-full rounded-2xl overflow-hidden border-2 ${index < REQUIRED_PHOTOS
                                            ? 'border-purple-300'
                                            : 'border-gray-200'
                                        }`}
                                    style={{
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                        elevation: 3,
                                    }}
                                >
                                    {photo.uri ? (
                                        <>
                                            <Image
                                                source={{ uri: photo.uri }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                            {photo.uploading && (
                                                <View className="absolute inset-0 bg-black/50 items-center justify-center">
                                                    <ActivityIndicator size="large" color="white" />
                                                    <Text className="text-white mt-2 font-semibold">
                                                        Uploading...
                                                    </Text>
                                                </View>
                                            )}
                                            {photo.uploaded && !photo.uploading && (
                                                <>
                                                    <View className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                                                        <Ionicons name="checkmark" size={16} color="white" />
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => removePhoto(index)}
                                                        className="absolute top-2 left-2 bg-red-500 rounded-full p-1"
                                                        activeOpacity={0.7}
                                                    >
                                                        <Ionicons name="close" size={16} color="white" />
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                            {photo.error && (
                                                <View className="absolute inset-0 bg-red-500/20 items-center justify-center">
                                                    <Ionicons name="alert-circle" size={32} color="#ef4444" />
                                                    <Text className="text-red-600 mt-2 font-semibold text-xs px-2 text-center">
                                                        {photo.error}
                                                    </Text>
                                                </View>
                                            )}
                                        </>
                                    ) : (
                                        <View className="w-full h-full bg-gray-50 items-center justify-center">
                                            <View className={`w-16 h-16 rounded-full items-center justify-center ${index < REQUIRED_PHOTOS ? 'bg-purple-100' : 'bg-gray-100'
                                                }`}>
                                                <Ionicons
                                                    name="camera"
                                                    size={28}
                                                    color={index < REQUIRED_PHOTOS ? '#9333ea' : '#9ca3af'}
                                                />
                                            </View>
                                            {index < REQUIRED_PHOTOS && (
                                                <Text className="text-purple-600 font-semibold mt-2 text-xs">
                                                    Required
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Tips */}
                <View className="mb-8 p-4 bg-purple-50 rounded-2xl">
                    <View className="flex-row items-start mb-2">
                        <Ionicons name="bulb" size={20} color="#9333ea" />
                        <Text className="ml-2 font-semibold text-purple-900">Photo Tips</Text>
                    </View>
                    <Text className="text-sm text-purple-700 ml-7">
                        • Use clear, recent photos{'\n'}
                        • Show your face in at least one photo{'\n'}
                        • Include photos that show your interests{'\n'}
                        • Avoid group photos as your first image
                    </Text>
                </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View className="px-6 pb-8 pt-4 border-t border-gray-100">
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!canContinue || isSubmitting}
                    activeOpacity={0.8}
                    className={`rounded-full py-4 items-center justify-center ${canContinue && !isSubmitting
                            ? 'bg-purple-500'
                            : 'bg-gray-300'
                        }`}
                    style={
                        canContinue && !isSubmitting
                            ? {
                                shadowColor: '#9333ea',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 5,
                            }
                            : {}
                    }
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className={`text-lg font-bold ${canContinue ? 'text-white' : 'text-gray-500'}`}>
                            Continue to App
                        </Text>
                    )}
                </TouchableOpacity>

                {uploadedCount >= REQUIRED_PHOTOS && uploadedCount < MAX_PHOTOS && (
                    <TouchableOpacity
                        onPress={handleSkip}
                        disabled={isSubmitting}
                        className="mt-3 py-3 items-center"
                    >
                        <Text className="text-gray-500 text-base">
                            Skip remaining photos
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}
