import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

// Generate 8 days starting from today (today + next 7 days)
export const getNext8Days = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 8; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dayStr = String(date.getDate()).padStart(2, '0');

        days.push({
            id: i,
            dayName: dayNames[date.getDay()],
            dayNumber: date.getDate(),
            month: monthNames[date.getMonth()],
            fullDate: `${year}-${month}-${dayStr}`, // Local "YYYY-MM-DD"
            isToday: i === 0,
        });
    }

    return days;
};

// Today's ISO date string
export const getTodayDateString = (): string => getNext8Days()[0].fullDate;

// Given a stored ISO date string, find its index in current DAYS window.
// Returns -1 if not found (date has passed or is in the future beyond window).
export const findDateIndex = (dateStr: string | null): number => {
    if (!dateStr) return -1;
    return getNext8Days().findIndex(d => d.fullDate === dateStr);
};

interface DayCardProps {
    day: ReturnType<typeof getNext8Days>[0];
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
    /** ISO date string e.g. "2026-05-06", or null */
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
}

export const AvailabilityPicker = ({ selectedDate, onSelectDate }: AvailabilityPickerProps) => {

    const days = React.useMemo(() => getNext8Days(), []);

    // Auto-fallback: if saved date is no longer in the 8-day window,
    // automatically select today so the user always has a valid selection.
    useEffect(() => {
        if (selectedDate !== null) {
            const idx = findDateIndex(selectedDate);
            if (idx === -1) {
                // Saved date has passed — auto-select today
                onSelectDate(days[0].fullDate);
            }
        }
    }, [selectedDate, onSelectDate, days]);

    const handleSelectDay = (date: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectDate(date);
    };

    return (
        <View className="gap-3">
            {/* First row - 4 days */}
            <View className="flex-row gap-3">
                {days.slice(0, 4).map((day) => (
                    <DayCard
                        key={day.id}
                        day={day}
                        isSelected={selectedDate === day.fullDate}
                        onPress={() => handleSelectDay(day.fullDate)}
                    />
                ))}
            </View>

            {/* Second row - 4 days */}
            <View className="flex-row gap-3">
                {days.slice(4, 8).map((day) => (
                    <DayCard
                        key={day.id}
                        day={day}
                        isSelected={selectedDate === day.fullDate}
                        onPress={() => handleSelectDay(day.fullDate)}
                    />
                ))}
            </View>
        </View>
    );
};
