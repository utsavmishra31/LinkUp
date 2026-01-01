import { useAuth } from '@/app/authFirebase/useAuth';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut();
            Alert.alert('Success', 'You have been logged out');
            router.replace('/authFirebase');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to log out');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />

            <View className="flex-1 px-6 py-10">
                {/* Header Section */}
                <View className="mb-8">
                    <Text className="text-4xl font-bold text-black mb-2">
                        Dashboard
                    </Text>
                    <Text className="text-lg text-gray-500">
                        Welcome back!
                    </Text>
                </View>

                {/* User Info Section */}
                <View className="bg-gray-50 rounded-2xl p-6 mb-6">
                    <Text className="text-sm text-gray-500 mb-2">
                        Signed in as
                    </Text>
                    <Text className="text-xl font-semibold text-black mb-1">
                        {user?.displayName || 'User'}
                    </Text>
                    <Text className="text-base text-gray-600">
                        {user?.email || 'No email available'}
                    </Text>
                </View>

                {/* Content Area */}
                <View className="flex-1 justify-center items-center">
                    <Text className="text-6xl mb-4">👋</Text>
                    <Text className="text-2xl font-semibold text-black text-center mb-2">
                        You're all set!
                    </Text>
                    <Text className="text-base text-gray-500 text-center px-8">
                        Your dashboard is ready. Start exploring LinkUp!
                    </Text>
                </View>

                {/* Logout Button */}
                <View className="w-full">
                    <Pressable
                        onPress={handleLogout}
                        className="bg-black rounded-full py-4 px-6 active:opacity-80"
                    >
                        <Text className="text-white text-center text-lg font-semibold">
                            Logout
                        </Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}
