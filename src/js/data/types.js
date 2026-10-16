/* ============ types.js — type chart ============
 * The one from the games (Gen 6 onwards), but SOFTENED for a survivor,
 * where you only have one active attack and cannot switch Pokémon:
 *
 *   games    ×2      ×0.5    ×0 (immune)
 *   here     ×1.6    ×0.6    ×0.3
 *
 * With two types they multiply (×1.6 · ×1.6 = ×2.56), capped to [×0.3, ×2.4].
 * (The live values are in G.Balance.combat.types.)
 * Used both ways: your attacks against enemies and the enemies' attacks
 * against you (their main type, or the type of their shot).
 */
G.Types = (() => {
  // attacker -> { defender: multiplier from the games } (×1 entries are omitted)
  const CHART = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
  };
  // Softening and clamp: G.Balance.combat.types.
  const B = G.Balance.combat;

  /** Multiplier of an `atk`-type attack against a Pokémon with types `def`. */
  function mult(atk, def) {
    const row = CHART[atk];
    if (!row || !def) return 1;
    const T = B.types;
    let m = 1;
    for (const t of def) if (row[t] != null) m *= T.soft[row[t]];
    return G.U.clamp(m, T.min, T.max);
  }

  /** Full damage multiplier of an attack: type chart × weather (used for every hit, both ways). */
  function attackMult(atk, def) {
    return mult(atk, def) * G.Weather.mult(atk);
  }

  /** 'super' | 'weak' | null, to show the hint. */
  function label(m) {
    return m > 1.05 ? 'super' : m < 0.95 ? 'weak' : null;
  }

  return { CHART, mult, attackMult, label };
})();
