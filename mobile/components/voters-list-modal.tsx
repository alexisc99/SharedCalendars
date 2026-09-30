import React from "react";
import { FlatList, Modal, useColorScheme } from "react-native";
import { Text } from "./themed/text";
import { View } from "./themed/view";
import { Pressable } from "./themed/pressable";
import { Avatar } from "./avatar";
import { RSVP_LABELS, RsvpStatus } from "../src/lib/rsvp";
import { Colors } from "../constants/theme";

type Voter = { userId: string; name: string; avatarUrl: string | null; isPremium: boolean };

type Props = {
  status: RsvpStatus | null;
  color: string;
  voters: Voter[];
  onClose: () => void;
};

/**
 * Liste des votants pour un statut de présence donné, ouverte par un appui
 * long sur le bouton YES/MAYBE/NO — évite d'afficher tous les noms en
 * permanence sur l'écran, illisible dès que le calendrier a beaucoup de
 * membres.
 */
export function VotersListModal({ status, color, voters, onClose }: Props) {
  const scheme = useColorScheme() ?? "light";
  if (!status) return null;

  return (
    <Modal visible={!!status} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: Colors[scheme].background,
            borderRadius: 14,
            padding: 16,
            maxHeight: "70%",
          }}
        >
          <Text style={{ fontWeight: "700", fontSize: 16, color, marginBottom: 4 }}>
            {RSVP_LABELS[status]}
          </Text>
          <Text style={{ opacity: 0.6, fontSize: 12, marginBottom: 10 }}>
            {voters.length} personne{voters.length > 1 ? "s" : ""}
          </Text>

          {voters.length > 0 ? (
            <FlatList
              data={voters}
              keyExtractor={(v) => v.userId}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: Colors[scheme].border }} />
              )}
              renderItem={({ item }) => (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                  <Avatar uri={item.avatarUrl} name={item.name} size={28} isPremium={item.isPremium} />
                  <Text>{item.name}</Text>
                </View>
              )}
            />
          ) : (
            <Text style={{ opacity: 0.6 }}>Personne pour l'instant</Text>
          )}

          <Pressable
            onPress={onClose}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
            }}
          >
            <Text>Fermer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
