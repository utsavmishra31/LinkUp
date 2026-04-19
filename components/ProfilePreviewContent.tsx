
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';

export interface PromptData {
    id: string;
    question: string;
    answer: string;
}

export interface ProfilePreviewData {
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
}

export interface ProfilePreviewContentProps {
    profile: ProfilePreviewData;
    onClose?: () => void;
}

export function ProfilePreviewContent({ profile, onClose }: ProfilePreviewContentProps) {
    // Filter out invalid photos/prompts
    const validPhotos = profile.photos.filter(p => !!p.uri);
    const validPrompts = profile.prompts.filter((p): p is PromptData => p !== null && !!p.answer);

    return (
        <View className="flex-1 bg-white relative">
            <StatusBar barStyle="dark-content" />

            {/* Back/Close Button - Absolute Positioned */}
            {onClose && (
                <TouchableOpacity
                    onPress={onClose}
                    className="absolute top-24 left-8 z-50 bg-black/50 p-2 rounded-full"
                    hitSlop={20}
                >
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
            )}

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Main Photo with Gradient Overlay */}
                <View className="px-5 pt-16">
                    <View className="relative w-full h-[550px] rounded-3xl overflow-hidden bg-gray-100 shadow-sm mb-8">
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
                        </View>
                    </View>
                </View>

                {/* Content Body */}
                <View className="px-5">
                    {/* Personal Info Grid */}
                    <View className="flex-row flex-wrap gap-3 mb-8">
                        {profile.gender && (
                            <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                                <Ionicons name="person-outline" size={18} color="#4B5563" />
                                <Text className="ml-2 text-gray-700 font-semibold">
                                    {profile.gender === 'MALE' ? 'Man' : profile.gender === 'FEMALE' ? 'Woman' : 'Non-binary'}
                                </Text>
                            </View>
                        )}
                        {profile.height && (
                            <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                                <Ionicons name="resize-outline" size={18} color="#4B5563" />
                                <Text className="ml-2 text-gray-700 font-semibold">{profile.height}</Text>
                            </View>
                        )}
                        {(profile.jobTitle || profile.company) && (
                            <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                                <Ionicons name="briefcase-outline" size={18} color="#4B5563" />
                                <Text className="ml-2 text-gray-700 font-semibold text-sm">
                                    {profile.jobTitle}{profile.jobTitle && profile.company ? ' at ' : ''}{profile.company}
                                </Text>
                            </View>
                        )}
                        {profile.school && (
                            <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                                <Ionicons name="school-outline" size={18} color="#4B5563" />
                                <Text className="ml-2 text-gray-700 font-semibold text-sm">{profile.school}</Text>
                            </View>
                        )}
                        {profile.interestedIn?.map((interest) => (
                            <View key={interest} className="flex-row items-center bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                                <View className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                                <Text className="text-gray-700 font-semibold text-sm">
                                    Interested in {interest === 'MALE' ? 'Men' : interest === 'FEMALE' ? 'Women' : 'Non-binary'}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Bio */}
                    {!!profile.bio && (
                        <View className="mb-10">
                            <Text className="text-xl text-gray-800 leading-8 font-normal" style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto' }}>
                                {profile.bio}
                            </Text>
                        </View>
                    )}



                    {/* Photos & Prompts Interleaved */}
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
    );
}
