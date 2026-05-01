import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth/AuthContext';
import { AvailabilityPicker } from '@/components/AvailabilityPicker';
import AgeRangeSlider from '@/components/AgeRangeSlider';
import DistanceSlider from '@/components/DistanceSlider';
import { useAppStore } from '@/lib/store';

const EditRow = ({ label, value, onPress }: { label: string, value: string, onPress: () => void }) => (
    <TouchableOpacity
        onPress={onPress}
        className="py-5 border-b border-gray-100 flex-row items-center justify-between active:opacity-70"
    >
        <View className="flex-1">
            <Text className="text-black text-lg font-bold mb-1">{label}</Text>
            <Text className="text-gray-500 text-xl font-normal">{value || 'Add'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#000" />
    </TouchableOpacity>
);

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: () => void;
}

export default function FilterModal({ visible, onClose, onApply }: FilterModalProps) {
    const { user } = useAuthContext();
    const [selectedAvailability, setSelectedAvailability] = useState<number | null>(null);
    const [ageRange, setAgeRange] = useState({ low: 18, high: 45 });
    const [distance, setDistance] = useState(50);
    const [interestedIn, setInterestedIn] = useState<string[]>([]);
    const [filterByAvailability, setFilterByAvailability] = useState(false);
    const [isInterestedInModalVisible, setIsInterestedInModalVisible] = useState(false);
    const [savingFilters, setSavingFilters] = useState(false);
    
    const { userCaches, updateUserCache } = useAppStore();

    useEffect(() => {
        if (visible && user) {
            const cache = userCaches[user.id]?.filters;
            if (cache) {
                setAgeRange(cache.ageRange);
                setDistance(cache.distance);
                setInterestedIn(cache.interestedIn);
                setSelectedAvailability(cache.selectedAvailability);
                setFilterByAvailability(cache.filterByAvailability ?? false);
            }
            loadUserPreferences();
        }
    }, [visible, user]);

    const loadUserPreferences = async () => {
        if (!user) return;
        try {
            const [{ data: userData }, { data: profileData }, { data: filterData }] = await Promise.all([
                supabase.from('users').select('interestedIn').eq('id', user.id).single(),
                supabase.from('profiles').select('availableNext8Days').eq('userId', user.id).single(),
                supabase.from('filter_preferences').select('minAge, maxAge, maxDistanceKm, filterByAvailability').eq('userId', user.id).single(),
            ]);

            if (userData?.interestedIn?.length) setInterestedIn(userData.interestedIn);
            if (filterData) {
                setAgeRange({ low: filterData.minAge ?? 18, high: filterData.maxAge ?? 45 });
                setDistance(filterData.maxDistanceKm ?? 50);
                setFilterByAvailability(filterData.filterByAvailability ?? false);
            }
            if (profileData?.availableNext8Days?.length) {
                const idx = (profileData.availableNext8Days as boolean[]).findIndex(v => v === true);
                if (idx !== -1) setSelectedAvailability(idx);
            }

            // Update cache silently
            updateUserCache(user.id, {
                filters: {
                    ageRange: { low: filterData?.minAge ?? 18, high: filterData?.maxAge ?? 45 },
                    distance: filterData?.maxDistanceKm ?? 50,
                    interestedIn: userData?.interestedIn || [],
                    selectedAvailability: profileData?.availableNext8Days ? (profileData.availableNext8Days as boolean[]).findIndex(v => v === true) : null,
                    filterByAvailability: filterData?.filterByAvailability ?? false,
                }
            });
        } catch (e) {
            console.error('Error loading user preferences:', e);
        }
    };

    const applyFilters = async () => {
        if (!user) return;
        setSavingFilters(true);
        try {
            const availability = Array(8).fill(false);
            if (selectedAvailability !== null) availability[selectedAvailability] = true;

            await Promise.all([
                supabase.from('users').update({ interestedIn }).eq('id', user.id),
                supabase.from('profiles').update({ availableNext8Days: availability }).eq('userId', user.id),
                supabase.from('filter_preferences').upsert({
                    userId: user.id,
                    minAge: ageRange.low,
                    maxAge: ageRange.high,
                    maxDistanceKm: distance,
                    filterByAvailability: filterByAvailability,
                }),
            ]);
            
            // Update cache
            updateUserCache(user.id, {
                filters: {
                    ageRange,
                    distance,
                    interestedIn,
                    selectedAvailability,
                    filterByAvailability,
                },
                profiles: [] // Clear dashboard profiles cache on filter change so it fetches new ones
            });
            
            onApply();
        } catch (e) {
            console.error('Error saving filters:', e);
        } finally {
            setSavingFilters(false);
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
                    <TouchableOpacity
                        onPress={onClose}
                        className="p-1"
                    >
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-black">Filters</Text>
                    <View className="w-8" />
                </View>

                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 }}
                >
                    {/* Interested In */}
                    <View className="mb-4">
                        <EditRow
                            label="I'm interested in"
                            value={
                                interestedIn.length === 3 ? 'Everyone' :
                                    interestedIn.length === 0 ? 'Not set' :
                                        interestedIn.map(g => g === 'MALE' ? 'Men' : g === 'FEMALE' ? 'Women' : 'Non-binary').join(', ')
                            }
                            onPress={() => setIsInterestedInModalVisible(true)}
                        />
                    </View>

                    {/* Age Range */}
                    <View className="mb-8">
                        <Text className="text-base font-bold text-black mb-1">Age Range</Text>
                        <AgeRangeSlider
                            minAge={18}
                            maxAge={80}
                            initialLow={ageRange.low}
                            initialHigh={ageRange.high}
                            onValuesChange={(low, high) => setAgeRange({ low, high })}
                        />
                    </View>

                    {/* Distance */}
                    <View className="mb-8">
                        <Text className="text-base font-bold text-black mb-1">Distance</Text>
                        <DistanceSlider
                            minDist={1}
                            maxDist={155}
                            initialValue={distance}
                            onValueChange={setDistance}
                        />
                    </View>

                    {/* Available Date */}
                    <View className="mb-8">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-base font-bold text-black">Filter by Available Date</Text>
                            <Switch
                                value={filterByAvailability}
                                onValueChange={setFilterByAvailability}
                                trackColor={{ false: "#E5E7EB", true: "#000000" }}
                                thumbColor={"#FFFFFF"}
                                ios_backgroundColor="#E5E7EB"
                            />
                        </View>
                        {filterByAvailability && (
                            <>
                                <Text className="text-sm text-gray-500 mb-4">
                                    Showing only users available on your selected day.
                                </Text>
                                <AvailabilityPicker
                                    selectedDayIndex={selectedAvailability}
                                    onSelectDay={setSelectedAvailability}
                                />
                            </>
                        )}
                    </View>
                </ScrollView>

                {/* Apply Button */}
                <View className="px-5 pb-8 pt-3 border-t border-gray-100">
                    <TouchableOpacity
                        onPress={applyFilters}
                        disabled={savingFilters}
                        className="bg-black py-4 rounded-2xl items-center flex-row justify-center"
                    >
                        {savingFilters ? (
                            <ActivityIndicator color="white" className="mr-2" />
                        ) : null}
                        <Text className="text-white font-bold text-base">
                            {savingFilters ? 'Saving...' : 'Apply Filters'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Interested In Modal */}
                <Modal visible={isInterestedInModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsInterestedInModalVisible(false)}>
                    <View className="flex-1 justify-end bg-black/50">
                        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setIsInterestedInModalVisible(false)} />
                        <View className="bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl">
                            <View className="flex-row items-center justify-between mb-8">
                                <TouchableOpacity onPress={() => setIsInterestedInModalVisible(false)} className="p-2 -ml-2">
                                    <Ionicons name="arrow-back" size={24} color="black" />
                                </TouchableOpacity>
                                <Text className="text-2xl font-bold">Interested In</Text>
                                <View className="w-10" />
                            </View>

                            <View className="gap-y-4">
                                {(['MALE', 'FEMALE', 'OTHER'] as const).map((option) => {
                                    const isSelected = interestedIn.includes(option);
                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            onPress={() => {
                                                setInterestedIn(prev => prev.includes(option) ? prev.filter(p => p !== option) : [...prev, option]);
                                            }}
                                            className={`p-4 rounded-2xl border-2 ${isSelected ? 'bg-black border-black' : 'bg-gray-50 border-gray-100'} flex-row items-center justify-between`}
                                        >
                                            <Text className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-black'}`}>
                                                {option === 'MALE' ? 'Men' : option === 'FEMALE' ? 'Women' : 'Non-binary'}
                                            </Text>
                                            {isSelected && <Ionicons name="checkmark-circle" size={24} color="white" />}
                                        </TouchableOpacity>
                                    );
                                })}

                                <TouchableOpacity
                                    onPress={() => {
                                        if (interestedIn.length === 3) {
                                            setInterestedIn([]);
                                        } else {
                                            setInterestedIn(['MALE', 'FEMALE', 'OTHER']);
                                        }
                                    }}
                                    className={`p-4 rounded-2xl border-2 ${interestedIn.length === 3 ? 'bg-black border-black' : 'bg-gray-50 border-gray-100'} flex-row items-center justify-between`}
                                >
                                    <Text className={`text-lg font-bold ${interestedIn.length === 3 ? 'text-white' : 'text-black'}`}>
                                        Everyone
                                    </Text>
                                    {interestedIn.length === 3 && <Ionicons name="checkmark-circle" size={24} color="white" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </Modal>
    );
}
