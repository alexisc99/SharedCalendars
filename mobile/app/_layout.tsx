import React, { useEffect } from "react";
import { ActivityIndicator, useColorScheme } from "react-native";
import { View } from "../components/themed/view";
import { Redirect, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import { SessionProvider, useSession } from "../src/lib/session";
import { Colors } from "../constants/theme";
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();


function AuthGate() {
  const { isBootstrapping, me } = useSession();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? "light";
  const background = Colors[scheme].background;

  // La couleur de fond de la "root view" native reste blanche par défaut tant
  // qu'on ne la fixe pas explicitement : c'est elle qui apparaît furtivement
  // (flash blanc) pendant les transitions de navigation (surtout au retour
  // en arrière), car le contenu React est peint par-dessus après coup.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(background);
  }, [background]);

  // routes publiques
  const isPublicRoute = pathname === "/login" || pathname === "/signup";

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: background }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Redirections déclaratives (<Redirect>) plutôt que des router.replace()
  // impératifs dans un useEffect : des replace() dispatchés en rafale lors
  // d'un cycle déconnexion → reconnexion pouvaient faire dérailler l'état
  // interne du navigateur (route introuvable jusqu'au redémarrage complet).
  if (!me && !isPublicRoute) {
    return <Redirect href="/login" />;
  }

  if (me && isPublicRoute) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: background },
          headerStyle: { backgroundColor: background },
          headerTintColor: Colors[scheme].text,
        }}
      >
        {/* Le groupe (tabs) gère ses propres marges (barre d'onglets + sceneContainerStyle) */}
        <Stack.Screen
          name="(tabs)"
          options={{ contentStyle: { paddingTop: 0, paddingBottom: 0, backgroundColor: background } }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <AuthGate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
