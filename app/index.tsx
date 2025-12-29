import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />

            {/* Main Content Container */}
            <View className="flex-1 justify-between px-6 py-10">

                {/* Top Section: Logo & Branding */}
                <View className="flex-1 justify-center items-center ">
                    {/* Visual element or just text. Hinge uses a nice serif font. */}
                    <View className="items-center">
                        <Text className="text-6xl font-serif text-black tracking-tighter font-bold">
                            LinkUp
                        </Text>
                        <Text className="text-xl text-gray-500 font-medium mt-6 tracking-wide text-center">
                            Meet your match.
                        </Text>
                    </View>
                </View>

                {/* Bottom Section: Actions */}
                <View className="w-full gap-4 mb-8">
                    <TouchableOpacity
                        activeOpacity={0.8}
                        className="w-full bg-black py-4 rounded-full items-center shadow-sm"
                        onPress={() => {
                            router.push('/auth/signup');
                        }}
                    >
                        <Text className="text-white text-lg font-bold tracking-wide">
                            Create account
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        className="w-full bg-gray-100 py-4 rounded-full items-center"
                        onPress={() => {
                            router.push('/auth/signin');
                        }}
                    >
                        <Text className="text-black text-lg font-bold tracking-wide">
                            Sign in
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
