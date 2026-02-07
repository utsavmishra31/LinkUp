import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Dispatch, SetStateAction, useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { API_URL } from '@/lib/api/client';
import { supabase } from '@/lib/supabase';
import ImageCropper from './ImageCropper';

import Sortable from 'react-native-sortables';

export type PhotoItem = {
    id?: string;              // DB id (existing photos)
    localUri?: string;        // temp while uploading
    imageUrl?: string;        // R2 public URL or key
    position?: number;
    status: 'uploading' | 'uploaded' | 'error';
    uploadProgress?: number;
    replaceOfId?: string; // ✅ ADD THIS
    key?: string;
    isPlaceholder?: boolean;
};

// ... (rest of file)



const generateFileName = (uri: string) => {
    const ext = uri.split('.').pop() || 'jpg';
    return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
};


export const uploadImage = async (
    uri: string,
    onProgress?: (progress: number) => void,
    replaceId?: string // ✅ Accept replaceId
) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error('No authentication token found');

    const filename = generateFileName(uri);
    const ext = filename.split('.').pop() || 'jpg';

    const formData = new FormData();
    // Append replaceId if it exists
    if (replaceId) {
        formData.append('replaceId', replaceId);
    }

    formData.append('image', {
        uri,
        name: filename,
        type: `image/${ext}`,
    } as any);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const progress = Math.round((event.loaded / event.total) * 100);
                onProgress(progress);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    reject(new Error('Invalid server response'));
                }
            } else {
                reject(new Error(xhr.responseText || 'Upload failed'));
            }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));

        xhr.timeout = 30000;
        xhr.open('POST', `${API_URL}/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
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
    // Track if we're in edit mode: { index: photo position, photoId: old photo ID to delete }
    const [editMode, setEditMode] = useState<{ index: number; photoId?: string } | null>(null);

    // Memoize the data array to prevent recreation on every render
    const gridData = useMemo(() => {
        return [...Array(maxPhotos)].map((_, index) => {
            if (index < photos.length) {
                return { ...photos[index], key: photos[index].id || photos[index].localUri || `photo-${index}` };
            }
            return { id: `empty-${index}`, isPlaceholder: true, key: `empty-${index}`, status: 'uploaded' as const };
        });
    }, [photos, maxPhotos]);

    // Memoize the onDragEnd callback
    const handleDragEnd = useCallback(({ data }: { data: PhotoItem[] }) => {
        const newOrder = data
            .filter((item) => !item.isPlaceholder)
            .map(({ key, isPlaceholder, ...rest }) => rest);
        onChange(newOrder);
    }, [onChange]);

    // We'll use a local helper to handle the actual upload process
    // so it can be reused by both "add new" (crop) and "edit existing" (picker)
    const handleUploadProcess = async (uri: string, isEdit: boolean, editIndex: number) => {
        // Create temp item
        const tempPhoto: PhotoItem = {
            localUri: uri,
            status: 'uploading',
            uploadProgress: 0,
            replaceOfId: editMode?.photoId,
        };

        if (isEdit) {
            // Replace existing at index with temp item
            onChange(prev => {
                const updated = [...prev];
                // Ensure we replace at the correct index even if photos changed slightly
                // But for index stability, using index is mostly fine in this context
                if (editIndex >= 0 && editIndex < updated.length) {
                    updated[editIndex] = tempPhoto;
                }
                return updated;
            });
        } else {
            // Add new
            onChange(prev => [...prev, tempPhoto]);
        }

        try {
            // Pass replaceOfId if in edit mode
            const replaceId = isEdit ? editMode?.photoId : undefined;

            const uploaded = await uploadImage(uri, (progress) => {
                // Update progress in real-time
                onChange(prev => {
                    const newPhotos = [...prev];
                    if (isEdit) {
                        // Find by matching localUri at that index or nearby to be safe, 
                        // but trusting index for now since we locked UI
                        if (newPhotos[editIndex]?.localUri === uri) {
                            newPhotos[editIndex] = {
                                ...newPhotos[editIndex],
                                uploadProgress: progress,
                            };
                        }
                    } else {
                        // For new photos, find by localUri
                        const idx = newPhotos.findIndex(p => p.localUri === uri && p.status === 'uploading');
                        if (idx !== -1) {
                            newPhotos[idx] = {
                                ...newPhotos[idx],
                                uploadProgress: progress,
                            };
                        }
                    }
                    return newPhotos;
                });
            }, replaceId) as { imageUrl: string; id: string };
            // backend returns { imageUrl, id? }

            onChange(prev => {
                const newPhotos = [...prev];

                if (isEdit) {
                    // Update at specific index
                    if (newPhotos[editIndex]?.localUri === uri) {
                        newPhotos[editIndex] = {
                            ...newPhotos[editIndex],
                            imageUrl: uploaded.imageUrl,
                            id: uploaded.id,
                            status: 'uploaded',
                            uploadProgress: 100,
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
                            uploadProgress: 100,
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

    const onCropComplete = (croppedUri: string) => {
        // 1️⃣ Close cropper immediately (UI first)
        setCropQueue(prev => prev.slice(1));

        // 2️⃣ Handle replace vs add
        if (editMode) {
            const { index, photoId } = editMode;
            setEditMode(null);

            // Upload new photo first (REPLACE logic handled by upload API now)
            handleUploadProcess(croppedUri, true, index);

            // NO manual delete here. Backend handles validation and replacement.

        } else {
            // Add new photo in background
            handleUploadProcess(croppedUri, false, -1);
        }
    };


    const onCropCancel = () => {
        setCropQueue(prev => prev.slice(1));
        setEditMode(null);
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
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newUri = result.assets[0].uri;
                const photo = photos[index];

                // Set edit mode with index and photo ID (for deletion)
                setEditMode({
                    index,
                    photoId: photo?.id
                });

                // Add to crop queue to trigger custom cropper
                setCropQueue([newUri]);
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
            <Sortable.Grid
                data={gridData}
                keyExtractor={(item: PhotoItem) => item.key!}
                columns={3}
                columnGap={10}
                rowGap={10}
                onDragEnd={handleDragEnd}
                renderItem={({ item, index }: { item: PhotoItem; index: number }) => {
                    const photo = item.isPlaceholder ? null : (item as PhotoItem);

                    return (
                        <Pressable
                            key={item.key}
                            onPress={() => !photo && pickImage()}
                            delayLongPress={200}
                            style={{
                                width: '100%',
                                aspectRatio: 3 / 4,
                            }}
                            className={`rounded-xl overflow-hidden relative ${photo ? 'bg-gray-100' : 'bg-gray-50 border-2 border-dashed border-gray-300'
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
                                                    '',
                                                    '',
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


                                    {/* Uploading Overlay */}
                                    {photo.status === 'uploading' && (
                                        <View className="absolute inset-0 bg-black/50 items-center justify-center z-20">
                                            <Text className="text-white font-semibold text-xs mb-1">Uploading</Text>
                                            {photo.uploadProgress !== undefined && photo.uploadProgress > 0 && (
                                                <Text className="text-white text-[10px] font-medium">{photo.uploadProgress}%</Text>
                                            )}
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
                }}
            />

            <ImageCropper
                visible={!!activeCropImage}
                imageUri={activeCropImage}
                onCrop={onCropComplete}
                onCancel={onCropCancel}
            />
        </>
    );
}