import { HEIGHT_OPTIONS, HeightPicker } from '@/components/HeightPicker';
import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HeightSelection() {
    const [selectedHeight, setSelectedHeight] = useState(HEIGHT_OPTIONS[33]); // Default to 5'9"
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const handleContinue = async () => {
        if (!selectedHeight) return;
        if (!user) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    height: `${selectedHeight.feet} ${selectedHeight.inches}`,
                    onboardingStep: 7,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();

        } catch (error) {
            console.error('Error updating height:', error);
            Alert.alert('Error', 'Failed to save height.');
        } finally {
            setIsSubmitting(false);
            // Navigate to availability directly
            router.push('/(onboarding)/availability');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12 items-center">
                <Text className="text-3xl font-bold text-black mb-12 self-start">
                    Your height?
                </Text>

                <HeightPicker onHeightChange={setSelectedHeight} />

                <View className="flex-1 justify-end pb-8 w-full">
                    <ArrowButton
                        onPress={handleContinue}
                        disabled={!selectedHeight}
                        isLoading={isSubmitting}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
