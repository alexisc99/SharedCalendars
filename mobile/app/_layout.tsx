import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack, usePathname } from "expo-router";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/lib/session";
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();


function AuthGate() {
  const { isBootstrapping, me } = useSession();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // routes publiques
  const isPublicRoute = pathname === "/login" || pathname === "/signup";

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { paddingTop: insets.top, paddingBottom: insets.bottom },
      }}
    >
      {/* Le groupe (tabs) gère ses propres marges (barre d'onglets + sceneContainerStyle) */}
      <Stack.Screen
        name="(tabs)"
        options={{ contentStyle: { paddingTop: 0, paddingBottom: 0 } }}
      />
    </Stack>
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
