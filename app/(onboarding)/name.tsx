import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
                    onboardingCompleted: true,
                })

            if (error) throw error;

            await refreshProfile();
            // AuthWrapper will handle redirection
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
                        <Text className="text-gray-500 font-medium mb-2 uppercase text-xs tracking-wider">First Name</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First Name"
                            className="border-b-2 border-gray-200 py-3 text-xl font-medium text-black"
                            autoFocus
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    <View className="mb-6">
                        <Text className="text-gray-500 font-medium mb-2 uppercase text-xs tracking-wider">Last Name</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Last Name"
                            className="border-b-2 border-gray-200 py-3 text-xl font-medium text-black"
                            placeholderTextColor="#9ca3af"
                        />
                        <Text className="text-gray-400 text-sm mt-2">This is optional.</Text>
                    </View>
                </View>

                <View className="mb-4">
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={!isValid || isSubmitting}
                        className={`w-full py-4 rounded-full items-center justify-center ${isValid && !isSubmitting ? 'bg-black' : 'bg-gray-200'
                            }`}
                    >
                        <Text className={`text-lg font-bold ${isValid && !isSubmitting ? 'text-white' : 'text-gray-400'
                            }`}>
                            {isSubmitting ? 'Saving...' : 'Continue'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
