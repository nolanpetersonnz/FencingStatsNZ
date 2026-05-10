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
import Clubs from './components/Clubs.jsx';
import ClubDetail from './components/ClubDetail.jsx';
import HeadToHead from './components/HeadToHead.jsx';
import Import from './components/Import.jsx';
import Settings from './components/Settings.jsx';

export default function App() {
  const [rawBouts, setRawBouts] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState('leaderboard');
  const [selectedFencer, setSelectedFencer] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);
  const [selectedClub, setSelectedClub] = useState(null);
  const [history, setHistory] = useState([]);
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
        fencers={fencers}
        onSelectFencer={goFencer}
        hasData={hasData}
      />

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px' }}>
        {!hasData && view !== 'import' && view !== 'settings' ? (
          <EmptyState onLoadDemo={handleLoadDemo} onGotoImport={() => setView('import')} />
        ) : view === 'leaderboard' ? (
          <Leaderboard fencers={fencers} bouts={bouts} weapon={weapon} gender={gender} settings={settings} onSelectFencer={goFencer} onSelectClub={goClub} />
        ) : view === 'competitions' ? (
          <Competitions competitions={competitions} weapon={weapon} gender={gender} onSelectComp={goComp} />
        ) : view === 'clubs' ? (
          <Clubs fencers={fencers} gender={gender} onSelectClub={goClub} />
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
            onBack={goBack}
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
