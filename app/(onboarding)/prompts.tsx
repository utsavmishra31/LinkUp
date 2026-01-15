import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const MAX_ANSWER_LENGTH = 150;
const REQUIRED_PROMPTS = 1;
const MAX_PROMPTS = 3;

// Curated prompt questions similar to Bumble/Hinge
const PROMPT_QUESTIONS = [
    "My ideal Sunday",
    "Two truths and a lie",
    "I'm looking for someone who",
    "The way to my heart is",
    "I'm weirdly attracted to",
    "My simple pleasures",
    "A perfect day would include",
    "I go crazy for",
    "My most controversial opinion",
    "I'm overly competitive about",
    "The key to my heart is",
    "I'm convinced that",
    "My greatest strength is",
    "I geek out on",
    "The one thing I'd like to know about you is",
    "My love language is",
    "I'm secretly really good at",
    "My perfect first date",
    "I'm looking for",
    "Together we could",
    "I know the best spot in town for",
    "My go-to karaoke song",
    "I won't shut up about",
    "A shower thought I recently had",
];

interface PromptSlot {
    question: string | null;
    answer: string;
}

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<PromptSlot[]>([
        { question: null, answer: '' },
        { question: null, answer: '' },
        { question: null, answer: '' },
    ]);
    const [showQuestionPicker, setShowQuestionPicker] = useState(false);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const openQuestionPicker = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveSlotIndex(index);
        setShowQuestionPicker(true);
    };

    const selectQuestion = (question: string) => {
        if (activeSlotIndex !== null) {
            setPrompts(prev => {
                const updated = [...prev];
                updated[activeSlotIndex] = { ...updated[activeSlotIndex], question };
                return updated;
            });
            setShowQuestionPicker(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    };

    const updateAnswer = (index: number, answer: string) => {
        if (answer.length <= MAX_ANSWER_LENGTH) {
            setPrompts(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], answer };
                return updated;
            });
        }
    };

    const clearPrompt = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPrompts(prev => {
            const updated = [...prev];
            updated[index] = { question: null, answer: '' };
            return updated;
        });
    };

    const handleContinue = async () => {
        try {
            // Filter valid prompts
            const validPrompts = prompts.filter(p => p.question && p.answer.trim());

            if (validPrompts.length < REQUIRED_PROMPTS) {
                Alert.alert(
                    'More Prompts Required',
                    `Please fill at least ${REQUIRED_PROMPTS} prompt to continue.`,
                    [{ text: 'OK' }]
                );
                return;
            }

            setIsSubmitting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Get session token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('No access token available');
            }

            // Save prompts to backend
            const response = await fetch(`${API_URL}/prompts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompts: validPrompts }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to save prompts');
            }

            // Mark onboarding as completed
            if (user) {
                const { error } = await supabase
                    .from('users')
                    .update({ onboardingCompleted: true })
                    .eq('id', user.id);

                if (error) throw error;

                await refreshProfile();
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            console.error('Error saving prompts:', error);
            Alert.alert('Error', error.message || 'Failed to save prompts. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filledCount = prompts.filter(p => p.question && p.answer.trim()).length;
    const canContinue = filledCount >= REQUIRED_PROMPTS && !isSubmitting;

    // Get available questions (exclude already selected ones)
    const availableQuestions = PROMPT_QUESTIONS.filter(
        q => !prompts.some(p => p.question === q)
    );

    return (
        <SafeAreaView className="flex-1 bg-gradient-to-br from-purple-50 to-pink-50">
            <ScrollView className="flex-1 px-6 pt-12" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">
                        Show Your Personality
                    </Text>
                    <Text className="text-base text-gray-600">
                        Answer prompts to help others get to know you better
                    </Text>
                    <View className="mt-3 flex-row items-center">
                        <Ionicons
                            name={filledCount >= REQUIRED_PROMPTS ? "checkmark-circle" : "chatbubbles"}
                            size={20}
                            color={filledCount >= REQUIRED_PROMPTS ? "#10b981" : "#9333ea"}
                        />
                        <Text className={`ml-2 font-semibold ${filledCount >= REQUIRED_PROMPTS ? 'text-green-600' : 'text-purple-600'}`}>
                            {filledCount} / {REQUIRED_PROMPTS} required
                        </Text>
                        {filledCount > REQUIRED_PROMPTS && (
                            <Text className="ml-4 text-gray-500">
                                +{filledCount - REQUIRED_PROMPTS} bonus
                            </Text>
                        )}
                    </View>
                </View>

                {/* Prompt Slots */}
                <View className="mb-8 space-y-4">
                    {prompts.map((prompt, index) => (
                        <View
                            key={index}
                            className="mb-4 rounded-3xl overflow-hidden"
                            style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 12,
                                elevation: 5,
                            }}
                        >
                            <View className="bg-white p-5">
                                {/* Question Selector */}
                                <TouchableOpacity
                                    onPress={() => openQuestionPicker(index)}
                                    activeOpacity={0.7}
                                    className={`flex-row items-center justify-between p-4 rounded-2xl ${prompt.question ? 'bg-purple-50' : 'bg-gray-50'
                                        }`}
                                >
                                    <View className="flex-1">
                                        <Text className={`font-semibold ${prompt.question ? 'text-purple-900' : 'text-gray-400'
                                            }`}>
                                            {prompt.question || 'Select a prompt...'}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-down"
                                        size={20}
                                        color={prompt.question ? "#9333ea" : "#9ca3af"}
                                    />
                                </TouchableOpacity>

                                {/* Answer Input */}
                                {prompt.question && (
                                    <View className="mt-4">
                                        <TextInput
                                            value={prompt.answer}
                                            onChangeText={(text) => updateAnswer(index, text)}
                                            placeholder="Your answer..."
                                            placeholderTextColor="#9ca3af"
                                            multiline
                                            maxLength={MAX_ANSWER_LENGTH}
                                            className="bg-gray-50 rounded-2xl p-4 text-base text-gray-900 min-h-[100px]"
                                            style={{ textAlignVertical: 'top' }}
                                        />
                                        <View className="flex-row items-center justify-between mt-2 px-2">
                                            <Text className={`text-xs ${prompt.answer.length >= MAX_ANSWER_LENGTH
                                                    ? 'text-red-500'
                                                    : 'text-gray-400'
                                                }`}>
                                                {prompt.answer.length} / {MAX_ANSWER_LENGTH}
                                            </Text>
                                            {prompt.answer.trim() && (
                                                <TouchableOpacity
                                                    onPress={() => clearPrompt(index)}
                                                    className="flex-row items-center"
                                                >
                                                    <Ionicons name="close-circle" size={16} color="#ef4444" />
                                                    <Text className="text-red-500 text-xs ml-1">Clear</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Slot Number Badge */}
                                <View className="absolute top-3 right-3">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center ${prompt.question && prompt.answer.trim()
                                            ? 'bg-green-500'
                                            : index < REQUIRED_PROMPTS
                                                ? 'bg-purple-200'
                                                : 'bg-gray-200'
                                        }`}>
                                        {prompt.question && prompt.answer.trim() ? (
                                            <Ionicons name="checkmark" size={16} color="white" />
                                        ) : (
                                            <Text className={`font-bold text-sm ${index < REQUIRED_PROMPTS ? 'text-purple-700' : 'text-gray-500'
                                                }`}>
                                                {index + 1}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Tips */}
                <View className="mb-8 p-4 bg-purple-50 rounded-2xl">
                    <View className="flex-row items-start mb-2">
                        <Ionicons name="bulb" size={20} color="#9333ea" />
                        <Text className="ml-2 font-semibold text-purple-900">Tips</Text>
                    </View>
                    <Text className="text-sm text-purple-700 ml-7">
                        • Be authentic and genuine{'\n'}
                        • Show your personality and humor{'\n'}
                        • Keep it light and positive{'\n'}
                        • Make it easy to start a conversation
                    </Text>
                </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View className="px-6 pb-8 pt-4 border-t border-gray-100 bg-white">
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                    className={`rounded-full py-4 items-center justify-center ${canContinue ? 'bg-purple-500' : 'bg-gray-300'
                        }`}
                    style={
                        canContinue
                            ? {
                                shadowColor: '#9333ea',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 5,
                            }
                            : {}
                    }
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className={`text-lg font-bold ${canContinue ? 'text-white' : 'text-gray-500'}`}>
                            Complete Profile
                        </Text>
                    )}
                </TouchableOpacity>

                {filledCount >= REQUIRED_PROMPTS && filledCount < MAX_PROMPTS && (
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={isSubmitting}
                        className="mt-3 py-3 items-center"
                    >
                        <Text className="text-gray-500 text-base">
                            Skip remaining prompts
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Question Picker Modal */}
            <Modal
                visible={showQuestionPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowQuestionPicker(false)}
            >
                <View className="flex-1 bg-black/50">
                    <TouchableOpacity
                        className="flex-1"
                        activeOpacity={1}
                        onPress={() => setShowQuestionPicker(false)}
                    />
                    <View className="bg-white rounded-t-3xl max-h-[70%]">
                        <View className="p-6 border-b border-gray-100">
                            <View className="flex-row items-center justify-between">
                                <Text className="text-xl font-bold text-black">
                                    Choose a Prompt
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowQuestionPicker(false)}
                                    className="w-8 h-8 items-center justify-center"
                                >
                                    <Ionicons name="close" size={24} color="#000" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
                            {availableQuestions.map((question, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => selectQuestion(question)}
                                    activeOpacity={0.7}
                                    className="py-4 border-b border-gray-100"
                                >
                                    <Text className="text-base text-gray-900">{question}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
