/**
 * Tabs layout
 *
 * Native tab bar (iOS Liquid Glass / Android Material) with Home, Crew and
 * Me. Logging a game and duos join as tabs once those screens exist.
 */
import { NativeTabs } from "expo-router/native-tabs";
import { useT } from "@/lib/i18n";
import { colors } from "@/theme";

export default function TabsLayout() {
  const { t } = useT();
  return (
    <NativeTabs backgroundColor={colors.deep} tintColor={colors.gold} labelStyle={{ color: colors.muted }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t.nav.home}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="crew">
        <NativeTabs.Trigger.Label>{t.nav.crew}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.3.fill" md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>{t.nav.me}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
