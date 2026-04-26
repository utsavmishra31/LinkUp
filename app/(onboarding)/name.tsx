import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NameOnboarding() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const validateUsername = (text: string) => {
        if (!text) return null;
        if (text.length < 3) return "Username must be at least 3 characters";
        if (text.length > 30) return "Username must be 30 characters or less";
        if (text.startsWith('.')) return "Cannot start with a period";
        if (text.endsWith('.')) return "Cannot end with a period";
        if (!/^[a-z0-9._]+$/.test(text)) return "Only letters, numbers, underscores, and periods allowed";
        return null;
    };

    const handleUsernameChange = (text: string) => {
        const cleanedText = text.toLowerCase().replace(/[^a-z0-9._]/g, '');
        if (cleanedText.length <= 30) {
            setUsername(cleanedText);
            setUsernameError(validateUsername(cleanedText));
        }
    };

    // Debounced username availability check
    useEffect(() => {
        if (!username || usernameError || username.length < 3) {
            setIsAvailable(null);
            return;
        }

        const checkUsername = async () => {
            setIsChecking(true);
            try {
                const { error } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', username.toLowerCase())
                    .single();

                if (error && error.code === 'PGRST116') { // Not found
                    setIsAvailable(true);
                } else {
                    setIsAvailable(false);
                }
            } catch (err) {
                console.error('Error checking username:', err);
            } finally {
                setIsChecking(false);
            }
        };

        const timer = setTimeout(checkUsername, 500);
        return () => clearTimeout(timer);
    }, [username, usernameError]);

    const handleContinue = async () => {
        if (!firstName.trim()) {
            Alert.alert('Required', 'First name is required.');
            return;
        }

        const error = validateUsername(username);
        if (error) {
            Alert.alert('Invalid Username', error);
            return;
        }

        if (isAvailable === false) {
            Alert.alert('Error', 'Username is already taken.');
            return;
        }

        if (!username.trim()) {
            Alert.alert('Required', 'Username is required.');
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
                    username: username.trim().toLowerCase(),
                    surname: lastName.trim() || null,
                    onboardingStep: 2,
                })

            if (error) throw error;

            await refreshProfile();
            router.push('/(onboarding)/dob');
        } catch (error: any) {
            console.error('Error updating profile:', error);
            if (error.code === '23505') {
                Alert.alert('Error', 'Username already taken. Please choose another one.');
            } else {
                Alert.alert('Error', 'Failed to save name. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValid = firstName.trim().length > 0 &&
        username.trim().length >= 3 &&
        !usernameError &&
        isAvailable === true;

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

                    <View className="mt-8 mb-6">
                        <Text className="text-3xl font-bold text-black mb-8">Choose username</Text>
                        <TextInput
                            value={username}
                            onChangeText={handleUsernameChange}
                            placeholder="username"
                            className={`border-b ${usernameError || isAvailable === false ? 'border-red-500' : isAvailable === true ? 'border-green-500' : 'border-gray-500'} py-3 text-2xl font-medium text-black`}
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="none"
                            maxLength={30}
                        />
                        <View className="flex-row items-center mt-2">
                            {isChecking ? (
                                <Text className="text-gray-400 text-sm">Checking availability...</Text>
                            ) : usernameError ? (
                                <Text className="text-red-500 text-sm">{usernameError}</Text>
                            ) : isAvailable === true ? (
                                <Text className="text-green-500 text-sm">Username available!</Text>
                            ) : isAvailable === false ? (
                                <Text className="text-red-500 text-sm">Username taken</Text>
                            ) : (
                                <Text className="text-gray-400 text-sm">Only letters, numbers, underscores, and periods.</Text>
                            )}
                        </View>
                    </View>
                </View>

                <ArrowButton
                    onPress={handleContinue}
                    disabled={!isValid}
                    isLoading={isSubmitting}
                />
            </KeyboardAvoidingView>
        </SafeAreaView >
    );
}
