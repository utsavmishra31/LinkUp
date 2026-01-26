import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { API_URL } from '@/lib/api/client';
import { supabase } from '@/lib/supabase';
import ImageCropper from './ImageCropper';

export type PhotoItem = string | { id: string; imageUrl: string; position?: number };

export const uploadImage = async (uri: string) => {
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
    return data;
};

interface PhotoGridProps {
    photos: PhotoItem[];
    onChange: (photos: PhotoItem[]) => void;
    maxPhotos?: number;
}

export function PhotoGrid({ photos, onChange, maxPhotos = 6 }: PhotoGridProps) {
    const [cropQueue, setCropQueue] = useState<string[]>([]);

    const activeCropImage = cropQueue.length > 0 ? cropQueue[0] : null;

    const onCropComplete = (croppedUri: string) => {
        // Add the cropped image to the list
        onChange([...photos, croppedUri]);
        // Remove from queue
        setCropQueue((prev) => prev.slice(1));
    };

    const onCropCancel = () => {
        // Skip current image
        setCropQueue((prev) => prev.slice(1));
    };

    const getPhotoUri = (photo: PhotoItem): string => {
        if (typeof photo === 'string') {
            return photo;
        }
        return photo.imageUrl?.startsWith('http')
            ? photo.imageUrl
            : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${photo.imageUrl}`;
    };

    const pickImage = async () => {
        // Calculate remaining slots
        const remainingSlots = maxPhotos - photos.length;
        if (remainingSlots <= 0) {
            Alert.alert('Limit Reached', `You can only upload up to ${maxPhotos} photos.`);
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
                // Start the cropping flow
                setCropQueue(newPhotos);
            }
        } catch (error) {
            console.error('Error picking images:', error);
            Alert.alert('Error', 'Failed to pick images');
        }
    };

    const editPhoto = async (index: number) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: false,
                allowsEditing: true, // Enable cropping
                quality: 0.8,
                aspect: [3, 4], // Consistent aspect ratio
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newUri = result.assets[0].uri;
                const updatedPhotos = [...photos];
                // Replace the photo at the specific index
                updatedPhotos[index] = newUri;
                onChange(updatedPhotos);
            }
        } catch (error) {
            console.error('Error editing image:', error);
            Alert.alert('Error', 'Failed to edit image');
        }
    };

    const removePhoto = (index: number) => {
        const updatedPhotos = photos.filter((_, i) => i !== index);
        onChange(updatedPhotos);
    };

    return (
        <>
            <View className="flex-row flex-wrap justify-between gap-y-4">
                {[...Array(maxPhotos)].map((_, index) => {
                    const photo = photos[index];
                    return (
                        <Pressable
                            key={index}
                            onPress={() => !photo && pickImage()}
                            className={`w-[31%] aspect-[3/4] rounded-xl overflow-hidden relative ${photo ? 'bg-gray-100' : 'bg-gray-50 border-2 border-dashed border-gray-300'
                                }`}
                        >
                            {photo ? (
                                <>
                                    <Image
                                        source={{ uri: getPhotoUri(photo) }}
                                        className="w-full h-full"
                                        contentFit="cover"
                                        transition={200}
                                    />
                                    {/* Edit Button or Remove Button */}
                                    {photos.length <= 1 ? (
                                        <Pressable
                                            onPress={() => editPhoto(index)}
                                            className="absolute top-1 right-1 bg-white/80 rounded-full p-1 z-10"
                                            hitSlop={10}
                                        >
                                            <Ionicons name="pencil" size={14} color="black" />
                                        </Pressable>
                                    ) : (
                                        <Pressable
                                            onPress={() => removePhoto(index)}
                                            className="absolute top-1 right-1 bg-white/80 rounded-full p-1 z-10"
                                            hitSlop={10}
                                        >
                                            <Ionicons name="close" size={14} color="black" />
                                        </Pressable>
                                    )}

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

            <ImageCropper
                visible={!!activeCropImage}
                imageUri={activeCropImage}
                onCrop={onCropComplete}
                onCancel={onCropCancel}
            />
        </>
    );
}
