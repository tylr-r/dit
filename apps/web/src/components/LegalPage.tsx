import type { ReactNode } from 'react';
import { Footer } from './Footer';

type LegalPageLayoutProps = {
  title: string;
  intro: string;
  lastUpdated: string;
  current: 'privacy' | 'terms' | 'support';
  children: ReactNode;
};

const LegalPageLayout = ({
  title,
  intro,
  lastUpdated,
  current,
  children,
}: LegalPageLayoutProps) => {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-top">
          <a className="legal-back" href="/">
            Back to Dit
          </a>
          <nav className="legal-nav" aria-label="Legal">
            <a
              href="/privacy"
              aria-current={current === 'privacy' ? 'page' : undefined}
            >
              Privacy
            </a>
            <a
              href="/terms"
              aria-current={current === 'terms' ? 'page' : undefined}
            >
              Terms
            </a>
            <a
              href="/support"
              aria-current={current === 'support' ? 'page' : undefined}
            >
              Support
            </a>
          </nav>
        </div>
        <div className="legal-hero">
          <p className="legal-eyebrow">Dit</p>
          <h1 className="legal-title">{title}</h1>
          <p className="legal-intro">{intro}</p>
          <p className="legal-updated">Last Updated: {lastUpdated}</p>
        </div>
      </header>
      <article className="legal-card">{children}</article>
      <Footer />
    </div>
  );
};

type LegalSectionProps = {
  title: string;
  children: ReactNode;
};

const LegalSection = ({ title, children }: LegalSectionProps) => (
  <section className="legal-section">
    <h2>{title}</h2>
    {children}
  </section>
);

/** Privacy policy content page for Dit. */
export function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      intro="This policy explains how Dit handles information across the Dit web app, website, and iOS app."
      lastUpdated="March 2026"
      current="privacy"
    >
      <LegalSection title="Information we collect">
        <ul>
          <li>
            Local settings and progress needed to run Dit, such as mode,
            learning progress, scores, hint preferences, and listen speed. On
            the web, this data is stored in your browser. On iOS, this data is
            stored on your device.
          </li>
          <li>
            Account information if you sign in, including your email address,
            display name, and authentication provider details. The web app
            currently supports Google sign-in. The iOS app currently supports
            Google and Sign in with Apple.
          </li>
          <li>
            Progress and preferences synced to Firebase when you sign in, so
            they can be restored across supported devices.
          </li>
          <li>
            Website and web app usage analytics through{' '}
            <a
              href="https://marketingplatform.google.com/about/analytics/"
              rel="noreferrer"
              target="_blank"
            >
              Google Analytics
            </a>
            . The iOS app does not use Google Analytics.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="How we use information">
        <ul>
          <li>Provide the core learning experience and save your progress.</li>
          <li>Authenticate your account when you choose to sign in.</li>
          <li>Sync your settings and progress across devices when signed in.</li>
          <li>
            Measure website and web app usage so we can improve the web
            experience.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="Services we rely on">
        <p>
          Dit relies on{' '}
          <a href="https://firebase.google.com" rel="noreferrer" target="_blank">
            Firebase
          </a>
          {' '}and{' '}
          <a href="https://cloud.google.com" rel="noreferrer" target="_blank">
            Google Cloud
          </a>{' '}
          for authentication and synced data. The web app also uses{' '}
          <a
            href="https://marketingplatform.google.com/about/analytics/"
            rel="noreferrer"
            target="_blank"
          >
            Google Analytics
          </a>{' '}
          for analytics. Sign-in providers such as Google and Apple also
          process authentication data under their own privacy policies. We do
          not sell personal information.
        </p>
      </LegalSection>
      <LegalSection title="Your choices">
        <ul>
          <li>You can use Dit without signing in.</li>
          <li>
            On the web, you can clear locally stored data through your browser
            settings.
          </li>
          <li>
            On iOS, removing the app deletes data stored only on that device.
          </li>
          <li>Signing out stops future sync activity.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Data deletion">
        <p>
          In the iOS app, signed-in users can delete their account from the
          Settings screen. That flow deletes the Firebase account, synced
          progress, and local progress on that device. If you only use the web
          app or need help with deletion, contact{' '}
          <a href="mailto:tyler@tylerobinson.com">tyler@tylerobinson.com</a>.
        </p>
      </LegalSection>
      <LegalSection title="Data security">
        <p>
          We use reasonable administrative, technical, and physical safeguards
          to protect your information, including encryption in transit and
          access controls, along with industry-standard services for data
          storage and transmission.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          If you have questions about this policy or need support, visit{' '}
          <a href="/support">the Dit support page</a> or email{' '}
          <a href="mailto:tyler@tylerobinson.com">tyler@tylerobinson.com</a>.
        </p>
      </LegalSection>
      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy from time to time. By continuing to use the
          app after changes take effect, you agree to the revised policy.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

/** Terms of service content page for Dit. */
export function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      intro="These terms govern your use of the Dit website, web app, and iOS app."
      lastUpdated="March 2026"
      current="terms"
    >
      <LegalSection title="Use of the service">
        <p>
          Dit is a learning tool for Morse code practice. Use the app only in
          lawful ways and in accordance with these terms.
        </p>
      </LegalSection>
      <LegalSection title="Accounts">
        <p>
          Signing in is optional. If you sign in, you are responsible for
          maintaining the security of your account and any activity that occurs
          under it. The web app currently offers Google sign-in. The iOS app
          currently offers Google and Sign in with Apple.
        </p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <ul>
          <li>Do not interfere with the app or attempt to disrupt it.</li>
          <li>
            Do not attempt to access data or systems you are not authorized to
            use.
          </li>
          <li>Do not reverse engineer or misuse the app.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Third-party services">
        <p>
          Dit uses{' '}
          <a href="https://firebase.google.com" rel="noreferrer" target="_blank">
            Firebase
          </a>
          ,{' '}
          <a href="https://cloud.google.com" rel="noreferrer" target="_blank">
            Google Cloud
          </a>
          ,{' '}
          <a
            href="https://marketingplatform.google.com/about/analytics/"
            rel="noreferrer"
            target="_blank"
          >
            Google Analytics
          </a>{' '}
          on the web, and Apple and Google for optional authentication on iOS.
          Your use of those services is subject to their respective terms and
          policies.
        </p>
      </LegalSection>
      <LegalSection title="Intellectual property">
        <p>
          All content, features, and functionality of Dit are the exclusive
          property of Tylr and are protected by copyright and other intellectual
          property laws.
        </p>
      </LegalSection>
      <LegalSection title="Termination">
        <p>
          We reserve the right to terminate or suspend your access to the app
          immediately, without prior notice, for any reason, including breach of
          these terms.
        </p>
      </LegalSection>
      <LegalSection title="Governing law">
        <p>
          These terms shall be governed by the laws of Washington State, USA,
          without regard to its conflict of law provisions.
        </p>
      </LegalSection>
      <LegalSection title="Privacy policy">
        <p>
          Please review the <a href="/privacy">Dit Privacy Policy</a> to
          understand how we collect and use information.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          If you have questions about these terms, visit{' '}
          <a href="/support">the Dit support page</a> or email{' '}
          <a href="mailto:tyler@tylerobinson.com">tyler@tylerobinson.com</a>.
        </p>
      </LegalSection>
      <LegalSection title="Disclaimers">
        <p>
          The app is provided on an "as is" and "as available" basis. We do not
          guarantee that the app will be error-free or uninterrupted.
        </p>
      </LegalSection>
      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we will not be liable for any
          indirect, incidental, or consequential damages arising from your use
          of the app.
        </p>
      </LegalSection>
      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms from time to time. Continued use of the app
          after changes take effect means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

/** Public support contact page for Dit. */
export function SupportPage() {
  return (
    <LegalPageLayout
      title="Support"
      intro="Need help with Dit, sign-in, sync, or account deletion? This page is the public support contact for the web app and iOS app."
      lastUpdated="March 2026"
      current="support"
    >
      <LegalSection title="Contact">
        <p>
          Email <a href="mailto:tyler@tylerobinson.com">tyler@tylerobinson.com</a>{' '}
          for support questions, bug reports, or account help.
        </p>
      </LegalSection>
      <LegalSection title="Account deletion">
        <p>
          In the iOS app, you can delete your account from Settings. That
          removes the Dit account, synced progress, and local progress on that
          device. If you only use the web app and need deletion help, email us.
        </p>
      </LegalSection>
      <LegalSection title="Privacy and terms">
        <p>
          Privacy details are available at <a href="/privacy">/privacy</a> and
          terms are available at <a href="/terms">/terms</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
