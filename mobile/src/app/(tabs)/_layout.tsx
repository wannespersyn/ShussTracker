/**
 * Tabs layout
 *
 * Native tab bar (iOS Liquid Glass / Android Material), same order as the
 * website's bottom nav: Home, Crew, Log a game, Duos and Me.
 */
import { NativeTabs } from "expo-router/native-tabs";
import { useT } from "@/lib/i18n";
import { usePushNotifications } from "@/lib/push";
import { colors } from "@/theme";

export default function TabsLayout() {
  const { t, locale } = useT();
  usePushNotifications(true, locale);
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
      <NativeTabs.Trigger name="log">
        <NativeTabs.Trigger.Label>{t.nav.log}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus.circle.fill" md="add_circle" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="duos">
        <NativeTabs.Trigger.Label>{t.nav.duos}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>{t.nav.me}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
