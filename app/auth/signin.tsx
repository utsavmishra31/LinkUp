import OTPInput from '@/authFirebase/components/OTPInput';
import PhoneInput from '@/authFirebase/components/PhoneInput';
import SocialAuthButton from '@/authFirebase/components/SocialAuthButton';
import { useAuth } from '@/authFirebase/useAuth';
import { countries } from '@/constants/countries';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithPhone, verifyOTP, signInWithGoogle, signInWithApple } =
    useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState(countries[0]); // India
  const [verificationId, setVerificationId] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      Alert.alert(
        'Update Required',
        'Phone authentication is being updated. Please use Google or Apple Sign In.'
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(verificationId, otp);
      Alert.alert('Success', 'Signed in successfully!');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Header */}
      <View className="px-6 py-4">
        <TouchableOpacity
          onPress={() =>
            step === 'otp' ? setStep('phone') : router.back()
          }
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1 px-6">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-black mb-2">
            {step === 'phone' ? 'Sign in' : 'Enter OTP'}
          </Text>
          <Text className="text-gray-500 text-base">
            {step === 'phone'
              ? 'Choose your preferred sign-in method'
              : `We sent a code to ${phoneNumber}`}
          </Text>
        </View>

        {step === 'phone' ? (
          <>
            {/* Social Sign-In */}
            <View className="gap-3 mb-6">
              <SocialAuthButton
                provider="google"
                onPress={handleGoogleSignIn}
                disabled={loading}
              />
              {Platform.OS === 'ios' && (
                <SocialAuthButton
                  provider="apple"
                  onPress={handleAppleSignIn}
                  disabled={loading}
                />
              )}
            </View>

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-4 text-gray-400 text-sm">OR</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* Phone Input */}
            <PhoneInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              selectedCountry={country}
              onSelectCountry={setCountry}
            />

            {/* Continue */}
            <TouchableOpacity
              activeOpacity={0.8}
              className={`w-full py-4 rounded-full items-center mt-6 ${
                loading || !phoneNumber ? 'bg-gray-300' : 'bg-black'
              }`}
              onPress={handleSendOTP}
              disabled={loading || !phoneNumber}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-bold">
                  Continue
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* OTP Input */}
            <OTPInput value={otp} onChangeText={setOtp} length={6} />

            {/* Verify */}
            <TouchableOpacity
              activeOpacity={0.8}
              className={`w-full py-4 rounded-full items-center mt-6 ${
                loading || otp.length !== 6
                  ? 'bg-gray-300'
                  : 'bg-black'
              }`}
              onPress={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-bold">
                  Verify
                </Text>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <TouchableOpacity
              onPress={handleSendOTP}
              disabled={loading}
              className="mt-4 items-center"
            >
              <Text className="text-black text-base font-medium">
                Resend OTP
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
