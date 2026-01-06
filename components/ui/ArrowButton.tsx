
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

interface ArrowButtonProps {
    onPress: () => void;
    disabled?: boolean;
    isLoading?: boolean;
}

export const ArrowButton = ({ onPress, disabled = false, isLoading = false }: ArrowButtonProps) => {
    const isInteractable = !disabled && !isLoading;

    return (
        <View className="flex-row justify-end pb-8">
            <TouchableOpacity
                onPress={onPress}
                disabled={!isInteractable}
                className={`w-16 h-16 rounded-full items-center justify-center shadow-sm ${isInteractable ? 'bg-black' : 'bg-gray-200'
                    }`}
            >
                {isLoading ? (
                    <Ionicons name="ellipsis-horizontal" size={24} color="black" />
                ) : (
                    <Ionicons
                        name="chevron-forward"
                        size={36}
                        color={isInteractable ? 'white' : '#9ca3af'}
                    />
                )}
            </TouchableOpacity>
        </View>
    );
};
