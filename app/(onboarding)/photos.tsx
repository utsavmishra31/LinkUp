import { PhotoGrid, uploadImage } from '@/components/PhotoGrid';
import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
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





    const handleContinue = async () => {
        if (!user) return;
        if (photos.length < 1) {
            Alert.alert('Minimum Photos', 'Please add at least 1 photo to continue.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload images sequentially
            for (let i = 0; i < photos.length; i++) {
                try {
                    await uploadImage(photos[i]);
                } catch (e) {
                    console.error(`Error uploading photo ${i + 1}:`, e);
                    throw e;
                }
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

    const canContinue = photos.length >= 1;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">Add your photos</Text>
                    <Text className="text-gray-500 text-base">Add at least 1 photo to continue</Text>
                </View>

                {/* Photo Grid */}
                <PhotoGrid
                    photos={photos}
                    onChange={(newPhotos) => setPhotos(newPhotos as string[])}
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
