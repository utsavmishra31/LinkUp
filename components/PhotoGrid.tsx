import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

type Photo = { id: string; imageUrl: string; position: number } | string;

interface PhotoGridProps {
    photos: Photo[];
    onAddPhoto: () => void;
    onRemovePhoto: (photoIdOrIndex: string | number) => void;
    maxPhotos?: number;
}

export function PhotoGrid({ photos, onAddPhoto, onRemovePhoto, maxPhotos = 6 }: PhotoGridProps) {
    const getPhotoUri = (photo: Photo): string => {
        if (typeof photo === 'string') {
            return photo;
        }
        return photo.imageUrl?.startsWith('http')
            ? photo.imageUrl
            : `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${photo.imageUrl}`;
    };

    const getPhotoId = (photo: Photo, index: number): string | number => {
        if (typeof photo === 'string') {
            return index;
        }
        return photo.id;
    };

    return (
        <View className="flex-row flex-wrap justify-between gap-y-4">
            {[...Array(maxPhotos)].map((_, index) => {
                const photo = photos[index];
                return (
                    <Pressable
                        key={index}
                        onPress={() => !photo && onAddPhoto()}
                        className={`w-[31%] aspect-[3/4] rounded-xl overflow-hidden relative ${photo ? 'bg-gray-100' : 'bg-gray-50 border-2 border-dashed border-gray-300'
                            }`}
                    >
                        {photo ? (
                            <>
                                <Image
                                    source={{ uri: getPhotoUri(photo) }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                                <Pressable
                                    onPress={() => onRemovePhoto(getPhotoId(photo, index))}
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
    );
}
