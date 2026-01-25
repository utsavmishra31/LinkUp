import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function DateOfBirth() {
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const dayRef = useRef<TextInput>(null);
    const monthRef = useRef<TextInput>(null);
    const yearRef = useRef<TextInput>(null);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const handleDayChange = (text: string) => {
        setDay(text);
        if (text.length === 2) {
            monthRef.current?.focus();
        }
    };

    const handleMonthChange = (text: string) => {
        setMonth(text);
        if (text.length === 2) {
            yearRef.current?.focus();
        }
        if (text.length === 0) {
            dayRef.current?.focus();
        }
    };

    const handleYearChange = (text: string) => {
        setYear(text);
        if (text.length === 0) {
            monthRef.current?.focus();
        }
    };

    const validateDate = (): boolean => {
        const d = parseInt(day);
        const m = parseInt(month);
        const y = parseInt(year);

        if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
        if (d < 1 || d > 31) return false;
        if (m < 1 || m > 12) return false;

        const currentYear = new Date().getFullYear();
        if (y < 1900 || y > currentYear) return false; // Basic validation, must be a past/current year

        // Check valid days in month
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
            return false;
        }

        return true;
    };

    const submitDate = async (age: number, birthDate: Date) => {
        if (!user) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    dob: birthDate.toISOString().split('T')[0], // Send YYYY-MM-DD only
                    onboardingStep: 3,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            router.push('/(onboarding)/gender');
        } catch (error) {
            console.error('Error updating DOB:', error);
            Alert.alert('Error', 'Failed to save date of birth.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleContinue = async () => {
        if (!validateDate()) {
            Alert.alert('Invalid Date', 'Please enter a valid date of birth.');
            return;
        }

        if (!user) return;

        // Use UTC to avoid timezone issues when converting to ISO string for DB
        const birthDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));

        // Calculate age using inputs directly to be safe
        const today = new Date();
        let age = today.getFullYear() - parseInt(year);
        const m = today.getMonth() - (parseInt(month) - 1);
        if (m < 0 || (m === 0 && today.getDate() < parseInt(day))) {
            age--;
        }

        if (age < 18) {
            Alert.alert('Must be 18 or above', 'You must be at least 18 years old to use LinkUp.');
            return;
        }

        Alert.alert(
            `You're ${age}`,
            'Please confirm your age.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Confirm',
                    onPress: () => submitDate(age, birthDate),
                },
            ]
        );
    };

    const isValid = day.length >= 1 && month.length >= 1 && year.length === 4;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 px-6 pt-12"
            >
                <View className="flex-1">
                    <View className="mb-6" />

                    <Text className="text-3xl font-bold text-black mb-8">What's your birthdate?</Text>

                    <View className="flex-row items-center space-x-4">
                        <View className="flex-1">
                            <TextInput
                                ref={dayRef}
                                value={day}
                                onChangeText={handleDayChange}
                                placeholder="DD"
                                keyboardType="number-pad"
                                maxLength={2}
                                className="border-b border-gray-500 py-3 text-2xl font-medium text-black text-center"
                                autoFocus
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                        <Text className="text-2xl text-gray-600">/</Text>
                        <View className="flex-1">
                            <TextInput
                                ref={monthRef}
                                value={month}
                                onChangeText={handleMonthChange}
                                placeholder="MM"
                                keyboardType="number-pad"
                                maxLength={2}
                                className="border-b border-gray-500 py-3 text-2xl font-medium text-black text-center"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                        <Text className="text-2xl text-gray-600">/</Text>
                        <View className="flex-[1.5]">
                            <TextInput
                                ref={yearRef}
                                value={year}
                                onChangeText={handleYearChange}
                                placeholder="YYYY"
                                keyboardType="number-pad"
                                maxLength={4}
                                className="border-b border-gray-500 py-3 text-2xl font-medium text-black text-center"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                    </View>
                    <Text className="text-gray-600 text-sm mt-4">Calculates age which will be visible on profile.</Text>
                </View>

                <ArrowButton
                    onPress={handleContinue}
                    disabled={!isValid}
                    isLoading={isSubmitting}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
