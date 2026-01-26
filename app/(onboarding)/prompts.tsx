import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Hardcoded Prompts Data ---
export const PREDEFINED_PROMPTS = [
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

export interface PromptData {
    id: string; // unique ID based on timestamp or random
    question: string;
    answer: string;
}

// --- Reusable Components ---

export const BioInput = ({ value, onChangeText, maxLength = 500, placeholder = "" }: { value: string, onChangeText: (t: string) => void, maxLength?: number, placeholder?: string }) => {
    return (
        <View className="mb-6">
            <Text className="text-lg font-bold text-black mb-3">Bio</Text>
            <TextInput
                className="bg-white border border-gray-200 rounded-xl p-4 text-black text-base leading-6 min-h-[80px] align-top"
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                multiline
                value={value}
                onChangeText={onChangeText}
                maxLength={maxLength}
            />
            <View className="items-end mt-2">
                <Text className="text-xs text-gray-400">
                    {value.length}/{maxLength}
                </Text>
            </View>
        </View>
    );
};

export const PromptSlot = ({
    data,
    onPress,
    onClear
}: {
    data?: PromptData | null,
    onPress: () => void,
    onClear?: () => void
}) => {
    if (data) {
        return (
            <View className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
                <View className="flex-row justify-between items-start mb-2">
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide pr-6">
                        {data.question}
                    </Text>
                    {onClear && (
                        <TouchableOpacity
                            onPress={onClear}
                            className="p-1 -mr-2 -mt-2 bg-gray-50 rounded-full"
                        >
                            <Ionicons name="close" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity onPress={onPress}>
                    <Text className="text-lg text-black leading-6 font-medium">
                        {data.answer}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            className="border border-gray-200 rounded-xl p-6 items-center justify-center bg-white active:bg-gray-100"
        >
            <Text className="text-gray-700 font-medium">+ Select a prompt</Text>
        </TouchableOpacity>
    );
}

export const PromptModal = ({
    visible,
    onClose,
    onSave,
    initialData,
    availablePrompts = PREDEFINED_PROMPTS
}: {
    visible: boolean;
    onClose: () => void;
    onSave: (data: { question: string; answer: string }) => void;
    initialData?: { question: string; answer: string } | null;
    availablePrompts?: string[];
}) => {
    const [step, setStep] = useState<'SELECT_QUESTION' | 'TYPE_ANSWER'>('SELECT_QUESTION');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');

    useEffect(() => {
        if (visible) {
            if (initialData) {
                setQuestion(initialData.question);
                setAnswer(initialData.answer);
                setStep('TYPE_ANSWER');
            } else {
                setQuestion('');
                setAnswer('');
                setStep('SELECT_QUESTION');
            }
        }
    }, [visible, initialData]);

    const handleSave = () => {
        if (!answer.trim()) return;
        onSave({ question, answer: answer.trim() });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 bg-white"
            >
                <SafeAreaView className="flex-1">
                    <View className="px-6 py-4 border-b border-gray-100 flex-row justify-between items-center bg-white z-10 w-full">
                        {step === 'TYPE_ANSWER' ? (
                            <TouchableOpacity onPress={() => setStep('SELECT_QUESTION')}>
                                <Ionicons name="chevron-back" size={24} color="black" />
                            </TouchableOpacity>
                        ) : (
                            <View className="w-6" />
                        )}
                        <Text className="font-bold text-lg text-center flex-1">
                            {step === 'SELECT_QUESTION' ? 'Pick a Prompt' : 'Your Answer'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="black" />
                        </TouchableOpacity>
                    </View>

                    {step === 'SELECT_QUESTION' ? (
                        <ScrollView className="flex-1 px-6">
                            <View className="py-4 gap-y-1">
                                {availablePrompts.map((q) => (
                                    <TouchableOpacity
                                        key={q}
                                        onPress={() => {
                                            setQuestion(q);
                                            setStep('TYPE_ANSWER');
                                        }}
                                        className="py-4 border-b border-gray-50 active:bg-gray-50 -mx-6 px-6"
                                    >
                                        <Text className="text-base text-gray-900 font-medium">{q}</Text>
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
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View className="flex-1 px-6 pt-6">
                                <View className="mb-4">
                                    <Text className="text-sm font-bold text-gray-500 uppercase mb-2 tracking-wide">
                                        {question}
                                    </Text>
                                </View>
                                <TextInput
                                    className="text-xl text-black leading-7 min-h-[120px] align-top"
                                    placeholder="Type your answer here..."
                                    placeholderTextColor="#9ca3af"
                                    multiline
                                    autoFocus
                                    value={answer}
                                    onChangeText={setAnswer}
                                    maxLength={150}
                                />
                                <View className="items-end mt-2">
                                    <Text className={`text-xs ${answer.length > 130 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {150 - answer.length}
                                    </Text>
                                </View>
                                <View className="flex-1" />
                                <View className="mb-4">
                                    <TouchableOpacity
                                        onPress={handleSave}
                                        disabled={!answer.trim()}
                                        className={`w-full py-4 rounded-full items-center ${answer.trim() ? 'bg-black' : 'bg-gray-200'}`}
                                    >
                                        <Text className={`font-bold text-base ${answer.trim() ? 'text-white' : 'text-gray-400'}`}>
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
    );
};

export default function PromptsScreen() {
    const router = useRouter();
    const { user, refreshProfile } = useAuth();

    // --- State ---
    const [bio, setBio] = useState('');
    const [selectedPrompts, setSelectedPrompts] = useState<(PromptData | null)[]>([null]);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track which slot we are currently editing (0, 1, or 2)
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

    // --- Actions ---

    const handleSlotPress = (index: number) => {
        setActiveSlotIndex(index);
        setModalVisible(true);
    };

    const handleClearSlot = (index: number) => {
        const newPrompts = [...selectedPrompts];
        newPrompts[index] = null;
        setSelectedPrompts(newPrompts);
    };

    const handleSavePrompt = (data: { question: string; answer: string }) => {
        if (activeSlotIndex === null) return;

        const newPrompts = [...selectedPrompts];
        newPrompts[activeSlotIndex] = {
            id: Date.now().toString(),
            question: data.question,
            answer: data.answer,
        };
        setSelectedPrompts(newPrompts);
        setModalVisible(false);
        setActiveSlotIndex(null);
    };

    const handleContinue = async () => {
        if (!user) {
            Alert.alert('Error', 'No authenticated user found.');
            return;
        }

        const validPrompts = selectedPrompts.filter((p): p is PromptData => p !== null);

        if (validPrompts.length < 1) {
            Alert.alert('Required', 'Please add a prompt.');
            return;
        }

        if (!bio.trim()) {
            Alert.alert('Required', 'Please enter your bio.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    userId: user.id,
                    prompts: validPrompts,
                    bio: bio.trim(),
                });

            if (profileError) throw profileError;

            const { error: userError } = await supabase
                .from('users')
                .update({ onboardingStep: 10 })
                .eq('id', user.id);

            if (userError) throw userError;

            await refreshProfile();
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
    const canContinue = filledCount >= 1 && bio.trim().length > 0;

    // Filter out prompts that are already selected in OTHER slots
    const availablePrompts = PREDEFINED_PROMPTS.filter(p => {
        const isUsed = selectedPrompts.some(sp => sp?.question === p);
        const currentQuestion = activeSlotIndex !== null ? selectedPrompts[activeSlotIndex]?.question : null;
        return !isUsed || (currentQuestion === p);
    });

    const activePromptData = activeSlotIndex !== null ? selectedPrompts[activeSlotIndex] : null;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            <View className="flex-1 px-6 pt-8">
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">Bio & Prompt</Text>
                    <Text className="text-gray-500 text-base">Add a bio and a prompt</Text>
                </View>

                {/* Bio Input */}
                <BioInput
                    value={bio}
                    onChangeText={setBio}
                />

                {/* Slots */}
                <View className="gap-y-4">
                    <Text className="text-lg font-bold text-black mb-3">Prompt</Text>
                    {[0].map((index) => (
                        <PromptSlot
                            key={index}
                            data={selectedPrompts[index]}
                            onPress={() => handleSlotPress(index)}
                            onClear={selectedPrompts[index] ? () => handleClearSlot(index) : undefined}
                        />
                    ))}
                </View>

                <View className="flex-1" />

                {/* Footer */}
                <ArrowButton
                    onPress={handleContinue}
                    disabled={!canContinue}
                    isLoading={isSubmitting}
                />
            </View>

            {/* Reusable Modal */}
            <PromptModal
                visible={isModalVisible}
                onClose={() => {
                    setModalVisible(false);
                    setActiveSlotIndex(null);
                }}
                onSave={handleSavePrompt}
                initialData={activePromptData}
                availablePrompts={availablePrompts}
            />
        </SafeAreaView>
    );
}
