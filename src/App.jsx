import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import citizenImage from "./assets/citizen.jpg";
import emperorImage from "./assets/emperor.jpg";
import slaveImage from "./assets/slave.jpg";
import zawaSound from "./assets/zawa.mp3";

const STORAGE_KEY = "ecard-scoreboard-v5";
const REVEAL_DELAY_MS = 5000;
const RESULT_DELAY_MS = 2600;
const ROUND_END_POPUP_DELAY_MS = 5000;
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
  "There are 2 rounds. First to 3 turn-wins takes the round.",
  "Round 1: Player gets 1 King + 4 Citizen. Computer gets 1 Slave + 4 Citizen.",
  "Round 2: Decks swap — Player gets 1 Slave + 4 Citizen. Computer gets 1 King + 4 Citizen.",
  "After each turn, both hands reset to 5 fresh cards.",
  "Two table cards stay face-down for 10 seconds, then reveal.",
  "King or Citizen win = 1 point. Slave win = 3 points. Most round-wins takes the match.",
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
  const hiddenHeight = tiny ? "min-h-[180px]" : compact ? "min-h-[200px]" : "min-h-[260px]";

  if (hidden) {
    return (
      <div className={`ecard-card ecard-back ${hiddenHeight}`}>
        <div className="ecard-back__inner" />
      </div>
    );
  }

  const card = CARD_META[cardKey];

  return (
    <div className="ecard-card overflow-hidden">
      <img src={card.image} alt={card.label} className="aspect-[3/4] w-full object-cover" />
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
              className="absolute left-3 top-[calc(100%+8px)] z-50 min-w-[180px] rounded-[1.25rem] border border-white/10 bg-[#18181c]/95 p-2 shadow-2xl backdrop-blur"
              onClick={() => setMenuOpen(false)}
            >
              <NavLink to="/game" className={linkClass}>Game</NavLink>
              <NavLink to="/rules" className={linkClass}>Rules</NavLink>
              <NavLink to="/leaderboard" className={linkClass}>Leaderboard</NavLink>
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
      <div className={`relative flex flex-col items-center gap-5 rounded-[2rem] border ${accent} bg-[#18181c] px-10 py-10 shadow-2xl`}>
        <p className="text-4xl font-black tracking-tight text-white">{title}</p>
        {subtitle && <p className="text-sm text-slate-300">{subtitle}</p>}
        <button
          type="button"
          onClick={onNext}
          className="mt-2 rounded-full bg-amber-400 px-8 py-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-900 transition hover:bg-amber-300"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}


function GamePage({ game, summary, onReset, onPlay, onNextRound }) {
  const resultText = summary ?? game.status;

  const roundWonByPlayer = game.playerTurnWins > game.computerTurnWins && (game.playerTurnWins + game.computerTurnWins) >= TURNS_TO_END_ROUND;
  const roundWonByComputer = game.computerTurnWins > game.playerTurnWins && (game.playerTurnWins + game.computerTurnWins) >= TURNS_TO_END_ROUND;
  const showRoundPopup = game.showRoundEndPopup && (roundWonByPlayer || roundWonByComputer) && !game.isFinished;
  const showMatchPopup = game.isFinished;

  return (
    <>
      <section className="game-board relative flex min-h-0 flex-1 flex-col rounded-[1.5rem] px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <RoundPill active={game.roundIndex === 0 && !game.isFinished} done={game.roundIndex > 0}>
                R1
              </RoundPill>
              <RoundPill active={game.roundIndex === 1 && !game.isFinished} done={game.isFinished}>
                R2
              </RoundPill>
            </div>
            <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 sm:px-3 sm:py-2 md:px-5 md:py-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 md:gap-6 text-[10px] sm:text-xs md:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-slate-400">Rounds:</span>
                  <span className="font-bold text-emerald-300">{game.playerRoundWins}</span>
                  <span className="text-slate-500">—</span>
                  <span className="font-bold text-rose-300">{game.computerRoundWins}</span>
                </div>
                <div className="hidden sm:block h-4 w-[1px] bg-white/10"></div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-slate-400">Turns:</span>
                  <span className="font-bold text-amber-300">{game.playerTurnWins}</span>
                  <span className="text-slate-500">—</span>
                  <span className="font-bold text-amber-300">{game.computerTurnWins}</span>
                  <span className="text-slate-500">/</span>
                  <span className="font-semibold text-slate-300">3</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-1.5 sm:mt-2 flex justify-center">
          <div className="grid grid-cols-5 gap-0.5 sm:gap-1">
            {game.computerHand.map((_, index) => (
              <div key={`enemy-${game.roundIndex}-${index}`} className="w-[35px] sm:w-[60px] md:w-[72px]">
                <CardFace hidden tiny />
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <div className="board-line" />

          <div className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[2px] border-[#242428] bg-[#8a8a8a] text-white shadow-2xl sm:h-16 sm:w-16 md:h-24 md:w-24">
            <span className="text-sm font-black leading-none sm:text-xl md:text-2xl">{game.computerScore}</span>
            <span className="my-0.5 h-[1.5px] w-4 rounded-full bg-[#2a2a2f] sm:h-[2px] sm:w-6 md:w-7" />
            <span className="text-sm font-black leading-none sm:text-xl md:text-2xl">{game.playerScore}</span>
          </div>

          {/* Computer table card — left of center */}
          <div className="absolute left-1/2 top-1/2 z-20 w-[38px] -translate-x-[calc(50%+55px)] -translate-y-1/2 sm:w-[65px] sm:-translate-x-[calc(50%+100px)] md:w-[80px] md:-translate-x-[calc(50%+130px)]">
            {game.computerTableCard ? (
              <CardFace cardKey={game.computerTableCard} hidden={!game.revealCards} tiny />
            ) : (
              <div className="min-h-[50px] w-full rounded-lg border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm sm:min-h-[85px] sm:rounded-xl md:min-h-[105px] flex items-center justify-center">
                <div className="h-5 w-5 rounded-full border-2 border-dashed border-white/30 sm:h-9 sm:w-9 md:h-11 md:w-11"></div>
              </div>
            )}
            <p className="mt-0.5 sm:mt-1 text-center text-[6px] uppercase tracking-widest text-slate-400 sm:text-[7px] md:text-[8px]">CPU</p>
          </div>

          {/* Player table card — right of center */}
          <div className="absolute left-1/2 top-1/2 z-20 w-[38px] translate-x-[calc(-50%+55px)] -translate-y-1/2 sm:w-[65px] sm:translate-x-[calc(-50%+100px)] md:w-[80px] md:translate-x-[calc(-50%+130px)]">
            {game.playerTableCard ? (
              <CardFace cardKey={game.playerTableCard} hidden={!game.revealCards} tiny />
            ) : (
              <div className="min-h-[50px] w-full rounded-lg border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm sm:min-h-[85px] sm:rounded-xl md:min-h-[105px] flex items-center justify-center">
                <div className="h-5 w-5 rounded-full border-2 border-dashed border-white/30 sm:h-9 sm:w-9 md:h-11 md:w-11"></div>
              </div>
            )}
            <p className="mt-0.5 sm:mt-1 text-center text-[6px] uppercase tracking-widest text-slate-400 sm:text-[7px] md:text-[8px]">You</p>
          </div>

          <div className="absolute right-1.5 top-1/2 z-20 flex w-[75px] -translate-y-1/2 flex-col gap-1.5 sm:right-3 sm:w-[120px] sm:gap-2 md:right-4 md:w-[150px]">
            <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/20 px-1.5 py-1.5 text-center text-[8px] text-slate-200 sm:px-2.5 sm:py-2 sm:text-[9px] md:px-3 md:py-2.5 md:text-[10px]">
              <p className="font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-300">
                {game.phase === "countdown" ? `${game.countdown}s` : game.phase === "result" ? `Turn ${game.turnIndex}` : `Turn ${game.turnIndex + 1}`}
              </p>
              <p className="mt-0.5 sm:mt-1 leading-3 sm:leading-4">{resultText}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex justify-center">
          <div className="grid grid-cols-5 gap-0.5 sm:gap-1">
            {game.playerHand.map((cardKey, index) => (
              <button
                key={`${game.roundIndex}-${cardKey}-${index}`}
                type="button"
                disabled={game.phase !== "idle" || game.isFinished}
                onClick={() => onPlay(index)}
                className="w-[45px] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-45 sm:w-[75px] md:w-[100px]"
              >
                <CardFace cardKey={cardKey} tiny />
              </button>
            ))}
          </div>
        </div>
      </section>

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
          onNext={onReset}
          nextLabel="Play Again"
        />
      )}
    </>
  );
}

function RulesPage() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-8">
      <h2 className="text-3xl font-black">Rules</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {RULE_LINES.map((rule) => (
          <div key={rule} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-200">
            {rule}
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300">
        <p>Round 1: Player gets 1 King and 4 Citizen. Computer gets 1 Slave and 4 Citizen.</p>
        <p>Round 2: Player gets 1 Slave and 4 Citizen. Computer gets 1 King and 4 Citizen.</p>
        <p>After each turn, both hands reset to 5 fresh cards.</p>
        <p>Citizen defeats Slave.</p>
        <p>King defeats Citizen.</p>
        <p>Slave defeats King.</p>
        <p>Same card against same card is a tie with no points.</p>
      </div>
    </section>
  );
}

function LeaderboardPage({ scoreboard }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-black">Leaderboard</h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-300">
          localStorage
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Games</p>
          <p className="mt-2 text-3xl font-black">{scoreboard.totalGames}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Your Wins</p>
          <p className="mt-2 text-3xl font-black">{scoreboard.playerWins}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Computer Wins</p>
          <p className="mt-2 text-3xl font-black">{scoreboard.computerWins}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Draws</p>
          <p className="mt-2 text-3xl font-black">{scoreboard.draws}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          Best player score: <span className="font-semibold text-white">{scoreboard.bestPlayerScore}</span>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          Best computer score: <span className="font-semibold text-white">{scoreboard.bestComputerScore}</span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {scoreboard.history.length > 0 ? (
          scoreboard.history.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm"
            >
              <span className="text-slate-300">
                {item.outcome === "player"
                  ? "You won"
                  : item.outcome === "computer"
                    ? "Computer won"
                    : "Draw"}
              </span>
              <span className="font-semibold text-white">
                {item.playerScore} - {item.computerScore}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-300">No matches saved yet.</p>
        )}
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
            return current;
          }

          if (roundFinished) {
            // Schedule popup to show after 10 seconds
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
        <Route path="/game" element={<GamePage game={game} summary={summary} onReset={resetGame} onPlay={playCard} onNextRound={nextRound} />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage scoreboard={scoreboard} />} />
      </Routes>
    </Shell>
  );
}

export default App;
