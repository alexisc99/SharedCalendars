import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { formatLeadTime } from "../src/lib/date";

const PRESETS: { minutesBefore: number; label: string }[] = [
  { minutesBefore: 10, label: "10 min avant" },
  { minutesBefore: 30, label: "30 min avant" },
  { minutesBefore: 60, label: "1 heure avant" },
  { minutesBefore: 1440, label: "1 jour avant" },
];
const PRESET_VALUES = new Set(PRESETS.map((p) => p.minutesBefore));

type Unit = "minutes" | "heures" | "jours";
const UNIT_MULTIPLIER: Record<Unit, number> = { minutes: 1, heures: 60, jours: 1440 };

type Props = {
  value: number[]; // liste de minutesBefore
  onChange: (next: number[]) => void;
  isPremium: boolean;
};

/**
 * Sélecteur de rappels : le backend refuse plus d'un rappel pour un compte
 * ni calendrier premium (Event.createEvent/updateEvent) — en gratuit, on
 * bascule donc automatiquement en sélection unique côté client plutôt que de
 * laisser l'utilisateur cocher plusieurs cases puis se prendre une erreur à
 * l'enregistrement.
 */
export function ReminderPicker({ value, onChange, isPremium }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<Unit>("minutes");

  // Un rappel déjà enregistré (ou ajouté via le champ personnalisé) qui ne
  // correspond à aucun préréglage doit quand même rester visible et
  // désélectionnable.
  const customValues = value.filter((m) => !PRESET_VALUES.has(m));

  function set(minutesBefore: number) {
    if (isPremium) {
      onChange([...value, minutesBefore].sort((a, b) => a - b));
    } else {
      onChange([minutesBefore]);
    }
  }

  function remove(minutesBefore: number) {
    onChange(value.filter((m) => m !== minutesBefore));
  }

  function toggle(minutesBefore: number) {
    if (value.includes(minutesBefore)) remove(minutesBefore);
    else set(minutesBefore);
  }

  function confirmCustom() {
    const amount = parseInt(customAmount, 10);
    if (!amount || amount <= 0) return;
    const minutesBefore = amount * UNIT_MULTIPLIER[customUnit];
    if (!value.includes(minutesBefore)) set(minutesBefore);
    setCustomAmount("");
    setShowCustom(false);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text>Rappels</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {PRESETS.map((p) => {
          const selected = value.includes(p.minutesBefore);
          return (
            <Pressable
              key={p.minutesBefore}
              onPress={() => toggle(p.minutesBefore)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: selected ? 2 : 1,
              }}
            >
              <Text>{p.label}</Text>
            </Pressable>
          );
        })}

        {customValues.map((minutesBefore) => (
          <Pressable
            key={minutesBefore}
            onPress={() => remove(minutesBefore)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 2,
            }}
          >
            <Text>{formatLeadTime(minutesBefore)} ✕</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => setShowCustom((v) => !v)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderStyle: "dashed",
          }}
        >
          <Text>+ Personnalisé</Text>
        </Pressable>
      </View>

      {showCustom ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <TextInput
            value={customAmount}
            onChangeText={(t) => setCustomAmount(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="ex: 45"
            style={{ borderWidth: 1, padding: 10, borderRadius: 8, width: 70 }}
          />
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["minutes", "heures", "jours"] as Unit[]).map((u) => (
              <Pressable
                key={u}
                onPress={() => setCustomUnit(u)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: customUnit === u ? 2 : 1,
                }}
              >
                <Text>{u}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={confirmCustom}
            style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 }}
          >
            <Text>Ajouter</Text>
          </Pressable>
        </View>
      ) : null}

      {!isPremium ? (
        <Text style={{ opacity: 0.6, fontSize: 12 }}>
          Un seul rappel en gratuit — passe en premium pour en cumuler plusieurs ✨
        </Text>
      ) : null}
    </View>
  );
}
