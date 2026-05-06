import * as SecureStore from "expo-secure-store";

const KEY = "access_token";

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(KEY);
}