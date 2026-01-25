import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LocationPermission() {
    const [isLoading, setIsLoading] = useState(false);
    // locationProcessing means we are in the process of finalizing/getting location after permission confirmed
    const [locationProcessing, setLocationProcessing] = useState(false);
    const [hasExistingPermission, setHasExistingPermission] = useState(false);

    const { user, refreshProfile } = useAuth();
    const router = useRouter();

    useEffect(() => {
        checkPermission();
    }, []);

    const checkPermission = async () => {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
                setHasExistingPermission(true);
            }
        } catch (error) {
            console.error('Error checking permission:', error);
        }
    };

    const finalizeOnboarding = async () => {
        if (!user) return;

        try {
            setLocationProcessing(true);

            // Get current location (get fresh coords)
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            // Save location to database using RPC function
            const { error } = await supabase.rpc('set_profile_location', {
                uid: user.id,
                lat: latitude,
                lng: longitude,
            });

            if (error) throw error;

            // Mark onboarding as completed
            const { error: updateError } = await supabase
                .from('users')
                .update({ onboardingCompleted: true })
                .eq('id', user.id);

            if (updateError) {
                console.error('Error updating onboarding status:', updateError);
            }

            await refreshProfile();

            // Navigate to Dashboard (Tabs)
            router.replace('/(tabs)');

        } catch (error) {
            console.error('Error finalizing location:', error);
            Alert.alert('Error', 'Failed to save your location. Please try again.');
            setLocationProcessing(false);
            setIsLoading(false);
        }
    };

    const requestLocationPermission = async () => {
        try {
            setIsLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Request location permission - this will show the native popup
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Location permission is required to find people near you. Please enable it in your device settings.',
                    [{ text: 'OK' }]
                );
                setIsLoading(false);
                return;
            }

            // Permission granted, proceed to finalize
            await finalizeOnboarding();

        } catch (error) {
            console.error('Error requesting location:', error);
            Alert.alert('Error', 'Failed to get your location. Please try again.');
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        Alert.alert(
            'Skip Location',
            'You can enable location later in settings. You will now proceed to finish onboarding.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Skip',
                    style: 'destructive',
                    onPress: async () => {
                        if (user) {
                            // Mark onboarding as completed
                            const { error: updateError } = await supabase
                                .from('users')
                                .update({ onboardingCompleted: true })
                                .eq('id', user.id);

                            if (updateError) {
                                console.error('Error updating onboarding status:', updateError);
                            }

                            await refreshProfile();
                            router.replace('/components/dashboard');
                        }
                    },
                },
            ]
        );
    };

    const handleStartJourney = async () => {
        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await finalizeOnboarding();
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">
                        {hasExistingPermission ? 'All Set!' : 'Enable Location'}
                    </Text>
                    <Text className="text-base text-gray-600">
                        {hasExistingPermission
                            ? 'You are ready to start meeting people.'
                            : 'Help us find people near you for better matches'}
                    </Text>
                </View>

                {/* Location Icon Illustration */}
                <View className="items-center justify-center flex-1">
                    <View
                        className="w-40 h-40 rounded-full bg-gray-100 items-center justify-center mb-8 shadow-lg shadow-[#9333ea]"
                    >
                        {
                            hasExistingPermission ? (
                                <Ionicons name="rocket" size={80} color="#000000" />
                            ) : (
                                <Ionicons name="location" size={80} color="#000000" />
                            )}
                    </View>

                    {/* Benefits List */}
                    <View className="w-full space-y-4">
                        <View className="flex-row items-start">
                            <View className="w-8 h-8 rounded-full bg-black items-center justify-center mr-3 mt-0.5">
                                <Ionicons name="people" size={16} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-base font-semibold text-black mb-1">
                                    Find nearby matches
                                </Text>
                                <Text className="text-sm text-gray-600">
                                    Discover people in your area who share your interests
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row items-start">
                            <View className="w-8 h-8 rounded-full bg-black items-center justify-center mr-3 mt-0.5">
                                <Ionicons name="shield-checkmark" size={16} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-base font-semibold text-black mb-1">
                                    Your privacy matters
                                </Text>
                                <Text className="text-sm text-gray-600">
                                    Your exact location is never shared with others
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row items-start">
                            <View className="w-8 h-8 rounded-full bg-black items-center justify-center mr-3 mt-0.5">
                                <Ionicons name="compass" size={16} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-base font-semibold text-black mb-1">
                                    Better recommendations
                                </Text>
                                <Text className="text-sm text-gray-600">
                                    Get personalized suggestions based on your location
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Action Button */}
                <View className="pb-8">
                    {!locationProcessing ? (
                        <>
                            {hasExistingPermission ? (
                                <TouchableOpacity
                                    onPress={handleStartJourney}
                                    disabled={isLoading}
                                    activeOpacity={0.8}
                                    className="bg-black rounded-full py-4 items-center justify-center shadow-lg shadow-black"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <View className="flex-row items-center">
                                            <Text className="text-white text-lg font-bold mr-2">
                                                Start your journey
                                            </Text>
                                            <Ionicons name="arrow-forward" size={20} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={requestLocationPermission}
                                    disabled={isLoading}
                                    activeOpacity={0.8}
                                    className="bg-black rounded-full py-4 items-center justify-center shadow-lg shadow-black"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <View className="flex-row items-center">
                                            <Ionicons name="location-sharp" size={20} color="white" />
                                            <Text className="text-white text-lg font-bold ml-2">
                                                Enable Location Access
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <View className="items-center">
                            <ActivityIndicator size="large" color="#000000" />
                            <Text className="text-gray-600 mt-4">Setting up your profile...</Text>
                        </View>
                    )}

                    {/* Skip option - Only show if permission not already granted and not processing */}
                    {!isLoading && !locationProcessing && !hasExistingPermission && (
                        <TouchableOpacity
                            onPress={handleSkip}
                            className="mt-4 py-3 items-center"
                        >
                            <Text className="text-gray-500 text-base">Skip for now</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}
