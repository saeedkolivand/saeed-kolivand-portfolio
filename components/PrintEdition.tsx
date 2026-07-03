import type { CSSProperties, ReactNode } from "react";
import { content, issueCopy, lettering, links, printEdition, projects } from "@/lib/content";
import ContactEmail from "./ContactEmail";
import styles from "./PrintEdition.module.css";

/*
 * The Print Edition (SPEC Phase 5 + S8): the always-present semantic document.
 * One <h1> (masthead), one <h2> per issue section, real links, alt on every
 * image. Every body string is REUSED from lib/content -- never re-typed (S0.5).
 * Server-renderable: no hooks, no window at render scope, so server and first
 * client paint are identical (ExperienceGate mounts this on both paths).
 */

type Pal = { paper: string; ink: string; accent: string };

// Per-issue accent tints echoing the S0.4 palettes, ASCII hex.
const PAL = [
  { paper: "#f2ead9", ink: "#201d18", accent: "#e2574c" }, // 0 Cover
  { paper: "#0e0e10", ink: "#f5f1e8", accent: "#ffb347" }, // 1 Noir
  { paper: "#f6efe3", ink: "#1c1b1a", accent: "#f5a623" }, // 2 Desk
  { paper: "#060608", ink: "#ededf2", accent: "#00e5ff" }, // 3 Neon
  { paper: "#ede7db", ink: "#2a2722", accent: "#7c93b2" }, // 4 Origin
  { paper: "#23272e", ink: "#e8e4dc", accent: "#4fc3f7" }, // 5 Press
  { paper: "#eae3d2", ink: "#221f1a", accent: "#c63d2f" }, // 6 Newsprint
  { paper: "#101014", ink: "#e8e8e8", accent: "#f6c243" }, // 7 Screentone
  { paper: "#1b0f2e", ink: "#f4efff", accent: "#ff3d81" }, // 8 Pop
  { paper: "#f7f2e7", ink: "#232019", accent: "#6fa8dc" }, // 9 Sketchbook
  { paper: "#05060d", ink: "#eaf2ff", accent: "#ffd166" }, // 10 Spread
  { paper: "#0b0f0c", ink: "#33ff66", accent: "#ffb000" }, // 11 Terminal
] as const;

const DARK = [false, true, false, true, false, true, false, true, true, false, true, true] as const;

function vars(p: Pal): CSSProperties {
  const s: Record<string, string> = { "--paper": p.paper, "--ink": p.ink, "--accent": p.accent };
  return s as CSSProperties;
}

function Panel(props: {
  index: number;
  pal: Pal;
  dark: boolean;
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <section
      id={"issue-" + props.index}
      className={props.dark ? styles.issue + " " + styles.issueDark : styles.issue}
      style={vars(props.pal)}
    >
      <div className={styles.issueHead}>
        <p className={styles.kicker}>
          {props.index === 0 ? "Cover" : "Issue " + props.index} -- {props.kicker}
        </p>
        <h2 className={styles.issueTitle}>{props.title}</h2>
      </div>
      {props.children}
    </section>
  );
}

const T = printEdition.sectionTitles;

export default function PrintEdition() {
  return (
    <div className={styles.root}>
      <a className={styles.skipLink} href="#print-main">
        {printEdition.skipLinkLabel}
      </a>

      <header className={styles.masthead}>
        <h1 className={styles.mastheadTitle}>{printEdition.masthead.title}</h1>
        <p className={styles.dek}>{printEdition.masthead.dek}</p>
        <p className={styles.intro}>{printEdition.intro}</p>
      </header>

      <nav className={styles.toc} aria-label="Issues in this edition">
        <p className={styles.tocTitle}>In This Edition</p>
        <ul className={styles.tocList}>
          {T.map((s, i) => (
            <li key={i}>
              <a className={styles.tocLink} href={"#issue-" + i}>
                <span className={styles.tocNum}>{i === 0 ? "00" : String(i).padStart(2, "0")}</span>
                <span>{s.title}</span>
                <span className={styles.tocKicker}>{s.kicker}</span>
              </a>
            </li>
          ))}
          <li>
            <a className={styles.tocLink} href="#projects">
              <span className={styles.tocNum}>12</span>
              <span>The Projects</span>
              <span className={styles.tocKicker}>the whole shelf</span>
            </a>
          </li>
        </ul>
      </nav>

      <main id="print-main" className={styles.main}>
        {/* 0 -- Cover */}
        <Panel index={0} pal={PAL[0]} dark={DARK[0]} title={T[0].title} kicker={T[0].kicker}>
          <img
            className={styles.catMotif}
            src="/images/backcover-harley.png"
            alt={printEdition.altText.mascot}
            loading="lazy"
            decoding="async"
          />
          <p className={styles.lead}>{lettering.cover.masthead}</p>
          <p>{lettering.cover.issueLine}</p>
          <p className={styles.prose}>{lettering.cover.blurb}</p>
          <div className={styles.keycaps}>
            <span className={styles.keycap}>{lettering.cover.priceBox}</span>
            <span className={styles.keycap}>{lettering.cover.attractPrompt}</span>
          </div>
        </Panel>

        {/* 1 -- Noir */}
        <Panel index={1} pal={PAL[1]} dark={DARK[1]} title={T[1].title} kicker={T[1].kicker}>
          <div className={styles.imgRow}>
            <figure className={styles.imgFrame}>
              <img
                src="/images/noir-window-figure.png"
                alt={printEdition.altText.noirWindow}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
          <ul className={styles.captionList}>
            {lettering.noirCaptions.map((c, i) => (
              <li key={i} className={styles.captionBox}>
                {c}
              </li>
            ))}
          </ul>
        </Panel>

        {/* 2 -- Desk */}
        <Panel index={2} pal={PAL[2]} dark={DARK[2]} title={T[2].title} kicker={T[2].kicker}>
          <p className={styles.prose}>One window still lit; the keys under the lamp. The workspace:</p>
          <div className={styles.chips}>
            {content.stack.map((s) => (
              <span key={s} className={styles.chip}>
                {s}
              </span>
            ))}
          </div>
          <div className={styles.keycaps}>
            {lettering.onomatopoeia.keycaps.map((k, i) => (
              <span key={i} className={styles.keycap}>
                {k}
              </span>
            ))}
          </div>
        </Panel>

        {/* 3 -- Neon */}
        <Panel index={3} pal={PAL[3]} dark={DARK[3]} title={T[3].title} kicker={T[3].kicker}>
          <p className={styles.prose}>The stack, lit up in neon over the code city.</p>
          <div className={styles.chips}>
            {lettering.neonSigns.map((n) => (
              <span key={n} className={styles.chip}>
                {n}
              </span>
            ))}
          </div>
        </Panel>

        {/* 4 -- Origin */}
        <Panel index={4} pal={PAL[4]} dark={DARK[4]} title={T[4].title} kicker={T[4].kicker}>
          <img
            className={styles.catMotif}
            src="/images/backcover-harley.png"
            alt={printEdition.altText.mascot}
            loading="lazy"
            decoding="async"
          />
          <p className={styles.lead}>{issueCopy.origin.lead}</p>
          <ol className={styles.beats}>
            {issueCopy.origin.beats.map((b, i) => (
              <li key={i} className={styles.beat}>
                <span className={styles.beatMilestone}>{content.timeline[i] ?? ""}</span>
                {b}
              </li>
            ))}
          </ol>
          <div className={styles.imgRow}>
            <figure className={styles.imgFrame}>
              <img
                src="/images/origin-kid-panel.png"
                alt={printEdition.altText.originKid}
                loading="lazy"
                decoding="async"
              />
            </figure>
            <figure className={styles.imgFrame}>
              <img
                src="/images/origin-cologne-panel.png"
                alt={printEdition.altText.originCologne}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </Panel>

        {/* 5 -- Press */}
        <Panel index={5} pal={PAL[5]} dark={DARK[5]} title={T[5].title} kicker={T[5].kicker}>
          <p className={styles.prose}>Skills come off the line, department by department.</p>
          <div className={styles.grid2}>
            {issueCopy.press.departments.map((d) => (
              <div key={d.label} className={styles.dept}>
                <p className={styles.deptLabel}>{d.label}</p>
                <p className={styles.deptCaption}>{d.caption}</p>
              </div>
            ))}
          </div>
          <a className={styles.ctaLink} href="#projects">
            {issueCopy.press.cta}
          </a>
        </Panel>

        {/* 6 -- Newsprint */}
        <Panel index={6} pal={PAL[6]} dark={DARK[6]} title={T[6].title} kicker={T[6].kicker}>
          <h3 className={styles.newsHeadline}>{issueCopy.newsprint.headline}</h3>
          <ul className={styles.newsSecondary}>
            {issueCopy.newsprint.secondaryHeadlines.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <div className={styles.imgRow}>
            <figure className={styles.imgFrame}>
              <img
                src="/images/newsprint-harley-photo.png"
                alt={printEdition.altText.pressHarley}
                loading="lazy"
                decoding="async"
              />
            </figure>
            <div className={styles.newsFront}>
              <h3>{issueCopy.newsprint.frontPageStory}</h3>
              <p>{issueCopy.newsprint.frontPageBlurb}</p>
              <div className={styles.newsBtns}>
                <a className={styles.newsBtn} href={links.flagshipRepoUrl}>
                  GITHUB
                </a>
                <a className={styles.newsBtn} href={links.liveDemoUrl}>
                  WEBSITE
                </a>
              </div>
            </div>
          </div>
          <p className={styles.ticker}>
            {issueCopy.newsprint.ticker.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </p>
        </Panel>

        {/* 7 -- Screentone */}
        <Panel index={7} pal={PAL[7]} dark={DARK[7]} title={T[7].title} kicker={T[7].kicker}>
          <p className={styles.prose}>The line runs station to station.</p>
          <ol className={styles.subway}>
            {issueCopy.screentone.stationCaptions.map((c, i) => (
              <li key={i} className={styles.station}>
                <span className={styles.stationDot} aria-hidden />
                <span className={styles.stationName}>{content.timeline[i] ?? ""}</span>
                <p className={styles.stationCaption}>{c}</p>
              </li>
            ))}
          </ol>
        </Panel>

        {/* 8 -- Pop Print */}
        <Panel index={8} pal={PAL[8]} dark={DARK[8]} title={T[8].title} kicker={T[8].kicker}>
          <p className={styles.prose}>Live and on air. The chat rolls in:</p>
          <div className={styles.chatWall}>
            {issueCopy.popPrint.chat.map((c, i) => (
              <span key={i} className={styles.bubble}>
                {c}
              </span>
            ))}
          </div>
          <p className={styles.donationAlert}>{issueCopy.popPrint.donationAlert}</p>
          <p className={styles.boom}>{issueCopy.popPrint.donationBoom}</p>
        </Panel>

        {/* 9 -- Sketchbook */}
        <Panel index={9} pal={PAL[9]} dark={DARK[9]} title={T[9].title} kicker={T[9].kicker}>
          <p className={styles.prose}>The architecture, by hand: Frontend to API to Workers to AI to DB to Search to Desktop.</p>
          <ul className={styles.annotationChain}>
            {issueCopy.sketchbook.annotations.map((a, i) => (
              <li key={i} className={styles.annotation}>
                <span className={styles.chainNode}>LINK {i + 1}</span>
                <span className={styles.hand}>{a}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 10 -- Spread */}
        <Panel index={10} pal={PAL[10]} dark={DARK[10]} title={T[10].title} kicker={T[10].kicker}>
          <img
            className={styles.catMotif}
            src="/images/backcover-harley.png"
            alt={printEdition.altText.mascot}
            loading="lazy"
            decoding="async"
          />
          <p className={styles.prose}>The whole run at once, laid out like a constellation:</p>
          <ul className={styles.spreadStars}>
            {issueCopy.spread.constellations.map((c, i) => (
              <li key={i} className={styles.star}>
                {c}
              </li>
            ))}
          </ul>
          <p className={styles.closingCaption}>{issueCopy.spread.closingCaption}</p>
        </Panel>

        {/* 11 -- Letters Page (terminal) */}
        <Panel index={11} pal={PAL[11]} dark={DARK[11]} title={T[11].title} kicker={T[11].kicker}>
          <p className={styles.prose}>Commands in, answers out.</p>
          <dl className={styles.terminal}>
            {content.terminalCommands.map((cmd) => {
              if (cmd === "blog" && !links.blogUrl) return null;
              const body = issueCopy.lettersPage.responses[cmd];
              return (
                <div key={cmd}>
                  <dt>{cmd}</dt>
                  <dd>
                    {body}
                    {cmd === "github" ? (
                      <>
                        {" "}
                        <a href={links.githubUrl}>github.com/saeedkolivand</a>
                      </>
                    ) : null}
                    {cmd === "linkedin" ? (
                      <>
                        {" "}
                        <a href={links.linkedinUrl}>linkedin.com/in/saeedkolivand</a>
                      </>
                    ) : null}
                    {cmd === "blog" && links.blogUrl ? (
                      <>
                        {" "}
                        <a href={links.blogUrl}>read the blog</a>
                      </>
                    ) : null}
                  </dd>
                </div>
              );
            })}
            {/* hidden easter-egg command -- factual/fun, the real senior engineer */}
            <div>
              <dt>harley</dt>
              <dd>{issueCopy.lettersPage.responses.harley}</dd>
            </div>
          </dl>
          <div className={styles.backCover}>
            <p className={styles.nextIssue}>{issueCopy.lettersPage.backCover.nextIssue}</p>
            <p>{issueCopy.lettersPage.backCover.barcode}</p>
            <figure className={styles.imgFrame}>
              <img
                src="/images/backcover-harley.png"
                alt={printEdition.altText.backCoverHarley}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </Panel>

        {/* Projects */}
        <section id="projects" className={styles.issue} style={vars(PAL[2])}>
          <div className={styles.issueHead}>
            <p className={styles.kicker}>Issue 12 -- the whole shelf</p>
            <h2 className={styles.issueTitle}>The Projects</h2>
          </div>
          <div className={styles.grid3}>
            {projects.map((p) => (
              <article key={p.name} className={styles.projectCard}>
                <h3 className={styles.projectName}>{p.name}</h3>
                <p className={styles.projectTech}>{p.tech}</p>
                <p className={styles.projectBlurb}>{p.blurb}</p>
                <a className={styles.projectLink} href={p.url}>
                  Open project
                </a>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer id="contact" className={styles.footer}>
        <h2 className={styles.footerTitle}>Contact</h2>
        <p className={styles.contactNote}>{printEdition.contactNote}</p>
        <div className={styles.contactLinks}>
          <a className={styles.contactLink} href={links.githubUrl}>
            GitHub
          </a>
          <a className={styles.contactLink} href={links.linkedinUrl}>
            LinkedIn
          </a>
          <ContactEmail />
        </div>
      </footer>
    </div>
  );
}
