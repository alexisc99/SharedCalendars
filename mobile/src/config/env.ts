import { Platform } from "react-native";

// 1) Mets ici l'IP locale de ton PC si tu testes sur téléphone physique.
//const LAN_IP = "192.168.1.42"; // <-- à adapter

export const API_BASE_URL =
  'http://localhost:3000'    // iOS simulator (souvent OK)

// Si tu testes sur téléphone physique (iOS/Android), remplace par :
// export const API_BASE_URL = `http://${LAN_IP}:3000`;