import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUp() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={32} color="black" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 px-8 mt-10"
            >
                <Text className="text-4xl font-serif font-bold mb-4 text-black">
                    My number is
                </Text>

                <View className="flex-row items-center border-b-2 border-gray-200 py-3">
                    <Text className="text-xl font-bold mr-4">+1</Text>
                    <TextInput
                        className="flex-1 text-xl text-black font-medium"
                        placeholder="000 000 0000"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        autoFocus
                    />
                </View>

                <Text className="text-gray-400 mt-4 text-sm leading-5">
                    LinkUp will send you a text with a verification code. Message and data rates may apply.
                </Text>

                <View className="flex-1 justify-end mb-8">
                    <TouchableOpacity
                        className="w-full bg-gray-200 py-4 rounded-full items-center"
                        onPress={() => router.push('/(tabs)')}
                    >
                        <Text className="text-gray-500 font-bold text-lg">Continue</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
