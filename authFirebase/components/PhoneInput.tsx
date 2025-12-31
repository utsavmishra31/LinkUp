import { countries, Country } from '@/constants/countries';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardTypeOptions, Text, TextInput, TouchableOpacity, View } from 'react-native';
import CountrySelector from './CountrySelector';

interface PhoneInputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: KeyboardTypeOptions;
    selectedCountry?: Country;
    onSelectCountry?: (country: Country) => void;
}

export default function PhoneInput({
    value,
    onChangeText,
    placeholder = "Phone number",
    keyboardType = "phone-pad",
    selectedCountry = countries[0], // Default to India
    onSelectCountry
}: PhoneInputProps) {
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <View>
            <View className="flex-row items-center border-b border-gray-300 py-3 ml-2">
                {/* Country Selector Trigger */}
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="flex-row items-center mr-3"
                >
                    <Text className="text-2xl mr-2">{selectedCountry.flag}</Text>
                    <Text className="text-xl font-medium text-black">{selectedCountry.dial_code}</Text>
                    <Ionicons name="chevron-down" size={16} color="black" style={{ marginLeft: 4 }} />
                </TouchableOpacity>

                {/* Vertical Divider */}
                <View className="w-px h-6 bg-gray-300 mx-2" />

                {/* Phone Input */}
                <TextInput
                    className="flex-1 text-xl font-medium text-black"
                    style={{
                        paddingVertical: 5,
                        lineHeight: 20,
                        marginLeft: 10,
                    }}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType={keyboardType}
                    autoCapitalize="none"
                    selectionColor="black"
                />
            </View>

            {/* Country Selector Modal */}
            <CountrySelector
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSelect={(country) => {
                    if (onSelectCountry) {
                        onSelectCountry(country);
                    }
                }}
                selectedCountry={selectedCountry}
            />
        </View>
    );
}
