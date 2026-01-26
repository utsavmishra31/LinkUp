import { PhotoGrid, PhotoItem } from '@/components/PhotoGrid';
import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotosUpload() {
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived state
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

        // Check if any are still uploading
        if (photos.some(p => p.status === 'uploading')) {
            Alert.alert('Please Wait', 'Photos are still uploading...');
            return;
        }

        // Check for errors
        if (photos.some(p => p.status === 'error')) {
            Alert.alert('Upload Error', 'Some photos failed to upload. Please remove or retry them.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Update onboarding step
            const { error: updateError } = await supabase
                .from('users')
                .update({ onboardingStep: 9 })
                .eq('id', user.id);

            if (updateError) throw updateError;

            await refreshProfile();
            router.push('/(onboarding)/prompts');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canContinue = photos.length >= 1 && !photos.some(p => p.status === 'uploading' || p.status === 'error');

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
                    onChange={setPhotos}
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
