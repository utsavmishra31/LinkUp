import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

interface OTPInputProps {
    value: string;
    onChangeText: (text: string) => void;
    length?: number;
}

export default function OTPInput({ value, onChangeText, length = 6 }: OTPInputProps) {
    const [focusedIndex, setFocusedIndex] = useState(0);
    const inputRefs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        // Auto-focus first input on mount
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (text: string, index: number) => {
        // Only allow numbers
        const numericText = text.replace(/[^0-9]/g, '');

        if (numericText.length === 0) {
            // Handle backspace
            const newValue = value.slice(0, index) + value.slice(index + 1);
            onChangeText(newValue);

            // Move to previous input
            if (index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        } else if (numericText.length === 1) {
            // Handle single digit input
            const newValue = value.slice(0, index) + numericText + value.slice(index + 1);
            onChangeText(newValue);

            // Move to next input
            if (index < length - 1) {
                inputRefs.current[index + 1]?.focus();
            }
        } else if (numericText.length > 1) {
            // Handle paste
            const pastedValue = numericText.slice(0, length);
            onChangeText(pastedValue);

            // Focus last filled input
            const lastIndex = Math.min(pastedValue.length - 1, length - 1);
            inputRefs.current[lastIndex]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    return (
        <View className="flex-row justify-between gap-2">
            {Array.from({ length }).map((_, index) => (
                <View
                    key={index}
                    className={`flex-1 aspect-square items-center justify-center border-2 rounded-2xl ${focusedIndex === index ? 'border-black bg-gray-50' : 'border-gray-300 bg-white'
                        }`}
                >
                    <TextInput
                        ref={(ref) => { inputRefs.current[index] = ref; }}
                        className="text-2xl font-bold text-black text-center w-full h-full"
                        value={value[index] || ''}
                        onChangeText={(text) => handleChange(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        onFocus={() => setFocusedIndex(index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                    />
                </View>
            ))}
        </View>
    );
}
