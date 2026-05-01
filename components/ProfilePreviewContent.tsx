
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

    const validPhotos = profile.photos.filter(p => !!p.uri);
    const validPrompts = profile.prompts.filter((p): p is PromptData => p !== null && !!p.answer);

    const renderContent = () => (
        <>
            {/* Main Photo with Glassmorphism Overlay */}
            <View className="px-4 pt-12">
                <View className="relative w-full aspect-[4/5] rounded-[40px] overflow-hidden shadow-2xl bg-gray-200">
                    {validPhotos.length > 0 ? (
                        <Image
                            source={{ uri: validPhotos[0].uri }}
                            className="w-full h-full"
                            contentFit="cover"
                            transition={400}
                        />
                    ) : (
                        <View className="w-full h-full bg-gray-300 items-center justify-center">
                            <Ionicons name="person" size={80} color="#9ca3af" />
                        </View>
                    )}

                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                        className="absolute left-0 right-0 bottom-0 h-[250px]"
                    />

                    <View className="absolute bottom-8 left-6 right-6">
                        <View className="flex-row items-center mb-2">
                             <View className="bg-green-500 w-2.5 h-2.5 rounded-full mr-2 shadow-sm" />
                             <Text className="text-white/80 text-[10px] font-black uppercase tracking-[2px]">Active Now</Text>
                        </View>
                        <View className="bg-white/10 backdrop-blur-xl p-4 rounded-3xl border border-white/20">
                            <Text className="text-white text-4xl font-black tracking-tight">
                                {profile.displayName}{profile.age ? `, ${profile.age}` : ''}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Content Body */}
            <View className="px-6 pt-10">
                {/* Personal Info Grid - Minimal & Chic */}
                <View className="flex-row flex-wrap gap-2 mb-10">
                    {profile.gender && (
                        <View className="flex-row items-center bg-white px-5 py-3 rounded-full shadow-sm border border-gray-100">
                            <Ionicons name={profile.gender === 'MALE' ? 'male' : 'female'} size={14} color="#000" />
                            <Text className="ml-2 text-black font-black text-[11px] uppercase tracking-wider">
                                {profile.gender === 'MALE' ? 'Man' : profile.gender === 'FEMALE' ? 'Woman' : 'Non-binary'}
                            </Text>
                        </View>
                    )}
                    {profile.height && (
                        <View className="flex-row items-center bg-white px-5 py-3 rounded-full shadow-sm border border-gray-100">
                            <Ionicons name="resize-outline" size={14} color="#000" />
                            <Text className="ml-2 text-black font-black text-[11px] uppercase tracking-wider">{profile.height}</Text>
                        </View>
                    )}
                    {profile.interestedIn?.map((interest) => (
                        <View key={interest} className="flex-row items-center bg-white px-5 py-3 rounded-full shadow-sm border border-gray-100">
                            <Ionicons name="heart-outline" size={14} color="#000" />
                            <Text className="ml-2 text-black font-black text-[11px] uppercase tracking-wider">
                                {interest === 'MALE' ? 'Men' : interest === 'FEMALE' ? 'Women' : 'Non-binary'}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Bio Section - Minimalist Elegant */}
                {!!profile.bio && (
                    <View className="mb-12 bg-white/50 p-8 rounded-[40px] border border-white shadow-xl relative overflow-hidden">
                        <View className="flex-row items-center mb-6">
                             <Text className="text-[10px] font-black text-black/40 uppercase tracking-[4px]">About Me</Text>
                        </View>
                        <Text className="text-xl text-black leading-9 font-medium tracking-tight">
                            {profile.bio}
                        </Text>
                    </View>
                )}

                {/* Prompts Section - High Contrast */}
                {validPrompts.map((prompt) => (
                    <View key={prompt.id} className="mb-10">
                        <View className="bg-black p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                            <View className="bg-white/20 w-12 h-1 rounded-full mb-6" />
                            <Text className="text-[10px] font-black text-white/50 uppercase tracking-[4px] mb-4 leading-5">
                                {prompt.question}
                            </Text>
                            <Text className="text-2xl font-bold text-white leading-10 tracking-tight">
                                {prompt.answer}
                            </Text>
                        </View>
                    </View>
                ))}

                {validPhotos.slice(1).map((photo) => (
                    <View key={photo.uri} className="mb-10 rounded-[40px] overflow-hidden aspect-square w-full shadow-2xl bg-gray-100">
                        <Image
                            source={{ uri: photo.uri }}
                            className="w-full h-full"
                            contentFit="cover"
                            transition={400}
                        />
                    </View>
                ))}

                {/* Question for Viewers - Elegant Interaction */}
                {profile.viewerQuestion && (
                    <View className="mb-12 bg-white p-8 rounded-[40px] shadow-2xl border border-gray-50 relative">
                        <View className="absolute -top-4 left-10 bg-black rounded-2xl px-4 py-2 shadow-lg">
                            <Text className="text-white text-[10px] font-black uppercase tracking-widest">Question</Text>
                        </View>
                        <Text className="text-2xl font-bold text-black leading-10 mb-8 pt-4">
                            {profile.viewerQuestion}
                        </Text>
                        
                        {profile.viewerPollOptions && profile.viewerPollOptions.length > 0 ? (
                            <View className="gap-y-3">
                                {profile.viewerPollOptions.map((opt, idx) => {
                                    const isSelected = selectedPollOption === idx;
                                    const isCorrect = profile.viewerPollAnswer === idx;
                                    const showResult = selectedPollOption !== null;
                                    
                                    let bgClass = "bg-gray-50";
                                    let borderClass = "border-transparent";
                                    let textClass = "text-black/60";

                                    if (showResult) {
                                        if (isSelected && isCorrect) {
                                            bgClass = "bg-green-500";
                                            textClass = "text-white font-black";
                                        } else if (isSelected && !isCorrect) {
                                            bgClass = "bg-red-500";
                                            textClass = "text-white font-black";
                                        } else if (isCorrect) {
                                            bgClass = "bg-green-100";
                                            textClass = "text-green-800 font-black";
                                        }
                                    } else {
                                        if (isSelected) {
                                            bgClass = "bg-black";
                                            textClass = "text-white font-black";
                                        }
                                    }

                                    return (
                                        <TouchableOpacity 
                                            key={idx}
                                            disabled={showResult}
                                            onPress={() => setSelectedPollOption(idx)}
                                            className={`rounded-3xl px-6 py-4 flex-row items-center justify-between transition-all ${bgClass} ${borderClass}`}
                                        >
                                            <Text className={`text-sm tracking-tight ${textClass}`}>{opt}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View className="bg-gray-50 rounded-full px-6 py-5 flex-row items-center">
                                <Text className="text-black/30 flex-1 font-bold text-sm">Type your answer...</Text>
                                <Ionicons name="arrow-forward-circle" size={32} color="#000" />
                            </View>
                        )}
                    </View>
                )}
            </View>
        </>
    );

    return (
        <View className="flex-1 bg-[#FDFDFD] relative">
            <StatusBar barStyle="dark-content" />

            {onClose && (
                <TouchableOpacity
                    onPress={onClose}
                    className="absolute top-16 left-6 z-50 bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/30"
                    hitSlop={20}
                >
                    <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
            )}

            {scrollEnabled ? (
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                    nestedScrollEnabled={true}
                    contentContainerStyle={{ paddingBottom: 150 }}
                >
                    {renderContent()}
                </ScrollView>
            ) : (
                <View className="flex-1">
                    {renderContent()}
                </View>
            )}

            {/* Premium Floating Action Buttons */}
            <View className="absolute bottom-12 left-0 right-0 flex-row justify-center items-center gap-8 z-50">
                <TouchableOpacity
                    onPress={() => onDislike?.(profile.id)}
                    className="w-14 h-14 bg-white rounded-full items-center justify-center shadow-2xl border border-gray-50 active:scale-90"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }}
                >
                    <Ionicons name="close" size={28} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onLike?.(profile.id)}
                    className="w-20 h-20 bg-black rounded-full items-center justify-center shadow-2xl active:scale-95"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.3, shadowRadius: 25 }}
                >
                    <Ionicons name="heart" size={36} color="#FFF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
