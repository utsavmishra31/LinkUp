import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, KeyboardAvoidingView, Platform,  Text, TextInput, View } from 'react-native';

export default function NameOnboarding() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const handleContinue = async () => {
        if (!firstName.trim()) {
            Alert.alert('Required', 'First name is required.');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'No authenticated user found.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .upsert({
                    id: user.id,
                    email: user.email,
                    displayName: firstName.trim(),
                    surname: lastName.trim() || null,
                    // onboardingCompleted: true, // Moved to final step
                })

            if (error) throw error;

            await refreshProfile();
            router.push('/(onboarding)/dob');
        } catch (error: any) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to save name. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValid = firstName.trim().length > 0;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 px-6 pt-12"
            >
                <View className="flex-1">
                    <Text className="text-3xl font-bold text-black mb-8">My name is</Text>

                    <View className="mb-6">
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First name"
                            className="border-b border-gray-500 py-3 text-2xl font-medium text-black"
                            autoFocus
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    <View className="mb-6">
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Last name"
                            className="border-b border-gray-500 py-3 text-2xl font-medium text-black"
                            placeholderTextColor="#9ca3af"
                        />
                        <Text className="text-gray-400 text-sm mt-2">This is optional.</Text>
                    </View>
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
