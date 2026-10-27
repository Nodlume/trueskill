# @quokkaquery/trueskill

> Built and maintained by [QuokkaQuery](https://quokkaquery.com). Source on [GitHub](https://github.com/Nodlume/trueskill).

TrueSkill Bayesian rating system — Gaussian skill beliefs, 1v1/team/free-for-all matches, match quality predictions, and conservative ratings for display.

## Install

```bash
npm install @quokkaquery/trueskill
```

## Quick Start

```ts
import { RatingPool } from "@quokkaquery/trueskill";

const pool = new RatingPool({ drawProbability: 0.1 });

pool.record1v1("alice", "bob");                       // alice wins
pool.record1v1("bob", "carol", true);                 // draw
pool.recordTeamMatch(["alice", "bob"], ["carol", "dave"]);  // team match

pool.leaderboard();
// [{ id: "alice", mu: 27.6, sigma: 6.3, conservative: 8.7, ... }, ...]

pool.matchQuality("alice", "bob"); // 0.78 — balanced match
```

## Why TrueSkill over ELO?

- **Uncertainty tracking** — new players have wide sigma, veterans narrow. Ratings converge faster.
- **Teams** — natively supports team vs team with individual rating updates.
- **Match quality** — predicts how balanced a match will be before it happens.
- **Conservative rating** — display rating (mu - 3*sigma) means new players start at the bottom and rise as they prove themselves.

## API

### Core Functions (stateless)

```ts
import { rate1v1, matchQuality1v1, conservativeRating, teamGaussian, resolveConfig } from "@quokkaquery/trueskill";

const config = resolveConfig(); // defaults: mu=25, sigma=8.33, beta=4.17, tau=0.083

// Update two Gaussians after a match
const [winner, loser] = rate1v1(
  { mu: 25, sigma: 8.33 },
  { mu: 25, sigma: 8.33 },
  false,   // isDraw
  config,
);

// Match quality (0–1, higher = more balanced)
matchQuality1v1({ mu: 25, sigma: 8 }, { mu: 25, sigma: 8 }, config.beta);

// Display rating
conservativeRating({ mu: 30, sigma: 5 }); // 30 - 15 = 15

// Combine team members into one Gaussian
teamGaussian([{ mu: 25, sigma: 8 }, { mu: 30, sigma: 6 }]);
// { mu: 55, sigma: 10 }
```

### Gaussian Math

```ts
import { pdf, cdf, ppf } from "@quokkaquery/trueskill";

pdf(0);      // 0.3989 — standard normal density
cdf(1.96);   // 0.975  — cumulative distribution
ppf(0.975);  // 1.96   — inverse CDF (quantile)
```

### RatingPool

```ts
import { RatingPool } from "@quokkaquery/trueskill";

const pool = new RatingPool({
  mu: 25,                // initial mean (default: 25)
  sigma: 8.333,          // initial uncertainty (default: mu/3)
  beta: 4.167,           // performance variation (default: sigma/2)
  tau: 0.0833,           // dynamics factor (default: sigma/100)
  drawProbability: 0.1,  // draw probability (default: 0.1)
});

// Players
pool.addPlayer("alice", 30, 5);   // optional mu, sigma
pool.getPlayer("alice");          // { id, mu, sigma, gamesPlayed, wins, losses, draws }
pool.getConservativeRating("alice"); // mu - 3*sigma

// 1v1
pool.record1v1("winner", "loser");
pool.record1v1("alice", "bob", true);  // draw

// Teams
pool.recordTeamMatch(["alice", "bob"], ["carol", "dave"]);
pool.recordTeamMatch(["a", "b"], ["c", "d"], true);  // team draw

// Free-for-all (adjacent rank pairs compared)
pool.recordFreeForAll([
  { id: "first", rank: 1 },
  { id: "second", rank: 2 },
  { id: "tied-2nd", rank: 2 },  // equal ranks = draw
  { id: "third", rank: 3 },
]);

// Match quality
pool.matchQuality("alice", "bob");               // 1v1 balance
pool.teamMatchQuality(["a", "b"], ["c", "d"]);   // team balance

// Queries
pool.leaderboard();  // sorted by conservative rating (mu - 3*sigma)
pool.size;
pool.reset();
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `mu` | 25 | Initial skill mean |
| `sigma` | mu/3 | Initial uncertainty |
| `beta` | sigma/2 | Performance variation per game |
| `tau` | sigma/100 | Dynamics factor (prevents sigma collapse) |
| `drawProbability` | 0.1 | Prior probability of a draw |

## Types

| Type | Description |
|------|-------------|
| `Gaussian` | `{ mu: number, sigma: number }` |
| `Rating` | Gaussian + `{ id, gamesPlayed, wins, losses, draws }` |
| `RatingDelta` | `{ id, oldMu, oldSigma, newMu, newSigma, deltaConservative }` |
| `Team` | `string[]` — array of player IDs |
| `FreeForAllEntry` | `{ id: string, rank: number }` |
| `MatchUpdateResult` | `{ deltas: RatingDelta[] }` |
| `TrueSkillConfig` | Pool configuration options |

## Tests

```bash
npm test       # 57 tests
```

## Gotchas

- **Auto-registration**: `RatingPool.getPlayer()` and all `record*` methods auto-register unknown player IDs with default mu/sigma. No error on typos.
- **`addPlayer` is idempotent**: Returns the existing Rating if the ID already exists, ignoring any mu/sigma args passed.
- **`record1v1` winner/loser order matters**: First arg is the winner. For draws, order still matters slightly due to the directional `t = (winnerMu - loserMu) / c` calculation, though the effect is symmetric for equal-skill players.
- **Free-for-all decomposes into adjacent pairs**: `recordFreeForAll` compares rank 1 vs 2, 2 vs 3, etc. Player at rank 2 gets updated twice (once as loser to rank 1, once as winner over rank 3). This means middle-ranked players accumulate more updates per call.
- **`rate1v1` is pure**: Returns new Gaussians without mutating inputs. `RatingPool.record1v1` mutates the stored `Rating` objects.
- **Beta scaling for teams**: Team match quality and team matches scale beta by `sqrt(totalPlayers) / sqrt(2)`.

## Common Patterns

### Team match (2v2)

```ts
const pool = new RatingPool();
const result = pool.recordTeamMatch(
  ["alice", "bob"],     // winning team
  ["charlie", "dave"],  // losing team
);
// result.deltas has 4 entries, one per player
```

### Free-for-all (race / battle royale)

```ts
pool.recordFreeForAll([
  { id: "alice",   rank: 1 },  // 1st place
  { id: "bob",     rank: 2 },
  { id: "charlie", rank: 2 },  // tied for 2nd (draw between bob & charlie)
  { id: "dave",    rank: 4 },
]);
```

### Standalone rating without pool

```ts
import { resolveConfig, rate1v1, conservativeRating } from "@quokkaquery/trueskill";

const cfg = resolveConfig({ drawProbability: 0 });
const a = { mu: 25, sigma: 8.333 };
const b = { mu: 25, sigma: 8.333 };

const [newA, newB] = rate1v1(a, b, false, cfg);
console.log(conservativeRating(newA)); // display rating
```

## License

MIT © [QuokkaQuery](https://quokkaquery.com)

---

Part of the open-source tooling behind [QuokkaQuery](https://quokkaquery.com).
