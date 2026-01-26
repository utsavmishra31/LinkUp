import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import {
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

const ITEM_HEIGHT = 60;
const { width } = Dimensions.get('window');
const VISIBLE_ITEMS = 5;
const LIST_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// Generate height options from 3'0" to 8'0"
export const HEIGHT_OPTIONS = Array.from({ length: 61 }, (_, i) => {
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

interface HeightPickerProps {
    initialHeight?: string; // Format: "5 9" (feet space inches)
    onHeightChange?: (height: typeof HEIGHT_OPTIONS[0]) => void;
}

export const HeightPicker: React.FC<HeightPickerProps> = ({
    initialHeight,
    onHeightChange,
}) => {
    // Parse initial height or default to 5'9"
    const getInitialIndex = () => {
        if (initialHeight) {
            const [feet, inches] = initialHeight.split(' ').map(Number);
            const totalInches = feet * 12 + inches;
            const index = HEIGHT_OPTIONS.findIndex(opt => opt.feet === feet && opt.inches === inches);
            return index !== -1 ? index : 33; // Default to 5'9" if not found
        }
        return 33; // Default to 5'9"
    };

    const [selectedHeight, setSelectedHeight] = useState(HEIGHT_OPTIONS[getInitialIndex()]);
    const y = useSharedValue(0);

    // Track previous index to only trigger haptics on change
    const activeIndex = useRef(getInitialIndex());

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            y.value = event.contentOffset.y;
        },
    });

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        if (index >= 0 && index < HEIGHT_OPTIONS.length) {
            const newHeight = HEIGHT_OPTIONS[index];
            setSelectedHeight(newHeight);
            if (activeIndex.current !== index) {
                activeIndex.current = index;
                Haptics.selectionAsync();
            }
            onHeightChange?.(newHeight);
        }
    };

    return (
        <View className="items-center justify-center">
            <View className="relative w-[80vw] h-[300px]">
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
                    initialScrollIndex={getInitialIndex()}
                    renderItem={({ item, index }) => (
                        <AnimatedItem item={item} index={index} y={y} />
                    )}
                />
            </View>
        </View>
    );
};
