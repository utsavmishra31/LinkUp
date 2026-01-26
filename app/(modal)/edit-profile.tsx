import { BioInput, PREDEFINED_PROMPTS, PromptData, PromptModal, PromptSlot } from '@/app/(onboarding)/prompts';
import { PhotoGrid } from '@/components/PhotoGrid';
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

    const removePhoto = async (photoId: string | number) => {
        const id = typeof photoId === 'number' ? photos[photoId]?.id : photoId;
        if (!id) return;

        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('photos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setPhotos(prev => prev.filter(p => p.id !== id));
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
    const handlePromptPress = (prompt: PromptData | null) => {
        setEditingPromptId(prompt ? prompt.id : null);
        setPromptModalVisible(true);
    };

    const handleSavePrompt = (data: { question: string; answer: string }) => {
        let newPrompts = [...selectedPrompts];

        if (editingPromptId) {
            newPrompts = newPrompts.map(p =>
                p?.id === editingPromptId
                    ? { ...p, question: data.question, answer: data.answer }
                    : p
            );
        } else {
            // Enforce single prompt: Override index 0
            newPrompts = [{
                id: Date.now().toString(),
                question: data.question,
                answer: data.answer,
            }];
        }

        setSelectedPrompts(newPrompts);
        setPromptModalVisible(false);
        setEditingPromptId(null);
    };

    const deletePrompt = (id: string) => {
        setSelectedPrompts(prev => prev.filter(p => p?.id !== id));
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
                    <View className="mb-8">
                        <PhotoGrid
                            photos={photos}
                            onAddPhoto={pickImage}
                            onRemovePhoto={removePhoto}
                            maxPhotos={6}
                        />
                    </View>

                    {/* Bio */}
                    <BioInput
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Write something about yourself..."
                    />

                    {/* --- PROMPTS --- */}
                    <View className="mb-8">
                        <Text className="text-lg font-bold mb-3">Prompts</Text>

                        <View className="gap-y-3">
                            {/* Single Prompt Slot */}
                            <PromptSlot
                                data={selectedPrompts[0] || null}
                                onPress={() => handlePromptPress(selectedPrompts[0] || null)}
                                onClear={selectedPrompts[0] ? () => deletePrompt(selectedPrompts[0]!.id) : undefined}
                            />
                        </View>
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
            {/* --- PROMPT MODAL --- */}
            <PromptModal
                visible={isPromptModalVisible}
                onClose={() => {
                    setPromptModalVisible(false);
                    setEditingPromptId(null);
                }}
                onSave={handleSavePrompt}
                initialData={editingPromptId ? selectedPrompts.find(p => p?.id === editingPromptId) : null}
                availablePrompts={availablePrompts}
            />

        </SafeAreaView>
    );
}
