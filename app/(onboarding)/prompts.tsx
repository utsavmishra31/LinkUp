import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Hardcoded Prompts Data ---
const PREDEFINED_PROMPTS = [
    "A non-negotiable for me is",
    "Simple pleasures",
    "Typical Sunday",
    "I'm looking for",
    "My simple pleasures",
    "A random fact I love",
    "I geek out on",
    "Two truths and a lie",
    "Believe it or not, I",
    "Best travel story",
    "Dating me is like",
    "I want someone who",
    "My most controversial opinion is",
    "The way to win me over is",
    "Biggest risk I've taken",
];

interface PromptData {
    id: string; // unique ID based on timestamp or random
    question: string;
    answer: string;
}

export default function PromptsScreen() {
    const router = useRouter();
    const { user, refreshProfile } = useAuth();

    // --- State ---
    const [selectedPrompts, setSelectedPrompts] = useState<(PromptData | null)[]>([null, null, null]);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track which slot we are currently editing (0, 1, or 2)
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

    // Track state within the modal (selecting question vs typing answer)
    const [stepInModal, setStepInModal] = useState<'SELECT_QUESTION' | 'TYPE_ANSWER'>('SELECT_QUESTION');
    const [tempQuestion, setTempQuestion] = useState('');
    const [tempAnswer, setTempAnswer] = useState('');

    // --- Actions ---

    const handleSlotPress = (index: number) => {
        const existingData = selectedPrompts[index];
        setActiveSlotIndex(index);

        if (existingData) {
            setTempQuestion(existingData.question);
            setTempAnswer(existingData.answer);
            setStepInModal('TYPE_ANSWER'); // Jump straight to editing answer but allow back to change prompt
            // If they want to change the prompt, they can hit "Back" in the modal header
        } else {
            setTempQuestion('');
            setTempAnswer('');
            setStepInModal('SELECT_QUESTION');
        }
        setModalVisible(true);
    };

    const handleClearSlot = (index: number) => {
        const newPrompts = [...selectedPrompts];
        newPrompts[index] = null;
        setSelectedPrompts(newPrompts);
    };

    const handleSelectQuestion = (question: string) => {
        setTempQuestion(question);
        setStepInModal('TYPE_ANSWER');
    };

    const handleSavePrompt = () => {
        if (activeSlotIndex === null) return;
        if (!tempAnswer.trim()) return;

        const newPrompts = [...selectedPrompts];
        newPrompts[activeSlotIndex] = {
            id: Date.now().toString(),
            question: tempQuestion,
            answer: tempAnswer.trim(),
        };
        setSelectedPrompts(newPrompts);
        closeModal();
    };

    const closeModal = () => {
        setModalVisible(false);
        setActiveSlotIndex(null);
        setStepInModal('SELECT_QUESTION');
        setTempQuestion('');
        setTempAnswer('');
    };

    const handleContinue = async () => {
        if (!user) {
            Alert.alert('Error', 'No authenticated user found.');
            return;
        }

        const validPrompts = selectedPrompts.filter((p): p is PromptData => p !== null);

        if (validPrompts.length < 1) {
            Alert.alert('Required', 'Please add at least 1 prompt.');
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Save prompts to profile
            // We use upsert to create or update the profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    userId: user.id,
                    prompts: validPrompts, // Saving as JSONB
                });

            if (profileError) throw profileError;

            // Update onboarding step
            const { error: userError } = await supabase
                .from('users')
                .update({ onboardingStep: 10 })
                .eq('id', user.id);

            if (userError) throw userError;

            await refreshProfile();

            // 2. Navigate to Location screen
            router.push('/(onboarding)/location');
        } catch (error: any) {
            console.error('Error saving prompts:', error);
            Alert.alert('Error', error.message || 'Failed to save prompts.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Validation
    const filledCount = selectedPrompts.filter(p => p !== null).length;
    const canContinue = filledCount >= 1;

    // Filter out prompts that are already selected in OTHER slots
    const availablePrompts = PREDEFINED_PROMPTS.filter(p => {
        const isUsed = selectedPrompts.some(sp => sp?.question === p);
        // It is available if NOT used, OR if it is used by the CURRENT slot (so we can keep it)
        return !isUsed || (activeSlotIndex !== null && selectedPrompts[activeSlotIndex]?.question === p);
    });

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            <View className="flex-1 px-6 pt-8">
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">Written Prompts</Text>
                    <Text className="text-gray-500 text-base">Add 3 prompts to your profile. 1 is required.</Text>
                </View>

                {/* Slots */}
                <View className="gap-y-4">
                    {[0, 1, 2].map((index) => {
                        const data = selectedPrompts[index];
                        return (
                            <View key={index} className="relative">
                                {data ? (
                                    // Filled State
                                    <View className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                        <View className="flex-row justify-between items-start mb-2">
                                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                {data.question}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => handleClearSlot(index)}
                                                className="p-1 -mr-2 -mt-2 bg-gray-50 rounded-full"
                                            >
                                                <Ionicons name="close" size={16} color="#9ca3af" />
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity onPress={() => handleSlotPress(index)}>
                                            <Text className="text-lg text-black leading-6 font-medium">
                                                {data.answer}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    // Empty State
                                    <TouchableOpacity
                                        onPress={() => handleSlotPress(index)}
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 items-center justify-center bg-gray-50 active:bg-gray-100"
                                    >
                                        <Text className="text-gray-400 font-medium">+ Select a prompt</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>

                <View className="flex-1" />

                {/* Footer */}
                <ArrowButton
                    onPress={handleContinue}
                    disabled={!canContinue}
                    isLoading={isSubmitting}
                />
            </View>

            {/* Modal for Selection & Input */}
            <Modal
                visible={isModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closeModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 bg-white"
                >
                    <SafeAreaView className="flex-1">
                        {/* Modal Header */}
                        <View className="px-6 py-4 border-b border-gray-100 flex-row justify-between items-center bg-white z-10 w-full">
                            {stepInModal === 'TYPE_ANSWER' ? (
                                <TouchableOpacity onPress={() => setStepInModal('SELECT_QUESTION')}>
                                    <Ionicons name="chevron-back" size={24} color="black" />
                                </TouchableOpacity>
                            ) : (
                                <View className="w-6" /> // spacer
                            )}

                            <Text className="font-bold text-lg text-center flex-1">
                                {stepInModal === 'SELECT_QUESTION' ? 'Pick a Prompt' : 'Your Answer'}
                            </Text>

                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={24} color="black" />
                            </TouchableOpacity>
                        </View>

                        {stepInModal === 'SELECT_QUESTION' ? (
                            // STEP 1: List of Prompts
                            <ScrollView className="flex-1 px-6">
                                <View className="py-4 gap-y-1">
                                    {availablePrompts.map((question) => (
                                        <TouchableOpacity
                                            key={question}
                                            onPress={() => handleSelectQuestion(question)}
                                            className="py-4 border-b border-gray-50 active:bg-gray-50 -mx-6 px-6"
                                        >
                                            <Text className="text-base text-gray-900 font-medium">{question}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    {availablePrompts.length === 0 && (
                                        <Text className="text-center text-gray-500 mt-10">
                                            No more prompts available.
                                        </Text>
                                    )}
                                </View>
                            </ScrollView>
                        ) : (
                            // STEP 2: Input Answer
                            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                                <View className="flex-1 px-6 pt-6">
                                    <View className="mb-4">
                                        <Text className="text-sm font-bold text-gray-500 uppercase mb-2 tracking-wide">
                                            {tempQuestion}
                                        </Text>
                                    </View>

                                    <TextInput
                                        className="text-xl text-black leading-7 min-h-[120px]"
                                        placeholder="Type your answer here..."
                                        placeholderTextColor="#9ca3af"
                                        multiline
                                        autoFocus
                                        value={tempAnswer}
                                        onChangeText={setTempAnswer}
                                        maxLength={140}
                                        style={{ textAlignVertical: 'top' }}
                                    />

                                    <View className="items-end mt-2">
                                        <Text className={`text-xs ${tempAnswer.length > 120 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {140 - tempAnswer.length}
                                        </Text>
                                    </View>

                                    <View className="flex-1" />

                                    <View className="mb-4">
                                        <TouchableOpacity
                                            onPress={handleSavePrompt}
                                            disabled={!tempAnswer.trim()}
                                            className={`w-full py-4 rounded-full items-center ${tempAnswer.trim() ? 'bg-black' : 'bg-gray-200'
                                                }`}
                                        >
                                            <Text className={`font-bold text-base ${tempAnswer.trim() ? 'text-white' : 'text-gray-400'
                                                }`}>
                                                Save Answer
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        )}
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
