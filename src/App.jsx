import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import citizenImage from "./assets/citizen.jpg";
import emperorImage from "./assets/emperor.jpg";
import slaveImage from "./assets/slave.jpg";
import zawaSound from "./assets/zawa.mp3";

const STORAGE_KEY = "ecard-scoreboard-v5";
const REVEAL_DELAY_MS = 5000;
const RESULT_DELAY_MS = 2600;
const ROUND_END_POPUP_DELAY_MS = 5000;
const MATCH_END_POPUP_DELAY_MS = 4000;
const DECK_SIZE = 5;
const TURNS_TO_END_ROUND = 3;

const CARD_META = {
  citizen: {
    label: "Citizen",
    image: citizenImage,
    accent: "from-sky-400/80 to-cyan-200/80",
    text: "Beats Slave, loses to King.",
  },
  emperor: {
    label: "King",
    image: emperorImage,
    accent: "from-amber-400/80 to-yellow-200/80",
    text: "Beats Citizen, loses to Slave.",
  },
  slave: {
    label: "Slave",
    image: slaveImage,
    accent: "from-rose-500/80 to-orange-300/80",
    text: "Beats King, loses to Citizen.",
  },
};

const RULE_LINES = [
  "ပွဲစဉ် ၂ ခု ကစားရမည်။ အလှည့် (၃) ခု အရင်အနိုင်ရသူသည် ထိုပွဲစဉ်၏ အနိုင်ရရှိသူ ဖြစ်မည်။",
  "ပွဲစဉ် (၁): ကစားသမား - ရှင်ဘုရင် ၁ ကတ် + အရပ်သား ၄ ကတ်။ ကွန်ပျူတာ - ကျွန် ၁ ကတ် + အရပ်သား ၄ ကတ်။",
  "ပွဲစဉ် (၂): ကစားသမား - ကျွန် ၁ ကတ် + အရပ်သား ၄ ကတ်။ ကွန်ပျူတာ - ရှင်ဘုရင် ၁ ကတ် + အရပ်သား ၄ ကတ်။",
  "အလှည့်တိုင်းပြီးဆုံးပါက နှစ်ဖက်စလုံး၏ လက်ထဲတွင် ကတ် ၅ ကတ်စီ ပြန်လည်ဖြည့်တင်းပေးမည်။",
  "ရွေးချယ်ထားသော ကတ်နှစ်ကတ်ကို ၅ စက္ကန့်ကြာ ပြပေးပါမည်။",
  "ရှင်ဘုရင် သို့မဟုတ် အရပ်သား အနိုင်ရ = ၁ မှတ်။ ကျွန် အနိုင်ရ = ၃ မှတ်။ ပွဲစဉ်အများဆုံး အနိုင်ရသူက ပွဲကို အနိုင်ရမည်။",
];

function createScoreboard() {
  return {
    totalGames: 0,
    playerWins: 0,
    computerWins: 0,
    draws: 0,
    bestPlayerScore: 0,
    bestComputerScore: 0,
    history: [],
  };
}

function getRoundDecks(roundIndex) {
  if (roundIndex === 0) {
    return {
      player: ["emperor", "citizen", "citizen", "citizen", "citizen"],
      computer: ["slave", "citizen", "citizen", "citizen", "citizen"],
      playerRole: "king",
      computerRole: "slave",
    };
  }

  return {
    player: ["slave", "citizen", "citizen", "citizen", "citizen"],
    computer: ["emperor", "citizen", "citizen", "citizen", "citizen"],
    playerRole: "slave",
    computerRole: "king",
  };
}

function createGameState() {
  const firstRound = getRoundDecks(0);

  return {
    roundIndex: 0,
    turnIndex: 0,
    playerScore: 0,
    computerScore: 0,
    playerRoundWins: 0,
    computerRoundWins: 0,
    playerTurnWins: 0,
    computerTurnWins: 0,
    playerHand: [...firstRound.player],
    computerHand: [...firstRound.computer],
    playerRole: firstRound.playerRole,
    computerRole: firstRound.computerRole,
    playerTableCard: null,
    computerTableCard: null,
    revealCards: false,
    phase: "idle",
    countdown: REVEAL_DELAY_MS / 1000,
    status: "Round 1: pick one card and place it on the table.",
    lastBattle: null,
    isFinished: false,
    showRoundEndPopup: false,
    showMatchEndPopup: false,
  };
}

function getWinner(playerCard, computerCard) {
  if (playerCard === computerCard) {
    return "tie";
  }

  if (
    (playerCard === "citizen" && computerCard === "slave") ||
    (playerCard === "emperor" && computerCard === "citizen") ||
    (playerCard === "slave" && computerCard === "emperor")
  ) {
    return "player";
  }

  return "computer";
}

function getPoints(card) {
  return card === "slave" ? 3 : 1;
}

function loadScoreboard() {
  if (typeof window === "undefined") {
    return createScoreboard();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...createScoreboard(), ...JSON.parse(raw) } : createScoreboard();
  } catch {
    return createScoreboard();
  }
}

function persistScoreboard(scoreboard) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scoreboard));
}

function CardFace({ cardKey, hidden = false, compact = false, tiny = false }) {
  if (hidden) {
    return (
      <div className="ecard-card ecard-back aspect-[3/5] w-full">
        <div className="ecard-back__inner" />
      </div>
    );
  }

  const card = CARD_META[cardKey];

  return (
    <div className="ecard-card overflow-hidden">
      <img src={card.image} alt={card.label} className="aspect-[3/5] w-full object-cover" />
    </div>
  );
}

function HandCard({ cardKey, disabled, onClick }) {
  const card = CARD_META[cardKey];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group overflow-hidden rounded-[1rem] border border-white/15 bg-white/5 transition duration-200 hover:-translate-y-1 hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <img src={card.image} alt={card.label} className="aspect-[3/4] w-full object-cover" />
    </button>
  );
}

function Shell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `block rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] transition ${
      isActive
        ? "bg-amber-300/15 text-amber-100"
        : "text-slate-200 hover:bg-white/10"
    }`;

  const disabledLinkClass = "block rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500 cursor-not-allowed opacity-50";

  return (
    <main className="min-h-screen overflow-hidden p-1 text-white">
      <div className="flex min-h-[calc(100vh-0.5rem)] w-full flex-col gap-1">
        <header className="relative px-3 py-2.5">
          <div className="flex items-center justify-start">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/15"
              aria-label="Toggle menu"
            >
              <span className="flex flex-col gap-[5px]">
                <span className={`block h-[2px] w-5 rounded-full bg-white transition-all ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
                <span className={`block h-[2px] w-5 rounded-full bg-white transition-all ${menuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-[2px] w-5 rounded-full bg-white transition-all ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
              </span>
            </button>
          </div>

          {menuOpen && (
            <nav
              className="absolute left-3 top-[calc(100%+8px)] z-50 min-w-[200px] rounded-[1.25rem] border border-white/10 bg-[#18181c]/95 p-2 shadow-2xl backdrop-blur"
              onClick={() => setMenuOpen(false)}
            >
              <NavLink to="/game" className={linkClass}>Game</NavLink>
              <NavLink to="/rules" className={linkClass}>Rules</NavLink>
              <NavLink to="/leaderboard" className={linkClass}>Leaderboard</NavLink>
              <div className={disabledLinkClass}>
                Online Match
                <span className="ml-2 text-[10px] text-amber-400">(Coming Soon)</span>
              </div>
              <div className={disabledLinkClass}>
                6 Round Match
                <span className="ml-2 text-[10px] text-amber-400">(Coming Soon)</span>
              </div>
            </nav>
          )}
        </header>

        {children}
      </div>
    </main>
  );
}

function RoundPill({ active, done, children }) {
  return (
    <div
      className={`rounded-full border px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.22em] transition ${
        active
          ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
          : done
            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
            : "border-white/10 bg-white/5 text-slate-400"
      }`}
    >
      {children}
    </div>
  );
}

function ResultPopup({ title, subtitle, accent, onNext, nextLabel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={`relative flex flex-col items-center gap-6 rounded-[2rem] border ${accent} bg-gradient-to-br from-[#18181c] to-[#0f0f12] px-12 py-12 shadow-2xl`}>
        <div className="absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 shadow-lg">
          <span className="text-2xl">🏆</span>
        </div>
        <p className="text-5xl font-black tracking-tight text-white drop-shadow-lg">{title}</p>
        {subtitle && (
          <div className="rounded-xl border border-white/20 bg-white/5 px-6 py-3">
            <p className="text-base text-slate-200">{subtitle}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onNext}
          className="mt-4 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-10 py-4 text-base font-bold uppercase tracking-[0.2em] text-slate-900 shadow-lg transition hover:from-amber-300 hover:to-amber-400 hover:shadow-xl"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}


function GamePage({ game, summary, onReset, onPlay, onNextRound, onMatchEnd }) {
  const resultText = summary ?? game.status;

  const roundWonByPlayer = game.playerTurnWins > game.computerTurnWins && (game.playerTurnWins + game.computerTurnWins) >= TURNS_TO_END_ROUND;
  const roundWonByComputer = game.computerTurnWins > game.playerTurnWins && (game.playerTurnWins + game.computerTurnWins) >= TURNS_TO_END_ROUND;
  const showRoundPopup = game.showRoundEndPopup && (roundWonByPlayer || roundWonByComputer) && !game.isFinished;
  const showMatchPopup = game.showMatchEndPopup && game.isFinished;

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <RoundPill active={game.roundIndex === 0 && !game.isFinished} done={game.roundIndex > 0}>
              R1
            </RoundPill>
            <RoundPill active={game.roundIndex === 1 && !game.isFinished} done={game.isFinished}>
              R2
            </RoundPill>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-900 transition hover:bg-amber-300"
          >
            New Match
          </button>
        </div>

        <div className="flex justify-center gap-3">
          {game.computerHand.map((cardKey, index) => (
            <div key={`computer-${game.roundIndex}-${index}`} className="w-[70px] sm:w-[90px] md:w-[110px]">
              <CardFace cardKey={cardKey} hidden compact />
            </div>
          ))}
        </div>

        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-white/30 bg-black/40 text-white shadow-2xl sm:h-24 sm:w-24">
          <span className="text-xl font-black leading-none sm:text-2xl">{game.computerScore}</span>
          <span className="my-1 h-[2px] w-6 rounded-full bg-white/40 sm:w-8" />
          <span className="text-xl font-black leading-none sm:text-2xl">{game.playerScore}</span>
        </div>

        <div className="flex justify-center gap-3">
          {game.playerHand.map((cardKey, index) => (
            <button
              key={`player-${game.roundIndex}-${cardKey}-${index}`}
              type="button"
              disabled={game.phase !== "idle" || game.isFinished}
              onClick={() => onPlay(index)}
              className="w-[70px] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-45 sm:w-[90px] md:w-[110px]"
            >
              <CardFace cardKey={cardKey} compact />
            </button>
          ))}
        </div>
      </section>

      {(game.phase === "countdown" || game.phase === "result") && game.playerTableCard && game.computerTableCard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-[120px]">
                <CardFace cardKey={game.computerTableCard} hidden={!game.revealCards} />
              </div>
              <p className="text-sm uppercase tracking-widest text-slate-300">CPU</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-[120px]">
                <CardFace cardKey={game.playerTableCard} hidden={!game.revealCards} />
              </div>
              <p className="text-sm uppercase tracking-widest text-slate-300">You</p>
            </div>
          </div>
          {game.phase === "countdown" && (
            <div className="absolute bottom-8 text-2xl font-bold text-white">
              {game.countdown}s
            </div>
          )}
        </div>
      )}

      {showRoundPopup && (
        <ResultPopup
          title={roundWonByPlayer ? "You win Round " + (game.roundIndex + 1) + "!" : "Computer wins Round " + (game.roundIndex + 1) + "!"}
          subtitle={`Score: You ${game.playerScore} — CPU ${game.computerScore}`}
          accent={roundWonByPlayer ? "border-emerald-400/40" : "border-rose-400/40"}
          onNext={onNextRound}
          nextLabel="Next Round"
        />
      )}

      {showMatchPopup && (
        <ResultPopup
          title={summary}
          subtitle={`Final Score: You ${game.playerScore} — CPU ${game.computerScore} | Rounds: You ${game.playerRoundWins} — CPU ${game.computerRoundWins}`}
          accent={game.playerRoundWins > game.computerRoundWins ? "border-amber-400/40" : game.playerRoundWins < game.computerRoundWins ? "border-rose-400/40" : "border-white/20"}
          onNext={() => {
            onMatchEnd();
            onReset();
          }}
          nextLabel="Play Again"
        />
      )}
    </>
  );
}

function RulesPage() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-8">
      <h2 className="text-3xl font-black">ကစားနည်း စည်းမျဉ်းများ</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {RULE_LINES.map((rule) => (
          <div key={rule} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-200">
            {rule}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <p className="font-bold text-amber-300 mb-6 text-lg">ကတ်များ စာရင်း</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-5">
            <div className="flex justify-center mb-4">
              <div className="w-32">
                <img src={citizenImage} alt="Citizen" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
            </div>
            <p className="text-center text-base font-bold text-sky-200">အရပ်သား (Citizen)</p>
          </div>
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">
            <div className="flex justify-center mb-4">
              <div className="w-32">
                <img src={emperorImage} alt="King" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
            </div>
            <p className="text-center text-base font-bold text-amber-200">ရှင်ဘုရင် (King)</p>
          </div>
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-5">
            <div className="flex justify-center mb-4">
              <div className="w-32">
                <img src={slaveImage} alt="Slave" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
            </div>
            <p className="text-center text-base font-bold text-rose-200">ကျွန် (Slave)</p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <p className="font-bold text-amber-300 mb-6 text-lg">အနိုင်အရှုံး သတ်မှတ်ချက်</p>
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-20">
                <img src={citizenImage} alt="Citizen" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
              <div className="text-2xl font-bold text-white">VS</div>
              <div className="w-20">
                <img src={slaveImage} alt="Slave" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-emerald-200">အရပ်သား (Citizen)</p>
            <p className="text-center text-xs text-slate-300 mt-1">ကျွန် (Slave) ကို နိုင်သည်</p>
            <p className="text-center text-xs text-amber-300 mt-2 font-bold">+1 မှတ်</p>
          </div>
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-20">
                <img src={emperorImage} alt="King" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
              <div className="text-2xl font-bold text-white">VS</div>
              <div className="w-20">
                <img src={citizenImage} alt="Citizen" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-amber-200">ရှင်ဘုရင် (King)</p>
            <p className="text-center text-xs text-slate-300 mt-1">အရပ်သား (Citizen) ကို နိုင်သည်</p>
            <p className="text-center text-xs text-amber-300 mt-2 font-bold">+1 မှတ်</p>
          </div>
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-5">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-20">
                <img src={slaveImage} alt="Slave" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
              <div className="text-2xl font-bold text-white">VS</div>
              <div className="w-20">
                <img src={emperorImage} alt="King" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-rose-200">ကျွန် (Slave)</p>
            <p className="text-center text-xs text-slate-300 mt-1">ရှင်ဘုရင် (King) ကို နိုင်သည်</p>
            <p className="text-center text-xs text-rose-300 mt-2 font-bold">+3 မှတ်</p>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-5">
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="w-16">
              <img src={citizenImage} alt="Citizen" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
            </div>
            <div className="text-xl font-bold text-slate-400">=</div>
            <div className="w-16">
              <img src={citizenImage} alt="Citizen" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />
            </div>
          </div>
          <p className="text-sm text-slate-300 text-center font-semibold mb-1">သရေ (Draw)</p>
          <p className="text-xs text-slate-400 text-center">တူညီသောကတ်များ (ဥပမာ- အရပ်သား နှင့် အရပ်သား) ကျပါက သရေဖြစ်ပြီး အမှတ်မရရှိပါ။</p>
        </div>
      </div>
    </section>
  );
}

function LeaderboardPage({ scoreboard }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-8">
      <div className="flex items-center justify-between gap-3 mb-8">
        <h2 className="text-3xl font-black text-amber-300">Leaderboard</h2>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200">
          localStorage
        </span>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border border-sky-400/30 bg-gradient-to-br from-sky-400/10 to-cyan-400/5 p-6 shadow-lg">
          <p className="text-sm text-sky-300 font-semibold">Total Games</p>
          <p className="mt-3 text-4xl font-black text-white">{scoreboard.totalGames}</p>
        </div>
        <div className="rounded-[1.5rem] border border-emerald-400/30 bg-gradient-to-br from-emerald-400/10 to-green-400/5 p-6 shadow-lg">
          <p className="text-sm text-emerald-300 font-semibold">Your Wins</p>
          <p className="mt-3 text-4xl font-black text-white">{scoreboard.playerWins}</p>
        </div>
        <div className="rounded-[1.5rem] border border-rose-400/30 bg-gradient-to-br from-rose-400/10 to-red-400/5 p-6 shadow-lg">
          <p className="text-sm text-rose-300 font-semibold">Computer Wins</p>
          <p className="mt-3 text-4xl font-black text-white">{scoreboard.computerWins}</p>
        </div>
        <div className="rounded-[1.5rem] border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-yellow-400/5 p-6 shadow-lg">
          <p className="text-sm text-amber-300 font-semibold">Draws</p>
          <p className="mt-3 text-4xl font-black text-white">{scoreboard.draws}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-emerald-400/30 bg-gradient-to-br from-emerald-400/10 to-green-400/5 p-6 shadow-lg">
          <p className="text-sm text-emerald-300 font-semibold mb-2">Best Player Score</p>
          <p className="text-3xl font-black text-white">{scoreboard.bestPlayerScore}</p>
        </div>
        <div className="rounded-[1.5rem] border border-rose-400/30 bg-gradient-to-br from-rose-400/10 to-red-400/5 p-6 shadow-lg">
          <p className="text-sm text-rose-300 font-semibold mb-2">Best Computer Score</p>
          <p className="text-3xl font-black text-white">{scoreboard.bestComputerScore}</p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold text-amber-300 mb-4">Match History</h3>
        <div className="space-y-3">
          {scoreboard.history.length > 0 ? (
            scoreboard.history.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-gradient-to-r from-white/5 to-white/10 px-6 py-4 shadow-md hover:border-white/20 transition"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-slate-300">
                    #{index + 1}
                  </span>
                  <span className={`text-base font-semibold ${
                    item.outcome === "player"
                      ? "text-emerald-300"
                      : item.outcome === "computer"
                        ? "text-rose-300"
                        : "text-amber-300"
                  }`}>
                    {item.outcome === "player"
                      ? "You Won"
                      : item.outcome === "computer"
                        ? "Computer Won"
                        : "Draw"}
                  </span>
                </div>
                <span className="text-lg font-bold text-white">
                  {item.playerScore} - {item.computerScore}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-slate-400 py-8">No matches saved yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [game, setGame] = useState(createGameState);
  const [scoreboard, setScoreboard] = useState(createScoreboard);
  const countdownIntervalRef = useRef(null);
  const resultTimeoutRef = useRef(null);
  const saveGuardRef = useRef("");

  useEffect(() => {
    setScoreboard(loadScoreboard());
  }, []);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }
      if (resultTimeoutRef.current) {
        window.clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!game.isFinished) {
      return;
    }

    const signature = `${game.playerScore}:${game.computerScore}:${game.roundIndex}:${game.turnIndex}`;
    if (saveGuardRef.current === signature) {
      return;
    }
    saveGuardRef.current = signature;

    setScoreboard((current) => {
      const outcome =
        game.playerRoundWins > game.computerRoundWins
          ? "player"
          : game.playerRoundWins < game.computerRoundWins
            ? "computer"
            : "draw";

      const next = {
        totalGames: current.totalGames + 1,
        playerWins: current.playerWins + (outcome === "player" ? 1 : 0),
        computerWins: current.computerWins + (outcome === "computer" ? 1 : 0),
        draws: current.draws + (outcome === "draw" ? 1 : 0),
        bestPlayerScore: Math.max(current.bestPlayerScore, game.playerScore),
        bestComputerScore: Math.max(current.bestComputerScore, game.computerScore),
        history: [
          {
            id: `${Date.now()}-${signature}`,
            playerScore: game.playerScore,
            computerScore: game.computerScore,
            outcome,
          },
          ...current.history,
        ].slice(0, 10),
      };

      persistScoreboard(next);
      return next;
    });
  }, [game.computerRoundWins, game.isFinished, game.playerRoundWins, game.playerScore, game.computerScore, game.roundIndex, game.turnIndex]);

  const summary = useMemo(() => {
    if (!game.isFinished) {
      return null;
    }
    if (game.playerRoundWins > game.computerRoundWins) {
      return "You win the match!";
    }
    if (game.playerRoundWins < game.computerRoundWins) {
      return "Computer wins the match.";
    }
    return "The match is a draw.";
  }, [game.computerRoundWins, game.isFinished, game.playerRoundWins]);

  function clearTimers() {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (resultTimeoutRef.current) {
      window.clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
  }

  function clearCountdownInterval() {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  function resetGame() {
    clearTimers();
    saveGuardRef.current = "";
    setGame(createGameState());
  }

  function handleMatchEnd() {
    clearTimers();
    setGame((current) => ({ ...current, showMatchEndPopup: false }));
  }

  function moveToNextRoundOrFinish(current) {
    const nextRoundIndex = current.roundIndex + 1;

    if (nextRoundIndex > 1) {
      return {
        ...current,
        playerTableCard: null,
        computerTableCard: null,
        revealCards: false,
        phase: "finished",
        status: "Match finished.",
        isFinished: true,
      };
    }

    const nextRound = getRoundDecks(nextRoundIndex);
    return {
      ...current,
      roundIndex: nextRoundIndex,
      turnIndex: 0,
      playerTurnWins: 0,
      computerTurnWins: 0,
      playerHand: [...nextRound.player],
      computerHand: [...nextRound.computer],
      playerRole: nextRound.playerRole,
      computerRole: nextRound.computerRole,
      playerTableCard: null,
      computerTableCard: null,
      revealCards: false,
      phase: "idle",
      countdown: REVEAL_DELAY_MS / 1000,
      status: `Round ${nextRoundIndex + 1}: decks changed. You now play the ${nextRound.playerRole} set.`,
      isFinished: false,
    };
  }

  function startRoundResolution(playerCard, playerIndex) {
    const computerIndex = Math.floor(Math.random() * game.computerHand.length);
    const computerCard = game.computerHand[computerIndex];

    setGame((current) => ({
      ...current,
      playerTableCard: playerCard,
      computerTableCard: computerCard,
      playerHand: current.playerHand.filter((_, index) => index !== playerIndex),
      computerHand: current.computerHand.filter((_, index) => index !== computerIndex),
      revealCards: false,
      phase: "countdown",
      countdown: REVEAL_DELAY_MS / 1000,
      status: "Cards are on the table. Reveal in 5 seconds.",
    }));

    countdownIntervalRef.current = window.setInterval(() => {
      setGame((current) => {
        if (current.countdown <= 1) {
          clearCountdownInterval();
          return current;
        }
        return { ...current, countdown: current.countdown - 1 };
      });
    }, 1000);

    resultTimeoutRef.current = window.setTimeout(() => {
      clearCountdownInterval();

      setGame((current) => {
        const winner = getWinner(playerCard, computerCard);
        const winnerCard = winner === "player" ? playerCard : winner === "computer" ? computerCard : null;
        const points = winnerCard ? getPoints(winnerCard) : 0;

        const nextPlayerTurnWins = current.playerTurnWins + (winner === "player" ? 1 : 0);
        const nextComputerTurnWins = current.computerTurnWins + (winner === "computer" ? 1 : 0);
        const nextTurn = current.turnIndex + 1;

        const totalTurnWins = nextPlayerTurnWins + nextComputerTurnWins;
        const roundFinished = totalTurnWins >= TURNS_TO_END_ROUND;
        const roundWonByPlayer = roundFinished && nextPlayerTurnWins > nextComputerTurnWins;
        const roundWonByComputer = roundFinished && nextComputerTurnWins > nextPlayerTurnWins;

        const nextPlayerRoundWins = current.playerRoundWins + (roundWonByPlayer ? 1 : 0);
        const nextComputerRoundWins = current.computerRoundWins + (roundWonByComputer ? 1 : 0);

        const matchFinished = roundFinished && (current.roundIndex === 1 || nextPlayerRoundWins >= 2 || nextComputerRoundWins >= 2);

        let statusMsg =
          winner === "tie"
            ? "Tie. Both cards cancel each other."
            : `${winner === "player" ? "You" : "Computer"} win this turn and get ${points} point${points > 1 ? "s" : ""}.`;

        if (roundFinished) {
          statusMsg += roundWonByPlayer ? " You win this round!" : " Computer wins this round!";
        }

        if (winner !== "tie") {
          const audio = new Audio(zawaSound);
          audio.play().catch(() => {});
        }

        return {
          ...current,
          revealCards: true,
          playerScore: current.playerScore + (winner === "player" ? points : 0),
          computerScore: current.computerScore + (winner === "computer" ? points : 0),
          playerTurnWins: nextPlayerTurnWins,
          computerTurnWins: nextComputerTurnWins,
          playerRoundWins: nextPlayerRoundWins,
          computerRoundWins: nextComputerRoundWins,
          phase: "result",
          status: statusMsg,
          lastBattle: { playerCard, computerCard, winner, points },
          turnIndex: nextTurn,
          isFinished: matchFinished,
        };
      });

      resultTimeoutRef.current = window.setTimeout(() => {
        setGame((current) => {
          const totalTurnWins = current.playerTurnWins + current.computerTurnWins;
          const roundFinished = totalTurnWins >= TURNS_TO_END_ROUND;
          const roundWonByPlayer = roundFinished && current.playerTurnWins > current.computerTurnWins;
          const roundWonByComputer = roundFinished && current.computerTurnWins > current.playerTurnWins;

          if (current.isFinished) {
            // Schedule match end popup to show after 4 seconds
            resultTimeoutRef.current = window.setTimeout(() => {
              setGame((c) => ({ ...c, showMatchEndPopup: true }));
            }, MATCH_END_POPUP_DELAY_MS);
            return current;
          }

          if (roundFinished) {
            // Schedule popup to show after 5 seconds
            resultTimeoutRef.current = window.setTimeout(() => {
              setGame((c) => ({ ...c, showRoundEndPopup: true }));
            }, ROUND_END_POPUP_DELAY_MS);
            return current;
          }

          const hadWinner = current.lastBattle && current.lastBattle.winner !== "tie";
          const roundDecks = getRoundDecks(current.roundIndex);
          return {
            ...current,
            playerTableCard: null,
            computerTableCard: null,
            revealCards: false,
            phase: "idle",
            countdown: REVEAL_DELAY_MS / 1000,
            playerHand: hadWinner ? [...roundDecks.player] : current.playerHand,
            computerHand: hadWinner ? [...roundDecks.computer] : current.computerHand,
            status: `Round ${current.roundIndex + 1}: pick the next card. (${current.playerTurnWins}-${current.computerTurnWins} turn wins)`,
          };
        });

        resultTimeoutRef.current = null;
      }, RESULT_DELAY_MS);
    }, REVEAL_DELAY_MS);
  }

  function playCard(cardIndex) {
    if (game.phase !== "idle" || game.isFinished) {
      return;
    }

    const playerCard = game.playerHand[cardIndex];
    if (!playerCard) {
      return;
    }

    startRoundResolution(playerCard, cardIndex);
  }

  function nextRound() {
    clearTimers();
    setGame((current) => {
      const next = moveToNextRoundOrFinish(current);
      return { ...next, showRoundEndPopup: false };
    });
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/game" replace />} />
        <Route path="/game" element={<GamePage game={game} summary={summary} onReset={resetGame} onPlay={playCard} onNextRound={nextRound} onMatchEnd={handleMatchEnd} />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage scoreboard={scoreboard} />} />
      </Routes>
      <Analytics />
    </Shell>
  );
}

export default App;
