import type { ReactNode } from 'react'
import { Footer } from './Footer'

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
  )
}

type LegalSectionProps = {
  title: string;
  children: ReactNode;
};

const LegalSection = ({ title, children }: LegalSectionProps) => (
  <section className="legal-section">
    <h2>{title}</h2>
    {children}
  </section>
)

/** Privacy policy content page for Dit. */
export function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      intro="How Dit handles information in the web and iOS apps."
      lastUpdated="April 2026"
      current="privacy"
    >
      <LegalSection title="Information we collect">
        <ul>
          <li>
            Local settings and progress needed to run Dit, such as mode,
            learning progress, scores, hint preferences, and listen speed. On
            the web this lives in your browser; on iOS it lives on your
            device.
          </li>
          <li>
            Account information if you sign in, including your email address,
            display name, and authentication provider details. Both the web
            and iOS apps support Google, Apple, and email/password sign-in.
          </li>
          <li>
            Progress and preferences synced to our servers when you sign in,
            so they can be restored across your devices.
          </li>
          <li>
            Web app usage analytics through{' '}
            <a
              href="https://marketingplatform.google.com/about/analytics/"
              rel="noreferrer"
              target="_blank"
            >
              Google Analytics
            </a>
            . If you sign in, your Dit user ID is sent to Google Analytics so
            your usage can be linked across sessions and devices. The Dit
            user ID is an opaque identifier; it does not contain your name or
            email.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="How we use information">
        <ul>
          <li>Run the app and save your progress.</li>
          <li>Authenticate your account when you sign in.</li>
          <li>Sync your settings and progress across devices.</li>
          <li>Measure web app usage so we can improve it.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Services we rely on">
        <p>
          Dit uses{' '}
          <a href="https://cloud.google.com" rel="noreferrer" target="_blank">
            Google Cloud
          </a>{' '}
          for authentication and synced data, and{' '}
          <a
            href="https://marketingplatform.google.com/about/analytics/"
            rel="noreferrer"
            target="_blank"
          >
            Google Analytics
          </a>{' '}
          on the web. Sign-in providers (Google and Apple) handle
          authentication data under their own privacy policies. We do not
          sell personal information.
        </p>
      </LegalSection>
      <LegalSection title="Your choices">
        <ul>
          <li>You can use Dit without signing in.</li>
          <li>
            On the web, you can clear locally stored data through your
            browser settings.
          </li>
          <li>On iOS, deleting the app removes data stored on the device.</li>
          <li>Signing out stops future sync activity.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Data deletion">
        <p>
          On both the web and iOS apps, signed-in users can delete their
          account from Settings. That removes your Dit account, synced
          progress, and the local progress on that device. If you need help,
          email{' '}
          <a href="mailto:tyler@tylerobinson.com">tyler@tylerobinson.com</a>.
        </p>
      </LegalSection>
      <LegalSection title="Data security">
        <p>
          We use reasonable safeguards to protect your information, including
          encryption in transit, access controls, and trusted third-party
          services for data storage and transmission.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          Questions or support requests: visit{' '}
          <a href="/support">the support page</a> or email{' '}
          <a href="mailto:tyler@tylerobinson.com">tyler@tylerobinson.com</a>.
        </p>
      </LegalSection>
      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy from time to time. Continued use after
          changes take effect means you accept the revised policy.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}

/** Terms of service content page for Dit. */
export function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      intro="These terms govern your use of the Dit web and iOS apps."
      lastUpdated="April 2026"
      current="terms"
    >
      <LegalSection title="Use of the service">
        <p>
          Dit is a learning tool for Morse code practice. Use it lawfully and
          in accordance with these terms.
        </p>
      </LegalSection>
      <LegalSection title="Accounts">
        <p>
          Signing in is optional. If you sign in, you are responsible for the
          security of your account and any activity under it. Both the web
          and iOS apps support Google, Apple, and email/password sign-in.
        </p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <ul>
          <li>Do not interfere with the app or try to disrupt it.</li>
          <li>Do not access data or systems you are not authorized to use.</li>
          <li>Do not reverse engineer or misuse the app.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Third-party services">
        <p>
          Dit uses{' '}
          <a href="https://cloud.google.com" rel="noreferrer" target="_blank">
            Google Cloud
          </a>{' '}
          and{' '}
          <a
            href="https://marketingplatform.google.com/about/analytics/"
            rel="noreferrer"
            target="_blank"
          >
            Google Analytics
          </a>{' '}
          on the web, and Google and Apple for optional sign-in on iOS. Your
          use of those services is subject to their own terms and policies.
        </p>
      </LegalSection>
      <LegalSection title="Intellectual property">
        <p>
          All content, features, and functionality of Dit are the property of
          TYLR and are protected by copyright and other intellectual property
          laws.
        </p>
      </LegalSection>
      <LegalSection title="Termination">
        <p>
          We may suspend or terminate your access to the app at any time,
          without notice, for any reason, including breach of these terms.
        </p>
      </LegalSection>
      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of Washington State, USA,
          without regard to its conflict of law provisions.
        </p>
      </LegalSection>
      <LegalSection title="Privacy policy">
        <p>
          See the <a href="/privacy">privacy policy</a> for how we collect and
          use information.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          Questions about these terms: visit{' '}
          <a href="/support">the support page</a> or email{' '}
          <a href="mailto:tyler@tylerobinson.com">tyler@tylerobinson.com</a>.
        </p>
      </LegalSection>
      <LegalSection title="Disclaimers">
        <p>
          The app is provided on an "as is" and "as available" basis. We do
          not guarantee that the app will be error-free or uninterrupted.
        </p>
      </LegalSection>
      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we will not be liable for
          any indirect, incidental, or consequential damages arising from
          your use of the app.
        </p>
      </LegalSection>
      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms from time to time. Continued use after
          changes take effect means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}

/** Public support contact page for Dit. */
export function SupportPage() {
  return (
    <LegalPageLayout
      title="Support"
      intro="Help with Dit: sign-in, sync, account deletion, or anything else."
      lastUpdated="April 2026"
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
          On both the web and iOS apps, you can delete your account from
          Settings. That removes your Dit account, synced progress, and local
          progress on that device. If you need help, email us.
        </p>
      </LegalSection>
      <LegalSection title="Privacy and terms">
        <p>
          See the <a href="/privacy">privacy policy</a> and{' '}
          <a href="/terms">terms of service</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
