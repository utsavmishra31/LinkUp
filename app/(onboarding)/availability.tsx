import { AvailabilityPicker } from '@/components/AvailabilityPicker';
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

export default function AvailabilitySelection() {
    // Initialize with no day selected (null means no selection)
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const handleSelectDay = (index: number) => {
        // If clicking the same day, deselect it; otherwise select the new day
        setSelectedDayIndex(selectedDayIndex === index ? null : index);
    };

    const handleContinue = async () => {
        if (!user) return;

        // Check if a day is selected
        if (selectedDayIndex === null) {
            Alert.alert('Selection Required', 'Please select a day when you\'re available to meet.');
            return;
        }

        setIsSubmitting(true);
        try {
            // First, check if profile exists
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('userId')
                .eq('userId', user.id)
                .single();

            // Create boolean array with only the selected day as true
            // Note: We use 8-day array for database compatibility
            const availabilityArray = new Array(8).fill(false);
            if (selectedDayIndex < 8) {
                availabilityArray[selectedDayIndex] = true;
            }

            if (existingProfile) {
                // Update existing profile
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        availableNext8Days: availabilityArray,
                    })
                    .eq('userId', user.id);

                if (error) throw error;
            } else {
                // Create new profile
                const { error } = await supabase
                    .from('profiles')
                    .insert({
                        userId: user.id,
                        availableNext8Days: availabilityArray,
                    });

                if (error) throw error;
            }

            // Update onboarding step on users table
            const { error: userError } = await supabase
                .from('users')
                .update({ onboardingStep: 8 })
                .eq('id', user.id);

            if (userError) throw userError;

            await refreshProfile();

            // Navigate to location permission page
            router.push('/(onboarding)/photos');
        } catch (error) {
            console.error('Error updating availability:', error);
            Alert.alert('Error', 'Failed to save availability.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">
                <Text className="text-3xl font-bold text-black mb-2">
                    Available Date
                </Text>
                <Text className="text-base text-gray-600 mb-8">
                    Select one day when you're available to meet in next 7 days
                </Text>

                {/* Shared Picker Component */}
                <AvailabilityPicker
                    selectedDayIndex={selectedDayIndex}
                    onSelectDay={handleSelectDay}
                />

                <View className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Text className="text-sm text-gray-700">
                        <Text className="font-semibold">Note:</Text> Choose the day that works best for you. You can always update this later!
                    </Text>
                </View>

                <View className="flex-1 justify-end pb-8">
                    <ArrowButton
                        onPress={handleContinue}
                        disabled={selectedDayIndex === null}
                        isLoading={isSubmitting}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
