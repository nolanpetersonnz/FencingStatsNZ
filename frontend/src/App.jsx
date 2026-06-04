import React, { useState, useEffect, useMemo } from 'react';
import STYLE from './styles.js';
import { DEFAULT_SETTINGS } from './constants.js';
import { processBouts, makeDemoBouts, parseCSV, nameKey } from './data/pipeline.js';
import { loadFromStorage, saveToStorage, clearStorage } from './data/storage.js';
import { loadFencerInfo, buildEnrichmentIndex, genderFromEnrichment, findFencerByLicenceHash, fencerKeyForInfo } from './data/fencerInfo.js';
import { loadOverrides } from './data/edits.js';
import Header from './components/Header.jsx';
import EmptyState from './components/EmptyState.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import FencerProfile from './components/FencerProfile.jsx';
import Competitions from './components/Competitions.jsx';
import CompetitionDetail from './components/CompetitionDetail.jsx';
import Clubs from './components/Clubs.jsx';
import ClubDetail from './components/ClubDetail.jsx';
import HeadToHead from './components/HeadToHead.jsx';
import Method from './components/Method.jsx';
import Admin from './components/Admin.jsx';

export default function App() {
  const [rawBouts, setRawBouts] = useState([]);
  const [fencerInfo, setFencerInfo] = useState([]);
  const [session, setSession] = useState(null); // { licenceHash, info } when signed in
  const [overrides, setOverrides] = useState({ name_overrides: {}, club_overrides: {}, flagged_bouts: [], club_meta: {}, merges: {} });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState('leaderboard');
  const [selectedFencer, setSelectedFencer] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);
  const [selectedClub, setSelectedClub] = useState(null);
  const [history, setHistory] = useState([]);
  const [serverSourced, setServerSourced] = useState(false);
  const [weapon, setWeapon] = useState('epee');
  const [gender, setGender] = useState('M');
  const [ageCategory, setAgeCategory] = useState('all');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Try the canonical server dataset first (public/data/manifest.json
      // produced by scripts/copy-data.mjs). When present, it overrides any
      // localStorage rawBouts so visitors always see the latest pushed data.
      let serverBouts = null;
      try {
        const manifestRes = await fetch('/data/manifest.json', { cache: 'no-cache' });
        if (manifestRes.ok) {
          const paths = await manifestRes.json();
          if (Array.isArray(paths) && paths.length > 0) {
            const collected = [];
            for (const p of paths) {
              const res = await fetch('/' + p, { cache: 'no-cache' });
              if (res.ok) collected.push(...parseCSV(await res.text()));
            }
            if (collected.length > 0) serverBouts = collected;
          }
        }
      } catch {
        // No manifest, offline, etc. — fall through to localStorage.
      }

      const stored = await loadFromStorage();
      if (stored?.settings) setSettings({ ...DEFAULT_SETTINGS, ...stored.settings });

      if (serverBouts) {
        setRawBouts(serverBouts);
        setServerSourced(true);
      } else if (stored?.rawBouts) {
        setRawBouts(stored.rawBouts);
      }

      const info = await loadFencerInfo();
      setFencerInfo(info);

      // Pull live overrides (applied name/club edits + flagged bouts).
      // Failure here is non-fatal — the function gracefully returns an
      // empty doc on Upstash outage.
      const ov = await loadOverrides();
      if (ov) setOverrides({
        name_overrides: ov.name_overrides || {},
        club_overrides: ov.club_overrides || {},
        flagged_bouts: ov.flagged_bouts || [],
        club_meta: ov.club_meta || {},
        merges: ov.merges || {},
      });

      // Restore login session if a hash is in localStorage and still
      // resolves to a known fencer.
      try {
        const savedHash = localStorage.getItem('fl_session_licence_hash');
        if (savedHash) {
          const match = findFencerByLicenceHash(info, savedHash);
          if (match) setSession({ licenceHash: savedHash, info: match });
          else localStorage.removeItem('fl_session_licence_hash');
        }
      } catch {
        // Private-mode browsers may throw on localStorage access — ignore.
      }

      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // When data came from the server, persist only settings — rawBouts is
    // re-fetched on every load, so writing it to localStorage just wastes
    // quota and risks pinning stale data.
    if (serverSourced) saveToStorage({ settings });
    else saveToStorage({ rawBouts, settings });
  }, [rawBouts, settings, loaded, serverSourced]);

  // Apply admin merges by rewriting fencer names on raw bouts before
  // processBouts runs. Source-key bouts get attributed to the target's
  // canonical name, so the two profiles collapse into one rating
  // history. Stored name (`merge_into_name`) wins; fall back to the
  // first occurrence of the target key in the bout list.
  const mergedRawBouts = useMemo(() => {
    const merges = overrides.merges || {};
    const sources = Object.keys(merges);
    if (sources.length === 0) return rawBouts;
    const targetNames = {};
    for (const src of sources) {
      const m = merges[src];
      if (m?.merge_into_name) targetNames[m.merge_into] = m.merge_into_name;
    }
    for (const b of rawBouts) {
      const ka = nameKey(b.fencer_a), kb = nameKey(b.fencer_b);
      if (ka && !targetNames[ka]) targetNames[ka] = b.fencer_a;
      if (kb && !targetNames[kb]) targetNames[kb] = b.fencer_b;
    }
    return rawBouts.map((b) => {
      const ka = nameKey(b.fencer_a), kb = nameKey(b.fencer_b);
      const ta = merges[ka]?.merge_into;
      const tb = merges[kb]?.merge_into;
      if (!ta && !tb) return b;
      const next = { ...b };
      if (ta) next.fencer_a = targetNames[ta] || ta;
      if (tb) next.fencer_b = targetNames[tb] || tb;
      return next;
    });
  }, [rawBouts, overrides.merges]);

  const { fencers: rawFencers, bouts, competitions } = useMemo(
    () => processBouts(mergedRawBouts, settings),
    [mergedRawBouts, settings]
  );

  // name_key → enrichment record, derived from the shipped fencers.json.
  // Defined before `fencers` so the gender fallback below can use it.
  const enrichment = useMemo(() => buildEnrichmentIndex(fencerInfo), [fencerInfo]);

  // Apply live name/club overrides over the bout-derived fencers map, and fill
  // gender from the registry when bout data couldn't determine it (mixed-event-
  // only fencers), so they aren't silently dropped from the gendered leaderboards.
  // Overrides win over what processBouts inferred from the latest bout. We clone
  // shallow so the original object stays stable for rating memoisation elsewhere.
  const fencers = useMemo(() => {
    const { name_overrides, club_overrides } = overrides;
    const out = {};
    for (const k in rawFencers) {
      const f = rawFencers[k];
      const newName = name_overrides[k]?.value;
      const newClub = club_overrides[k]?.value;
      const eg = f.genders.size === 0 ? genderFromEnrichment(enrichment[k]) : null;
      if (newName || newClub || eg) {
        out[k] = {
          ...f,
          name: newName || f.name,
          club: newClub != null ? newClub : f.club,
          genders: eg ? new Set([eg]) : f.genders,
        };
      } else {
        out[k] = f;
      }
    }
    return out;
  }, [rawFencers, overrides, enrichment]);

  const flaggedBouts = useMemo(() => new Set(overrides.flagged_bouts || []), [overrides]);

  // The session fencer's key in the current `fencers` map — null when
  // signed out, or when the signed-in person has no bouts in the dataset.
  const sessionFencerKey = useMemo(
    () => (session ? fencerKeyForInfo(session.info, fencers) : null),
    [session, fencers]
  );

  const hasData = rawBouts.length > 0;

  const handleLogin = (licenceHash, info) => {
    try { localStorage.setItem('fl_session_licence_hash', licenceHash); } catch {}
    setSession({ licenceHash, info });
  };
  const handleLogout = () => {
    try { localStorage.removeItem('fl_session_licence_hash'); } catch {}
    setSession(null);
  };
  const refreshOverrides = async () => {
    const ov = await loadOverrides({ fresh: true });
    if (ov) setOverrides({
      name_overrides: ov.name_overrides || {},
      club_overrides: ov.club_overrides || {},
      flagged_bouts: ov.flagged_bouts || [],
      club_meta: ov.club_meta || {},
      merges: ov.merges || {},
    });
  };

  const pushHistory = () => setHistory(h => [...h, { view, selectedFencer, selectedComp, selectedClub }]);
  const goFencer = (k) => { pushHistory(); setSelectedFencer(k); setSelectedComp(null); setSelectedClub(null); setView('fencer'); };
  const goComp = (id) => { pushHistory(); setSelectedComp(id); setSelectedFencer(null); setSelectedClub(null); setView('comp'); };
  const goClub = (name) => { pushHistory(); setSelectedClub(name); setSelectedFencer(null); setSelectedComp(null); setView('club'); };
  const goBack = () => {
    if (history.length === 0) {
      setSelectedFencer(null); setSelectedComp(null); setSelectedClub(null);
      if (view === 'fencer') setView('leaderboard');
      else if (view === 'comp') setView('competitions');
      else if (view === 'club') setView('clubs');
      return;
    }
    const prev = history[history.length - 1];
    setView(prev.view);
    setSelectedFencer(prev.selectedFencer);
    setSelectedComp(prev.selectedComp);
    setSelectedClub(prev.selectedClub);
    setHistory(history.slice(0, -1));
  };
  const goTab = (v) => {
    setView(v);
    setSelectedFencer(null); setSelectedComp(null); setSelectedClub(null);
    setHistory([]);
  };

  const handleImport = (rows) => {
    setRawBouts(prev => [...prev, ...rows]);
    setView('leaderboard');
  };
  const handleLoadDemo = () => { setRawBouts(makeDemoBouts()); setView('leaderboard'); };
  const handleClear = () => {
    if (confirm('Clear all bouts? This cannot be undone.')) {
      setRawBouts([]); clearStorage();
    }
  };

  useEffect(() => {
    if (!hasData) return;
    if (Object.values(fencers).some(f => f.byWeapon[weapon])) return;
    for (const w of ['epee', 'foil', 'sabre']) {
      if (Object.values(fencers).some(f => f.byWeapon[w])) { setWeapon(w); return; }
    }
  }, [hasData, fencers, weapon]);

  // Hash-route the admin page so it stays off the visible nav. Visit
  // /#admin to access it. Leaving the page returns you to the Ledger.
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#admin' && view !== 'admin') setView('admin');
      else if (window.location.hash !== '#admin' && view === 'admin') setView('leaderboard');
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [view]);

  return (
    <div className="fl-root">
      <style>{STYLE}</style>
      <Header
        view={view}
        setView={goTab}
        weapon={weapon}
        setWeapon={setWeapon}
        gender={gender}
        setGender={setGender}
        ageCategory={ageCategory}
        setAgeCategory={setAgeCategory}
        fencers={fencers}
        onSelectFencer={goFencer}
        hasData={hasData}
        fencerInfo={fencerInfo}
        session={session}
        sessionFencerKey={sessionFencerKey}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px' }}>
        {view === 'admin' ? (
          <Admin
            fencers={fencers}
            overrides={overrides}
            onLeave={() => { window.location.hash = ''; }}
            onChange={refreshOverrides}
            settings={settings}
            setSettings={setSettings}
            rawBouts={rawBouts}
            hasData={hasData}
            onImport={handleImport}
            onLoadDemo={handleLoadDemo}
            onClear={handleClear}
          />
        ) : !hasData ? (
          <EmptyState onLoadDemo={handleLoadDemo} onGotoImport={() => { window.location.hash = 'admin'; }} />
        ) : view === 'leaderboard' ? (
          <Leaderboard fencers={fencers} bouts={bouts} weapon={weapon} gender={gender} ageCategory={ageCategory} settings={settings} enrichment={enrichment} onSelectFencer={goFencer} onSelectClub={goClub} />
        ) : view === 'competitions' ? (
          <Competitions competitions={competitions} weapon={weapon} gender={gender} onSelectComp={goComp} />
        ) : view === 'clubs' ? (
          <Clubs fencers={fencers} gender={gender} weapon={weapon} onSelectClub={goClub} />
        ) : view === 'h2h' ? (
          <HeadToHead fencers={fencers} bouts={bouts} weapon={weapon} gender={gender} settings={settings} onSelectFencer={goFencer} />
        ) : view === 'method' ? (
          <Method bouts={bouts} settings={settings} />
        ) : view === 'fencer' && selectedFencer ? (
          <FencerProfile
            fencerKey={selectedFencer}
            fencers={fencers}
            bouts={bouts}
            competitions={competitions}
            weapon={weapon}
            settings={settings}
            enrichment={enrichment}
            isOwnProfile={sessionFencerKey && sessionFencerKey === selectedFencer}
            session={session}
            flaggedBouts={flaggedBouts}
            onEditApplied={refreshOverrides}
            onBack={goBack}
            onSelectFencer={goFencer}
            onSelectComp={goComp}
            onSelectClub={goClub}
          />
        ) : view === 'comp' && selectedComp ? (
          <CompetitionDetail
            compId={selectedComp}
            competitions={competitions}
            fencers={fencers}
            bouts={bouts}
            onBack={goBack}
            onSelectFencer={goFencer}
            onSelectClub={goClub}
          />
        ) : view === 'club' && selectedClub ? (
          <ClubDetail
            clubName={selectedClub}
            fencers={fencers}
            settings={settings}
            clubMeta={overrides.club_meta?.[selectedClub] || null}
            onBack={goBack}
            onSelectFencer={goFencer}
          />
        ) : null}

        <footer style={{ marginTop: 80, paddingTop: 24, borderTop: '1px solid var(--rule)' }}>
          <div className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', textAlign: 'center' }}>
            Beta  ·  Feedback: <a href="mailto:nolanpeterson.nz@gmail.com" style={{ color: 'var(--ink-soft)' }}>nolanpeterson.nz@gmail.com</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
