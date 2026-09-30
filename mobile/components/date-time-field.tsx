import React, { useState } from "react";
import { Platform } from "react-native";
import { Text } from "./themed/text";
import { View } from "./themed/view";
import { Pressable } from "./themed/pressable";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatDateTime } from "../src/lib/date";

type Props = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  disabled?: boolean;
};

export function DateTimeField({ label, value, onChange, minimumDate, disabled }: Props) {
  const [iosPickerVisible, setIosPickerVisible] = useState(false);

  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      minimumDate,
      onChange: (dateEvent: DateTimePickerEvent, pickedDate?: Date) => {
        if (dateEvent.type !== "set" || !pickedDate) return;

        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent: DateTimePickerEvent, pickedTime?: Date) => {
            if (timeEvent.type !== "set" || !pickedTime) return;
            const merged = new Date(pickedDate);
            merged.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
            onChange(merged);
          },
        });
      },
    });
  }

  function openPicker() {
    if (disabled) return;
    if (Platform.OS === "android") {
      openAndroidPicker();
    } else {
      setIosPickerVisible(true);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text>{label}</Text>
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        style={{
          borderWidth: 1,
          padding: 10,
          borderRadius: 10,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text>{formatDateTime(value)}</Text>
      </Pressable>

      {Platform.OS === "ios" && iosPickerVisible && !disabled ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="spinner"
          minimumDate={minimumDate}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            setIosPickerVisible(false);
            if (event.type === "set" && selected) {
              onChange(selected);
            }
          }}
        />
      ) : null}
    </View>
  );
}
