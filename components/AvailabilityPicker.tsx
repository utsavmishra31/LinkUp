import * as Haptics from 'expo-haptics';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

// Generate 8 days starting from today (today + next 7 days)
const getNext8Days = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 8; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        days.push({
            id: i,
            dayName: dayNames[date.getDay()],
            dayNumber: date.getDate(),
            month: monthNames[date.getMonth()],
            fullDate: date.toISOString().split('T')[0],
            isToday: i === 0,
        });
    }

    return days;
};

const DAYS = getNext8Days();

interface DayCardProps {
    day: typeof DAYS[0];
    isSelected: boolean;
    onPress: () => void;
}

const DayCard = ({ day, isSelected, onPress }: DayCardProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={`items-center justify-center py-3 rounded-2xl border-2 flex-1 h-32 ${isSelected
                ? 'bg-black border-black shadow-md shadow-black/30'
                : 'bg-white border-gray-200 shadow-sm shadow-black/5'
                }`}
        >
            <Text
                className={`text-xs font-semibold mb-1 ${isSelected ? 'text-white' : 'text-gray-500'
                    }`}
            >
                {day.dayName}
            </Text>
            <Text
                className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-black'
                    }`}
            >
                {day.dayNumber}
            </Text>
            <Text
                className={`text-xs font-medium mt-1 ${isSelected ? 'text-gray-400' : 'text-gray-400'
                    }`}
            >
                {day.month}
            </Text>
            {day.isToday && (
                <View className={`mt-1 px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100'
                    }`}>
                    <Text className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-black'
                        }`}>
                        Today
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

interface AvailabilityPickerProps {
    selectedDayIndex: number | null;
    onSelectDay: (index: number) => void;
}

export const AvailabilityPicker = ({ selectedDayIndex, onSelectDay }: AvailabilityPickerProps) => {
    const handleSelectDay = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Toggle selection logic should be handled by parent if needed, 
        // but typically the picker just reports the selection.
        // Based on original logic: "If clicking the same day, deselect it; otherwise select the new day"
        // We'll let the parent handle the toggling logic by passing the raw index.
        onSelectDay(index);
    };

    return (
        <View className="gap-3">
            {/* First row - 4 days */}
            <View className="flex-row gap-3">
                {DAYS.slice(0, 4).map((day, index) => (
                    <DayCard
                        key={day.id}
                        day={day}
                        isSelected={selectedDayIndex === index}
                        onPress={() => handleSelectDay(index)}
                    />
                ))}
            </View>

            {/* Second row - 4 days */}
            <View className="flex-row gap-3">
                {DAYS.slice(4, 8).map((day, index) => (
                    <DayCard
                        key={day.id}
                        day={day}
                        isSelected={selectedDayIndex === index + 4}
                        onPress={() => handleSelectDay(index + 4)}
                    />
                ))}
            </View>
        </View>
    );
};
