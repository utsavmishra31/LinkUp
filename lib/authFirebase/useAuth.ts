import { auth } from '@/lib/authFirebase/firebase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import {
    ApplicationVerifier,
    GoogleAuthProvider,
    OAuthProvider,
    PhoneAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    signInWithCredential,
    signInWithPhoneNumber,
    type User
} from 'firebase/auth';
import { useEffect, useState } from 'react';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        GoogleSignin.configure({
            webClientId: '309673756634-i52dg8q0cr2e80b0i5vk91rf72rhqchm.apps.googleusercontent.com', // From google-services.json
        });

        return unsubscribe;
    }, []);

    const signInWithPhone = async (phoneNumber: string, appVerifier: ApplicationVerifier, countryCode: string) => {
        try {
            // Format phone number: remove spaces/dashes, ensure it starts with +countryCode
            const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
            const fullPhoneNumber = countryCode + cleanPhone;

            const confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, appVerifier);
            return confirmationResult.verificationId;
        } catch (error: any) {
            console.error('Phone Sign In Error:', error);
            throw error;
        }
    };

    const verifyOTP = async (verificationId: string, smsCode: string) => {
        try {
            const credential = PhoneAuthProvider.credential(
                verificationId,
                smsCode
            );
            return await signInWithCredential(auth, credential);
        } catch (error: any) {
            console.error('Verify OTP Error:', error);
            throw error;
        }
    };

    const signInWithGoogle = async () => {
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.idToken;
            if (!idToken) {
                throw new Error('No ID token found');
            }
            const googleCredential = GoogleAuthProvider.credential(idToken);
            return await signInWithCredential(auth, googleCredential);
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // User cancelled the login flow - return null instead of throwing
                return null;
            } else if (error.code === statusCodes.IN_PROGRESS) {
                // Operation is already in progress
                return null;
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                // Play services not available or outdated
                throw new Error('Play services not available');
            } else {
                // Some other error happened
                console.error('Google Sign In Error:', error);
                throw error;
            }
        }
    };

    const signInWithApple = async () => {
        try {
            // Check if Apple Authentication is available
            const isAvailable = await AppleAuthentication.isAvailableAsync();
            if (!isAvailable) {
                throw new Error('Apple Sign-In is not available on this device');
            }

            // Generate a random nonce
            const rawNonce = Math.random().toString(36).substring(2, 10);

            // Hash the nonce using SHA-256
            const hashedNonce = await digestStringAsync(
                CryptoDigestAlgorithm.SHA256,
                rawNonce
            );

            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                nonce: hashedNonce,
            });

            const { identityToken } = credential;
            if (!identityToken) {
                throw new Error('Apple Sign-In failed - no identity token returned');
            }

            // Create Firebase credential with the raw nonce
            const provider = new OAuthProvider('apple.com');
            const oAuthCredential = provider.credential({
                idToken: identityToken,
                rawNonce: rawNonce, // Pass the unhashed nonce to Firebase
            });

            return await signInWithCredential(auth, oAuthCredential);
        } catch (error: any) {
            if (error.code === 'ERR_CANCELED' || error.code === 'ERR_CANCELLED') {
                // User cancelled the login flow - return null instead of throwing
                return null;
            }
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            await GoogleSignin.signOut();
        } catch (error) {
            console.error('Sign Out Error:', error);
        }
    };

    return {
        user,
        loading,
        signInWithPhone,
        verifyOTP,
        signInWithGoogle,
        signInWithApple,
        signOut
    };
}
