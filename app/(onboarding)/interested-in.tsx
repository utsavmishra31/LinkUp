import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function InterestedInSelection() {
    const [selectedGenders, setSelectedGenders] = useState<('MALE' | 'FEMALE' | 'OTHER')[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const toggleOption = (value: 'MALE' | 'FEMALE' | 'OTHER') => {
        setSelectedGenders((prev) => {
            if (prev.includes(value)) {
                return prev.filter((item) => item !== value);
            }
            return [...prev, value];
        });
    };

    const handleContinue = async () => {
        if (selectedGenders.length === 0) return;
        if (!user) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    interestedIn: selectedGenders,
                    onboardingCompleted: true,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            // router.push('/(onboarding)/looking-for'); // This is now the last step, flow handled by AuthWrapper or just replace

        } catch (error) {
            console.error('Error updating interestedIn:', error);
            Alert.alert('Error', 'Failed to save preferences.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const Option = ({ label, value }: { label: string; value: 'MALE' | 'FEMALE' | 'OTHER' }) => {
        const isSelected = selectedGenders.includes(value);
        return (
            <TouchableOpacity
                onPress={() => toggleOption(value)}
                className={`w-full p-4 rounded-xl border mb-4 ${isSelected
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-white'
                    }`}
            >
                <Text
                    className={`text-xl font-medium ${isSelected ? 'text-purple-600' : 'text-gray-600'
                        }`}
                >
                    {label}
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">


                <Text className="text-3xl font-bold text-black mb-2">
                    Who do you wanna meet?
                </Text>
                <Text className="text-gray-500 mb-8">
                    You can choose more than one.
                </Text>

                <View className="flex-1">
                    <Option label="Men" value="MALE" />
                    <Option label="Women" value="FEMALE" />
                    <Option label="Non-binary" value="OTHER" />
                </View>

                <ArrowButton
                    onPress={handleContinue}
                    disabled={selectedGenders.length === 0}
                    isLoading={isSubmitting}
                />
            </View>
        </SafeAreaView>
    );
}
