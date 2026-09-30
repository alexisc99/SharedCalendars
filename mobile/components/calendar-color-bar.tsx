import React from "react";
import { View } from "./themed/view";

/**
 * Bande de couleur pleine largeur affichée en haut de l'écran quand un
 * calendrier précis est ouvert — rend la couleur du calendrier bien plus
 * visible qu'une simple teinte de texte d'en-tête.
 */
export function CalendarColorBar({ color }: { color: string }) {
  return <View style={{ height: 16, backgroundColor: color }} />;
}
