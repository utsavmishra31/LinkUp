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
    aspectRatio?: number; // width / height, default 1
    onCancel: () => void;
    onCrop: (uri: string) => void;
    onReplace: () => void;
}

export default function ImageCropper({
    visible,
    imageUri,
    aspectRatio = 1,
    onCancel,
    onCrop,
    onReplace,
}: ImageCropperProps) {
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    // Full screen width for the crop area, perfect square
    const CROP_WIDTH = SCREEN_WIDTH;
    const CROP_HEIGHT = CROP_WIDTH / aspectRatio;

    let layoutWidth = CROP_WIDTH;
    let layoutHeight = CROP_HEIGHT;

    if (imageSize.width > 0 && imageSize.height > 0) {
        const imageRatio = imageSize.width / imageSize.height;
        const cropRatio = CROP_WIDTH / CROP_HEIGHT;

        if (imageRatio > cropRatio) {
            layoutHeight = CROP_HEIGHT;
            layoutWidth = CROP_HEIGHT * imageRatio;
        } else {
            layoutWidth = CROP_WIDTH;
            layoutHeight = CROP_WIDTH / imageRatio;
        }
    }

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
            const boundX = Math.max(0, (layoutWidth * scale.value - CROP_WIDTH) / 2);
            const boundY = Math.max(0, (layoutHeight * scale.value - CROP_HEIGHT) / 2);
            
            const nextX = savedTranslateX.value + e.translationX;
            const nextY = savedTranslateY.value + e.translationY;
            
            translateX.value = Math.max(-boundX, Math.min(boundX, nextX));
            translateY.value = Math.max(-boundY, Math.min(boundY, nextY));
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    // Pinch Gesture
    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            const newScale = Math.max(1, savedScale.value * e.scale);
            scale.value = newScale;

            const boundX = Math.max(0, (layoutWidth * newScale - CROP_WIDTH) / 2);
            const boundY = Math.max(0, (layoutHeight * newScale - CROP_HEIGHT) / 2);
            
            translateX.value = Math.max(-boundX, Math.min(boundX, translateX.value));
            translateY.value = Math.max(-boundY, Math.min(boundY, translateY.value));
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
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
        if (!imageUri || imageSize.width === 0) return;

        try {
            const currentScale = scale.value;
            const currentTx = translateX.value;
            const currentTy = translateY.value;

            // Rendered size of the crop box is CROP_WIDTH x CROP_HEIGHT.
            // The image rendered size is layoutWidth * currentScale by layoutHeight * currentScale.
            // Image center is at the same center as crop box center.
            const cropX_on_rendered = (layoutWidth * currentScale - CROP_WIDTH) / 2 - currentTx;
            const cropY_on_rendered = (layoutHeight * currentScale - CROP_HEIGHT) / 2 - currentTy;

            // Map back to original image size
            const originalCropX = (cropX_on_rendered / (layoutWidth * currentScale)) * imageSize.width;
            const originalCropY = (cropY_on_rendered / (layoutHeight * currentScale)) * imageSize.height;
            
            const originalCropW = (CROP_WIDTH / (layoutWidth * currentScale)) * imageSize.width;
            const originalCropH = (CROP_HEIGHT / (layoutHeight * currentScale)) * imageSize.height;

            const actions = [{
                crop: {
                    originX: Math.max(0, originalCropX),
                    originY: Math.max(0, originalCropY),
                    width: Math.min(imageSize.width, originalCropW),
                    height: Math.min(imageSize.height, originalCropH)
                }
            }];

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
                            style={{ width: CROP_WIDTH, height: CROP_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
                            className="relative overflow-hidden rounded-3xl bg-[#1A1A1A]"
                        >
                            <GestureDetector gesture={composedGesture}>
                                <Animated.Image
                                    source={{ uri: imageUri }}
                                    style={[
                                        { width: layoutWidth, height: layoutHeight },
                                        animatedStyle
                                    ]}
                                    resizeMode="cover"
                                    onLoad={handleImageLoad}
                                />
                            </GestureDetector>

                            {/* 3x3 Grid Overlay */}
                            <View className="absolute inset-0 pointer-events-none">
                                <View className="absolute top-1/3 left-0 right-0 h-[1px] bg-white/40" />
                                <View className="absolute top-2/3 left-0 right-0 h-[1px] bg-white/40" />
                                <View className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-white/40" />
                                <View className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-white/40" />
                            </View>
                        </View>

                        <Text className="text-gray-400 text-sm mt-8">
                            Pinch to zoom, drag to adjust
                        </Text>
                    </View>

                    {/* BOTTOM CONTROLS */}
                    <View className="px-6 pb-6 pt-2 flex-row items-center justify-between">
                        <TouchableOpacity onPress={onCancel} hitSlop={10} className="p-2">
                            <Text className="text-white text-lg">Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleCrop} hitSlop={10} className="bg-white px-8 py-3 rounded-full">
                            <Text className="text-black font-bold text-base">Done</Text>
                        </TouchableOpacity>
                    </View>

                </SafeAreaView>
            </GestureHandlerRootView>
        </Modal>
    );
}
