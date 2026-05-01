import { AvailabilityPicker, getNext8Days } from '@/components/AvailabilityPicker';
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
    // Store the actual ISO date string so selection persists across days
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const handleSelectDate = (date: string) => {
        // Toggle: tap same date → deselect, otherwise select new date
        setSelectedDate(selectedDate === date ? null : date);
    };

    const handleContinue = async () => {
        if (!user) return;

        // Check if a date is selected
        if (selectedDate === null) {
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



            if (existingProfile) {
                // Update existing profile
                const { error } = await supabase
                    .from('profiles')
                    .update({ availableDate: selectedDate })
                    .eq('userId', user.id);

                if (error) throw error;
            } else {
                // Create new profile
                const { error } = await supabase
                    .from('profiles')
                    .insert({
                        userId: user.id,
                        availableDate: selectedDate,
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
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                />

                <View className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Text className="text-sm text-gray-700">
                        <Text className="font-semibold">Note:</Text> Choose the day that works best for you. You can always update this later!
                    </Text>
                </View>

                <View className="flex-1 justify-end pb-8">
                    <ArrowButton
                        onPress={handleContinue}
                        disabled={selectedDate === null}
                        isLoading={isSubmitting}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
