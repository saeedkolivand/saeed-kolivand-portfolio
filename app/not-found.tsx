import { lettering, notFound } from "@/lib/content";
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
          <p className={styles.boom}>{lettering.onomatopoeia.impact[2]}</p>
        </div>

        <dl className={styles.terminal}>
          <div>
            <dt>{notFound.terminal.request}</dt>
            <dd>{notFound.terminal.response}</dd>
          </div>
          <div>
            <dt>{notFound.terminal.suggestion}</dt>
            <dd>{notFound.terminal.suggestionBody}</dd>
          </div>
        </dl>

        <a className={styles.ctaLink} href="/">
          {notFound.cta}
        </a>
        <div className={styles.newsBtns}>
          <a className={styles.newsBtn} href="/#projects">
            {notFound.ctaProjects}
          </a>
          <a className={styles.newsBtn} href="/#contact">
            {notFound.ctaContact}
          </a>
        </div>
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
