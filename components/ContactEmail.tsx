"use client";

import { useEffect, useState } from "react";
import { links } from "@/lib/content";
import styles from "./PrintEdition.module.css";

/**
 * S0.5 anti-scrape: the plain address is never present in the SSR HTML. The
 * mailto is assembled in an effect (client-only, after hydration) from the
 * split parts, so the initial markup a naive scraper reads has no address.
 */
export default function ContactEmail() {
  const [addr, setAddr] = useState<string | null>(null);
  useEffect(() => {
    const at = links.email.indexOf("@");
    if (at < 0) return;
    setAddr(links.email.slice(0, at) + "@" + links.email.slice(at + 1));
  }, []);

  if (!addr) {
    return <span className={styles.emailPending}>email (assembled at runtime)</span>;
  }
  return (
    <a className={styles.contactLink} href={"mailto:" + addr}>
      {addr}
    </a>
  );
}
