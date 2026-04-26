import { BioInput, PREDEFINED_PROMPTS, PromptData, PromptModal, PromptSlot, VIEWER_QUESTIONS, ViewerQuestionModal } from '@/app/(onboarding)/prompts';
import { AvailabilityPicker } from '@/components/AvailabilityPicker';
import { HEIGHT_OPTIONS, HeightPicker } from '@/components/HeightPicker';
import { PhotoGrid, PhotoItem } from '@/components/PhotoGrid';
import { ProfilePreviewContent } from '@/components/ProfilePreviewContent';
import { API_URL } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
    const router = useRouter();
    const { user, refreshProfile } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

    // --- Form State ---
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const isUploading = photos.some(p => p.status === 'uploading');
    const [initialPhotoIds, setInitialPhotoIds] = useState<Set<string>>(new Set());
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [bio, setBio] = useState('');
    const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | null>(null);
    const [interestedIn, setInterestedIn] = useState<string[]>([]);
    const [height, setHeight] = useState('');
    const [dob, setDob] = useState<string | null>(null);

    const [selectedPrompts, setSelectedPrompts] = useState<(PromptData | null)[]>([null]);
    const [availableDayIndex, setAvailableDayIndex] = useState<number | null>(null);

    const [isPromptModalVisible, setPromptModalVisible] = useState(false);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

    const [viewerQuestion, setViewerQuestion] = useState<string | null>(null);
    const [viewerPollOptions, setViewerPollOptions] = useState<string[]>([]);
    const [viewerPollAnswer, setViewerPollAnswer] = useState<number | null>(null);
    const [isViewerModalVisible, setViewerModalVisible] = useState(false);

    const [isHeightModalVisible, setHeightModalVisible] = useState(false);
    const [tempHeight, setTempHeight] = useState<typeof HEIGHT_OPTIONS[0] | null>(null);

    const [initialState, setInitialState] = useState<{
        photos: string[];
        firstName: string;
        lastName: string;
        bio: string;
        gender: string | null;
        interestedIn: string[];
        height: string;
        prompts: (PromptData | null)[];
        availableDayIndex: number | null;
        viewerQuestion: string | null;
        viewerPollOptions: string[];
        viewerPollAnswer: number | null;
    } | null>(null);

    const hasChanges = React.useMemo(() => {
        if (!initialState) return false;
        if (firstName !== initialState.firstName) return true;
        if (lastName !== initialState.lastName) return true;
        if (bio !== initialState.bio) return true;
        if (gender !== initialState.gender) return true;
        if (height !== initialState.height) return true;
        if (availableDayIndex !== initialState.availableDayIndex) return true;
        if (viewerQuestion !== initialState.viewerQuestion) return true;
        if (viewerPollAnswer !== initialState.viewerPollAnswer) return true;
        if (viewerPollOptions.join(',') !== initialState.viewerPollOptions.join(',')) return true;

        const sortedInterestedIn = [...interestedIn].sort().join(',');
        const sortedInitialInterestedIn = [...initialState.interestedIn].sort().join(',');
        if (sortedInterestedIn !== sortedInitialInterestedIn) return true;

        const currentPrompt = selectedPrompts[0];
        const initialPrompt = initialState.prompts[0];

        if (!currentPrompt && !initialPrompt) {
        } else if ((!currentPrompt && initialPrompt) || (currentPrompt && !initialPrompt)) {
            return true;
        } else if (currentPrompt && initialPrompt) {
            if (currentPrompt.question !== initialPrompt.question || currentPrompt.answer !== initialPrompt.answer) return true;
        }
        return false;
    }, [initialState, firstName, lastName, bio, gender, interestedIn, height, availableDayIndex, selectedPrompts, viewerQuestion, viewerPollOptions, viewerPollAnswer]);

    useEffect(() => {
        const loadProfileData = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('displayName, surname, dob, gender, interestedIn, height, photos(*), profile:profiles(*)')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                if (!data) return;

                if (data.photos) {
                    const sortedPhotos = [...data.photos].sort((a: any, b: any) => a.position - b.position);
                    setPhotos(sortedPhotos);
                    setInitialPhotoIds(new Set(sortedPhotos.map((p: any) => p.id)));
                }

                setFirstName(data.displayName || '');
                setLastName(data.surname || '');
                if (data.gender) setGender(data.gender);
                if (data.interestedIn && Array.isArray(data.interestedIn)) setInterestedIn(data.interestedIn);
                if (data.height) setHeight(data.height);
                if (data.dob) setDob(data.dob);

                if (data.profile) {
                    const profileData = data.profile as any;
                    setBio(profileData.bio || '');
                    if (profileData.prompts && Array.isArray(profileData.prompts) && profileData.prompts.length > 0) {
                        setSelectedPrompts([profileData.prompts[0]]);
                    } else {
                        setSelectedPrompts([null]);
                    }

                    if (profileData.availableNext8Days && Array.isArray(profileData.availableNext8Days)) {
                        const index = profileData.availableNext8Days.findIndex((isAvailable: boolean) => isAvailable === true);
                        setAvailableDayIndex(index !== -1 ? index : null);
                    }
                    setViewerQuestion(profileData.viewerQuestion || null);
                    setViewerPollOptions(profileData.viewerPollOptions || []);
                    setViewerPollAnswer(profileData.viewerPollAnswer ?? null);
                }

                const profileDataForState = (data.profile && Array.isArray(data.profile)) ? data.profile[0] : (data.profile || {});
                setInitialState({
                    photos: (data.photos || []).sort((a: any, b: any) => a.position - b.position).map((p: any) => p.id),
                    firstName: data.displayName || '',
                    lastName: data.surname || '',
                    bio: profileDataForState.bio || '',
                    gender: data.gender || null,
                    interestedIn: data.interestedIn || [],
                    height: data.height || '',
                    prompts: (profileDataForState.prompts && profileDataForState.prompts.length > 0) ? [profileDataForState.prompts[0]] : [null],
                    availableDayIndex: (profileDataForState.availableNext8Days || []).findIndex((x: boolean) => x === true) !== -1
                        ? (profileDataForState.availableNext8Days || []).findIndex((x: boolean) => x === true)
                        : null,
                    viewerQuestion: profileDataForState.viewerQuestion || null,
                    viewerPollOptions: profileDataForState.viewerPollOptions || [],
                    viewerPollAnswer: profileDataForState.viewerPollAnswer ?? null,
                });
            } catch (err) {
                console.error('Error fetching full profile:', err);
                Alert.alert('Error', 'Failed to load profile data');
            } finally {
                setIsLoading(false);
            }
        };
        loadProfileData();
    }, [user]);

    // Reload photos when screen comes into focus to show updated order
    useFocusEffect(
        React.useCallback(() => {
            const reloadPhotos = async () => {
                if (!user) return;
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('photos(*)')
                        .eq('id', user.id)
                        .single();

                    if (error) throw error;
                    if (data?.photos) {
                        const sortedPhotos = [...data.photos].sort((a: any, b: any) => a.position - b.position);
                        setPhotos(sortedPhotos);
                        setInitialState(prev => prev ? {
                            ...prev,
                            photos: sortedPhotos.map((p: any) => p.id)
                        } : null);
                    }
                } catch (err) {
                    console.error('Error reloading photos:', err);
                }
            };
            reloadPhotos();
        }, [user])
    );

    // Auto-save photo order when it changes
    useEffect(() => {
        const savePhotoOrder = async () => {
            if (!initialState || !user) return;

            // Only save if photos are fully loaded and not uploading
            if (photos.some(p => p.status === 'uploading')) return;

            const currentPhotoIds = photos.filter(p => p.id).map(p => p.id).join(',');
            const initialPhotoIds = initialState.photos.join(',');

            // Only save if order has actually changed
            if (currentPhotoIds !== initialPhotoIds && photos.length > 0) {
                const photoUpdates = photos
                    .filter(p => p.id)
                    .map((photo, index) => ({
                        id: photo.id!,
                        position: index,
                    }));

                if (photoUpdates.length > 0) {
                    try {
                        const session = await supabase.auth.getSession();
                        const token = session.data.session?.access_token;

                        if (token) {
                            const response = await fetch(`${API_URL}/upload/reorder`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                },
                                body: JSON.stringify({ photos: photoUpdates }),
                            });

                            if (response.ok) {
                                // Check if main photo changed
                                const mainPhotoChanged = initialState.photos[0] !== photos[0]?.id;

                                // Update initialState to reflect the new order
                                setInitialState(prev => prev ? {
                                    ...prev,
                                    photos: photos.filter(p => p.id).map(p => p.id!)
                                } : null);

                                // Only refresh profile if main photo changed (non-blocking)
                                if (mainPhotoChanged) {
                                    refreshProfile();
                                }
                            }
                        }
                    } catch (error) {
                        // Silently fail - photo order will be saved on next successful reorder
                    }
                }
            }
        };

        savePhotoOrder();
    }, [photos, initialState, user]);

    const calculateAge = (dobString: string | null) => {
        if (!dobString) return undefined;
        const birthDate = new Date(dobString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const getPreviewProfile = () => ({
        id: user?.id || '',
        photos: photos.map(p => ({ uri: p.localUri || (p.imageUrl?.startsWith('http') ? p.imageUrl : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${p.imageUrl}`) })),
        displayName: firstName,
        age: calculateAge(dob),
        bio: bio,
        gender: gender || undefined,
        height: height || undefined,
        interestedIn: interestedIn,
        prompts: selectedPrompts,
        viewerQuestion: viewerQuestion || undefined,
        viewerPollOptions: viewerPollOptions.length > 0 ? viewerPollOptions : undefined,
        viewerPollAnswer: viewerPollAnswer !== null ? viewerPollAnswer : undefined,
    });

    const handleSlotPress = (index: number) => {
        setActiveSlotIndex(index);
        setPromptModalVisible(true);
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
        setPromptModalVisible(false);
        setActiveSlotIndex(null);
    };

    const handleClearPrompt = (index: number) => {
        const newPrompts = [...selectedPrompts];
        newPrompts[index] = null;
        setSelectedPrompts(newPrompts);
    };

    const availablePrompts = PREDEFINED_PROMPTS.filter(p => {
        const isUsed = selectedPrompts.some(sp => sp?.question === p);
        const currentQuestion = activeSlotIndex !== null ? selectedPrompts[activeSlotIndex]?.question : null;
        return !isUsed || (currentQuestion === p);
    });

    const handleSaveAll = async () => {
        if (!user) return;
        if (photos.some(p => p.status === 'uploading')) {
            Alert.alert('Please Wait', 'Photos are still uploading...');
            return;
        }
        if (photos.some(p => p.status === 'error')) {
            Alert.alert('Error', 'Some photos failed to upload. Please remove them.');
            return;
        }

        setIsSaving(true);
        try {
            if (interestedIn.length === 0) {
                Alert.alert('Required', 'Please select at least one "Interested In" preference.');
                setIsSaving(false);
                return;
            }

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

            const availabilityArray = new Array(8).fill(false);
            if (availableDayIndex !== null && availableDayIndex >= 0 && availableDayIndex < 8) {
                availabilityArray[availableDayIndex] = true;
            }

            const validPrompts = selectedPrompts.filter(p => p !== null);
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    userId: user.id,
                    bio: bio.trim(),
                    prompts: validPrompts,
                    availableNext8Days: availabilityArray,
                    viewerQuestion: viewerQuestion || null,
                    viewerPollOptions: viewerPollOptions.length > 0 ? viewerPollOptions : [],
                    viewerPollAnswer: viewerPollAnswer !== null ? viewerPollAnswer : null,
                });

            if (profileError) throw profileError;

            await refreshProfile();

            router.back();
        } catch (error: any) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectDay = (index: number) => {
        setAvailableDayIndex(availableDayIndex === index ? null : index);
    };

    const handleBack = () => {
        if (hasChanges) {
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to discard them?',
                [
                    { text: 'Continue Editing', style: 'cancel' },
                    { text: 'Discard', style: 'destructive', onPress: () => router.back() },
                ]
            );
        } else {
            router.back();
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="small" color="black" />
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-white">
            {/* PROGRESS BANNER - Overlaying EVERYTHING including header */}
            {(isUploading || photos.some(p => p.status === 'error')) && (
                <View
                    className={`absolute top-0 left-0 right-0 bottom-0 z-[100] items-center justify-start pt-14 ${photos.some(p => p.status === 'error') ? 'bg-red-500' : 'bg-black/80'
                        }`}
                >
                    <View className="flex-row items-center px-4 py-3">
                        {!photos.some(p => p.status === 'error') && <ActivityIndicator size="small" color="white" className="mr-3" />}
                        <Text className="text-white font-bold text-sm">
                            {photos.some(p => p.status === 'error')
                                ? `${photos.filter(p => p.status === 'error').length} upload(s) failed`
                                : `Uploading ${photos.filter(p => p.localUri && p.status === 'uploaded').length}/${photos.filter(p => p.localUri).length} images...`}
                        </Text>
                    </View>
                </View>
            )}

            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                {/* HEADER */}
                <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-100 relative">
                    <TouchableOpacity onPress={handleBack} disabled={isUploading} className="p-2">
                        <Ionicons name="arrow-back" size={24} color={isUploading ? "gray" : "black"} />
                    </TouchableOpacity>
                    <View className="flex-row items-center gap-12">
                        <TouchableOpacity onPress={() => setActiveTab('edit')}>
                            <Text className={`text-lg font-bold ${activeTab === 'edit' ? 'text-black' : 'text-gray-400'}`}>Edit Profile</Text>
                        </TouchableOpacity>
                        <Text className="text-2xl font-bold text-gray-300">|</Text>
                        <TouchableOpacity onPress={() => setActiveTab('preview')}>
                            <Text className={`text-lg font-bold ${activeTab === 'preview' ? 'text-black' : 'text-gray-400'}`}>Preview</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row items-center gap-4">

                        <View className="w-12 items-end">
                            {hasChanges && activeTab === 'edit' && (
                                <TouchableOpacity
                                    onPress={handleSaveAll}
                                    disabled={isSaving || isUploading}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator size="small" color="black" />
                                    ) : (
                                        <Text className={`font-bold text-[15px] ${isUploading ? 'text-gray-400' : 'text-blue-600'}`}>
                                            Save
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                {activeTab === 'edit' ? (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        className="flex-1"
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    >
                        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                            <Text className="text-lg font-bold mb-3">Photos</Text>
                            <View className="mb-8">
                                <PhotoGrid photos={photos} onChange={setPhotos} maxPhotos={6} />
                            </View>

                            <View className="mb-8">
                                <Text className="text-lg font-bold mb-3">Availability</Text>
                                <Text className="text-gray-500 text-sm mb-4">Select the day you are available.</Text>
                                <AvailabilityPicker selectedDayIndex={availableDayIndex} onSelectDay={handleSelectDay} />
                            </View>

                            <BioInput value={bio} onChangeText={setBio} placeholder="" />

                            <View className="mb-8">
                                <Text className="text-lg font-bold mb-3">Prompts</Text>
                                <View className="gap-y-3">
                                    <PromptSlot
                                        data={selectedPrompts[0]}
                                        onPress={() => handleSlotPress(0)}
                                        onClear={selectedPrompts[0] ? () => handleClearPrompt(0) : undefined}
                                    />
                                </View>
                            </View>

                            <View className="mb-8">
                                <Text className="text-lg font-bold mb-1">Question for Viewers</Text>
                                <Text className="text-sm text-gray-500 mb-3">Ask a question for people to answer when they see your profile.</Text>
                                {viewerQuestion ? (
                                    <View className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
                                        <View className="flex-row justify-between items-start mb-2">
                                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide pr-6">
                                                Question for you
                                            </Text>
                                            <View className="flex-row gap-1 -mr-2 -mt-2">
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        setViewerQuestion(null);
                                                        setViewerPollOptions([]);
                                                        setViewerPollAnswer(null);
                                                    }} 
                                                    className="p-1 bg-gray-50 rounded-full"
                                                >
                                                    <Ionicons name="close" size={16} color="#9ca3af" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => setViewerModalVisible(true)}>
                                            <Text className="text-lg text-black leading-6 font-medium mb-3">
                                                {viewerQuestion}
                                            </Text>
                                            {viewerPollOptions.length > 0 && (
                                                <View className="gap-y-2">
                                                    {viewerPollOptions.map((opt, idx) => (
                                                        <View key={idx} className={`p-3 rounded-lg border ${viewerPollAnswer === idx ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                                            <Text className={`${viewerPollAnswer === idx ? 'text-green-700 font-bold' : 'text-gray-700'}`}>{opt}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => setViewerModalVisible(true)}
                                        className="border border-gray-200 rounded-xl p-6 items-center justify-center bg-white active:bg-gray-100"
                                    >
                                        <Text className="text-gray-700 font-medium">+ Choose a question</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <Text className="text-lg font-bold mb-3">About You</Text>
                            <View className="mb-4">
                                <Text className="text-gray-500 text-xs uppercase mb-1">Name</Text>
                                <TextInput
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    className="bg-gray-50 p-4 rounded-xl text-black border border-gray-200"
                                    placeholder="Name"
                                />
                            </View>

                            <View className="mb-4">
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="person-outline" size={16} color="gray" className="mr-1" />
                                    <Text className="text-gray-500 text-xs uppercase">Gender</Text>
                                </View>
                                <View className="flex-row gap-3">
                                    {(['MALE', 'FEMALE', 'OTHER'] as const).map((option) => (
                                        <TouchableOpacity
                                            key={option}
                                            onPress={() => setGender(option)}
                                            className={`flex-1 py-3 items-center rounded-xl border ${gender === option ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'}`}
                                        >
                                            <Text className={`font-medium ${gender === option ? 'text-white' : 'text-black'}`}>
                                                {option === 'MALE' ? 'Man' : option === 'FEMALE' ? 'Woman' : 'Non-binary'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View className="mb-4">
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="heart-outline" size={16} color="gray" className="mr-1" />
                                    <Text className="text-gray-500 text-xs uppercase">Interested In</Text>
                                </View>
                                <View className="flex-row gap-3">
                                    {(['MALE', 'FEMALE', 'OTHER'] as const).map((option) => {
                                        const isSelected = interestedIn.includes(option);
                                        return (
                                            <TouchableOpacity
                                                key={option}
                                                onPress={() => {
                                                    setInterestedIn(prev => prev.includes(option) ? prev.filter(p => p !== option) : [...prev, option]);
                                                }}
                                                className={`flex-1 py-3 items-center rounded-xl border ${isSelected ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'}`}
                                            >
                                                <Text className={`font-medium ${isSelected ? 'text-white' : 'text-black'}`}>
                                                    {option === 'MALE' ? 'Men' : option === 'FEMALE' ? 'Women' : 'Non-binary'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <View className="mb-4">
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="resize-outline" size={16} color="gray" className="mr-1" />
                                    <Text className="text-gray-500 text-xs uppercase">Height</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setHeightModalVisible(true)}
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex-row items-center justify-between"
                                >
                                    <Text className={`text-base ${height ? 'text-black' : 'text-gray-400'}`}>
                                        {height ? `${height.split(' ')[0]}'${height.split(' ')[1]}"` : 'Select height'}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={20} color="gray" />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                ) : (
                    <ProfilePreviewContent profile={getPreviewProfile()} />
                )}
            </SafeAreaView>

            <PromptModal
                visible={isPromptModalVisible}
                onClose={() => { setPromptModalVisible(false); setActiveSlotIndex(null); }}
                onSave={handleSavePrompt}
                initialData={activeSlotIndex !== null ? selectedPrompts[activeSlotIndex] : null}
                availablePrompts={availablePrompts}
            />

            <ViewerQuestionModal
                visible={isViewerModalVisible}
                onClose={() => setViewerModalVisible(false)}
                onSelect={(q, options, correctIdx) => {
                    setViewerQuestion(q);
                    setViewerPollOptions(options || []);
                    setViewerPollAnswer(correctIdx ?? null);
                    setViewerModalVisible(false);
                }}
            />

            <Modal visible={isHeightModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHeightModalVisible(false)}>
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-100">
                        <TouchableOpacity onPress={() => setHeightModalVisible(false)} className="p-2"><Text className="text-base text-gray-500">Cancel</Text></TouchableOpacity>
                        <Text className="text-lg font-bold">Select Height</Text>
                        <TouchableOpacity onPress={() => { if (tempHeight) setHeight(`${tempHeight.feet} ${tempHeight.inches}`); setHeightModalVisible(false); }} className="p-2">
                            <Text className="text-base font-semibold text-black">Done</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-1 justify-center">
                        <HeightPicker initialHeight={height} onHeightChange={setTempHeight} />
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
}