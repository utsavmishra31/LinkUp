
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, Modal, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export interface PromptData {
    id: string;
    question: string;
    answer: string;
}

export interface ProfilePreviewProps {
    visible: boolean;
    onClose: () => void;
    profile: {
        photos: { uri: string }[];
        displayName: string;
        age?: number;
        bio: string;
        gender?: string;
        height?: string;
        interestedIn?: string[];
        prompts: (PromptData | null)[];
        jobTitle?: string;
        company?: string;
        school?: string;
    };
}

export function ProfilePreview({ visible, onClose, profile }: ProfilePreviewProps) {

    // Filter out invalid photos/prompts
    const validPhotos = profile.photos.filter(p => !!p.uri);
    const validPrompts = profile.prompts.filter((p): p is PromptData => p !== null && !!p.answer);

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View className="flex-1 bg-white relative">
                <StatusBar barStyle="light-content" />

                {/* Close Button - Absolute Positioned */}
                <TouchableOpacity
                    onPress={onClose}
                    className="absolute top-12 right-5 z-50 bg-black/50 p-2 rounded-full"
                    hitSlop={20}
                >
                    <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>

                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {/* Main Photo with Gradient Overlay */}
                    <View className="relative w-full h-[550px]">
                        {validPhotos.length > 0 ? (
                            <Image
                                source={{ uri: validPhotos[0].uri }}
                                className="w-full h-full bg-gray-200"
                                contentFit="cover"
                                transition={200}
                            />
                        ) : (
                            <View className="w-full h-full bg-gray-200 items-center justify-center">
                                <Ionicons name="person" size={64} color="#9ca3af" />
                            </View>
                        )}

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 }}
                        />

                        <View className="absolute bottom-6 left-5 right-5">
                            <Text className="text-white text-4xl font-extrabold shadow-sm">
                                {profile.displayName}{profile.age ? `, ${profile.age}` : ''}
                            </Text>

                            <View className="flex-row items-center mt-2">
                                {profile.gender ? (
                                    <View className="flex-row items-center bg-white/20 rounded-full px-3 py-1 mr-2 backdrop-blur-md">
                                        <Ionicons name="person" size={12} color="white" style={{ marginRight: 4 }} />
                                        <Text className="text-white text-xs font-bold uppercase tracking-wide">
                                            {profile.gender === 'MALE' ? 'Man' : profile.gender === 'FEMALE' ? 'Woman' : 'Non-binary'}
                                        </Text>
                                    </View>
                                ) : null}

                                {profile.height ? (
                                    <View className="flex-row items-center bg-white/20 rounded-full px-3 py-1 backdrop-blur-md">
                                        <Ionicons name="resize" size={12} color="white" style={{ marginRight: 4 }} />
                                        <Text className="text-white text-xs font-bold uppercase tracking-wide">
                                            {profile.height}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </View>

                    {/* Content Body */}
                    <View className="px-5 pt-8">

                        {/* Bio */}
                        {!!profile.bio && (
                            <View className="mb-10">
                                <Text className="text-xl text-gray-800 leading-8 font-normal" style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto' }}>
                                    {profile.bio}
                                </Text>
                            </View>
                        )}

                        {/* Interest Tags */}
                        {profile.interestedIn && profile.interestedIn.length > 0 && (
                            <View className="mb-10">
                                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Interested In</Text>
                                <View className="flex-row gap-2 flex-wrap">
                                    {profile.interestedIn.map((interest) => (
                                        <View key={interest} className="border border-gray-200 rounded-full px-4 py-2 bg-gray-50">
                                            <Text className="text-gray-600 font-medium text-sm">
                                                {interest === 'MALE' ? 'Men' : interest === 'FEMALE' ? 'Women' : 'Non-binary people'}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Photos & Prompts Interleaved */}
                        {/* Strategy: Show 1 Prompt, then 1 Photo, repeat. Or just list prompts then remaining photos. */}

                        {validPrompts.map((prompt, index) => (
                            <View key={index} className="mb-8">
                                <View className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                        {prompt.question}
                                    </Text>
                                    <Text className="text-2xl font-semibold text-gray-900 leading-9">
                                        {prompt.answer}
                                    </Text>
                                </View>
                            </View>
                        ))}

                        {validPhotos.slice(1).map((photo, index) => (
                            <View key={`photo-${index}`} className="mb-8 rounded-3xl overflow-hidden h-[500px] w-full bg-gray-100 shadow-sm">
                                <Image
                                    source={{ uri: photo.uri }}
                                    className="w-full h-full"
                                    contentFit="cover"
                                    transition={200}
                                />
                            </View>
                        ))}

                    </View>
                </ScrollView>

                {/* Floating Action Buttons (Visual Only) */}
                <View className="absolute bottom-10 left-0 right-0 flex-row justify-center items-center gap-6 z-50">
                    <View
                        className="w-16 h-16 bg-white rounded-full items-center justify-center shadow-xl border border-gray-100"
                    >
                        <Ionicons name="close" size={30} color="#EF4444" />
                    </View>
                    <View
                        className="w-16 h-16 bg-black rounded-full items-center justify-center shadow-xl"
                    >
                        <Ionicons name="heart" size={30} color="#10B981" />
                    </View>
                </View>
            </View>
        </Modal>
    );
}
