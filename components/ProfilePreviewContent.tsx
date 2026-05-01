
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
    id: string;
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
    viewerQuestion?: string;
    viewerPollOptions?: string[];
    viewerPollAnswer?: number;
}

export interface ProfilePreviewContentProps {
    profile: ProfilePreviewData;
    onClose?: () => void;
    onLike?: (id: string) => void;
    onDislike?: (id: string) => void;
    scrollEnabled?: boolean;
}

export function ProfilePreviewContent({ profile, onClose, onLike, onDislike, scrollEnabled = true }: ProfilePreviewContentProps) {
    const [selectedPollOption, setSelectedPollOption] = React.useState<number | null>(null);

    React.useEffect(() => {
        setSelectedPollOption(null);
    }, [profile.id]);

    // Filter out invalid photos/prompts
    const validPhotos = profile.photos.filter(p => !!p.uri);
    const validPrompts = profile.prompts.filter((p): p is PromptData => p !== null && !!p.answer);

    const renderContent = () => (
        <>
            {/* Main Photo with Gradient Overlay */}
            <View className="px-5 pt-16">
                <View className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm mb-8">
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
                        className="absolute left-0 right-0 bottom-0 h-[200px]"
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
                        <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                            <Ionicons name="person-outline" size={18} color="#4B5563" />
                            <Text className="ml-2 text-gray-700 font-semibold">
                                {profile.gender === 'MALE' ? 'Man' : profile.gender === 'FEMALE' ? 'Woman' : 'Non-binary'}
                            </Text>
                        </View>
                    )}
                    {profile.height && (
                        <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                            <Ionicons name="resize-outline" size={18} color="#4B5563" />
                            <Text className="ml-2 text-gray-700 font-semibold">{profile.height}</Text>
                        </View>
                    )}
                    {(profile.jobTitle || profile.company) && (
                        <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                            <Ionicons name="briefcase-outline" size={18} color="#4B5563" />
                            <Text className="ml-2 text-gray-700 font-semibold text-sm">
                                {profile.jobTitle}{profile.jobTitle && profile.company ? ' at ' : ''}{profile.company}
                            </Text>
                        </View>
                    )}
                    {profile.school && (
                        <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                            <Ionicons name="school-outline" size={18} color="#4B5563" />
                            <Text className="ml-2 text-gray-700 font-semibold text-sm">{profile.school}</Text>
                        </View>
                    )}
                    {profile.interestedIn?.map((interest) => (
                        <View key={interest} className="flex-row items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                            <View className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                            <Text className="text-gray-700 font-semibold text-sm">
                                Interested in {interest === 'MALE' ? 'Men' : interest === 'FEMALE' ? 'Women' : 'Non-binary'}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Bio */}
                {!!profile.bio && (
                    <View className="mb-10 bg-white p-5 rounded-xl shadow-sm">
                        <Text className="text-xl text-gray-800 leading-8 font-normal">
                            {profile.bio}
                        </Text>
                    </View>
                )}

                {/* Photos & Prompts Interleaved */}
                {validPrompts.map((prompt) => (
                    <View key={prompt.id} className="mb-8">
                        <View className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                {prompt.question}
                            </Text>
                            <Text className="text-2xl font-semibold text-gray-900 leading-9">
                                {prompt.answer}
                            </Text>
                        </View>
                    </View>
                ))}

                {validPhotos.slice(1).map((photo) => (
                    <View key={photo.uri} className="mb-8 rounded-xl overflow-hidden aspect-square w-full bg-gray-100 shadow-sm">
                        <Image
                            source={{ uri: photo.uri }}
                            className="w-full h-full"
                            contentFit="cover"
                            transition={200}
                        />
                    </View>
                ))}

                {/* Question for Viewers */}
                {profile.viewerQuestion && (
                    <View className="mb-8 bg-white border border-indigo-100 p-6 rounded-xl shadow-sm relative">
                        <View className="absolute -top-3 -right-2 bg-indigo-500 rounded-full w-8 h-8 items-center justify-center border-2 border-white shadow-sm">
                            <Ionicons name="chatbubble-ellipses" size={16} color="white" />
                        </View>
                        <Text className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">
                            Question for you
                        </Text>
                        <Text className="text-2xl font-semibold text-gray-900 leading-9 mb-4">
                            {profile.viewerQuestion}
                        </Text>
                        
                        {profile.viewerPollOptions && profile.viewerPollOptions.length > 0 ? (
                            <View className="gap-y-3">
                                {profile.viewerPollOptions.map((opt, idx) => {
                                    const isSelected = selectedPollOption === idx;
                                    const isCorrect = profile.viewerPollAnswer === idx;
                                    const showResult = selectedPollOption !== null;
                                    
                                    let bgClass = "bg-white";
                                    let borderClass = "border-indigo-100";
                                    let textClass = "text-gray-700";
                                    let icon = null;

                                    if (showResult) {
                                        if (isSelected && isCorrect) {
                                            bgClass = "bg-green-100";
                                            borderClass = "border-green-500";
                                            textClass = "text-green-800 font-bold";
                                            icon = <Ionicons name="checkmark-circle" size={20} color="#16a34a" />;
                                        } else if (isSelected && !isCorrect) {
                                            bgClass = "bg-red-100";
                                            borderClass = "border-red-500";
                                            textClass = "text-red-800 font-bold";
                                            icon = <Ionicons name="close-circle" size={20} color="#dc2626" />;
                                        } else if (isCorrect) {
                                            bgClass = "bg-green-50";
                                            borderClass = "border-green-400";
                                            textClass = "text-green-700";
                                            icon = <Ionicons name="checkmark-circle-outline" size={20} color="#16a34a" />;
                                        }
                                    }

                                    return (
                                        <TouchableOpacity 
                                            key={idx}
                                            disabled={showResult}
                                            onPress={() => setSelectedPollOption(idx)}
                                            className={`border rounded-xl px-4 py-3 flex-row items-center justify-between ${bgClass} ${borderClass}`}
                                        >
                                            <Text className={textClass}>{opt}</Text>
                                            {icon}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View className="bg-white border border-indigo-100 rounded-full px-4 py-3 flex-row items-center">
                                <Text className="text-gray-400 flex-1">Type your answer...</Text>
                                <Ionicons name="send" size={18} color="#6366f1" />
                            </View>
                        )}
                    </View>
                )}
            </View>
        </>
    );

    return (
        <View className="flex-1 bg-[#F2F3F5] relative">
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

            {scrollEnabled ? (
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    nestedScrollEnabled={true}
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {renderContent()}
                </ScrollView>
            ) : (
                <View className="flex-1">
                    {renderContent()}
                </View>
            )}

            {/* Floating Action Buttons */}
            <View className="absolute bottom-10 left-0 right-0 flex-row justify-center items-center gap-6 z-50">
                <TouchableOpacity
                    onPress={() => onDislike?.(profile.id)}
                    className="w-16 h-16 bg-white rounded-full items-center justify-center shadow-xl border border-gray-100 active:bg-gray-50"
                >
                    <Ionicons name="close" size={30} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onLike?.(profile.id)}
                    className="w-16 h-16 bg-black rounded-full items-center justify-center shadow-xl active:opacity-80"
                >
                    <Ionicons name="heart" size={30} color="#10B981" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
