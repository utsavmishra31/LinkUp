import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

interface SocialAuthButtonProps {
    provider: 'google' | 'apple';
    onPress: () => void;
    disabled?: boolean;
}

export default function SocialAuthButton({ provider, onPress, disabled = false }: SocialAuthButtonProps) {
    const config = {
        google: {
            icon: 'logo-google' as const,
            text: 'Continue with Google',
            bgColor: 'bg-white',
            textColor: 'text-black',
            borderColor: 'border-gray-300',
        },
        apple: {
            icon: 'logo-apple' as const,
            text: 'Continue with Apple',
            bgColor: 'bg-black',
            textColor: 'text-white',
            borderColor: 'border-black',
        },
    };

    const { icon, text, bgColor, textColor, borderColor } = config[provider];

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            className={`w-full ${bgColor} py-4 rounded-full items-center border ${borderColor} ${disabled ? 'opacity-50' : ''
                }`}
            onPress={onPress}
            disabled={disabled}
        >
            <View className="flex-row items-center">
                <Ionicons name={icon} size={20} color={provider === 'google' ? '#000' : '#fff'} />
                <Text className={`${textColor} text-base font-semibold ml-3`}>
                    {text}
                </Text>
            </View>
        </TouchableOpacity>
    );
}
