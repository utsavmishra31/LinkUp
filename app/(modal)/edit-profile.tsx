import { API_URL } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Types & Constants ---

interface PromptData {
    id: string;
    question: string;
    answer: string;
}

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

// Generate 8 days starting from today (today + next 7 days)
const getNext8Days = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 8; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        days.push({
            id: i,
            dayName: dayNames[date.getDay()],
            dayNumber: date.getDate(),
            month: monthNames[date.getMonth()],
            fullDate: date.toISOString().split('T')[0],
            isToday: i === 0,
        });
    }

    return days;
};

const DAYS = getNext8Days();

export default function EditProfileScreen() {
    const router = useRouter();
    const { user, refreshProfile } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // --- Form State ---
    const [photos, setPhotos] = useState<{ id: string, imageUrl: string, position: number }[]>([]);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [bio, setBio] = useState('');
    const [dobDay, setDobDay] = useState('');
    const [dobMonth, setDobMonth] = useState('');
    const [dobYear, setDobYear] = useState('');
    const [selectedPrompts, setSelectedPrompts] = useState<(PromptData | null)[]>([]);
    const [availableDayIndex, setAvailableDayIndex] = useState<number | null>(null);

    // --- Refs for DOB inputs ---
    const dobMonthRef = useRef<TextInput>(null);
    const dobYearRef = useRef<TextInput>(null);

    // --- Prompt Modal State ---
    const [isPromptModalVisible, setPromptModalVisible] = useState(false);
    const [modalStep, setModalStep] = useState<'SELECT_QUESTION' | 'TYPE_ANSWER'>('SELECT_QUESTION');
    const [tempQuestion, setTempQuestion] = useState('');
    const [tempAnswer, setTempAnswer] = useState('');
    const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

    // --- Data Fetching ---
    useEffect(() => {
        const loadProfileData = async () => {
            if (!user) return;
            try {
                // Fetch user data WITH profile relation and photos
                const { data, error } = await supabase
                    .from('users')
                    .select('displayName, surname, dob, photos(*), profile:profiles(*)')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                if (!data) return;

                // Photos
                if (data.photos) {
                    const sortedPhotos = [...data.photos].sort((a: any, b: any) => a.position - b.position);
                    setPhotos(sortedPhotos);
                }

                // Name
                setFirstName(data.displayName || '');
                setLastName(data.surname || '');

                // DOB
                if (data.dob) {
                    const date = new Date(data.dob);
                    setDobDay(date.getDate().toString().padStart(2, '0'));
                    setDobMonth((date.getMonth() + 1).toString().padStart(2, '0'));
                    setDobYear(date.getFullYear().toString());
                }

                // Profile Relation Fields
                if (data.profile) {
                    /* Type cast as any because typescript might not know the shape of the joined profile relation if using generated types incorrectly */
                    const profileData = data.profile as any;

                    setBio(profileData.bio || '');

                    // Prompts
                    if (profileData.prompts && Array.isArray(profileData.prompts)) {
                        setSelectedPrompts(profileData.prompts);
                    } else {
                        setSelectedPrompts([]);
                    }

                    // Availability
                    if (profileData.availableNext8Days && Array.isArray(profileData.availableNext8Days)) {
                        const index = profileData.availableNext8Days.findIndex((isAvailable: boolean) => isAvailable === true);
                        setAvailableDayIndex(index !== -1 ? index : null);
                    }
                }

            } catch (err) {
                console.error('Error fetching full profile:', err);
                Alert.alert('Error', 'Failed to load profile data');
            } finally {
                setIsLoading(false);
            }
        };

        loadProfileData();
    }, [user]);

    // --- Handlers: Photos ---

    const pickImage = async () => {
        const remainingSlots = 6 - photos.length;
        if (remainingSlots <= 0) {
            Alert.alert('Limit Reached', 'You can only upload up to 6 photos.');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const uri = result.assets[0].uri;
                await uploadImage(uri);
            }
        } catch (error) {
            console.error('Error picking images:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadImage = async (uri: string) => {
        try {
            setIsSaving(true);
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('No authentication token found');

            const formData = new FormData();
            const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('image', {
                uri,
                name: filename,
                type,
            } as any);

            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed');

            await refreshProfile();
            // Also refresh local state efficiently? 
            // Better to re-fetch the specific data or append locally.
            // For now, let's just append locally if we can get the ID, or re-fetch.
            // Re-fetching is safer.
            const { data: userData } = await supabase.from('users').select('photos(*)').eq('id', user?.id).single();
            if (userData?.photos) {
                const sortedPhotos = [...userData.photos].sort((a: any, b: any) => a.position - b.position);
                setPhotos(sortedPhotos);
            }

        } catch (error: any) {
            console.error('Error uploading photo:', error);
            Alert.alert('Error', error.message || 'Failed to upload photo');
        } finally {
            setIsSaving(false);
        }
    };

    const removePhoto = async (photoId: string) => {
        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('photos')
                .delete()
                .eq('id', photoId);

            if (error) throw error;

            setPhotos(prev => prev.filter(p => p.id !== photoId));
            await refreshProfile();
        } catch (error: any) {
            console.error('Error deleting photo:', error);
            Alert.alert('Error', 'Failed to delete photo');
        } finally {
            setIsSaving(false);
        }
    };

    // --- Handlers: DOB ---
    const handleDobDay = (text: string) => { setDobDay(text); if (text.length === 2) dobMonthRef.current?.focus(); };
    const handleDobMonth = (text: string) => { setDobMonth(text); if (text.length === 2) dobYearRef.current?.focus(); };

    // --- Handlers: Prompts ---
    const handlePromptPress = (prompt: PromptData | null, index?: number) => {
        if (prompt) {
            setEditingPromptId(prompt.id);
            setTempQuestion(prompt.question);
            setTempAnswer(prompt.answer);
            setModalStep('TYPE_ANSWER');
        } else {
            setEditingPromptId(null);
            setTempQuestion('');
            setTempAnswer('');
            setModalStep('SELECT_QUESTION');
        }
        setPromptModalVisible(true);
    };

    const handleSelectQuestion = (question: string) => {
        setTempQuestion(question);
        setModalStep('TYPE_ANSWER');
    };

    const handleSavePrompt = () => {
        if (!tempAnswer.trim()) return;

        let newPrompts = [...selectedPrompts];

        if (editingPromptId) {
            newPrompts = newPrompts.map(p =>
                p?.id === editingPromptId
                    ? { ...p, question: tempQuestion, answer: tempAnswer.trim() }
                    : p
            );
        } else {
            newPrompts.push({
                id: Date.now().toString(),
                question: tempQuestion,
                answer: tempAnswer.trim(),
            });
        }

        setSelectedPrompts(newPrompts);
        closePromptModal();
    };

    const deletePrompt = (id: string) => {
        setSelectedPrompts(prev => prev.filter(p => p?.id !== id));
    };

    const closePromptModal = () => {
        setPromptModalVisible(false);
        setEditingPromptId(null);
        setModalStep('SELECT_QUESTION');
        setTempQuestion('');
        setTempAnswer('');
    };

    const availablePrompts = PREDEFINED_PROMPTS.filter(p => {
        const isUsed = selectedPrompts.some(sp => sp?.question === p);
        const isCurrentlyEditing = editingPromptId && selectedPrompts.find(sp => sp?.id === editingPromptId)?.question === p;
        return !isUsed || isCurrentlyEditing;
    });

    // --- Handler: Save All ---

    const handleSaveAll = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            // 1. Validate DOB
            const d = parseInt(dobDay);
            const m = parseInt(dobMonth);
            const y = parseInt(dobYear);
            let dobISO = null;
            let age = null;

            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                const date = new Date(Date.UTC(y, m - 1, d));
                dobISO = date.toISOString().split('T')[0];

                const today = new Date();
                age = today.getFullYear() - y;
                const mDiff = today.getMonth() - (m - 1);
                if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) {
                    age--;
                }
            }

            // 2. Update Users Table
            const { error: userError } = await supabase
                .from('users')
                .update({
                    displayName: firstName.trim(),
                    surname: lastName.trim() || null,
                    ...(dobISO ? { dob: dobISO, age } : {})
                })
                .eq('id', user.id);

            if (userError) throw userError;

            // 3. Update Profiles Table
            const availabilityArray = new Array(8).fill(false);
            if (availableDayIndex !== null && availableDayIndex >= 0 && availableDayIndex < 8) {
                availabilityArray[availableDayIndex] = true;
            }

            const validPrompts = selectedPrompts.filter(p => p !== null);

            // Accessing profile table, handling if it doesn't exist (upsert)
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    userId: user.id,
                    bio: bio.trim(),
                    prompts: validPrompts,
                    availableNext8Days: availabilityArray,
                });

            if (profileError) throw profileError;

            await refreshProfile();
            Alert.alert('Success', 'Profile updated successfully');
            router.back();

        } catch (error: any) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white justify-center items-center">
                <Text>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text className="text-lg font-bold">Edit Profile</Text>
                <View className="w-10" />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                    {/* --- PHOTOS --- */}
                    <Text className="text-lg font-bold mb-3">Photos</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
                        {[...Array(6)].map((_, index) => {
                            const photo = photos[index];
                            return (
                                <Pressable
                                    key={index}
                                    onPress={() => !photo && pickImage()}
                                    className={`w-[31%] aspect-[3/4] rounded-xl overflow-hidden relative ${photo ? 'bg-gray-100' : 'bg-gray-50 border-2 border-dashed border-gray-300'}`}
                                >
                                    {photo ? (
                                        <>
                                            <Image
                                                source={{ uri: photo.imageUrl?.startsWith('http') ? photo.imageUrl : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${photo.imageUrl}` }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                            <Pressable
                                                onPress={() => removePhoto(photo.id)}
                                                className="absolute top-1 right-1 bg-white/80 rounded-full p-1"
                                                hitSlop={10}
                                            >
                                                <Ionicons name="close" size={14} color="black" />
                                            </Pressable>
                                            {index === 0 && (
                                                <View className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded-md">
                                                    <Text className="text-[10px] font-bold uppercase text-black">Main</Text>
                                                </View>
                                            )}
                                        </>
                                    ) : (
                                        <View className="flex-1 items-center justify-center">
                                            <Ionicons name="add" size={24} color="#9ca3af" />
                                        </View>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* --- DETAILS --- */}
                    <Text className="text-lg font-bold mb-3">About You</Text>

                    {/* Name */}
                    <View className="mb-4">
                        <Text className="text-gray-500 text-xs uppercase mb-1">Display Name</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            className="bg-gray-50 p-4 rounded-xl text-black border border-gray-200"
                            placeholder="Your Name"
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-500 text-xs uppercase mb-1">Last Name (Optional)</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            className="bg-gray-50 p-4 rounded-xl text-black border border-gray-200"
                            placeholder="Last Name"
                        />
                    </View>

                    {/* DOB */}
                    <View className="mb-6">
                        <Text className="text-gray-500 text-xs uppercase mb-1">Date of Birth</Text>
                        <View className="flex-row gap-2">
                            <TextInput
                                value={dobDay}
                                onChangeText={handleDobDay}
                                placeholder="DD"
                                keyboardType="number-pad"
                                maxLength={2}
                                className="flex-1 bg-gray-50 p-4 rounded-xl text-black border border-gray-200 text-center"
                            />
                            <TextInput
                                ref={dobMonthRef}
                                value={dobMonth}
                                onChangeText={handleDobMonth}
                                placeholder="MM"
                                keyboardType="number-pad"
                                maxLength={2}
                                className="flex-1 bg-gray-50 p-4 rounded-xl text-black border border-gray-200 text-center"
                            />
                            <TextInput
                                ref={dobYearRef}
                                value={dobYear}
                                onChangeText={setDobYear}
                                placeholder="YYYY"
                                keyboardType="number-pad"
                                maxLength={4}
                                className="flex-[1.5] bg-gray-50 p-4 rounded-xl text-black border border-gray-200 text-center"
                            />
                        </View>
                    </View>

                    {/* Bio */}
                    <View className="mb-8">
                        <Text className="text-lg font-bold mb-3">Bio</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-black text-base leading-6 min-h-[100px] align-top"
                            placeholder="Write something about yourself..."
                            multiline
                            value={bio}
                            onChangeText={setBio}
                            maxLength={500}
                        />
                        <Text className="text-right text-gray-400 text-xs mt-1">{bio.length}/500</Text>
                    </View>

                    {/* --- PROMPTS --- */}
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-lg font-bold">Prompts</Text>
                            {selectedPrompts.length < 3 && (
                                <TouchableOpacity onPress={() => handlePromptPress(null)}>
                                    <Text className="text-blue-500 font-semibold">+ Add</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View className="gap-y-3">
                            {selectedPrompts.map((prompt) => (
                                prompt && (
                                    <View key={prompt.id} className="relative">
                                        <TouchableOpacity
                                            onPress={() => handlePromptPress(prompt)}
                                            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                                        >
                                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{prompt.question}</Text>
                                            <Text className="text-base text-black">{prompt.answer}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => deletePrompt(prompt.id)}
                                            className="absolute top-2 right-2 p-2 bg-gray-50 rounded-full border border-gray-100"
                                        >
                                            <Ionicons name="close" size={14} color="gray" />
                                        </TouchableOpacity>
                                    </View>
                                )
                            ))}
                            {selectedPrompts.length === 0 && (
                                <Text className="text-gray-400 italic">No prompts added.</Text>
                            )}
                        </View>
                    </View>

                    {/* --- AVAILABILITY --- */}
                    <View className="mb-8">
                        <Text className="text-lg font-bold mb-3">Availability (Next 8 Days)</Text>
                        <Text className="text-gray-500 text-sm mb-4">Select the day you are most available.</Text>
                        <View className="gap-3">
                            {/* Row 1 */}
                            <View className="flex-row gap-3">
                                {DAYS.slice(0, 4).map((day, index) => (
                                    <TouchableOpacity
                                        key={day.id}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setAvailableDayIndex(availableDayIndex === index ? null : index);
                                        }}
                                        className={`flex-1 items-center justify-center py-3 rounded-xl border ${availableDayIndex === index ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <Text className={`text-xs ${availableDayIndex === index ? 'text-white' : 'text-gray-500'}`}>{day.dayName}</Text>
                                        <Text className={`text-lg font-bold ${availableDayIndex === index ? 'text-white' : 'text-black'}`}>{day.dayNumber}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {/* Row 2 */}
                            <View className="flex-row gap-3">
                                {DAYS.slice(4, 8).map((day, index) => (
                                    <TouchableOpacity
                                        key={day.id}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            const realIndex = index + 4;
                                            setAvailableDayIndex(availableDayIndex === realIndex ? null : realIndex);
                                        }}
                                        className={`flex-1 items-center justify-center py-3 rounded-xl border ${availableDayIndex === index + 4 ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <Text className={`text-xs ${availableDayIndex === index + 4 ? 'text-white' : 'text-gray-500'}`}>{day.dayName}</Text>
                                        <Text className={`text-lg font-bold ${availableDayIndex === index + 4 ? 'text-white' : 'text-black'}`}>{day.dayNumber}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                </ScrollView>

                {/* --- FOOTER --- */}
                <View className="p-5 border-t border-gray-100 bg-white">
                    <TouchableOpacity
                        onPress={handleSaveAll}
                        disabled={isSaving || firstName.trim().length === 0}
                        className={`w-full py-4 rounded-full items-center ${isSaving || firstName.trim().length === 0 ? 'bg-gray-200' : 'bg-black'}`}
                    >
                        {isSaving ? (
                            <Text className="text-gray-500 font-bold text-lg">Saving...</Text>
                        ) : (
                            <Text className="text-white font-bold text-lg">Save Changes</Text>
                        )}

                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* --- PROMPT MODAL --- */}
            <Modal
                visible={isPromptModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closePromptModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 bg-white"
                >
                    <SafeAreaView className="flex-1">
                        <View className="px-6 py-4 border-b border-gray-100 flex-row justify-between items-center bg-white z-10 w-full">
                            {modalStep === 'TYPE_ANSWER' ? (
                                <TouchableOpacity onPress={() => setModalStep('SELECT_QUESTION')}>
                                    <Ionicons name="chevron-back" size={24} color="black" />
                                </TouchableOpacity>
                            ) : (
                                <View className="w-6" />
                            )}
                            <Text className="font-bold text-lg text-center flex-1">
                                {modalStep === 'SELECT_QUESTION' ? 'Pick a Prompt' : 'Your Answer'}
                            </Text>
                            <TouchableOpacity onPress={closePromptModal}>
                                <Ionicons name="close" size={24} color="black" />
                            </TouchableOpacity>
                        </View>

                        {modalStep === 'SELECT_QUESTION' ? (
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
                                </View>
                            </ScrollView>
                        ) : (
                            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                                <View className="flex-1 px-6 pt-6">
                                    <View className="mb-4">
                                        <Text className="text-sm font-bold text-gray-500 uppercase mb-2 tracking-wide">{tempQuestion}</Text>
                                    </View>
                                    <TextInput
                                        className="text-xl text-black leading-7 min-h-[120px] align-top"
                                        placeholder="Type your answer here..."
                                        placeholderTextColor="#9ca3af"
                                        multiline
                                        autoFocus
                                        value={tempAnswer}
                                        onChangeText={setTempAnswer}
                                        maxLength={150}
                                    />
                                    <View className="items-end mt-2">
                                        <Text className={`text-xs ${tempAnswer.length > 130 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {150 - tempAnswer.length}
                                        </Text>
                                    </View>
                                    <View className="mt-8">
                                        <TouchableOpacity
                                            onPress={handleSavePrompt}
                                            disabled={!tempAnswer.trim()}
                                            className={`w-full py-4 rounded-full items-center ${tempAnswer.trim() ? 'bg-black' : 'bg-gray-200'}`}
                                        >
                                            <Text className={`font-bold text-base ${tempAnswer.trim() ? 'text-white' : 'text-gray-400'}`}>Save Answer</Text>
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
