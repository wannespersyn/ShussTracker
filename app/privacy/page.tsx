import { getLocale } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";
import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacy · Shussapp" };

export default async function PrivacyPage() {
  const nl = (await getLocale()) === "nl";
  const L = LEGAL;
  return nl ? (
    <LegalPage title="Privacy" updated={`Laatst bijgewerkt: ${L.updated}`}>
      <p>
        Shussapp is een scorebord voor jouw crew. We verzamelen enkel wat nodig is om games bij te houden en met je crew te delen. Verantwoordelijke:{" "}
        <strong>{L.controller}</strong>, ondernemingsnummer {L.companyNumber}, {L.address}. Contact: <a href={`mailto:${L.email}`}>{L.email}</a>.
      </p>
      <h2>Welke gegevens</h2>
      <ul>
        <li><strong>Account:</strong> je naam, e-mailadres en profielfoto van Google wanneer je inlogt, plus de weergavenaam die je zelf kiest.</li>
        <li><strong>Spelgegevens:</strong> je crews, de games die jij of je crewleden loggen (teams, winnaars, mama’s, shots) en de stats die we daaruit berekenen.</li>
        <li><strong>Wat je deelt:</strong> comments, reacties, foto’s van de mat en feedback of ideeën.</li>
        <li><strong>Gasten:</strong> een crewlid kan iemand als gast toevoegen met enkel een naam, tot die persoon zijn stats claimt met een eigen account.</li>
        <li><strong>Meldingen:</strong> als je ze aanzet, een technisch adres van je toestel om meldingen te sturen.</li>
        <li><strong>Cookies:</strong> enkel noodzakelijke cookies: je login-sessie en je voorkeuren (thema, taal, streak-flair). Geen advertentie- of trackingcookies.</li>
      </ul>
      <h2>Waarom</h2>
      <p>Om de app te laten werken zoals je ze gebruikt (uitvoering van de overeenkomst): inloggen, games en stats tonen aan jou en je crew, meldingen sturen die je aanzette, en de app verbeteren op basis van feedback.</p>
      <h2>Wie het kan zien</h2>
      <p>Je naam, games en stats zijn zichtbaar voor de leden van de crews waarin je zit. Foto’s zijn enkel zichtbaar voor die crewleden. We verkopen niets en delen niets met adverteerders.</p>
      <h2>Verwerkers</h2>
      <ul>
        <li>Vercel Inc. — hosting en foto-opslag (servers in Frankfurt; doorgifte buiten de EU onder standaardcontractbepalingen).</li>
        <li>Neon Inc. — database (EU, Frankfurt).</li>
        <li>Google — inloggen met je Google-account.</li>
        <li>De pushdienst van je browser of toestel (Apple, Google, Mozilla) — enkel voor meldingen.</li>
      </ul>
      <h2>Hoe lang</h2>
      <p>Zolang je account bestaat. Verwijder je je account, dan wissen we je naam, e-mail, Google-koppeling, comments, reacties en lidmaatschappen meteen. De games die je speelde blijven anoniem (“Former player”) in de geschiedenis van je crew, zodat de stats van je crewleden kloppen.</p>
      <h2>Je rechten</h2>
      <p>
        Je hebt recht op inzage, verbetering, verwijdering, beperking, overdraagbaarheid en bezwaar. Je naam pas je aan in Instellingen, je account verwijder je zelf in Instellingen → Account verwijderen. Voor de rest: mail naar{" "}
        <a href={`mailto:${L.email}`}>{L.email}</a>. Je kan ook klacht indienen bij de Gegevensbeschermingsautoriteit (gegevensbeschermingsautoriteit.be).
      </p>
      <h2>Leeftijd</h2>
      <p>Shussapp is enkel voor personen van 16 jaar en ouder.</p>
    </LegalPage>
  ) : (
    <LegalPage title="Privacy" updated={`Last updated: ${L.updated}`}>
      <p>
        Shussapp is a scoreboard for your crew. We only collect what’s needed to keep track of games and share them with your crew. Controller:{" "}
        <strong>{L.controller}</strong>, company number {L.companyNumber}, {L.address}. Contact: <a href={`mailto:${L.email}`}>{L.email}</a>.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your name, email address and profile picture from Google when you sign in, plus the display name you choose.</li>
        <li><strong>Game data:</strong> your crews, the games you or your crewmates log (teams, winners, mama hits, shots) and the stats we calculate from them.</li>
        <li><strong>What you share:</strong> comments, reactions, photos of the mat, and feedback or ideas.</li>
        <li><strong>Guests:</strong> a crew member can add someone as a guest with just a name, until that person claims their stats with their own account.</li>
        <li><strong>Notifications:</strong> if you turn them on, a technical address of your device to deliver them.</li>
        <li><strong>Cookies:</strong> strictly necessary only — your sign-in session and your preferences (theme, language, streak flair). No advertising or tracking cookies.</li>
      </ul>
      <h2>Why</h2>
      <p>To run the app the way you use it (performance of our agreement with you): signing in, showing games and stats to you and your crew, sending notifications you turned on, and improving the app based on feedback.</p>
      <h2>Who can see it</h2>
      <p>Your name, games and stats are visible to members of the crews you’re in. Photos are only visible to those crew members. We don’t sell anything and don’t share anything with advertisers.</p>
      <h2>Processors</h2>
      <ul>
        <li>Vercel Inc. — hosting and photo storage (servers in Frankfurt; transfers outside the EU under standard contractual clauses).</li>
        <li>Neon Inc. — database (EU, Frankfurt).</li>
        <li>Google — signing in with your Google account.</li>
        <li>Your browser’s or device’s push service (Apple, Google, Mozilla) — notifications only.</li>
      </ul>
      <h2>How long</h2>
      <p>As long as your account exists. When you delete your account we immediately erase your name, email, Google link, comments, reactions and memberships. The games you played stay in your crew’s history anonymously (“Former player”) so your crewmates’ stats stay correct.</p>
      <h2>Your rights</h2>
      <p>
        You can access, correct, delete, restrict, port and object. Change your name in Settings, and delete your account yourself in Settings → Delete account. For anything else, email{" "}
        <a href={`mailto:${L.email}`}>{L.email}</a>. You can also complain to the Belgian Data Protection Authority (dataprotectionauthority.be).
      </p>
      <h2>Age</h2>
      <p>Shussapp is for people aged 16 and over only.</p>
    </LegalPage>
  );
}
