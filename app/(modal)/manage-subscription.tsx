import { useAuthContext } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TIERS = [null, 99, 199, 299, 399, 499];

export default function ManageSubscriptionModal() {
    const { profile } = useAuthContext();
    const router = useRouter();
    const [price, setPrice] = useState<number | null>(null);
    const [planId, setPlanId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!profile?.id) return;
        const fetchPlan = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('subscription_plans')
                .select('id, price')
                .eq('creatorId', profile.id)
                .single();
            
            if (data) {
                setPlanId(data.id);
                setPrice(data.price / 100); // convert paise to INR
            }
            setLoading(false);
        };
        fetchPlan();
    }, [profile?.id]);

    const handleSave = async () => {
        if (!profile?.id) return;
        setSaving(true);
        
        let error = null;
        if (price === null) {
            // Delete plan if exists
            if (planId) {
                const res = await supabase.from('subscription_plans').delete().eq('id', planId);
                error = res.error;
            }
        } else {
            // Upsert plan
            if (planId) {
                const res = await supabase
                    .from('subscription_plans')
                    .update({ price: price * 100 }) // save as paise
                    .eq('id', planId);
                error = res.error;
            } else {
                const res = await supabase
                    .from('subscription_plans')
                    .insert({ creatorId: profile.id, price: price * 100 });
                error = res.error;
            }
        }
            
        setSaving(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Success', 'Subscription updated');
            router.back();
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-5 py-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color="black" />
                </TouchableOpacity>
                <Text className="text-xl font-bold">Creator Subscription</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text className={`font-semibold text-lg ${saving ? 'text-gray-400' : 'text-blue-500'}`}>Save</Text>
                </TouchableOpacity>
            </View>

            <View className="p-5 flex-1">
                <Text className="text-2xl font-bold text-black mb-2">Set Your Price</Text>
                <Text className="text-gray-500 mb-6">
                    Allow your fans to subscribe to your exclusive photos and videos.
                </Text>

                <View className="gap-y-4">
                    {TIERS.map((tier, idx) => (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => setPrice(tier)}
                            className={`flex-row justify-between items-center p-4 rounded-2xl border ${price === tier ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                        >
                            <Text className={`text-lg font-bold ${price === tier ? 'text-blue-600' : 'text-black'}`}>
                                {tier === null ? 'Free (Disable Subscriptions)' : `₹${tier} / month`}
                            </Text>
                            {price === tier && <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />}
                        </TouchableOpacity>
                    ))}
                </View>

                {price !== null && (
                    <TouchableOpacity 
                        className="mt-8 bg-black rounded-3xl py-4 flex-row justify-center items-center"
                        onPress={() => Alert.alert('Coming Soon', 'Uploading exclusive media will be added soon!')}
                    >
                        <Ionicons name="cloud-upload" size={20} color="white" className="mr-2" />
                        <Text className="text-white font-bold text-lg">Upload Exclusive Media</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}
