import type { Metadata } from "next";
import { notFound } from "@/lib/content";
import styles from "@/components/PrintEdition.module.css";

/*
 * 404 -- the panel that never made it to print.
 *
 * `output: export` emits this as out/404.html, which GitHub Pages serves for
 * every unknown path. No WebGL, no client JS: a lost reader gets the paper
 * edition instantly, which is the point.
 *
 * It borrows the Print Edition stylesheet rather than owning one -- that sheet
 * IS the design language (paper + Ben-Day halftone, 4px ink borders, hard
 * offset shadows, Bangers lettering, Caveat hand, mono terminal), and a second
 * copy of it would only drift. Copy lives in lib/content (S0.5).
 *
 * ponytail: the terminal prints a fixed "GET /this-page" rather than the real
 * URL -- reading it needs "use client" + an effect to dodge the hydration
 * mismatch. Swap in usePathname() if the exact path ever has to be shown.
 */
// Verified against the emitted out/404.html: `not-found.tsx` DOES honour a
// metadata export under `output: export` (PR #76 review, finding 3). No robots
// field -- Next already injects `<meta name="robots" content="noindex">` here,
// and setting it again only emits a second, duplicate tag.
export const metadata: Metadata = {
  title: notFound.metaTitle,
  description: notFound.dek,
};

export default function NotFound() {
  return (
    <div className={styles.root}>
      <header className={styles.masthead}>
        <p className={styles.kicker}>{notFound.kicker}</p>
        <h1 className={styles.mastheadTitle}>404</h1>
        <p className={styles.dek}>{notFound.dek}</p>
        <p className={styles.intro}>{notFound.intro}</p>
      </header>

      <main className={styles.issue}>
        <div className={styles.issueHead}>
          <p className={styles.kicker}>{notFound.gutterKicker}</p>
          <h2 className={styles.issueTitle}>{notFound.title}</h2>
        </div>

        {/* The empty panel itself: dashed hold-for-art box, a handwritten note
            where the caption would be, and the sound of it hitting the floor. */}
        <div className={styles.donationAlert}>
          <span className={styles.hand}>{notFound.gutterNote}</span>
          <p className={styles.boom}>{notFound.boom}</p>
        </div>

        {/* One exchange, not two: the letters page prints bare commands, so a
            request line and a command line stacked as sibling prompts read as
            an inconsistency rather than a joke (PR #76 review, finding 4). */}
        <dl className={styles.terminal}>
          <div>
            <dt>{notFound.terminal.request}</dt>
            <dd>{notFound.terminal.response}</dd>
          </div>
        </dl>

        {/*
         * One exit, deliberately. Deep links like /#projects are dead on the
         * experience path: when ExperienceGate mounts the 3D stack it puts the
         * Print Edition in `.behind` (1px, clipped) and nothing in the app reads
         * location.hash, so the reader would land on the cover at t=0 anyway
         * (PR #76 review, finding 1). The cover is where they were going.
         */}
        <a className={styles.ctaLink} href="/">
          {notFound.cta}
        </a>
      </main>

      {/* ponytail: no Harley cameo here -- the mascot PNGs are 1.5-4 MB each,
          which is not a bill to hand someone who already took a wrong turn. */}
      <footer className={styles.backCover}>
        <p className={styles.nextIssue}>{notFound.nextIssue}</p>
        <p>{notFound.barcode}</p>
      </footer>
    </div>
  );
}
