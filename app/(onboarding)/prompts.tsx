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
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


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

// ... (imports remain the same, I will assume the imports block is outside the replacement range if I start from line 57, but wait, the prompt asks to rewrite the UI. I can replace the whole function body.)
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
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="mt-8 mb-6">
                    <Text className="text-4xl font-bold text-slate-900 tracking-tight">
                        Written Prompts
                    </Text>
                    <Text className="text-lg text-slate-500 mt-2 font-medium">
                        Pick replies that help others start a conversation
                    </Text>
                </View>

                {/* Prompt Slots */}
                <View className="mb-8">
                    {prompts.map((prompt, index) => (
                        <View
                            key={index}
                            className={`mb-6 p-4 rounded-xl border ${prompt.question ? 'border-purple-100 bg-purple-50/30' : 'border-slate-200 bg-white'
                                }`}
                        >
                            {/* Question Selector */}
                            <TouchableOpacity
                                onPress={() => openQuestionPicker(index)}
                                activeOpacity={0.7}
                                className="flex-row items-center justify-between"
                            >
                                <View className="flex-1 pr-4">
                                    <Text className={`text-base font-semibold ${prompt.question ? 'text-slate-900' : 'text-slate-400'
                                        }`}>
                                        {prompt.question || 'Select a prompt'}
                                    </Text>
                                </View>
                                {!prompt.question && (
                                    <Ionicons name="add-circle" size={24} color="#94a3b8" />
                                )}
                                {prompt.question && (
                                    <Ionicons name="create-outline" size={20} color="#94a3b8" />
                                )}
                            </TouchableOpacity>

                            {/* Answer Input */}
                            {prompt.question && (
                                <View className="mt-3 relative">
                                    <TextInput
                                        value={prompt.answer}
                                        onChangeText={(text) => updateAnswer(index, text)}
                                        placeholder="Type your answer here..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        maxLength={MAX_ANSWER_LENGTH}
                                        className="text-lg text-slate-700 min-h-[60px]"
                                        style={{ textAlignVertical: 'top' }}
                                    />

                                    <View className="flex-row items-center justify-between mt-2 border-t border-slate-100 pt-2">
                                        <TouchableOpacity
                                            onPress={() => clearPrompt(index)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text className="text-xs font-semibold text-slate-400">
                                                CLEAR
                                            </Text>
                                        </TouchableOpacity>
                                        <Text className={`text-xs ${prompt.answer.length >= MAX_ANSWER_LENGTH ? 'text-red-500' : 'text-slate-300'
                                            }`}>
                                            {prompt.answer.length}/{MAX_ANSWER_LENGTH}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}
                </View>

            </ScrollView>

            {/* Bottom Actions */}
            <View className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 blur-sm pt-4 border-t border-slate-100">
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                    className={`w-full py-4 rounded-full items-center justify-center ${canContinue ? 'bg-purple-600 shadow-lg shadow-purple-200' : 'bg-slate-200'
                        }`}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={canContinue ? "white" : "#94a3b8"} />
                    ) : (
                        <Text className={`text-lg font-bold ${canContinue ? 'text-white' : 'text-slate-400'}`}>
                            Complete Profile
                        </Text>
                    )}
                </TouchableOpacity>

                {filledCount >= REQUIRED_PROMPTS && filledCount < MAX_PROMPTS && (
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={isSubmitting}
                        className="mt-4 items-center"
                    >
                        <Text className="text-slate-500 font-medium">
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
                <View className="flex-1 bg-black/40">
                    <TouchableOpacity
                        className="flex-1"
                        activeOpacity={1}
                        onPress={() => setShowQuestionPicker(false)}
                    />
                    <View className="bg-white rounded-t-3xl max-h-[80%] shadow-2xl">
                        <View className="p-6 border-b border-slate-100 flex-row items-center justify-between">
                            <Text className="text-xl font-bold text-slate-900">
                                Choose a Prompt
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowQuestionPicker(false)}
                                className="w-8 h-8 items-center justify-center bg-slate-100 rounded-full"
                            >
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {availableQuestions.map((question, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => selectQuestion(question)}
                                    activeOpacity={0.7}
                                    className="px-6 py-5 border-b border-slate-50 active:bg-purple-50"
                                >
                                    <Text className="text-base text-slate-700 font-medium leading-6">
                                        {question}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <View className="h-10" />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
