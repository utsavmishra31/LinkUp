import { ArrowButton } from '@/components/ui/ArrowButton';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Text,
    View,
} from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const ITEM_HEIGHT = 60;
const { width } = Dimensions.get('window');
const VISIBLE_ITEMS = 5;
const LIST_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// Generate height options from 3'0" to 8'0"
const HEIGHT_OPTIONS = Array.from({ length: 61 }, (_, i) => {
    const totalInches = 36 + i; // Start at 36 inches (3 ft)
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return {
        id: totalInches.toString(),
        feet,
        inches,
        label: `${feet}'${inches}"`,
        value: totalInches / 12,
    };
});

const AnimatedItem = ({
    item,
    y,
    index,
}: {
    item: typeof HEIGHT_OPTIONS[0];
    y: SharedValue<number>;
    index: number;
}) => {
    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 2) * ITEM_HEIGHT,
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
            (index + 2) * ITEM_HEIGHT,
        ];

        const scale = interpolate(
            y.value,
            inputRange,
            [0.8, 0.9, 1.1, 0.9, 0.8],
            Extrapolation.CLAMP
        );

        const opacity = interpolate(
            y.value,
            inputRange,
            [0.3, 0.5, 1, 0.5, 0.3],
            Extrapolation.CLAMP
        );

        const rotateX = interpolate(
            y.value,
            inputRange,
            [45, 25, 0, -25, -45],
            Extrapolation.CLAMP
        );

        const translateY = interpolate(
            y.value,
            inputRange,
            [-20, -10, 0, 10, 20],
            Extrapolation.CLAMP
        );

        return {
            transform: [
                { perspective: 500 },
                { rotateX: `${rotateX}deg` },
                { scale },
                { translateY }
            ],
            opacity,
        };
    });

    return (
        <Animated.View
            className="h-[60px] justify-center items-center"
            style={[
                animatedStyle,
            ]}
        >
            <Text className="text-3xl font-bold text-black font-['System']">
                {item.label}
            </Text>
        </Animated.View>
    );
};

export default function HeightSelection() {
    const [selectedHeight, setSelectedHeight] = useState(HEIGHT_OPTIONS[33]); // Default to 5'9"
    const [isSubmitting, setIsSubmitting] = useState(false);
    const y = useSharedValue(0);

    // Track previous index to only trigger haptics on change
    const activeIndex = useRef(33);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            y.value = event.contentOffset.y;
        },
    });

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        if (index >= 0 && index < HEIGHT_OPTIONS.length) {
            setSelectedHeight(HEIGHT_OPTIONS[index]);
            if (activeIndex.current !== index) {
                activeIndex.current = index;
                Haptics.selectionAsync();
            }
        }
    };

    // Optional: Add haptics while scrolling using runOnJS if desired, 
    // but momentum end is safer for performance. 
    // For real drum feeling we might want haptics on every item cross.

    const handleContinue = async () => {
        if (!selectedHeight) return;
        if (!user) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    height: `${selectedHeight.feet} ${selectedHeight.inches}`,
                    onboardingStep: 7,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();

        } catch (error) {
            console.error('Error updating height:', error);
            Alert.alert('Error', 'Failed to save height.');
        } finally {
            setIsSubmitting(false);
            // Navigate to availability directly
            router.push('/(onboarding)/availability');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12 items-center">
                <Text className="text-3xl font-bold text-black mb-12 self-start">
                    Your height?
                </Text>

                <View className="items-center justify-center">
                    <View className="relative w-[80vw] h-[300px]">
                        {/* Center Indicator Line/Zone - Optional, maybe just whitespace or gradient */}
                        {/* 
                         <View
                             className="absolute w-full h-[60px] border-t border-b border-gray-200 z-0"
                             style={{ top: (LIST_HEIGHT - 60) / 2 }} 
                         />
                        */}

                        <Animated.FlatList
                            data={HEIGHT_OPTIONS}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            snapToInterval={ITEM_HEIGHT}
                            decelerationRate="fast"
                            onScroll={onScroll}
                            onMomentumScrollEnd={handleMomentumScrollEnd}
                            scrollEventThrottle={16}
                            contentContainerClassName="py-[120px]"
                            getItemLayout={(data, index) => ({
                                length: ITEM_HEIGHT,
                                offset: ITEM_HEIGHT * index,
                                index,
                            })}
                            initialScrollIndex={33}
                            renderItem={({ item, index }) => (
                                <AnimatedItem item={item} index={index} y={y} />
                            )}
                        />
                    </View>
                </View>

                <View className="flex-1 justify-end pb-8 w-full">
                    <ArrowButton
                        onPress={handleContinue}
                        disabled={!selectedHeight}
                        isLoading={isSubmitting}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
