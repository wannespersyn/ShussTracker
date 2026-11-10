/**
 * PhotoButton
 *
 * Adds or replaces a game's mat photo: camera or library, downscaled on the
 * device to max 1600 px JPEG (the API takes up to 4 MB), then uploaded.
 *
 * Data: POST /api/v1/games/{id}/photo (multipart)
 */
import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ApiError, upload } from "@/api/client";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui";

const MAX_SIDE = 1600;

export function PhotoButton({ gameId, hasPhoto, onUploaded }: { gameId: string; hasPhoto: boolean; onUploaded: (photoPath: string | null) => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  async function pick(source: "camera" | "library") {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;

    setBusy(true);
    try {
      const ctx = ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > MAX_SIDE) ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
      const image = await ctx.renderAsync();
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });

      const form = new FormData();
      // React Native's FormData takes a { uri, name, type } file descriptor.
      form.append("photo", { uri: saved.uri, name: "mat.jpg", type: "image/jpeg" } as unknown as Blob);
      const out = await upload<{ photoPath: string | null }>(`/games/${gameId}/photo`, form);
      onUploaded(out.photoPath);
    } catch (e) {
      Alert.alert(e instanceof ApiError ? (e.status === 0 ? t.app.offline : e.message) : t.errors.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  function choose() {
    Alert.alert(hasPhoto ? t.game.changePhoto : t.game.addPhoto, undefined, [
      { text: t.app.takePhoto, onPress: () => void pick("camera") },
      { text: t.app.choosePhoto, onPress: () => void pick("library") },
      { text: t.game.cancel, style: "cancel" },
    ]);
  }

  return <Button label={busy ? t.app.uploading : hasPhoto ? t.game.changePhoto : t.game.addPhoto} kind="outline" loading={busy} onPress={choose} />;
}
