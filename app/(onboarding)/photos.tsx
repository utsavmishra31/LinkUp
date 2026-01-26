import { PhotoGrid } from '@/components/PhotoGrid';
import { ArrowButton } from '@/components/ui/ArrowButton';
import { API_URL } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotosUpload() {
    const [photos, setPhotos] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived state or constant for "Main" label logic
    const userHasPhotos = photos.length > 0;
    const { user, refreshProfile, signOut } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut();
            Alert.alert('Success', 'You have been logged out');
            router.replace('/(auth)');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to log out');
        }
    };

    const pickImage = async () => {
        // Calculate remaining slots
        const remainingSlots = 6 - photos.length;
        if (remainingSlots <= 0) {
            Alert.alert('Limit Reached', 'You can only upload up to 6 photos.');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: remainingSlots,
                quality: 0.8,
            });

            if (!result.canceled) {
                const newPhotos = result.assets.map(asset => asset.uri);
                setPhotos(prev => {
                    const updated = [...prev, ...newPhotos];
                    return updated.slice(0, 6); // Ensure max 6
                });
            }
        } catch (error) {
            console.error('Error picking images:', error);
            Alert.alert('Error', 'Failed to pick images');
        }
    };

    const removePhoto = (index: string | number) => {
        const numIndex = typeof index === 'string' ? parseInt(index) : index;
        setPhotos(prev => prev.filter((_, i) => i !== numIndex));
    };

    const uploadImage = async (uri: string, index: number) => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) {
                throw new Error('No authentication token found');
            }

            const formData = new FormData();

            // Append file
            // React Native expects an object with uri, name, and type for FormData files
            const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('image', {
                uri,
                name: filename,
                type,
            } as any);

            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            return data;
        } catch (error) {
            console.error(`Error uploading photo ${index + 1}:`, error);
            throw error;
        }
    };

    const handleContinue = async () => {
        if (!user) return;
        if (photos.length < 2) {
            Alert.alert('Minimum Photos', 'Please add at least 2 photos to continue.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload images sequentially
            for (let i = 0; i < photos.length; i++) {
                await uploadImage(photos[i], i);
            }

            // All uploads success

            // Update onboarding step
            const { error: updateError } = await supabase
                .from('users')
                .update({ onboardingStep: 9 })
                .eq('id', user.id);

            if (updateError) throw updateError;

            await refreshProfile();
            router.push('/(onboarding)/prompts');
        } catch (error: any) {
            Alert.alert('Upload Error', error.message || 'Failed to upload one or more photos. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canContinue = photos.length >= 2;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">Add your photos</Text>
                    <Text className="text-gray-500 text-base">Add at least 2 photos to continue</Text>
                </View>

                {/* Photo Grid */}
                <PhotoGrid
                    photos={photos}
                    onAddPhoto={pickImage}
                    onRemovePhoto={removePhoto}
                    maxPhotos={6}
                />

                <View className="flex-1" />

                {/* Footer / Navigation */}
                <View className="w-full gap-y-4 mb-4">
                    <ArrowButton
                        onPress={handleContinue}
                        disabled={!canContinue}
                        isLoading={isSubmitting}
                    />

                    <Pressable
                        onPress={handleLogout}
                        className="bg-black rounded-full py-4 px-6 active:opacity-80 w-full"
                    >
                        <Text className="text-white text-center text-lg font-semibold">
                            Logout
                        </Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}
