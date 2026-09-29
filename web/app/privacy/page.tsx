export const metadata = { title: 'Privacy policy · Glimmer' };
export default function Privacy() {
  return (
    <main className="legal">
      <h1>Privacy policy</h1>
      <p className="mute">Template text. Have a lawyer review it, and fill in your company details, before launch. Last updated: [date].</p>
      <h2>What we collect</h2><p>Your email and a hashed password, your reading progress and character name, the custom actions you type, your turn balance and purchases, and basic technical logs.</p>
      <h2>How we use it</h2><p>To run the service, keep turns fair, moderate abuse, and improve stories. Custom actions and story context are sent to our AI provider to generate the next passage.</p>
      <h2>Sharing</h2><p>We do not sell personal data. Hosting, database, payment (Apple, Google, RevenueCat) and AI providers process data on our behalf under contract.</p>
      <h2>Security</h2><p>Traffic uses HTTPS. Passwords are hashed. Custom input is length-limited and sanitised. Turn timers and purchase checks run on our servers.</p>
      <h2>Your choices</h2><p>You can delete your account and its data from the Account page at any time. Contact us to access or correct your data.</p>
      <h2>Children</h2><p>Glimmer is not for children under 13 and we do not knowingly collect their data.</p>
      <h2>Contact</h2><p>[privacy email]</p>
    </main>
  );
}
