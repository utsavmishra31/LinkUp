import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


// Use same Enum as Prisma
const LOOKING_FOR_OPTIONS = [
    { label: 'Relationship', value: 'RELATIONSHIP' },
    { label: 'Casual Dates', value: 'CASUAL_DATES' },
    { label: 'Party Partner', value: 'PARTY_PARTNER' },
    { label: 'Friends', value: 'FRIENDS' },
    { label: 'Hangouts', value: 'HANGOUTS' },
    { label: 'Watch Movie', value: 'WATCH_MOVIE' },
    { label: 'Exploring City & Cafe', value: 'EXPLORING_CITY_AND_CAFE' },
    { label: 'Time Spending', value: 'TIME_SPENDING' },
    { label: 'Finding Out', value: 'FINDING_OUT' },
] as const;

type LookingForValue = typeof LOOKING_FOR_OPTIONS[number]['value'];

export default function LookingForSelection() {
    const [selectedOptions, setSelectedOptions] = useState<LookingForValue[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const toggleOption = (value: LookingForValue) => {
        setSelectedOptions((prev) => {
            if (prev.includes(value)) {
                return prev.filter((item) => item !== value);
            }
            if (prev.length >= 3) {
                // Determine user preference for feedback if needed, currently just blocking > 3
                return prev;
            }
            return [...prev, value];
        });
    };

    const handleContinue = async () => {
        if (selectedOptions.length === 0) return;
        if (!user) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    lookingFor: selectedOptions,
                    // onboardingCompleted: true, // Moved to next step
                })
                .eq('id', user.id);

            if (error) throw error;

            // await refreshProfile(); 
            router.push('/(onboarding)/interested-in');
        } catch (error) {
            console.error('Error updating lookingFor:', error);
            Alert.alert('Error', 'Failed to save preferences.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">


                <Text className="text-3xl font-bold text-black mb-2">
                    What are you looking for?
                </Text>
                <Text className="text-gray-500 mb-8">
                    Select up to 3 options
                </Text>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <View className="flex-row flex-wrap gap-3">
                        {LOOKING_FOR_OPTIONS.map((option) => {
                            const isSelected = selectedOptions.includes(option.value);
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => toggleOption(option.value)}
                                    className={`px-4 py-3 rounded-xl border ${isSelected
                                        ? 'border-purple-600 bg-purple-50'
                                        : 'border-gray-200 bg-white'
                                        }`}
                                >
                                    <Text
                                        className={`text-base font-medium ${isSelected ? 'text-purple-600' : 'text-gray-600'
                                            }`}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>

                <View className="py-4">
                    <ArrowButton
                        onPress={handleContinue}
                        disabled={selectedOptions.length === 0}
                        isLoading={isSubmitting}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
