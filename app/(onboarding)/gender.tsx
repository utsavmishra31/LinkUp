import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function GenderSelection() {
    const [selectedGender, setSelectedGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const handleContinue = async () => {
        if (!selectedGender) return;
        if (!user) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    gender: selectedGender,
                    onboardingStep: 4,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            router.push('/(onboarding)/looking-for');
        } catch (error) {
            console.error('Error updating gender:', error);
            Alert.alert('Error', 'Failed to save gender.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const GenderOption = ({ label, value }: { label: string; value: 'MALE' | 'FEMALE' | 'OTHER' }) => (
        <TouchableOpacity
            onPress={() => setSelectedGender(value)}
            className={`w-full p-4 rounded-xl border mb-4 ${selectedGender === value
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 bg-white'
                }`}
        >
            <Text
                className={`text-xl font-medium ${selectedGender === value ? 'text-purple-600' : 'text-gray-600'
                    }`}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">


                <Text className="text-3xl font-bold text-black mb-8">
                    Which gender best describes you?
                </Text>

                <View className="flex-1">
                    <GenderOption label="Man" value="MALE" />
                    <GenderOption label="Woman" value="FEMALE" />
                    <GenderOption label="Non-binary" value="OTHER" />
                </View>

                <ArrowButton
                    onPress={handleContinue}
                    disabled={!selectedGender}
                    isLoading={isSubmitting}
                />
            </View>
        </SafeAreaView>
    );
}
