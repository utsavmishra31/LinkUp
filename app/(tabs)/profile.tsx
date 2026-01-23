import { useAuthContext } from '@/lib/auth/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
    const { profile } = useAuthContext();
    const primaryPhoto = profile?.photos?.find((p: any) => p.position === 0) || profile?.photos?.[0];
    const firstName = profile?.displayName?.split(' ')[0] || 'User';

    const getImageUrl = (path: string | null | undefined) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${path}`;
    };

    const imageUrl = getImageUrl(primaryPhoto?.imageUrl);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerLogo}>LinkUp</Text>
                <TouchableOpacity onPress={() => { /* TODO: Navigate to settings */ }}>
                    <Ionicons name="settings-outline" size={28} color="black" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.imageContainer}>
                    {imageUrl ? (
                        <Image
                            source={imageUrl}
                            style={styles.profileImage}
                            contentFit="cover"
                            transition={200}
                            priority="high"
                        />
                    ) : (
                        <View style={[styles.profileImage, styles.placeholderImage]} />
                    )}
                </View>
                <Text style={styles.name}>{firstName}</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    headerLogo: {
        fontSize: 24,
        fontWeight: '800', // Extra bold for logo
        color: '#000',
        fontFamily: 'System', // fall back to system font, ideally use app font
    },
    content: {
        alignItems: 'center',
        marginTop: 40,
    },
    imageContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f0f0f0',
    },
    placeholderImage: {
        backgroundColor: '#e1e1e1',
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        marginTop: 16,
        color: '#000',
    },
});
