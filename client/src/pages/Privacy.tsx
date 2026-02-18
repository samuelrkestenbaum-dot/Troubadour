import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-3xl py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 18, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you use Troubadour, we collect the following information: account details (name, email) provided through our authentication provider; audio files you upload for review; metadata about your usage (projects created, reviews generated, features used); and payment information processed securely through Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your audio files are processed by our AI engine to generate reviews and analysis. We use your account information to provide and improve the Service, manage subscriptions, and communicate important updates. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Audio File Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Uploaded audio files are stored securely in cloud storage and processed by our AI analysis pipeline. Audio data is used solely for generating your reviews and is not shared with other users or third parties. Audio files are retained for the duration of your account and can be deleted at any time through the application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. AI Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your audio content is analyzed using third-party AI services to generate reviews. This processing involves sending audio metadata and analysis results to AI language models. We do not use your audio content to train AI models. The AI-generated reviews are stored in your account and are accessible only to you unless you choose to share them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Payment Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              Payment processing is handled entirely by Stripe. We store only your Stripe customer ID and subscription status. We never store credit card numbers, CVV codes, or other sensitive payment details on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure cloud storage, and access controls. However, no method of electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cookies & Analytics</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies for authentication and session management. We may use privacy-respecting analytics to understand how the Service is used. We do not use third-party advertising trackers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal data at any time. You can export your reviews and delete your audio files through the application. To request complete account deletion, contact us through the Support section in your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active. Upon account deletion, personal data and uploaded content are removed within 30 days. Anonymized, aggregated usage statistics may be retained for service improvement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes through the Service or via email. Continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related questions or data requests, please reach out through the Support section in your account settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
