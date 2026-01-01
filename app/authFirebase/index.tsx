import SocialAuthButton from '@/app/authFirebase/components/SocialAuthButton';
import { useAuth } from '@/app/authFirebase/useAuth';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen() {
    const router = useRouter();
    const { signInWithGoogle, signInWithApple } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            await signInWithGoogle();
            Alert.alert('Success', 'Signed in with Google!');
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.message || 'Failed to sign in with Google'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        setLoading(true);
        try {
            await signInWithApple();
            Alert.alert('Success', 'Signed in with Apple!');
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.message || 'Failed to sign in with Apple'
            );
        } finally {
            setLoading(false);
        }
    };

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
                <View className="w-[80%] gap-4 self-center mb-8">
                    {Platform.OS === 'ios' && (
                        <SocialAuthButton
                            provider="apple"
                            onPress={handleAppleSignIn}
                            disabled={loading}
                        />
                    )}
                    <SocialAuthButton
                        provider="google"
                        onPress={handleGoogleSignIn}
                        disabled={loading}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
