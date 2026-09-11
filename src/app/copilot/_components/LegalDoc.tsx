// src/app/copilot/_components/LegalDoc.tsx
// Privacy and terms, shared by /copilot and /lifeos.
//
// These exist because the app could not be shipped to anybody without them —
// not as a formality but because it genuinely collects a lot: what somebody
// sells, what they are trying to earn, how much cash they have left, the
// messages they draft and who they draft them to. A product holding that and
// saying nothing about it is not one a stranger should sign up for.
//
// Written to be read rather than to be survived. Every processor named below is
// one this code actually calls; if you remove an integration, remove it here.

import Link from 'next/link';

/**
 * Who operates the deployment. Set these before going live — the fallbacks are
 * deliberately obvious rather than plausible, because a privacy policy naming
 * the wrong entity is worse than one that admits it has not been filled in.
 */
const OPERATOR = process.env.NEXT_PUBLIC_COPILOT_OPERATOR || 'the operator of this deployment';
const CONTACT = process.env.NEXT_PUBLIC_COPILOT_CONTACT_EMAIL || '';
const UPDATED = 'September 2026';

function Contact() {
  return CONTACT
    ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
    : <span className="cp-legal-todo">[set NEXT_PUBLIC_COPILOT_CONTACT_EMAIL]</span>;
}

export default function LegalDoc({ doc, shell }: { doc: 'privacy' | 'terms'; shell: string }) {
  return (
    <main className="cp-legal">
      <Link className="cp-legal-back" href={shell}>← Back</Link>
      {doc === 'privacy' ? <Privacy /> : <Terms />}
      <p className="cp-legal-foot">
        Last updated {UPDATED}. Operated by {OPERATOR}. Questions: <Contact />.
        {' '}<Link href={`${shell}/${doc === 'privacy' ? 'terms' : 'privacy'}`}>{doc === 'privacy' ? 'Terms of use' : 'Privacy'}</Link>
      </p>
    </main>
  );
}

function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="cp-legal-lead">
        This app is a working tool, not an advertising product. Nothing here is sold, and nothing is
        shared with anyone except the services listed below that are needed to make it run.
      </p>

      <h2>What it holds about you</h2>
      <ul>
        <li><b>Who you are.</b> A name, an optional email, an optional one-line description of what you do, an optional location and your timezone.</li>
        <li><b>What you are trying to do.</b> Goals you write, with their targets and dates.</li>
        <li><b>What you sell.</b> Your offer, who it is for, the problem it solves, a price band, a proof link.</li>
        <li><b>Money, if you enter it.</b> Cash on hand and monthly burn, used to work out runway. Typed by you, never read from a bank. You can leave both blank and the app still works.</li>
        <li><b>Work the app produced for you.</b> Drafted messages, the businesses they are addressed to, links and findings it surfaced.</li>
        <li><b>What happened next.</b> Replies, meetings, wins and losses you record, and what you did about each daily call.</li>
        <li><b>Notes you write</b>, which are used to sharpen what it suggests.</li>
        <li><b>Sources you choose to watch</b> — the feed URLs you paste, and which of their items have already been shown to you.</li>
        <li><b>A session cookie</b> identifying your device. There is no advertising or analytics cookie in this app.</li>
      </ul>

      <h2>What it does not hold</h2>
      <ul>
        <li>No password — sign-in is a one-time emailed link.</li>
        <li>No card details. Payments are handled entirely by Stripe; this app stores only a customer reference and whether a plan is active.</li>
        <li>No access to your WhatsApp, your mailbox, your calendar or your bank. Messages open pre-filled in your own app and you send them yourself.</li>
      </ul>

      <h2>Who else sees it</h2>
      <p>Only these, and only what each one needs:</p>
      <ul>
        <li><b>Supabase</b> — hosts the database everything above is stored in.</li>
        <li><b>A language-model provider</b> — receives a context pack (your offer, goals, metrics and matched businesses) to write the daily read and to judge items from sources you watch. Which provider depends on how this deployment is configured; it is named on the About line of your account screen. Your email, phone number and payment details are never included.</li>
        <li><b>Apify</b> — runs the Google Maps searches, and receives the business type and area you set as targeting. It does not receive anything personal about you.</li>
        <li><b>Resend</b> — delivers sign-in links and notification email.</li>
        <li><b>Stripe</b> — takes payment, if you upgrade.</li>
        <li><b>Your browser&apos;s push service</b> (Google, Apple or Mozilla, depending on your device) — delivers notifications, if you turn them on.</li>
        <li><b>Sites you ask it to watch</b> — their servers see a request from this app, not from you.</li>
      </ul>

      <h2>How long</h2>
      <p>
        Until you delete it. There is no fixed retention period because the whole value of the app is
        the record building up over months — a funnel and a decision history are worthless if they are
        quietly truncated.
      </p>

      <h2>Deleting it</h2>
      <p>
        Open the account screen and choose <b>Delete everything</b>. That removes your profile and, with
        it, every goal, match, drafted message, outcome, decision and watched source — immediately, and
        not recoverably. It is not a request queued for review; the rows are gone when the screen
        confirms it.
      </p>
      <p>
        Two things survive by necessity and are outside this app&apos;s control: payment records Stripe is
        legally required to keep, and anything already sent to a language-model provider under its own
        retention policy. Neither is readable from here after deletion.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see everything held about you inside the app itself — there is no hidden profile behind
        the screens. To get a copy, to correct something, or to object to how it is used, write to{' '}
        <Contact />. If you are in the UK or EU, you can also complain to your local data protection
        authority.
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="cp-legal-lead">
        Short, because the arrangement is simple: you use the app, you decide what to send, and you are
        responsible for what you send.
      </p>

      <h2>What this is</h2>
      <p>
        A tool that finds work, drafts messages and keeps a record of what came back. It suggests; it
        does not act. Nothing is sent, bought, booked or replied to without you tapping the button.
      </p>

      <h2>What you are responsible for</h2>
      <ul>
        <li><b>Everything you send.</b> Drafts open in your own WhatsApp or mail app and go out under your name, from your account. Outreach law differs by country — unsolicited messaging is restricted in many of them — and complying with the rules where you and your recipients are is yours to do.</li>
        <li><b>The accuracy of what you enter.</b> Rankings, runway and every projection are arithmetic over numbers you typed. Wrong inputs give confident wrong answers.</li>
        <li><b>Your account.</b> Sign-in is a link sent to your email; anyone with access to that inbox can get in.</li>
      </ul>

      <h2>What this app does not promise</h2>
      <ul>
        <li><b>That a suggestion is right.</b> Parts of it are written by a language model and can be wrong or out of date. Nothing here is legal, financial or tax advice.</li>
        <li><b>That found work is real.</b> Listings come from public sources and third-party feeds you choose. Verify anything before acting on it, and never send money to a stranger because this app surfaced them.</li>
        <li><b>Uninterrupted service.</b> It depends on external providers and can be unavailable.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Do not use it to send spam, to harass anyone, to scrape at a volume that harms the sites it
        reads, or to do anything unlawful where you are. Accounts doing any of that can be closed.
      </p>

      <h2>Paying</h2>
      <p>
        The free plan needs no card. Paid plans bill monthly or yearly through Stripe and renew until
        cancelled; you can cancel any time from the billing screen and keep access until the period
        ends. If a payment fails, the account drops to free limits rather than locking — your data,
        history and funnel stay exactly where they are.
      </p>

      <h2>Ending it</h2>
      <p>
        Delete your account whenever you like, from the account screen. {OPERATOR} may close an account
        that breaks the acceptable-use rules above, or discontinue the service with reasonable notice.
      </p>

      <h2>Liability</h2>
      <p>
        The app is provided as it is. To the extent the law allows, {OPERATOR} is not liable for lost
        business, lost profit or lost data arising from using it, and any liability that cannot be
        excluded is limited to what you paid in the twelve months before the claim.
      </p>
    </>
  );
}
