// Shared Player Stats (YTD) aggregation.
//
// Used by both the Player Stats dialog and the header player search so the two
// always rank an identical set of players. Keep this the single source of truth
// for the leaderboard's scoring and ordering.

import dayjs from 'dayjs';

const SURFACES = ['Hard', 'Indoor Hard', 'Clay', 'Grass'];
const surfaceKey = s => (SURFACES.includes(s) ? s : 'Hard');

// Champion / runner-up points per tournament level, mirroring the ATP & WTA
// ranking-point tables. This weights the leaderboard by how big each title is
// — a Grand Slam (2000) outweighs a stack of 250s — rather than a raw count.
const CHAMPION_POINTS  = { 2000: 2000, 1500: 1500, 1000: 1000, 500: 500, 250: 250 };
const RUNNER_UP_POINTS = { 2000: 1300, 1500: 1000, 1000: 650,  500: 330, 250: 165 };
const championPoints = level => CHAMPION_POINTS[level] ?? level ?? 0;
const runnerUpPoints = level => RUNNER_UP_POINTS[level] ?? Math.round((level ?? 0) * 0.65);

// All tournaments for one tour completed from the season start through the end
// of `currentDate`'s month (year-to-date cumulative), oldest → newest.
export function cumulativeCompleted(tourTournaments, currentDate) {
  const today = dayjs();
  const seasonStart = currentDate.startOf('year');
  const monthEnd = currentDate.endOf('month');
  return (tourTournaments ?? [])
    .filter(t =>
      t.winner &&
      dayjs(t.end).isBefore(today) &&
      dayjs(t.end).isSameOrAfter(seasonStart) &&
      dayjs(t.end).isSameOrBefore(monthEnd)
    )
    .sort((a, b) => (a.end > b.end ? 1 : -1));
}

// Aggregate players from a list of completed tournaments and rank them by
// level-weighted points, then titles, then runner-ups. Ties (equal points)
// share a dense rank. Each stat carries the rich win/runner-up lists and
// per-surface tallies the dialogs need.
export function buildPlayerStats(completedTournaments) {
  const playerStats = {};
  const ensure = name => {
    if (!playerStats[name]) {
      playerStats[name] = {
        // fullName defaults to the abbreviated name; upgraded to the real
        // "First Last" when a tournament carries winner_full / runner_up_full.
        fullName: name,
        wins: 0, runnerUp: 0, points: 0,
        winsList: [], runnerUpList: [],
        surfaceWins: { Hard: 0, 'Indoor Hard': 0, Clay: 0, Grass: 0 },
        surfaceFinals: { Hard: 0, 'Indoor Hard': 0, Clay: 0, Grass: 0 },
      };
    }
    return playerStats[name];
  };

  for (const tournament of completedTournaments) {
    const entry = {
      name: tournament.name,
      level: tournament.level,
      surface: tournament.surface,
      score: tournament.score,
    };
    const surf = surfaceKey(tournament.surface);
    if (tournament.winner) {
      const p = ensure(tournament.winner);
      if (tournament.winner_full) p.fullName = tournament.winner_full;
      p.wins += 1;
      p.points += championPoints(tournament.level);
      p.winsList.push({ ...entry, opponent: tournament.runner_up });
      p.surfaceWins[surf] += 1;
      p.surfaceFinals[surf] += 1;
    }
    if (tournament.runner_up) {
      const p = ensure(tournament.runner_up);
      if (tournament.runner_up_full) p.fullName = tournament.runner_up_full;
      p.runnerUp += 1;
      p.points += runnerUpPoints(tournament.level);
      p.runnerUpList.push({ ...entry, opponent: tournament.winner });
      p.surfaceFinals[surf] += 1;
    }
  }

  const stats = Object.entries(playerStats)
    .map(([name, data]) => ({
      name,
      fullName: data.fullName,
      wins: data.wins,
      runnerUp: data.runnerUp,
      points: data.points,
      total: data.wins + data.runnerUp,
      winsList: data.winsList,
      runnerUpList: data.runnerUpList,
      surfaceWins: data.surfaceWins,
      surfaceFinals: data.surfaceFinals,
    }))
    // Rank by level-weighted points, then titles, then runner-ups as tie-breaks.
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.runnerUp - a.runnerUp;
    });

  // Dense rank: players with equal points share a rank number.
  for (let i = 0; i < stats.length; i++) {
    if (i > 0 && stats[i].points === stats[i - 1].points) {
      stats[i].rank = stats[i - 1].rank;
    } else {
      stats[i].rank = i + 1;
    }
  }
  return stats;
}
