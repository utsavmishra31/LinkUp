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
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


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

    const pickImage = async (startIndex: number) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Calculate how many more photos we can add
            // We count 'filled' as anything that has a URI (uploading or uploaded)
            const filledCount = photos.filter(p => p.uri !== null).length;
            const remainingSlots = MAX_PHOTOS - filledCount;

            if (remainingSlots <= 0) return;

            const hasPermission = await requestPermission();
            if (!hasPermission) return;

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false, // cropping multiple images is usually not supported well in one go on native, often disabled
                quality: 0.8,
                allowsMultipleSelection: true,
                selectionLimit: remainingSlots,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                // We need to find *which* slots to put these images in.
                // We prefer starting at 'startIndex' if it's empty, then look for other empty slots.

                // 1. Identify indices of empty slots
                const emptyIndices = photos
                    .map((p, i) => (p.uri === null ? i : -1))
                    .filter(i => i !== -1);

                // 2. Sort empty indices to prefer startIndex, then others in order
                // Actually, just filling first available empty slots is usually fine, 
                // but let's try to honor the user's tap if possible.
                // If they tapped an empty slot, that should be the first one filled.
                // If they tapped a filled slot (which shouldn't happen based on UI), we'd just find empty ones.

                // Let's just fill empty slots in order. It's safer and less confusing UX for multiple adds.
                // OR: shift 'startIndex' to the front if it exists in emptyIndices
                if (emptyIndices.includes(startIndex)) {
                    const idx = emptyIndices.indexOf(startIndex);
                    emptyIndices.splice(idx, 1);
                    emptyIndices.unshift(startIndex);
                }

                // 3. Assign images to slots
                const newPhotos = [...photos];
                const uploadsToStart: { uri: string; index: number }[] = [];

                result.assets.forEach((asset, i) => {
                    if (i < emptyIndices.length) {
                        const targetIndex = emptyIndices[i];
                        newPhotos[targetIndex] = {
                            uri: asset.uri,
                            uploading: true,
                            uploaded: false,
                            error: null
                        };
                        uploadsToStart.push({ uri: asset.uri, index: targetIndex });
                    }
                });

                // Update UI once
                setPhotos(newPhotos);

                // Start uploads in parallel
                uploadsToStart.forEach(upload => {
                    uploadImage(upload.uri, upload.index);
                });
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

            // Navigate to prompts page
            router.push('/(onboarding)/prompts');
        } catch (error) {
            console.error('Error navigating to prompts:', error);
            Alert.alert('Error', 'Failed to continue. Please try again.');
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
            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="mt-8 mb-6">
                    <Text className="text-4xl font-bold text-slate-900 tracking-tight">
                        Choose your photos
                    </Text>
                    <Text className="text-lg text-slate-500 mt-2 font-medium">
                        Add at least {REQUIRED_PHOTOS} to start
                    </Text>
                </View>

                {/* Photo Grid */}
                <View className="flex-row flex-wrap justify-between">
                    {photos.map((photo, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => !photo.uploading && pickImage(index)}
                            activeOpacity={0.8}
                            className="mb-3 relative"
                            style={{
                                width: '31%', // 3 columns
                                aspectRatio: 3 / 4,
                            }}
                        >
                            <View
                                className={`w-full h-full rounded-xl overflow-hidden border ${photo.uri ? 'border-transparent' : 'border-slate-200 bg-slate-100'
                                    }`}
                                style={{
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 5,
                                    elevation: 2,
                                }}
                            >
                                {photo.uri ? (
                                    <>
                                        <Image
                                            source={{ uri: photo.uri }}
                                            className="w-full h-full"
                                            resizeMode="cover"
                                        />

                                        {/* Loading Overlay */}
                                        {photo.uploading && (
                                            <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                                <ActivityIndicator size="small" color="white" />
                                            </View>
                                        )}

                                        {/* Remove Button */}
                                        {!photo.uploading && (
                                            <TouchableOpacity
                                                onPress={() => removePhoto(index)}
                                                className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full items-center justify-center shadow-sm"
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="close" size={14} color="#64748b" />
                                            </TouchableOpacity>
                                        )}

                                        {/* Error State */}
                                        {photo.error && (
                                            <View className="absolute inset-0 bg-red-500/80 items-center justify-center p-2">
                                                <Ionicons name="alert-circle" size={20} color="white" />
                                            </View>
                                        )}

                                        {/* Main Photo Badge - Simplified for small size */}
                                        {index === 0 && !photo.uploading && !photo.error && (
                                            <View className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded-full shadow-sm">
                                                <Text className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">
                                                    Main
                                                </Text>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <View className="w-full h-full items-center justify-center relative">
                                        <View className="w-8 h-8 bg-white rounded-full items-center justify-center shadow-sm">
                                            <Ionicons name="add" size={20} color="#94a3b8" />
                                        </View>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Subtle Helper Text */}
                <View className="mt-4 mb-24 px-2">
                    <View className="flex-row items-center space-x-2">
                        <Text className="text-slate-400 text-sm leading-6">
                            Grab attention with your first photo. Photos showing your face or hobbies work best.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 blur-sm pt-4 border-t border-slate-100">
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!canContinue || isSubmitting}
                    activeOpacity={0.8}
                    className={`w-full py-4 rounded-full items-center justify-center ${canContinue && !isSubmitting
                        ? 'bg-purple-600 shadow-lg shadow-purple-200'
                        : 'bg-slate-200'
                        }`}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={canContinue ? "white" : "#94a3b8"} />
                    ) : (
                        <Text className={`text-lg font-bold ${canContinue ? 'text-white' : 'text-slate-400'}`}>
                            Continue
                        </Text>
                    )}
                </TouchableOpacity>

                {uploadedCount >= REQUIRED_PHOTOS && uploadedCount < MAX_PHOTOS && (
                    <TouchableOpacity
                        onPress={handleSkip}
                        disabled={isSubmitting}
                        className="mt-4 items-center"
                    >
                        <Text className="text-slate-500 font-medium">
                            Skip
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}
