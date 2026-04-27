import { useEffect, useRef } from 'react';
import { useRoute } from './lib/router';
import { Header } from './components/shared/Header';
import { Hero } from './components/hero/Hero';
import { Gallery } from './components/gallery/Gallery';
import { CaseDetail } from './components/gallery/CaseDetail';
import { SkillsPage } from './components/skills/SkillsPage';
import { Footer } from './components/shared/Footer';

export function App() {
  const [route, navigate] = useRoute();

  // Scroll preservation around the case-detail overlay.
  //
  // The previous implementation read `document.body.style.overflow` to decide
  // whether a restore was needed, but the effect's cleanup function unlocked
  // the body BEFORE the next effect ran (React always runs cleanup before
  // re-running an effect). That meant on close the new effect saw an unlocked
  // body and skipped scroll restore — so the page snapped back to the Hero.
  //
  // We now drive everything off a ref that is independent of DOM state.
  const lastNonCaseScroll = useRef(0);
  const wasInCase = useRef(route.name === 'case');

  useEffect(() => {
    if (route.name === 'case') {
      // Save scroll only the FIRST time we enter case mode (so prev/next
      // navigation between cases doesn't keep clobbering the saved value).
      if (!wasInCase.current) {
        lastNonCaseScroll.current = window.scrollY;
      }
      document.body.style.overflow = 'hidden';
      wasInCase.current = true;
    } else {
      const shouldRestore = wasInCase.current;
      document.body.style.overflow = '';
      wasInCase.current = false;
      if (shouldRestore) {
        const y = lastNonCaseScroll.current;
        // Restore immediately…
        window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });
        // …and once more after layout settles, in case the browser fired its
        // own scroll-to-top during the URL change.
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });
        });
      }
    }
  }, [route]);

  // Unmount safety only — never racing with the route effect above.
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Scroll to top when switching between top-level pages (home <-> skills),
  // but not when entering / leaving the case overlay.
  const lastTopRoute = useRef(route.name === 'case' ? 'home' : route.name);
  useEffect(() => {
    if (route.name === 'case') return;
    if (route.name !== lastTopRoute.current) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      lastTopRoute.current = route.name;
    }
  }, [route.name]);

  return (
    <>
      <Header route={route} navigate={navigate} />

      {route.name === 'skills' ? (
        <SkillsPage navigate={navigate} />
      ) : (
        <main>
          <Hero navigate={navigate} />
          <Gallery navigate={navigate} />
          <Footer navigate={navigate} />
        </main>
      )}

      {route.name === 'case' && (
        <CaseDetail id={route.id} navigate={navigate} />
      )}
    </>
  );
}
