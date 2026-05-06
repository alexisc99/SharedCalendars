import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSession } from "../../src/lib/session";


export default function TabHome() {
  const { me, logout } = useSession();

  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 18 }}>
        Bonjour {me?.user?.name ?? "—"}
      </Text>
      <Text>Google connecté: {me?.integrations.googleConnected ? "Oui" : "Non"}</Text>
      <Text>Notifications non lues: {me?.notifications.unreadCount ?? 0}</Text>

      <Pressable
        onPress={() => logout()}
        style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
      >
        <Text>Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
