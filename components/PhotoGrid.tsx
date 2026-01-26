import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Dispatch, SetStateAction, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { API_URL } from '@/lib/api/client';
import { supabase } from '@/lib/supabase';
import ImageCropper from './ImageCropper';

export type PhotoItem = {
    id?: string;              // DB id (existing photos)
    localUri?: string;        // temp while uploading
    imageUrl?: string;        // R2 public URL or key
    position?: number;
    status: 'uploading' | 'uploaded' | 'error';
};

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

export const deleteImage = async (photoId: string) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error('No authentication token found');

    const response = await fetch(`${API_URL}/upload/${photoId}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
    }
};


interface PhotoGridProps {
    photos: PhotoItem[];
    onChange: Dispatch<SetStateAction<PhotoItem[]>>;
    maxPhotos?: number;
}

export function PhotoGrid({ photos, onChange, maxPhotos = 6 }: PhotoGridProps) {
    const [cropQueue, setCropQueue] = useState<string[]>([]);

    // We'll use a local helper to handle the actual upload process
    // so it can be reused by both "add new" (crop) and "edit existing" (picker)
    const handleUploadProcess = async (uri: string, isEdit: boolean, editIndex: number) => {
        // Create temp item
        const tempPhoto: PhotoItem = {
            localUri: uri,
            status: 'uploading',
        };

        if (isEdit) {
            // Replace existing at index with temp item
            const updated = [...photos];
            updated[editIndex] = tempPhoto;
            onChange(updated);
        } else {
            // Add new
            onChange([...photos, tempPhoto]);
        }

        try {
            const uploaded = await uploadImage(uri);
            // backend returns { imageUrl, id? }

            onChange(prev => {
                const newPhotos = [...prev];
                // needed to find the item we just added/updated. 
                // Since `prev` might have changed (race condition?), reliable way is by reference if we hadn't closed over `tempPhoto`.
                // Actually, just find by localUri or index.
                // For edit: index is stable usually.
                // For add: it's the last one OR we match object reference (if simplistic).

                if (isEdit) {
                    // Update at specific index
                    if (newPhotos[editIndex]?.localUri === uri) {
                        newPhotos[editIndex] = {
                            ...newPhotos[editIndex],
                            imageUrl: uploaded.imageUrl,
                            id: uploaded.id,
                            status: 'uploaded',
                        };
                    }
                } else {
                    // Find the item with matching localUri/reference
                    const idx = newPhotos.findIndex(p => p.localUri === uri && p.status === 'uploading');
                    if (idx !== -1) {
                        newPhotos[idx] = {
                            ...newPhotos[idx],
                            imageUrl: uploaded.imageUrl,
                            id: uploaded.id,
                            status: 'uploaded',
                        };
                    }
                }
                return newPhotos;
            });
        } catch (e) {
            console.error('Upload failed', e);
            onChange(prev => {
                const newPhotos = [...prev];
                if (isEdit) {
                    if (newPhotos[editIndex]?.localUri === uri) {
                        newPhotos[editIndex] = { ...newPhotos[editIndex], status: 'error' };
                    }
                } else {
                    const idx = newPhotos.findIndex(p => p.localUri === uri && p.status === 'uploading');
                    if (idx !== -1) {
                        newPhotos[idx] = { ...newPhotos[idx], status: 'error' };
                    }
                }
                return newPhotos;
            });
        }
    };

    const activeCropImage = cropQueue.length > 0 ? cropQueue[0] : null;

    const onCropComplete = async (croppedUri: string) => {
        // This is always "Add New" flow in current usage
        await handleUploadProcess(croppedUri, false, -1);
        setCropQueue(prev => prev.slice(1));
    };

    const onCropCancel = () => {
        setCropQueue(prev => prev.slice(1));
    };


    const getPhotoUri = (photo: PhotoItem): string => {
        if (photo.localUri) return photo.localUri;
        if (photo.imageUrl?.startsWith('http')) return photo.imageUrl;
        return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${photo.imageUrl}`;
    };

    const pickImage = async () => {
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
                allowsEditing: true, // Native cropper for edit
                quality: 0.8,
                aspect: [3, 4],
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newUri = result.assets[0].uri;
                // Trigger upload for this index
                handleUploadProcess(newUri, true, index);
            }
        } catch (error) {
            console.error('Error editing image:', error);
            Alert.alert('Error', 'Failed to edit image');
        }
    };

const removePhoto = async (index: number) => {
    const photo = photos[index];

    // 1️⃣ Remove instantly from UI
    onChange(prev => prev.filter((_, i) => i !== index));

    // 2️⃣ Delete instantly from backend
    if (photo?.id) {
        try {
            await deleteImage(photo.id);
        } catch (err) {
            console.error(err);
            Alert.alert(
                'Delete failed',
                'Could not delete photo from server'
            );
        }
    }
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
    onPress={() => {
        Alert.alert(
            'Manage Photo',
            'Choose an option',
            [
                {
                    text: 'Replace',
                    onPress: () => editPhoto(index),
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => removePhoto(index),
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    }}
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
