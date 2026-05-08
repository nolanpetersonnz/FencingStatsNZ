import React, { useState, useEffect, useMemo } from 'react';
import STYLE from './styles.js';
import { DEFAULT_SETTINGS } from './constants.js';
import { processBouts, makeDemoBouts } from './data/pipeline.js';
import { loadFromStorage, saveToStorage, clearStorage } from './data/storage.js';
import Header from './components/Header.jsx';
import EmptyState from './components/EmptyState.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import FencerProfile from './components/FencerProfile.jsx';
import Competitions from './components/Competitions.jsx';
import CompetitionDetail from './components/CompetitionDetail.jsx';
import HeadToHead from './components/HeadToHead.jsx';
import Import from './components/Import.jsx';
import Settings from './components/Settings.jsx';

export default function App() {
  const [rawBouts, setRawBouts] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState('leaderboard');
  const [selectedFencer, setSelectedFencer] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);
  const [weapon, setWeapon] = useState('epee');
  const [gender, setGender] = useState('M');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await loadFromStorage();
      if (data) {
        if (data.rawBouts) setRawBouts(data.rawBouts);
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveToStorage({ rawBouts, settings });
  }, [rawBouts, settings, loaded]);

  const { fencers, bouts, competitions } = useMemo(
    () => processBouts(rawBouts, settings),
    [rawBouts, settings]
  );
  const hasData = rawBouts.length > 0;

  const goFencer = (k) => { setSelectedFencer(k); setSelectedComp(null); setView('fencer'); };
  const goComp = (id) => { setSelectedComp(id); setSelectedFencer(null); setView('comp'); };

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

  return (
    <div className="fl-root">
      <style>{STYLE}</style>
      <Header
        view={view}
        setView={(v) => { setView(v); setSelectedFencer(null); setSelectedComp(null); }}
        weapon={weapon}
        setWeapon={setWeapon}
        gender={gender}
        setGender={setGender}
        fencers={fencers}
        onSelectFencer={goFencer}
        hasData={hasData}
      />

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px' }}>
        {!hasData && view !== 'import' && view !== 'settings' ? (
          <EmptyState onLoadDemo={handleLoadDemo} onGotoImport={() => setView('import')} />
        ) : view === 'leaderboard' ? (
          <Leaderboard fencers={fencers} bouts={bouts} weapon={weapon} gender={gender} settings={settings} onSelectFencer={goFencer} />
        ) : view === 'competitions' ? (
          <Competitions competitions={competitions} weapon={weapon} gender={gender} onSelectComp={goComp} />
        ) : view === 'h2h' ? (
          <HeadToHead fencers={fencers} bouts={bouts} weapon={weapon} gender={gender} settings={settings} onSelectFencer={goFencer} />
        ) : view === 'import' ? (
          <Import onImport={handleImport} onLoadDemo={handleLoadDemo} hasData={hasData} onClear={handleClear} rawBouts={rawBouts} />
        ) : view === 'settings' ? (
          <Settings settings={settings} setSettings={setSettings} onRecompute={() => {}} />
        ) : view === 'fencer' && selectedFencer ? (
          <FencerProfile
            fencerKey={selectedFencer}
            fencers={fencers}
            bouts={bouts}
            competitions={competitions}
            weapon={weapon}
            settings={settings}
            onBack={() => setView('leaderboard')}
            onSelectFencer={goFencer}
            onSelectComp={goComp}
          />
        ) : view === 'comp' && selectedComp ? (
          <CompetitionDetail
            compId={selectedComp}
            competitions={competitions}
            fencers={fencers}
            bouts={bouts}
            onBack={() => setView('competitions')}
            onSelectFencer={goFencer}
          />
        ) : null}

        <footer style={{ marginTop: 80, paddingTop: 24, borderTop: '1px solid var(--rule)' }}>
          <div className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', textAlign: 'center' }}>
            <span className="fl-ornament">❦</span>  A prototype  ·  Rating algorithm under development  ·  Data persists locally
          </div>
        </footer>
      </main>
    </div>
  );
}
