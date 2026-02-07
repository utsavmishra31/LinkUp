import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ArrowButtonProps {
    onPress: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    loadingText?: string;
}

export const ArrowButton = ({ onPress, disabled = false, isLoading = false, loadingText }: ArrowButtonProps) => {
    const isInteractable = !disabled && !isLoading;

    // Show text only if loading
    const showText = isLoading && loadingText;

    return (
        <View className="flex-row justify-end pb-8">
            <TouchableOpacity
                onPress={onPress}
                disabled={!isInteractable}
                className={`h-16 rounded-full items-center justify-center shadow-sm flex-row ${showText ? 'px-6 space-x-3' : 'w-16'} ${isInteractable ? 'bg-black' : 'bg-gray-200'
                    }`}
            >
                {isLoading ? (
                    <View className="flex-row items-center space-x-2">
                        {loadingText && (
                            <Text className="text-black font-semibold text-base mr-2">
                                {loadingText}
                            </Text>
                        )}
                        <Ionicons name="ellipsis-horizontal" size={24} color="black" />
                    </View>
                ) : (
                    <View>
                        <Ionicons
                            name="chevron-forward"
                            size={36}
                            color={isInteractable ? 'white' : '#9ca3af'}
                        />
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
};