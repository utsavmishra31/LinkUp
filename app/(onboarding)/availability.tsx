import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


// Generate 8 days starting from today (today + next 7 days)
const getNext8Days = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 8; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        days.push({
            id: i,
            dayName: dayNames[date.getDay()],
            dayNumber: date.getDate(),
            month: monthNames[date.getMonth()],
            fullDate: date.toISOString().split('T')[0],
            isToday: i === 0,
        });
    }

    return days;
};

const DAYS = getNext8Days();

interface DayCardProps {
    day: typeof DAYS[0];
    isSelected: boolean;
    onPress: () => void;
}

const DayCard = ({ day, isSelected, onPress }: DayCardProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={`items-center justify-center py-3 rounded-2xl border-2 flex-1 h-32 ${isSelected
                ? 'bg-purple-500 border-purple-500'
                : 'bg-white border-gray-200'
                }`}
            style={{
                shadowColor: isSelected ? '#9333ea' : '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isSelected ? 0.3 : 0.05,
                shadowRadius: 4,
                elevation: isSelected ? 5 : 2,
            }}
        >
            <Text
                className={`text-xs font-semibold mb-1 ${isSelected ? 'text-white' : 'text-gray-500'
                    }`}
            >
                {day.dayName}
            </Text>
            <Text
                className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-black'
                    }`}
            >
                {day.dayNumber}
            </Text>
            <Text
                className={`text-xs font-medium mt-1 ${isSelected ? 'text-purple-100' : 'text-gray-400'
                    }`}
            >
                {day.month}
            </Text>
            {day.isToday && (
                <View className={`mt-1 px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-purple-100'
                    }`}>
                    <Text className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-purple-600'
                        }`}>
                        Today
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

export default function AvailabilitySelection() {
    // Initialize with no day selected (null means no selection)
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const selectDay = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

                {/* Grid layout - 4 columns, 2 rows */}
                <View className="gap-3">
                    {/* First row - 4 days */}
                    <View className="flex-row gap-3">
                        {DAYS.slice(0, 4).map((day, index) => (
                            <DayCard
                                key={day.id}
                                day={day}
                                isSelected={selectedDayIndex === index}
                                onPress={() => selectDay(index)}
                            />
                        ))}
                    </View>

                    {/* Second row - 4 days */}
                    <View className="flex-row gap-3">
                        {DAYS.slice(4, 8).map((day, index) => (
                            <DayCard
                                key={day.id}
                                day={day}
                                isSelected={selectedDayIndex === index + 4}
                                onPress={() => selectDay(index + 4)}
                            />
                        ))}
                    </View>
                </View>

                <View className="mt-8 p-4 bg-purple-50 rounded-xl border border-purple-100">
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
