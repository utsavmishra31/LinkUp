import OTPInput from '@/authFirebase/components/OTPInput';
import PhoneInput from '@/authFirebase/components/PhoneInput';
import { app } from '@/authFirebase/firebase';
import { useAuth } from '@/authFirebase/useAuth';
import { countries } from '@/constants/countries';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUpScreen() {
    const router = useRouter();
    const { signInWithPhone, verifyOTP } = useAuth();
    const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

    const [phoneNumber, setPhoneNumber] = useState('');
    const [country, setCountry] = useState(countries[0]); // Default to India
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
            if (!recaptchaVerifier.current) {
                throw new Error('Recaptcha not initialized');
            }
            const verificationId = await signInWithPhone(phoneNumber, recaptchaVerifier.current, country.dial_code);
            setVerificationId(verificationId);
            setStep('otp');
            Alert.alert('Success', 'OTP sent to your phone number');
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
            Alert.alert('Success', 'Account created successfully!');
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />
            <FirebaseRecaptchaVerifierModal
                ref={recaptchaVerifier}
                firebaseConfig={app.options}
                attemptInvisibleVerification
            />

            {/* Header */}
            <View className="px-6 py-4">
                <TouchableOpacity
                    onPress={() => step === 'otp' ? setStep('phone') : router.back()}
                    className="w-10 h-10 items-center justify-center"
                >
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="flex-1 px-6 mt-8">
                <View className="mb-8 ml-2">
                    <Text className="text-3xl font-bold text-black mb-2">
                        {step === 'phone' ? 'Create account' : 'Enter OTP'}
                    </Text>
                    <Text className="text-gray-500 text-base">
                        {step === 'phone'
                            ? 'Enter your phone number to get started'
                            : `We sent a code to ${phoneNumber}`}
                    </Text>
                </View>

                {step === 'phone' ? (
                    <>
                        {/* Phone Input */}
                        <PhoneInput
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            placeholder="Phone number"
                            selectedCountry={country}
                            onSelectCountry={setCountry}
                        />

                        {/* Continue Button */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            className={`w-full py-4 rounded-full items-center mt-10 ${loading || !phoneNumber ? 'bg-gray-300' : 'bg-black'
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

                        {/* Terms */}
                        <Text className="text-gray-400 text-sm text-center mt-6">
                            By continuing, you agree to our{' '}
                            <Text className="text-black font-medium">Terms of Service</Text>
                            {' '}and{' '}
                            <Text className="text-black font-medium">Privacy Policy.</Text>
                        </Text>
                    </>
                ) : (
                    <>
                        {/* OTP Input */}
                        <OTPInput
                            value={otp}
                            onChangeText={setOtp}
                            length={6}
                        />

                        {/* Verify Button */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            className={`w-full py-4 rounded-full items-center mt-6 ${loading || otp.length !== 6 ? 'bg-gray-300' : 'bg-black'
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

                        {/* Resend OTP */}
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
