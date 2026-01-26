import { BioInput, PREDEFINED_PROMPTS, PromptData, PromptModal, PromptSlot } from '@/app/(onboarding)/prompts';
import { AvailabilityPicker } from '@/components/AvailabilityPicker';
import { PhotoGrid, PhotoItem, uploadImage } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Types & Constants ---


export default function EditProfileScreen() {
    const router = useRouter();
    const { user, refreshProfile } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // --- Form State ---
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [initialPhotoIds, setInitialPhotoIds] = useState<Set<string>>(new Set());
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [bio, setBio] = useState('');
    const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | null>(null);
    const [interestedIn, setInterestedIn] = useState<string[]>([]);
    const [height, setHeight] = useState('');


    // CHANGED: Initialize with [null] for single slot, matching prompts.tsx
    const [selectedPrompts, setSelectedPrompts] = useState<(PromptData | null)[]>([null]);

    const [availableDayIndex, setAvailableDayIndex] = useState<number | null>(null);

    // --- Refs for DOB inputs ---


    // --- Prompt Modal State ---
    const [isPromptModalVisible, setPromptModalVisible] = useState(false);

    // CHANGED: Use activeSlotIndex instead of editingPromptId
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

    // --- Data Fetching ---
    useEffect(() => {
        const loadProfileData = async () => {
            if (!user) return;
            try {
                // Fetch user data WITH profile relation and photos
                const { data, error } = await supabase
                    .from('users')
                    .select('displayName, surname, dob, gender, interestedIn, height, photos(*), profile:profiles(*)')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                if (!data) return;

                // Photos
                if (data.photos) {
                    const sortedPhotos = [...data.photos].sort((a: any, b: any) => a.position - b.position);
                    setPhotos(sortedPhotos);
                    setInitialPhotoIds(new Set(sortedPhotos.map((p: any) => p.id)));
                }

                // Name
                setFirstName(data.displayName || '');
                setLastName(data.surname || '');

                // Gender
                if (data.gender) {
                    setGender(data.gender);
                }

                // Interested In
                if (data.interestedIn && Array.isArray(data.interestedIn)) {
                    setInterestedIn(data.interestedIn);
                }

                // Height
                if (data.height) {
                    setHeight(data.height);
                }

                // DOB


                // Profile Relation Fields
                if (data.profile) {
                    /* Type cast as any because typescript might not know the shape of the joined profile relation if using generated types incorrectly */
                    const profileData = data.profile as any;

                    setBio(profileData.bio || '');

                    // Prompts
                    // CHANGED: Logic to map DB prompts to our fixed 1-slot array
                    if (profileData.prompts && Array.isArray(profileData.prompts) && profileData.prompts.length > 0) {
                        // Take the first prompt, ignore others if any
                        setSelectedPrompts([profileData.prompts[0]]);
                    } else {
                        setSelectedPrompts([null]);
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

    // uploadImage is now imported from components/PhotoGrid

    // --- Handlers: DOB ---


    // --- Handlers: Prompts ---
    // CHANGED: Use slot index logic
    const handleSlotPress = (index: number) => {
        setActiveSlotIndex(index);
        setPromptModalVisible(true);
    };

    const handleSavePrompt = (data: { question: string; answer: string }) => {
        if (activeSlotIndex === null) return;

        const newPrompts = [...selectedPrompts];
        newPrompts[activeSlotIndex] = {
            id: Date.now().toString(), // Helper to generate ID
            question: data.question,
            answer: data.answer,
        };

        setSelectedPrompts(newPrompts);
        setPromptModalVisible(false);
        setActiveSlotIndex(null);
    };

    const handleClearSlot = (index: number) => {
        const newPrompts = [...selectedPrompts];
        newPrompts[index] = null;
        setSelectedPrompts(newPrompts);
    };

    // CHANGED: Filter logic based on prompts.tsx
    const availablePrompts = PREDEFINED_PROMPTS.filter(p => {
        const isUsed = selectedPrompts.some(sp => sp?.question === p);
        const currentQuestion = activeSlotIndex !== null ? selectedPrompts[activeSlotIndex]?.question : null;
        return !isUsed || (currentQuestion === p);
    });

    // --- Handler: Save All ---

    const handleSaveAll = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            // 1. Validate Profile
            if (interestedIn.length === 0) {
                Alert.alert('Required', 'Please select at least one "Interested In" preference.');
                setIsSaving(false);
                return;
            }

            // 1.5 Handle Photos (Uploads and Deletes)
            // Identify deleted photos
            const currentIds = new Set(photos.filter(p => typeof p !== 'string').map(p => (p as any).id));
            const idsToDelete = Array.from(initialPhotoIds).filter(id => !currentIds.has(id));

            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase.from('photos').delete().in('id', idsToDelete);
                if (deleteError) throw deleteError;
            }

            // Identify new photos to upload
            const newPhotos = photos.filter(p => typeof p === 'string') as string[];
            for (const uri of newPhotos) {
                await uploadImage(uri);
            }

            // 2. Update Users Table
            const { error: userError } = await supabase
                .from('users')
                .update({
                    displayName: firstName.trim(),
                    surname: lastName.trim() || null,
                    gender: gender,
                    interestedIn: interestedIn,
                    height: height.trim() || null,
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

    const handleSelectDay = (index: number) => {
        // Toggle: if already selected, deselect (set to null), else select
        setAvailableDayIndex(availableDayIndex === index ? null : index);
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
                    <View className="mb-8">
                        <PhotoGrid
                            photos={photos}
                            onChange={setPhotos}
                            maxPhotos={6}
                        />
                    </View>

                    {/* --- AVAILABILITY --- */}
                    <View className="mb-8">
                        <Text className="text-lg font-bold mb-3">Availability</Text>
                        <Text className="text-gray-500 text-sm mb-4">Select the day you are available.</Text>
                        <AvailabilityPicker
                            selectedDayIndex={availableDayIndex}
                            onSelectDay={handleSelectDay}
                        />
                    </View>

                    {/* Bio */}
                    <BioInput
                        value={bio}
                        onChangeText={setBio}
                        placeholder=""
                    />

                    {/* --- PROMPTS --- */}
                    <View className="mb-8">
                        <Text className="text-lg font-bold mb-3">Prompts</Text>

                        <View className="gap-y-3">
                            {/* Single Prompt Slot - Using index 0 */}
                            <PromptSlot
                                data={selectedPrompts[0]}
                                onPress={() => handleSlotPress(0)}
                                showEditIcon={true}
                            />
                        </View>
                    </View>

                    {/* --- DETAILS --- */}
                    <Text className="text-lg font-bold mb-3">About You</Text>

                    {/* Name */}
                    <View className="mb-4">
                        <Text className="text-gray-500 text-xs uppercase mb-1">Name</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            className="bg-gray-50 p-4 rounded-xl text-black border border-gray-200"
                            placeholder="Name"
                        />
                    </View>

                    {/* Gender */}
                    <View className="mb-4">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="person-outline" size={16} color="gray" style={{ marginRight: 4 }} />
                            <Text className="text-gray-500 text-xs uppercase">Gender</Text>
                        </View>
                        <View className="flex-row gap-3">
                            {(['MALE', 'FEMALE', 'OTHER'] as const).map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    onPress={() => setGender(option)}
                                    className={`flex-1 py-3 items-center rounded-xl border ${gender === option ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <Text className={`font-medium ${gender === option ? 'text-white' : 'text-black'}`}>
                                        {option === 'MALE' ? 'Man' : option === 'FEMALE' ? 'Woman' : 'Non-binary'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Interested In */}
                    <View className="mb-4">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="heart-outline" size={16} color="gray" style={{ marginRight: 4 }} />
                            <Text className="text-gray-500 text-xs uppercase">Interested In</Text>
                        </View>
                        <View className="flex-row gap-3">
                            {(['MALE', 'FEMALE', 'OTHER'] as const).map((option) => {
                                const isSelected = interestedIn.includes(option);
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        onPress={() => {
                                            setInterestedIn(prev => {
                                                if (prev.includes(option)) {
                                                    return prev.filter(p => p !== option);
                                                } else {
                                                    return [...prev, option];
                                                }
                                            });
                                        }}
                                        className={`flex-1 py-3 items-center rounded-xl border ${isSelected ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <Text className={`font-medium ${isSelected ? 'text-white' : 'text-black'}`}>
                                            {option === 'MALE' ? 'Men' : option === 'FEMALE' ? 'Women' : 'Non-binary'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Height */}
                    <View className="mb-4">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="resize-outline" size={16} color="gray" style={{ marginRight: 4 }} />
                            <Text className="text-gray-500 text-xs uppercase">Height</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push('/(onboarding)/height')}
                            className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex-row items-center justify-between"
                        >
                            <Text className={`text-base ${height ? 'text-black' : 'text-gray-400'}`}>
                                {height ? `${height.split(' ')[0]}'${height.split(' ')[1]}"` : 'Select height'}
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color="gray" />
                        </TouchableOpacity>
                    </View>

                    {/* DOB */}




                </ScrollView>

                {/* --- FOOTER --- */}
                <View className="p-5 border-t border-gray-100 bg-white">
                    <TouchableOpacity
                        onPress={handleSaveAll}
                        disabled={isSaving || firstName.trim().length === 0 || interestedIn.length === 0}
                        className={`w-full py-4 rounded-full items-center ${isSaving || firstName.trim().length === 0 || interestedIn.length === 0 ? 'bg-gray-200' : 'bg-black'}`}
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
            <PromptModal
                visible={isPromptModalVisible}
                onClose={() => {
                    setPromptModalVisible(false);
                    setActiveSlotIndex(null);
                }}
                onSave={handleSavePrompt}
                initialData={activeSlotIndex !== null ? selectedPrompts[activeSlotIndex] : null}
                availablePrompts={availablePrompts}
            />

        </SafeAreaView>
    );
}
