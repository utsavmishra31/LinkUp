import { useAuth } from '@/lib/auth/useAuth';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LikeScreen() {
    const { signOut } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut();
            Alert.alert('Success', 'You have been logged out');
            router.replace('/(auth)');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to log out');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 py-10">
                <View className="flex-row justify-between items-center mb-8">
                    <Text className="text-4xl font-bold text-black">
                        Likes
                    </Text>
                    <Pressable
                        onPress={handleLogout}
                        className="bg-gray-100 rounded-full py-2 px-4 active:opacity-80"
                    >
                        <Text className="text-black text-center text-sm font-semibold">
                            Logout
                        </Text>
                    </Pressable>
                </View>

                <View className="flex-1 justify-center items-center">
                    <Text className="text-6xl mb-4">❤️</Text>
                    <Text className="text-2xl font-semibold text-black text-center mb-2">
                        No likes yet
                    </Text>
                    <Text className="text-base text-gray-500 text-center px-8">
                        When someone likes you, they'll show up here!
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}
