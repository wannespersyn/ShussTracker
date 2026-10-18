import { getLocale } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";
import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Terms · Shussapp" };

export default async function TermsPage() {
  const nl = (await getLocale()) === "nl";
  const L = LEGAL;
  return nl ? (
    <LegalPage title="Voorwaarden" updated={`Laatst bijgewerkt: ${L.updated}`}>
      <p>Deze voorwaarden gelden voor het gebruik van Shussapp, aangeboden door <strong>{L.controller}</strong> ({L.companyNumber}, {L.address}).</p>
      <h2>Wie mag meedoen</h2>
      <p>Je moet 16 jaar of ouder zijn. Shussapp is een onafhankelijke fan-app en is niet verbonden aan de makers van het spel.</p>
      <h2>Drink met mate</h2>
      <p>Shussapp houdt scores bij; het moedigt niemand aan om te drinken. Speel verantwoord, ken je grenzen en rij nooit onder invloed.</p>
      <h2>Wat je deelt</h2>
      <p>Jij blijft eigenaar van je comments en foto’s, maar je geeft ons toestemming om ze aan je crew te tonen. Post niets onwettigs, kwetsends, of foto’s van mensen die daar niet mee akkoord gaan. We mogen inhoud verwijderen en accounts blokkeren bij misbruik.</p>
      <h2>Crews en gasten</h2>
      <p>Wie een crew aanmaakt beheert ze: leden verwijderen, de naam aanpassen, de crew verwijderen. Voeg enkel gasten toe met hun akkoord.</p>
      <h2>Prijzen</h2>
      <p>Shussapp is gratis tijdens de beta. Als we later betalende functies invoeren, zie je de prijs vooraf en kies jij of je betaalt. Founding crews krijgen Pro een jaar gratis.</p>
      <h2>Geen garanties</h2>
      <p>We doen ons best om de app beschikbaar en de stats correct te houden, maar bieden geen garantie. Voor zover de wet het toelaat zijn we niet aansprakelijk voor onrechtstreekse schade.</p>
      <h2>Stoppen</h2>
      <p>Je kan je account altijd zelf verwijderen in Instellingen. We kunnen deze voorwaarden aanpassen; bij grote wijzigingen laten we het in de app weten.</p>
      <h2>Recht</h2>
      <p>Belgisch recht is van toepassing. Vragen? <a href={`mailto:${L.email}`}>{L.email}</a>.</p>
    </LegalPage>
  ) : (
    <LegalPage title="Terms" updated={`Last updated: ${L.updated}`}>
      <p>These terms apply to your use of Shussapp, provided by <strong>{L.controller}</strong> ({L.companyNumber}, {L.address}).</p>
      <h2>Who can join</h2>
      <p>You must be 16 or older. Shussapp is an independent fan app and isn’t affiliated with the makers of the game.</p>
      <h2>Drink responsibly</h2>
      <p>Shussapp keeps score; it doesn’t encourage anyone to drink. Play responsibly, know your limits and never drive under the influence.</p>
      <h2>What you share</h2>
      <p>You keep ownership of your comments and photos, but you let us show them to your crew. Don’t post anything illegal or hurtful, or photos of people who didn’t agree to it. We may remove content and block accounts that abuse the app.</p>
      <h2>Crews and guests</h2>
      <p>Whoever creates a crew manages it: removing members, renaming, deleting the crew. Only add guests with their agreement.</p>
      <h2>Pricing</h2>
      <p>Shussapp is free during the beta. If we introduce paid features later, you’ll see the price upfront and choose whether to pay. Founding crews get a year of Pro for free.</p>
      <h2>No guarantees</h2>
      <p>We do our best to keep the app available and the stats correct, but give no guarantee. To the extent the law allows, we’re not liable for indirect damage.</p>
      <h2>Leaving</h2>
      <p>You can delete your account yourself in Settings at any time. We may update these terms; for big changes we’ll let you know in the app.</p>
      <h2>Law</h2>
      <p>Belgian law applies. Questions? <a href={`mailto:${L.email}`}>{L.email}</a>.</p>
    </LegalPage>
  );
}
