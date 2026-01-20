import type { ReactNode } from 'react';
import { Footer } from './Footer';

type LegalPageLayoutProps = {
  title: string;
  intro: string;
  lastUpdated: string;
  current: 'privacy' | 'terms';
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
      intro="This policy explains how Dit collects and uses information when you use the app."
      lastUpdated="January 2026"
      current="privacy"
    >
      <LegalSection title="Information we collect">
        <ul>
          <li>
            On-device settings and progress stored in your browser, such as
            mode, hint preferences, scores, and speed.
          </li>
          <li>
            Account information if you sign in with Google, including your name
            and email address.
          </li>
          <li>
            Progress and preferences synced to{' '}
            <a href="https://cloud.google.com" rel="noreferrer" target="_blank">
              Google Cloud
            </a>{' '}
            when signed in, so you can access them across devices.
          </li>
          <li>
            Usage analytics events through{' '}
            <a
              href="https://marketingplatform.google.com/about/analytics/"
              rel="noreferrer"
              target="_blank"
            >
              Google Analytics
            </a>{' '}
            to understand feature usage and improve stability.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="How we use information">
        <ul>
          <li>Provide the core learning experience and app features.</li>
          <li>Sync your progress when you choose to sign in.</li>
          <li>Measure performance and improve the app over time.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Sharing">
        <p>
          We rely on{' '}
          <a href="https://cloud.google.com" rel="noreferrer" target="_blank">
            Google Cloud
          </a>
          ,{' '}
          <a href="https://www.cloudflare.com" rel="noreferrer" target="_blank">
            Cloudflare
          </a>
          , and{' '}
          <a
            href="https://marketingplatform.google.com/about/analytics/"
            rel="noreferrer"
            target="_blank"
          >
            Google Analytics
          </a>{' '}
          to operate the app. These services process data on our behalf under
          their own privacy policies. We do not sell your personal information.
        </p>
      </LegalSection>
      <LegalSection title="Your choices">
        <ul>
          <li>You can use Dit without signing in.</li>
          <li>
            You can clear local data at any time using your browser settings.
          </li>
          <li>Signing out stops further syncing to the cloud.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Data deletion">
        <p>
          If you wish to delete your account and all associated synced data,
          please contact us at{' '}
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
          If you have questions about this policy, please contact us at{' '}
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
      intro="These terms govern your use of Dit. By using the app, you agree to them."
      lastUpdated="January 2026"
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
          under it.
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
          <a href="https://cloud.google.com" rel="noreferrer" target="_blank">
            Google Cloud
          </a>
          ,{' '}
          <a href="https://www.cloudflare.com" rel="noreferrer" target="_blank">
            Cloudflare
          </a>
          , and{' '}
          <a
            href="https://marketingplatform.google.com/about/analytics/"
            rel="noreferrer"
            target="_blank"
          >
            Google Analytics
          </a>
          . Your use of those services is subject to their respective terms and
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
          If you have questions about these terms, please contact us at{' '}
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
