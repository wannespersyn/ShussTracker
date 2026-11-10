/**
 * CrewSetup
 *
 * Join a crew with an invite code or start a new one — what a new user sees
 * before they're in any crew, and what "Join or start another crew" opens.
 * Below it, a guest can claim the games they played before signing up.
 * On success the user's crew list is reloaded and the new crew selected.
 *
 * Data: POST /api/v1/crews/join, POST /api/v1/crews, POST /api/v1/claim
 */
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { useT } from "@/lib/i18n";
import { Button, Card, Kicker, Segmented, Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

export function CrewSetup({ onDone }: { onDone?: (crewId: string) => void }) {
  const { t } = useT();
  const { refreshMe } = useAuth();
  const { setCrewId, invalidate } = useCrew();
  const [mode, setMode] = useState<"join" | "new">("join");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [busy, setBusy] = useState<"crew" | "claim" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const message = (e: unknown) => (e instanceof ApiError ? (e.status === 0 ? t.app.offline : e.message) : String(e));

  async function done(crewId: string) {
    await refreshMe();
    setCrewId(crewId);
    invalidate();
    onDone?.(crewId);
  }

  async function submit() {
    setBusy("crew");
    setError(null);
    try {
      const res =
        mode === "join"
          ? await api<{ crewId: string }>("/crews/join", { method: "POST", body: { code: code.trim().toUpperCase() } })
          : await api<{ crewId: string }>("/crews", { method: "POST", body: { name: name.trim() } });
      await done(res.crewId);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    setBusy("claim");
    setClaimError(null);
    try {
      await api("/claim", { method: "POST", body: { code: claimCode.trim().toUpperCase() } });
      await refreshMe();
      invalidate();
      setClaimCode("");
    } catch (e) {
      setClaimError(message(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Kicker>{t.join.kicker}</Kicker>
        <Txt v="display" style={{ fontSize: 40, lineHeight: 42, textTransform: "uppercase" }}>
          {t.join.title}
        </Txt>
        <Txt style={{ color: colors.soft }}>{t.join.sub}</Txt>
      </View>

      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { id: "join", label: t.join.join },
          { id: "new", label: t.join.startNew },
        ]}
      />

      {mode === "join" ? (
        <View style={{ gap: 10 }}>
          <Kicker>{t.join.code}</Kicker>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder={t.join.codePh}
            placeholderTextColor="rgba(243,241,234,0.3)"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={[styles.input, styles.code]}
          />
          <Button label={busy === "crew" ? t.join.joining : t.join.cta} disabled={code.trim().length < 4} loading={busy === "crew"} onPress={submit} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Kicker>{t.join.name}</Kicker>
          <TextInput value={name} onChangeText={setName} placeholder={t.join.namePh} placeholderTextColor={colors.dim} maxLength={40} style={styles.input} />
          <Txt style={{ color: colors.muted, fontSize: 13 }}>{t.join.free}</Txt>
          <Button label={t.join.create} disabled={!name.trim()} loading={busy === "crew"} onPress={submit} />
        </View>
      )}
      {error && <Txt style={styles.error}>{error}</Txt>}

      <Card style={{ gap: 10, marginTop: 8 }}>
        <Kicker>{t.app.guestBefore}</Kicker>
        <Txt style={{ color: colors.muted, fontSize: 13 }}>{t.claim.body}</Txt>
        <TextInput
          value={claimCode}
          onChangeText={(v) => setClaimCode(v.toUpperCase())}
          placeholder={t.claim.codePh}
          placeholderTextColor="rgba(243,241,234,0.3)"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={[styles.input, styles.code, { fontSize: 22 }]}
        />
        <Button
          label={busy === "claim" ? t.claim.claiming : t.claim.cta}
          kind="outline"
          disabled={claimCode.trim().length < 4}
          loading={busy === "claim"}
          onPress={claim}
        />
        {claimError && <Txt style={styles.error}>{claimError}</Txt>}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.line,
    paddingHorizontal: 14,
    color: colors.cream,
    fontFamily: fonts.bodySemi,
    fontSize: 17,
  },
  code: { height: 64, textAlign: "center", fontFamily: fonts.display, fontSize: 32, letterSpacing: 6, borderColor: colors.gold },
  error: { color: colors.redPale, textAlign: "center" },
});
