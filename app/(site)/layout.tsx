import { siteSans, siteWide } from "@/components/site/fonts";
import SiteFooter from "@/components/site/footer";
import SiteHeader from "@/components/site/header";
import { TransitionProvider } from "@/components/site/transition";
import styles from "@/components/site/site.module.css";

// Every page of the website (/, /work, /services, /about, /contact) shares this:
// the hero's typefaces, the header and menu, the footer, and the letterbox cut
// between pages. The /heroN experiments stay outside it.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.site} ${siteWide.variable} ${siteSans.variable}`}>
      <TransitionProvider>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </TransitionProvider>
    </div>
  );
}
