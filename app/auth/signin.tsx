import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignIn() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={32} color="black" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 px-8 justify-center"
            >
                <Text className="text-4xl font-serif font-bold mb-8 text-black">
                    Welcome back.
                </Text>

                <View className="gap-6">
                    <View>
                        <Text className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Email</Text>
                        <TextInput
                            className="w-full border-b-2 border-gray-200 py-3 text-xl text-black"
                            placeholder="Enter your email"
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="none"
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Password</Text>
                        <TextInput
                            className="w-full border-b-2 border-gray-200 py-3 text-xl text-black"
                            placeholder="Enter your password"
                            placeholderTextColor="#9CA3AF"
                            secureTextEntry
                        />
                    </View>
                </View>

                <TouchableOpacity
                    className="mt-12 w-full bg-black py-4 rounded-full items-center active:bg-gray-800"
                    onPress={() => router.push('/(tabs)')}
                >
                    <Text className="text-white font-bold text-lg">Sign In</Text>
                </TouchableOpacity>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
