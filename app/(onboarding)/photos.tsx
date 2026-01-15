import { ArrowButton } from '@/components/ui/ArrowButton';
import { API_URL } from '@/lib/api/client';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotosUpload() {
    const [photos, setPhotos] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived state or constant for "Main" label logic
    const userHasPhotos = photos.length > 0;

    const router = useRouter();

    const pickImage = async () => {
        // Calculate remaining slots
        const remainingSlots = 6 - photos.length;
        if (remainingSlots <= 0) {
            Alert.alert('Limit Reached', 'You can only upload up to 6 photos.');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: remainingSlots,
                quality: 0.8,
            });

            if (!result.canceled) {
                const newPhotos = result.assets.map(asset => asset.uri);
                setPhotos(prev => {
                    const updated = [...prev, ...newPhotos];
                    return updated.slice(0, 6); // Ensure max 6
                });
            }
        } catch (error) {
            console.error('Error picking images:', error);
            Alert.alert('Error', 'Failed to pick images');
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const uploadImage = async (uri: string, index: number) => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) {
                throw new Error('No authentication token found');
            }

            const formData = new FormData();

            // Append file
            // React Native expects an object with uri, name, and type for FormData files
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

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            return data;
        } catch (error) {
            console.error(`Error uploading photo ${index + 1}:`, error);
            throw error;
        }
    };

    const handleContinue = async () => {
        if (photos.length < 2) {
            Alert.alert('Minimum Photos', 'Please add at least 2 photos to continue.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload images sequentially
            for (let i = 0; i < photos.length; i++) {
                await uploadImage(photos[i], i);
            }

            // All uploads success
            router.push('/(onboarding)/prompts');
        } catch (error: any) {
            Alert.alert('Upload Error', error.message || 'Failed to upload one or more photos. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canContinue = photos.length >= 2;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">Add your photos</Text>
                    <Text className="text-gray-500 text-base">Add at least 2 photos to continue</Text>
                </View>

                {/* Photo Grid */}
                <View className="flex-row flex-wrap justify-between gap-y-4">
                    {[...Array(6)].map((_, index) => {
                        const photoUri = photos[index];
                        return (
                            <Pressable
                                key={index}
                                onPress={!photoUri ? pickImage : undefined}
                                className={`w-[31%] aspect-[3/4] rounded-xl overflow-hidden relative ${photoUri ? 'bg-gray-100' : 'bg-gray-100 border-2 border-dashed border-gray-300'
                                    }`}
                            >
                                {photoUri ? (
                                    <>
                                        <Image
                                            source={{ uri: photoUri }}
                                            className="w-full h-full"
                                            resizeMode="cover"
                                        />
                                        <Pressable
                                            onPress={() => removePhoto(index)}
                                            className="absolute top-1 right-1 bg-white/80 rounded-full p-1"
                                            hitSlop={10}
                                        >
                                            <Ionicons name="close" size={16} color="black" />
                                        </Pressable>

                                        {/* Main Photo Indicator */}
                                        {index === 0 && (
                                            <View className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded-md">
                                                <Text className="text-[10px] font-bold uppercase text-black">Main</Text>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <View className="flex-1 items-center justify-center">
                                        <Ionicons name="add" size={32} color="#9ca3af" />
                                    </View>
                                )}
                            </Pressable>
                        );
                    })}
                </View>

                <View className="flex-1" />

                {/* Footer / Navigation */}
                <ArrowButton
                    onPress={handleContinue}
                    disabled={!canContinue}
                    isLoading={isSubmitting}
                />
            </View>
        </SafeAreaView>
    );
}
