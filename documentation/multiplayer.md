# Multiplayer

Turn-based multiplayer layered on top of the single-player arcade. Three games live: **Tic Tac Toe MP**, **Battleship MP**, and **8 Ball Pool MP (lite)**.

## Architecture

The server is a **dumb append-only event log**. It stores ordered move payloads as opaque `jsonb` and enforces the bare minimum (you're a participant, the game has started). Each game's client interprets its own payload shapes and enforces its own rules.

Result: one set of database tables and one API endpoint serve three structurally different games. Adding a fourth game is one new client component plus one switch case.

## Database

### `game_sessions`
A multiplayer room.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Hash of (gameId, hostUserId) — same host can't double-create |
| `game_id` | int | References `gameData.js` (1..18) |
| `public` | bool | Random matchmaking can find this room |
| `is_full` | bool | True when participant count hits `max_players` |
| `max_players` | int (default 2) | Per-room capacity |
| `created_by` | text → users.id (SET NULL) | Host. Survives host account deletion |
| `created_at` | timestamptz | |

### `game_participants`
One row per (session, user). Composite PK enforces "user in this session at most once."

| Column | Type | Notes |
|---|---|---|
| `game_session_id` | text → game_sessions.id (CASCADE) | |
| `user_id` | text → users.id (CASCADE) | |
| `seat` | int (default 0) | Turn order — first joiner = 0, second = 1 |
| `joined_at` | timestamptz | |

Index on `user_id` for "show me all my sessions."

### `game_moves`
The append-only event log.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | nanoid |
| `game_session_id` | text → game_sessions.id (CASCADE) | |
| `sender_id` | text → users.id (SET NULL) | Survives sender deletion as anonymous |
| `move_number` | int | Server-assigned absolute sequence |
| `payload` | jsonb | Game-specific shape, opaque to the server |
| `created_at` | timestamptz | |

Index on `(game_session_id, move_number)` — hot path for replay.

**Why jsonb**: TicTacToe stores `{cell: 4}`. Battleship stores `{type: "fire", x: 3, y: 7}`. Pool stores `{type: "shot", angleDeg: 42, power: 80}`. Server doesn't know or care.

## API endpoints

### `/api/games/[id]/multiplayer/gameRoom`

Room lifecycle.

| Method | Purpose | Body |
|---|---|---|
| `GET` | Snapshot of the room the caller is in for this game (or 204 if none). Used by lobby auto-rejoin and play-page seat lookup. | — |
| `POST` | Create a new room. Host gets seat 0. | `{ isChecked, maxPlayers? }` |
| `PUT` | Join existing room. Pass `null` roomID to find a random public one. | `{ roomID }` |
| `DELETE` | Leave. Drops the room entirely if you were the last participant; otherwise flips `is_full` back to false. | `{ roomID }` |

**PUT membership check ordering**: membership is checked BEFORE the `isFull` guard. Returning players always re-enter their existing room even if it's now full. Only new joiners hit the fullness gate.

### `/api/games/[id]/multiplayer/moves`

Generic event log. Same handler serves all three games.

| Method | Purpose |
|---|---|
| `GET` | Returns the move list. Supports `?lastCount=N` cache cursor — server returns `{count, unchanged: true}` and skips the moves SELECT when nothing's new. |
| `POST` | Submit a move. Body: `{ sessionId, payload }`. Server appends at next slot, no turn validation. |
| `DELETE` | Wipe moves. `?onlyMyVote=true` wipes only the caller's rematch-vote rows. |

The `GET` cache cursor means polling at 500ms is cheap — most polls cost a parallel pair of COUNT queries and return ~30 bytes.

## Client architecture

### Routes

- `/games/[id]/lobby` — pre-game lobby for any multiplayer-grouped game
- `/games/[id]/play?session=X` — actual gameplay

### Reusable pieces

| File | Purpose |
|---|---|
| `MultiplayerEndOverlay.tsx` | Generic end-of-game screen — takes `outcome: "win"\|"loss"\|"draw"` and optional headline/subtitle overrides |
| `useRematchVote.ts` | Hook that owns the rematch state machine: vote tracking, opponent-left detection, host-only DELETE trigger |

These two pieces eliminate the ~150 lines of duplicated rematch UI that would otherwise live in each MP component.

### Per-game MP components

Each (`TicTacToeMultiplayer`, `BattleshipMultiplayer`, `PoolMultiplayer`) follows the same pattern:

1. Poll `/multiplayer/moves` every 500ms with the lastCount cursor
2. Filter moves by payload type — gameplay vs meta (rematch-vote, game-start, forfeit)
3. Replay gameplay moves into local board state
4. Detect win/draw/forfeit locally
5. On click: validate locally, POST `{ sessionId, payload }`
6. Use `useRematchVote` + `MultiplayerEndOverlay` for end-of-game

## Notable design tricks

### Synced game start without a new column
The Start button posts `{type: "game-start"}` to the moves endpoint. Both lobbies poll for this signal — whoever sees it first navigates to `/play`. Reuses the existing event-log infrastructure.

### Rematch consent without a votes table
Same trick: each player posts `{type: "rematch-vote"}`. The hook tallies votes from the move list. When both are present, the host fires `DELETE /moves` to wipe (which also wipes the votes — same table). No schema change.

### Cancel-vote via jsonb operator
`DELETE /moves?onlyMyVote=true` uses Postgres's `payload->>'type' = 'rematch-vote'` operator in the WHERE clause to surgically remove only one player's votes.

### Forfeit-on-leave
The leave button posts `{type: "forfeit"}` BEFORE calling DELETE on the room. The opponent's polling picks it up on next tick and renders a "win by forfeit" overlay instead of staring at a frozen board.

### Battleship secret placement
Ship positions are randomized in `useState` initializer — pure local state, **never sent over the wire**. When opponent fires at (x, y), your client checks against your local ships and posts back only the hit/miss result. Genuine no-cheat secrecy without encryption or trusted server.

### Deterministic Pool outcomes
Both clients run an identical hash function (`(moveNumber * 2654435761) ^ (angleDeg * 100)` etc.) against the same inputs and reach the same sunk-ball counts. No server adjudication needed. Same trick lockstep RTS games use.

### Host-only DELETE on rematch
When both votes land, both clients see "rematch agreed" simultaneously. To avoid a double-wipe race, only the host (seat 0) fires the DELETE. The other client gets a delayed refetch and picks up the empty list naturally.

## Adding a new multiplayer game

1. **Pick an id** in `src/data/gameData.js` (next integer)
2. **Build the client component** in `src/components/games/multiplayer/`:
   - Poll `/multiplayer/moves` with cursor caching
   - Define your `MovePayload` union type
   - Filter gameplay vs meta payloads
   - Use `useRematchVote` + `MultiplayerEndOverlay`
3. **Add the switch case** in `src/app/games/[id]/play/page.tsx`
4. Done. No server-side changes needed.

## Files

| File | Role |
|---|---|
| `src/db/schema.ts` | All three multiplayer tables |
| `src/app/api/games/[id]/multiplayer/gameRoom/route.ts` | Room lifecycle |
| `src/app/api/games/[id]/multiplayer/moves/route.ts` | Event log |
| `src/components/games/multiplayer/useRematchVote.ts` | Rematch state machine |
| `src/components/games/multiplayer/MultiplayerEndOverlay.tsx` | Generic end-of-game UI |
| `src/components/games/multiplayer/TicTacToeMultiplayer.tsx` | TTT |
| `src/components/games/multiplayer/BattleshipMultiplayer.tsx` | Battleship |
| `src/components/games/multiplayer/PoolMultiplayer.tsx` | Pool (lite) |
| `src/app/games/[id]/lobby/page.tsx` | Lobby with auto-rejoin + synced start |
| `src/app/games/[id]/play/page.tsx` | Mounts the right MP component |
