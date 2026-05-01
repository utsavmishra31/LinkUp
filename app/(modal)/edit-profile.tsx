import { PREDEFINED_PROMPTS, PromptData, PromptModal, PromptSlot, ViewerQuestionModal } from '@/app/(onboarding)/prompts';
import { AvailabilityPicker, getNext8Days } from '@/components/AvailabilityPicker';
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

const EditRow = ({ label, value, onPress }: { label: string, value: string, onPress: () => void }) => (
    <TouchableOpacity
        onPress={onPress}
        className="py-5 border-b border-gray-100 flex-row items-center justify-between active:opacity-70"
    >
        <View className="flex-1">
            <Text className="text-black text-lg font-bold mb-1">{label}</Text>
            <Text className="text-gray-500 text-xl font-normal">{value || 'Add'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#000" />
    </TouchableOpacity>
);

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
    const [availableDate, setAvailableDate] = useState<string | null>(null); // ISO date e.g. "2026-05-06"

    const [isPromptModalVisible, setPromptModalVisible] = useState(false);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

    const [viewerQuestion, setViewerQuestion] = useState<string | null>(null);
    const [viewerPollOptions, setViewerPollOptions] = useState<string[]>([]);
    const [viewerPollAnswer, setViewerPollAnswer] = useState<number | null>(null);
    const [isViewerModalVisible, setViewerModalVisible] = useState(false);

    const [isHeightModalVisible, setHeightModalVisible] = useState(false);
    const [isNameModalVisible, setNameModalVisible] = useState(false);
    const [isGenderModalVisible, setGenderModalVisible] = useState(false);
    const [isInterestedInModalVisible, setInterestedInModalVisible] = useState(false);
    const [isBioModalVisible, setBioModalVisible] = useState(false);
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
        availableDayIndex: string | null;
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
        if (availableDate !== initialState.availableDayIndex) return true;
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
    }, [initialState, firstName, lastName, bio, gender, interestedIn, height, availableDate, selectedPrompts, viewerQuestion, viewerPollOptions, viewerPollAnswer]);

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

                    if (profileData.availableDate) {
                        setAvailableDate(profileData.availableDate);
                    }
                    setViewerQuestion(profileData.viewerQuestion || null);
                    setViewerPollOptions(profileData.viewerPollOptions || []);
                    setViewerPollAnswer(profileData.viewerPollAnswer ?? null);
                }

                const profileDataForState = (data.profile && Array.isArray(data.profile)) ? data.profile[0] : (data.profile || {});
                const initDate = profileDataForState.availableDate || null;
                setInitialState({
                    photos: (data.photos || []).sort((a: any, b: any) => a.position - b.position).map((p: any) => p.id),
                    firstName: data.displayName || '',
                    lastName: data.surname || '',
                    bio: profileDataForState.bio || '',
                    gender: data.gender || null,
                    interestedIn: data.interestedIn || [],
                    height: data.height || '',
                    prompts: (profileDataForState.prompts && profileDataForState.prompts.length > 0) ? [profileDataForState.prompts[0]] : [null],
                    availableDayIndex: initDate,
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



            const validPrompts = selectedPrompts.filter(p => p !== null);
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    userId: user.id,
                    bio: bio.trim(),
                    prompts: validPrompts,
                    availableDate: availableDate,
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

    const handleSelectDate = (date: string) => {
        setAvailableDate(availableDate === date ? null : date);
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
                                <AvailabilityPicker selectedDate={availableDate} onSelectDate={handleSelectDate} />
                            </View>


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

                            <Text className="text-2xl font-bold mb-4 mt-4">About You</Text>
                            <View className="mb-8">
                                <EditRow
                                    label="Name"
                                    value={`${firstName} ${lastName}`.trim()}
                                    onPress={() => setNameModalVisible(true)}
                                />
                                <EditRow
                                    label="Bio"
                                    value={bio}
                                    onPress={() => setBioModalVisible(true)}
                                />
                                <EditRow
                                    label="Gender"
                                    value={gender === 'MALE' ? 'Man' : gender === 'FEMALE' ? 'Woman' : gender === 'OTHER' ? 'Non-binary' : ''}
                                    onPress={() => setGenderModalVisible(true)}
                                />
                                <EditRow
                                    label="I'm interested in"
                                    value={
                                        interestedIn.length === 3 ? 'Everyone' :
                                            interestedIn.map(g => g === 'MALE' ? 'Men' : g === 'FEMALE' ? 'Women' : 'Non-binary').join(', ')
                                    }
                                    onPress={() => setInterestedInModalVisible(true)}
                                />
                                <EditRow
                                    label="Height"
                                    value={height ? `${height.split(' ')[0]}'${height.split(' ')[1]}"` : ''}
                                    onPress={() => setHeightModalVisible(true)}
                                />
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

            {/* Name Modal */}
            <Modal visible={isNameModalVisible} animationType="slide" transparent={true} onRequestClose={() => setNameModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setNameModalVisible(false)} />
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View className="bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl h-[60vh]">
                            <View className="flex-row items-center justify-between mb-8">
                                <TouchableOpacity onPress={() => setNameModalVisible(false)} className="p-2 -ml-2">
                                    <Ionicons name="arrow-back" size={24} color="black" />
                                </TouchableOpacity>
                                <Text className="text-2xl font-bold">Edit Name</Text>
                                <View className="w-10" />
                            </View>
                            <View className="gap-y-6">
                                <View>
                                    <Text className="text-gray-500 text-xs uppercase mb-2 font-bold ml-1">First Name</Text>
                                    <TextInput
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        className="bg-gray-50 p-5 rounded-2xl text-xl font-bold text-black border-2 border-gray-100 focus:border-black"
                                        placeholder="First name"
                                        autoFocus
                                    />
                                </View>
                                <View>
                                    <Text className="text-gray-500 text-xs uppercase mb-2 font-bold ml-1">Last Name</Text>
                                    <TextInput
                                        value={lastName}
                                        onChangeText={setLastName}
                                        className="bg-gray-50 p-5 rounded-2xl text-xl font-bold text-black border-2 border-gray-100 focus:border-black"
                                        placeholder="Last name"
                                    />
                                </View>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Gender Modal */}
            <Modal visible={isGenderModalVisible} animationType="slide" transparent={true} onRequestClose={() => setGenderModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setGenderModalVisible(false)} />
                    <View className="bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl h-[50vh]">
                        <View className="flex-row items-center justify-between mb-8">
                            <TouchableOpacity onPress={() => setGenderModalVisible(false)} className="p-2 -ml-2">
                                <Ionicons name="arrow-back" size={24} color="black" />
                            </TouchableOpacity>
                            <Text className="text-2xl font-bold">Select Gender</Text>
                            <View className="w-10" />
                        </View>
                        <View className="gap-y-4">
                            {(['MALE', 'FEMALE', 'OTHER'] as const).map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    onPress={() => setGender(option)}
                                    className={`p-4 rounded-2xl border-2 ${gender === option ? 'bg-black border-black' : 'bg-gray-50 border-gray-100'} flex-row items-center justify-between`}
                                >
                                    <Text className={`text-lg font-bold ${gender === option ? 'text-white' : 'text-black'}`}>
                                        {option === 'MALE' ? 'Man' : option === 'FEMALE' ? 'Woman' : 'Non-binary'}
                                    </Text>
                                    {gender === option && <Ionicons name="checkmark-circle" size={24} color="white" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Interested In Modal */}
            <Modal visible={isInterestedInModalVisible} animationType="slide" transparent={true} onRequestClose={() => setInterestedInModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setInterestedInModalVisible(false)} />
                    <View className="bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl h-[60vh]">
                        <View className="flex-row items-center justify-between mb-8">
                            <TouchableOpacity onPress={() => setInterestedInModalVisible(false)} className="p-2 -ml-2">
                                <Ionicons name="arrow-back" size={24} color="black" />
                            </TouchableOpacity>
                            <Text className="text-2xl font-bold">Interested In</Text>
                            <View className="w-10" />
                        </View>
                        <View className="gap-y-4">
                            {(['MALE', 'FEMALE', 'OTHER'] as const).map((option) => {
                                const isSelected = interestedIn.includes(option);
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        onPress={() => {
                                            setInterestedIn(prev => prev.includes(option) ? prev.filter(p => p !== option) : [...prev, option]);
                                        }}
                                        className={`p-4 rounded-2xl border-2 ${isSelected ? 'bg-black border-black' : 'bg-gray-50 border-gray-100'} flex-row items-center justify-between`}
                                    >
                                        <Text className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-black'}`}>
                                            {option === 'MALE' ? 'Men' : option === 'FEMALE' ? 'Women' : 'Non-binary'}
                                        </Text>
                                        {isSelected && <Ionicons name="checkmark-circle" size={24} color="white" />}
                                    </TouchableOpacity>
                                );
                            })}

                            <TouchableOpacity
                                onPress={() => {
                                    if (interestedIn.length === 3) {
                                        setInterestedIn([]);
                                    } else {
                                        setInterestedIn(['MALE', 'FEMALE', 'OTHER']);
                                    }
                                }}
                                className={`p-4 rounded-2xl border-2 ${interestedIn.length === 3 ? 'bg-black border-black' : 'bg-gray-50 border-gray-100'} flex-row items-center justify-between`}
                            >
                                <Text className={`text-lg font-bold ${interestedIn.length === 3 ? 'text-white' : 'text-black'}`}>
                                    Everyone
                                </Text>
                                {interestedIn.length === 3 && <Ionicons name="checkmark-circle" size={24} color="white" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Bio Modal */}
            <Modal visible={isBioModalVisible} animationType="slide" transparent={true} onRequestClose={() => setBioModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setBioModalVisible(false)} />
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View className="bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl h-[70vh]">
                            <View className="flex-row items-center justify-between mb-8">
                                <TouchableOpacity onPress={() => setBioModalVisible(false)} className="p-2 -ml-2">
                                    <Ionicons name="arrow-back" size={24} color="black" />
                                </TouchableOpacity>
                                <Text className="text-2xl font-bold">Edit Bio</Text>
                                <View className="w-10" />
                            </View>
                            <View>
                                <Text className="text-gray-500 text-xs uppercase mb-2 font-bold ml-1">About me</Text>
                                <TextInput
                                    value={bio}
                                    onChangeText={setBio}
                                    multiline
                                    className="bg-gray-50 p-6 rounded-3xl text-black border-2 border-gray-100 focus:border-black h-40 text-lg font-medium"
                                    placeholder="Tell us about yourself..."
                                    textAlignVertical="top"
                                    autoFocus
                                />
                                <Text className="text-gray-400 text-xs mt-3 text-right font-bold mr-2">{bio.length}/500</Text>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}