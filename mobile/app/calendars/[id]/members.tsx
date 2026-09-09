import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../../../src/lib/api";
import { useSession } from "../../../src/lib/session";
import { colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";
import { Avatar } from "../../../components/avatar";

type MemberRole = "owner" | "admin" | "editor" | "viewer" | "member";

type MemberItem = {
  id: string;
  role: MemberRole;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

const ROLES: MemberRole[] = ["owner", "admin", "editor", "viewer", "member"];

export default function CalendarMembersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const nameRaw = params.name;
  const calendarName = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
  const themeRaw = params.theme;
  const calendarTheme = Array.isArray(themeRaw) ? themeRaw[0] : themeRaw;
  const calendarColor = colorForTheme(calendarTheme);

  const insets = useSafeAreaInsets();
  const { me } = useSession();

  const [items, setItems] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function load() {
    if (!calendarId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.get<MemberItem[]>(
        `/calendars/${calendarId}/members`,
      );
      setItems(res);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [calendarId]);

  const myRole = items.find((m) => m.user.id === me?.user.id)?.role ?? null;
  const canManage = myRole === "owner" || myRole === "admin";

  async function changeRole(target: MemberItem, role: MemberRole) {
    if (!calendarId) return;

    const doIt = async () => {
      setBusyUserId(target.user.id);
      try {
        await api.patch(
          `/calendars/${calendarId}/members/${target.user.id}`,
          { role },
        );
        await load();
      } catch (e: any) {
        Alert.alert(
          "Erreur",
          e instanceof ApiError ? e.message : "Erreur inconnue",
        );
      } finally {
        setBusyUserId(null);
      }
    };

    if (role === "owner") {
      Alert.alert(
        "Transférer la propriété",
        `Faire de ${target.user.name ?? target.user.email} le nouveau propriétaire ? Tu perdras ton rôle de propriétaire.`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Confirmer", style: "destructive", onPress: doIt },
        ],
      );
    } else {
      doIt();
    }
  }

  function removeMember(target: MemberItem) {
    if (!calendarId) return;
    const isSelf = target.user.id === me?.user.id;

    Alert.alert(
      isSelf ? "Quitter le calendrier" : "Retirer ce membre",
      isSelf
        ? "Confirmer que tu veux quitter ce calendrier ?"
        : `Retirer ${target.user.name ?? target.user.email} de ce calendrier ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: isSelf ? "Quitter" : "Retirer",
          style: "destructive",
          onPress: async () => {
            setBusyUserId(target.user.id);
            try {
              await api.del(
                `/calendars/${calendarId}/members/${target.user.id}`,
              );
              if (isSelf) {
                router.replace("/(tabs)/calendars");
              } else {
                await load();
              }
            } catch (e: any) {
              Alert.alert(
                "Erreur",
                e instanceof ApiError ? e.message : "Erreur inconnue",
              );
              setBusyUserId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendarName ? `${calendarName} · Membres` : "Membres",
          headerShown: true,
          headerTintColor: calendarColor || undefined,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />
      <CalendarColorBar color={calendarColor} />

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={load}
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
            }}
          >
            <Text>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 10 }}
          data={items}
          keyExtractor={(m) => m.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => {
            const isSelf = item.user.id === me?.user.id;
            const isBusy = busyUserId === item.user.id;
            const canEditThisMember =
              canManage && !(item.role === "owner" && myRole !== "owner");
            const availableRoles = ROLES.filter(
              (r) => r !== item.role && (r !== "owner" || myRole === "owner"),
            );

            return (
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  gap: 8,
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar uri={item.user.avatarUrl} name={item.user.name ?? item.user.email} size={36} />
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>
                    {item.user.name || item.user.email}
                    {isSelf ? " (toi)" : ""}
                  </Text>
                </View>
                <Text style={{ opacity: 0.7 }}>{item.user.email}</Text>
                <Text>Rôle : {item.role}</Text>

                {canEditThisMember && !isBusy && availableRoles.length > 0 ? (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    {availableRoles.map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => changeRole(item, r)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                        }}
                      >
                        <Text style={{ fontSize: 12 }}>→ {r}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {(canEditThisMember || isSelf) && !isBusy ? (
                  <Pressable
                    onPress={() => removeMember(item)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <Text>{isSelf ? "Quitter" : "Retirer"}</Text>
                  </Pressable>
                ) : null}

                {isBusy ? <ActivityIndicator /> : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
