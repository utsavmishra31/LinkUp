import { Ionicons } from '@expo/vector-icons';
// import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import React, { useState } from 'react';
import {
    Dimensions,
    Modal,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageCropperProps {
    visible: boolean;
    imageUri: string | null;
    aspectRatio?: number; // width / height, default 3/4
    onCancel: () => void;
    onCrop: (uri: string) => void;
}

export default function ImageCropper({
    visible,
    imageUri,
    aspectRatio = 3 / 4,
    onCancel,
    onCrop,
}: ImageCropperProps) {
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    // Calculate crop window dimensions
    // We want the crop window to be as wide as possible with some padding
    const PADDING = 20;
    const CROP_WIDTH = SCREEN_WIDTH - PADDING * 2;
    const CROP_HEIGHT = CROP_WIDTH / aspectRatio;

    // Animation values
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const resetValues = () => {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        savedTranslateX.value = 0;
        translateY.value = 0;
        savedTranslateY.value = 0;
    };

    // Pan Gesture
    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    // Pinch Gesture
    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
        });

    const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value },
            ],
        };
    });

    const handleImageLoad = (e: any) => {
        const { width, height } = e.nativeEvent.source;
        setImageSize({ width, height });
        resetValues();
    };

    const handleCrop = async () => {
        if (!imageUri) return;

        try {
            // For MVP: center-crop logic ensuring 3:4 aspect ratio.
            const actions = [];

            // If image is too wide
            if (imageSize.width / imageSize.height > aspectRatio) {
                // Crop width
                const newWidth = imageSize.height * aspectRatio;
                const startX = (imageSize.width - newWidth) / 2;
                actions.push({
                    crop: {
                        originX: startX,
                        originY: 0,
                        width: newWidth,
                        height: imageSize.height
                    }
                });
            } else {
                // Crop height
                const newHeight = imageSize.width / aspectRatio;
                const startY = (imageSize.height - newHeight) / 2;
                actions.push({
                    crop: {
                        originX: 0,
                        originY: startY,
                        width: imageSize.width,
                        height: newHeight
                    }
                });
            }

            const result = await (async () => {
                let ImageManipulator;
                try {
                    // Safe dynamic require
                    ImageManipulator = require('expo-image-manipulator');
                } catch (e) {
                    throw new Error('MISSING_NATIVE_MODULE');
                }

                if (!ImageManipulator || typeof ImageManipulator.manipulateAsync !== 'function') {
                    throw new Error('MISSING_NATIVE_MODULE');
                }

                return await ImageManipulator.manipulateAsync(
                    imageUri,
                    actions,
                    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
                );
            })();

            onCrop(result.uri);
        } catch (error: any) {
            console.error('Crop failed', error);
            const errString = error ? error.toString() : '';
            if (errString.includes('MISSING_NATIVE_MODULE') || errString.includes('native module') || (error.message && error.message.includes('native module'))) {
                const { Alert } = require('react-native');
                Alert.alert(
                    'Setup Required',
                    'Image cropping requires a rebuild. Run "npx expo run:ios" to enable.',
                    [{ text: 'OK' }]
                );
            }
            // Fallback to original if fail
            onCrop(imageUri);
        }
    };

    if (!visible || !imageUri) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <GestureHandlerRootView className="flex-1">
                <SafeAreaView className="flex-1 bg-black">



                    {/* BODY */}
                    <View className="flex-1 items-center justify-center">
                        <View
                            style={{ width: CROP_WIDTH, height: CROP_HEIGHT }}
                            className="overflow-hidden border border-white rounded-xl"
                        >
                            <GestureDetector gesture={composedGesture}>
                                <Animated.Image
                                    source={{ uri: imageUri }}
                                    className="w-full h-full"
                                    style={animatedStyle}
                                    resizeMode="cover"
                                    onLoad={handleImageLoad}
                                />
                            </GestureDetector>
                        </View>

                        <Text className="text-gray-400 text-sm mt-4">
                            Pinch to zoom, drag to adjust
                        </Text>
                    </View>

                    {/* BOTTOM CONTROLS */}
                    <View className="px-6 pb-2 flex-row items-center justify-between">
                        <TouchableOpacity onPress={onCancel} hitSlop={10} className="p-2">
                            <Ionicons name="close" size={32} color="white" />
                        </TouchableOpacity>

                        <Text className="text-white text-lg font-semibold">
                            Crop Photo
                        </Text>

                        <TouchableOpacity onPress={handleCrop} hitSlop={10} className="p-2">
                            <Ionicons name="checkmark" size={32} color="#FF5864" />
                        </TouchableOpacity>
                    </View>

                </SafeAreaView>
            </GestureHandlerRootView>
        </Modal>
    );
}
