export const games = [
  {
    id: 1,
    title: "Mario Platformer",
    description: "Run, jump, and collect stars in a colorful platforming demo.",
    creator: "Miraaj Studios",
    theme: "platformer",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    // Leaderboard semantics:
    //   "highScore" — rank by max single-run score, DESC (Tetris, Flappy, etc.)
    //   "bestTime"  — rank by min single-run score (interpreted as time), ASC (Sudoku, Minesweeper)
    //   "none"      — no public leaderboard. Used for win/lose games where a
    //                 ranked list doesn't make sense: vs-CPU singleplayer
    //                 (Chess, TTT, Pool, Battleship) and the true multiplayer
    //                 games (which are just join/leave). The leaderboard UI
    //                 should skip rendering for these.
    leaderboardType: "highScore"
  },
  {
    id: 2,
    title: "8 Ball Pool",
    description: "Take the shot and sink the solids and stripes in a casual pool table simulator.",
    creator: "Pocket Arcade",
    theme: "pool",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    // vs CPU — win/lose only, no leaderboard
    leaderboardType: "none"
  },
  {
    id: 3,
    title: "Top-Down Shooter",
    description: "Survive waves of enemies in a fast-paced top-down arena.",
    creator: "Arcade Lab",
    theme: "shooter",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },
  {
    id: 4,
    title: "Chess Master",
    description: "Plan your strategy across the board with a polished chess interface.",
    creator: "Royal Code",
    theme: "chess",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    // vs CPU — win/lose only, no leaderboard
    leaderboardType: "none"
  },
  {
    id: 5,
    title: "Tic Tac Toe",
    description: "Classic grid-based strategy with interactive win detection.",
    creator: "Miraaj Games",
    theme: "puzzle",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    // vs CPU — win/lose only, no leaderboard
    leaderboardType: "none"
  },
  {
    id: 6,
    title: "Memory Match",
    description: "Flip cards and match pairs in a quick, addictive brain teaser.",
    creator: "Miraaj Games",
    theme: "strategy",
    version: 1,
    grouping: "singleplayer",
    // Score = total moves to clear all levels. Lower is better.
    sortedOrder: "ASC",
    leaderboardType: "bestTime"
  },
  {
    id: 7,
    title: "Space Invaders",
    description: "Defend Earth from alien invaders in this classic arcade shooter.",
    creator: "Retro Arcade",
    theme: "shooter",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },
  {
    id: 8,
    title: "Pac-Man",
    description: "Navigate mazes, eat dots, and avoid ghosts in this iconic maze game.",
    creator: "Namco Classics",
    theme: "arcade",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },
  {
    id: 9,
    title: "Tetris",
    description: "Arrange falling blocks to clear lines in this timeless puzzle game.",
    creator: "Puzzle Masters",
    theme: "puzzle",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },
  {
    id: 10,
    title: "Crossword Puzzle",
    description: "Solve word puzzles and expand your vocabulary with themed crosswords.",
    creator: "Word Games Inc",
    theme: "puzzle",
    version: 1,
    grouping: "singleplayer",
    // Score = seconds to complete all puzzles. Lower is better.
    sortedOrder: "ASC",
    leaderboardType: "bestTime"
  },
  {
    id: 11,
    title: "Battleship",
    description: "Hunt down the enemy fleet in a grid-based duel against a smart computer opponent.",
    creator: "Miraaj Games",
    theme: "strategy",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    // vs CPU — win/lose only, no leaderboard
    leaderboardType: "none"
  },
  {
    id: 12,
    title: "Minesweeper",
    description: "Sweep the randomized minefield using number clues and flags to mark the mines.",
    creator: "Miraaj Games",
    theme: "puzzle",
    version: 1,
    grouping: "singleplayer",
    // Score = seconds to clear board. Lower is better. Losses submit a high
    // sentinel so completed runs always rank above failed ones.
    sortedOrder: "ASC",
    leaderboardType: "bestTime"
  },
  {
    id: 13,
    title: "Sudoku",
    description: "Fill the 9x9 grid with a freshly generated puzzle every game.",
    creator: "Miraaj Games",
    theme: "puzzle",
    version: 1,
    grouping: "singleplayer",
    // Score = seconds to fill the grid. Lower is better.
    sortedOrder: "ASC",
    leaderboardType: "bestTime"
  },
  {
    id: 14,
    title: "Flappy Bird",
    description: "Tap to flap and dodge endless pipes — survive as long as you can.",
    creator: "Miraaj Games",
    theme: "arcade",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },
  {
    id: 15,
    title: "Crossy Road",
    description: "Hop across roads and rivers through escalating levels of chaos.",
    creator: "Miraaj Games",
    theme: "arcade",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },
  {
    id: 16,
    title: "Tic Tac Toe",
    description: "Classic grid-based strategy with another player.",
    creator: "Miraaj Games",
    theme: "puzzle",
    version: 1,
    grouping: "multiplayer",
    sortedOrder: "DESC",
    // True MP — join/leave only, no leaderboard
    leaderboardType: "none"
  },
  {
    id: 17,
    title: "Battleship",
    description: "Hunt the enemy fleet across two grids — placement is secret, shots are everything.",
    creator: "Miraaj Games",
    theme: "strategy",
    version: 1,
    grouping: "multiplayer",
    sortedOrder: "DESC",
    leaderboardType: "none"
  },
  {
    id: 18,
    title: "8 Ball Pool",
    description: "Take turns calling shots in a pared-down two-player rack.",
    creator: "Miraaj Games",
    theme: "pool",
    version: 1,
    grouping: "multiplayer",
    sortedOrder: "DESC",
    leaderboardType: "none"
  },
  {
    id: 19,
    title: "Wordle",
    description: "Guess the 5-letter word in 6 tries. Green = right spot, yellow = wrong spot.",
    creator: "Miraaj Games",
    theme: "puzzle",
    version: 1,
    grouping: "singleplayer",
    // Score = number of guesses used. Lower is better. Losses submit a sentinel
    // (7) so completed wins always rank above failed runs.
    sortedOrder: "ASC",
    leaderboardType: "bestTime",
    // Daily-reset: leaderboard shows only today's UTC-day scores. Pairs with
    // the daily play lock — each user has at most one row per day, so the
    // board is naturally a "who solved today's word fastest" snapshot.
    dailyReset: true
  },
  {
    id: 20,
    title: "Sky Jump",
    description: "Bounce up a tower of platforms — boost off gold, dodge red, time the cyan movers.",
    creator: "Miraaj Games",
    theme: "arcade",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },
  {
    id: 21,
    title: "Snake",
    description: "Eat to grow, don't bite yourself. Speed climbs with length.",
    creator: "Miraaj Games",
    theme: "arcade",
    version: 1,
    grouping: "singleplayer",
    sortedOrder: "DESC",
    leaderboardType: "highScore"
  },

];