import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { SessionProvider, useSession } from "../src/lib/session";
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();


function AuthGate() {
  const { isBootstrapping, me } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // routes publiques
  const isPublicRoute = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (isBootstrapping) return;

    if (!me && !isPublicRoute) {
      router.replace("/login");
    }

    if (me && isPublicRoute) {
      router.replace("/(tabs)");
    }
  }, [isBootstrapping, me, isPublicRoute, router]);

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <AuthGate />
    </SessionProvider>
  );
}
