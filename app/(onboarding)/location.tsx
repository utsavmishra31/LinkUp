import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
    const [locationGranted, setLocationGranted] = useState(false);
    const { user, refreshProfile } = useAuth();
    const router = useRouter();

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

            // Permission granted, get current location
            setLocationGranted(true);
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            // Save location to database using RPC function
            if (user) {
                const { error } = await supabase.rpc('set_profile_location', {
                    uid: user.id,
                    lat: latitude,
                    lng: longitude,
                });

                if (error) {
                    console.error('Error saving location:', error);
                    Alert.alert('Error', 'Failed to save your location. Please try again.');
                    setIsLoading(false);
                    return;
                }

                await refreshProfile();

                // Navigate to photos upload
                router.push('/(onboarding)/photos');
            }
        } catch (error) {
            console.error('Error requesting location:', error);
            Alert.alert('Error', 'Failed to get your location. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-12">
                {/* Header */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-black mb-2">
                        Enable Location
                    </Text>
                    <Text className="text-base text-gray-600">
                        Help us find people near you for better matches
                    </Text>
                </View>

                {/* Location Icon Illustration */}
                <View className="items-center justify-center flex-1">
                    <View
                        className="w-40 h-40 rounded-full bg-purple-100 items-center justify-center mb-8"
                        style={{
                            shadowColor: '#9333ea',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            elevation: 5,
                        }}
                    >
                        <Ionicons name="location" size={80} color="#9333ea" />
                    </View>

                    {/* Benefits List */}
                    <View className="w-full space-y-4">
                        <View className="flex-row items-start">
                            <View className="w-8 h-8 rounded-full bg-purple-500 items-center justify-center mr-3 mt-0.5">
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
                            <View className="w-8 h-8 rounded-full bg-purple-500 items-center justify-center mr-3 mt-0.5">
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
                            <View className="w-8 h-8 rounded-full bg-purple-500 items-center justify-center mr-3 mt-0.5">
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
                    {!locationGranted ? (
                        <TouchableOpacity
                            onPress={requestLocationPermission}
                            disabled={isLoading}
                            activeOpacity={0.8}
                            className="bg-purple-500 rounded-full py-4 items-center justify-center"
                            style={{
                                shadowColor: '#9333ea',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 5,
                            }}
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
                    ) : (
                        <View className="items-center">
                            <ActivityIndicator size="large" color="#9333ea" />
                            <Text className="text-gray-600 mt-4">Setting up your profile...</Text>
                        </View>
                    )}

                    {/* Skip option */}
                    {!isLoading && !locationGranted && (
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    'Skip Location',
                                    'You can enable location later in settings. You will now proceed to add your photos.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Skip',
                                            style: 'destructive',
                                            onPress: async () => {
                                                if (user) {
                                                    await refreshProfile();
                                                    router.push('/(onboarding)/photos');
                                                }
                                            },
                                        },
                                    ]
                                );
                            }}
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
