function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const whole = n => Math.abs(n - Math.round(n)) < 1e-9;
const fmt = n => String(Math.round(n * 100) / 100);
const rupee = n => '₹' + fmt(n);
const pct = n => fmt(n) + '%';
const unit = u => n => fmt(n) + ' ' + u;

function shuffle(r, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function attempt(fn) {
  for (let i = 0; i < 400; i++) {
    const out = fn();
    if (out) return out;
  }
  return null;
}

function build(r, question, answer, candidates, explanation) {
  const seen = new Set([answer]);
  const wrong = [];
  for (const c of candidates) {
    const s = String(c);
    if (!seen.has(s)) {
      seen.add(s);
      wrong.push(s);
    }
    if (wrong.length === 3) break;
  }
  if (wrong.length < 3) return null;
  const options = shuffle(r, [answer, ...wrong]);
  return { question, options, correct_index: options.indexOf(answer), explanation };
}

function around(r, correct, step, format) {
  return shuffle(r, [1, -1, 2, -2, 3, -3, 4])
    .map(k => correct + k * step)
    .filter(v => v > 0)
    .map(format);
}

const frac = (n, d) => {
  const g = gcd(n, d);
  return `${n / g}/${d / g}`;
};

const percentGens = [
  r => {
    const n = 20 * int(r, 5, 60);
    const p = pick(r, [5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
    const a = (n * p) / 100;
    return build(r, `What is ${p}% of ${n}?`, fmt(a), around(r, a, Math.max(1, Math.round(a / 10)), fmt), `${p}% of ${n} = ${p}/100 × ${n} = ${fmt(a)}.`);
  },
  r => attempt(() => {
    const b = pick(r, [20, 25, 40, 50, 80, 125, 200, 250, 400, 500]);
    const p = pick(r, [10, 15, 20, 25, 30, 40, 45, 60, 65, 70, 75, 80, 90]);
    const a = (b * p) / 100;
    if (!whole(a)) return null;
    return build(r, `${a} is what percent of ${b}?`, pct(p), around(r, p, 5, pct), `(${a} / ${b}) × 100 = ${p}%.`);
  }),
  r => {
    const p = pick(r, [10, 20, 25, 30, 40, 50]);
    const q = pick(r, [10, 20, 25, 30, 40, 50]);
    const net = ((100 + p) * (100 - q) - 10000) / 100;
    const label = net > 0 ? `${fmt(net)}% increase` : net < 0 ? `${fmt(-net)}% decrease` : 'No change';
    const opposite = net > 0 ? `${fmt(net)}% decrease` : `${fmt(-net)}% increase`;
    const diff = Math.abs(p - q) || p / 2;
    return build(r, `The price of an item is increased by ${p}% and then decreased by ${q}%. What is the net change in price?`, label, ['No change', opposite, `${fmt(p * q / 100)}% decrease`, `${fmt(p * q / 100)}% increase`, `${fmt(diff)}% increase`, `${fmt(diff)}% decrease`], `Net change = ${p} − ${q} − (${p} × ${q})/100 = ${fmt(net)}%.`);
  },
  r => {
    const n = 2000 * int(r, 3, 25);
    const p = pick(r, [5, 10, 20]);
    const v = (n * (100 + p) * (100 + p)) / 10000;
    return build(r, `The population of a town is ${n}. It grows by ${p}% every year. What will it be after 2 years?`, fmt(v), around(r, v, Math.max(10, Math.round((v * 0.02) / 10) * 10), fmt), `${n} × (1 + ${p}/100)² = ${fmt(v)}.`);
  },
  r => attempt(() => {
    const total = 20 * int(r, 10, 40);
    const pp = pick(r, [30, 35, 40, 45, 50]);
    const passMarks = (total * pp) / 100;
    const diff = pick(r, [5, 10, 15, 20, 25, 30]);
    const got = passMarks - diff;
    if (got <= 0) return null;
    return build(r, `A student needs ${pp}% marks to pass. He scored ${got} marks and failed by ${diff} marks. What are the maximum marks?`, fmt(total), around(r, total, 20, fmt), `Pass marks = ${got} + ${diff} = ${passMarks}, which is ${pp}% of the total. Total = ${passMarks} × 100 / ${pp} = ${total}.`);
  }),
  r => {
    const p = pick(r, [25, 100, 150, 300, 400]);
    const ans = (p * 100) / (100 + p);
    return build(r, `A's salary is ${p}% more than B's. By what percent is B's salary less than A's?`, pct(ans), [pct(p), ...around(r, ans, 5, pct)], `Let B = 100. Then A = ${100 + p}. B is less than A by ${p} on ${100 + p}, i.e. ${p}/${100 + p} × 100 = ${fmt(ans)}%.`);
  }
];

const profitGens = [
  r => {
    const cp = 20 * int(r, 5, 60);
    const p = pick(r, [5, 10, 15, 20, 25, 30, 40, 50]);
    const sp = (cp * (100 + p)) / 100;
    return build(r, `An article costing ${rupee(cp)} is sold at a profit of ${p}%. What is its selling price?`, rupee(sp), around(r, sp, Math.max(5, Math.round(sp / 100) * 5), rupee), `SP = ${cp} × (100 + ${p})/100 = ${rupee(sp)}.`);
  },
  r => {
    const cp = 20 * int(r, 5, 60);
    const p = pick(r, [5, 10, 15, 20, 25, 30, 40, 50]);
    const sp = (cp * (100 + p)) / 100;
    return build(r, `A shopkeeper sells an article for ${rupee(sp)} and earns a profit of ${p}%. What is the cost price?`, rupee(cp), around(r, cp, Math.max(5, Math.round(cp / 100) * 5), rupee), `CP = SP × 100/(100 + ${p}) = ${sp} × 100/${100 + p} = ${rupee(cp)}.`);
  },
  r => attempt(() => {
    const cp = pick(r, [50, 80, 100, 125, 200, 250, 400, 500, 800]);
    const loss = r() < 0.4;
    const p = loss ? pick(r, [10, 20, 25, 30, 40]) : pick(r, [10, 20, 25, 30, 40, 50]);
    const sp = (cp * (loss ? 100 - p : 100 + p)) / 100;
    if (!whole(sp)) return null;
    return build(r, `An article bought for ${rupee(cp)} is sold for ${rupee(sp)}. What is the ${loss ? 'loss' : 'profit'} percent?`, pct(p), around(r, p, 5, pct), `${loss ? 'Loss' : 'Profit'} = ${Math.abs(sp - cp)}. Percent = ${Math.abs(sp - cp)}/${cp} × 100 = ${p}%.`);
  }),
  r => {
    const mp = 20 * int(r, 5, 50);
    const d = pick(r, [5, 10, 15, 20, 25, 30]);
    const sp = (mp * (100 - d)) / 100;
    return build(r, `The marked price of a shirt is ${rupee(mp)}. After a discount of ${d}%, what is the selling price?`, rupee(sp), around(r, sp, Math.max(5, Math.round(sp / 100) * 5), rupee), `SP = ${mp} × (100 − ${d})/100 = ${rupee(sp)}.`);
  },
  r => {
    const m = pick(r, [20, 25, 30, 40, 50]);
    const d = pick(r, [10, 15, 20, 25]);
    const sp = ((100 + m) * (100 - d)) / 100;
    const net = sp - 100;
    const label = net > 0 ? `${fmt(net)}% profit` : net < 0 ? `${fmt(-net)}% loss` : 'No profit, no loss';
    return build(r, `A shopkeeper marks an article ${m}% above its cost price and then allows a discount of ${d}%. What is his overall result?`, label, [`${fmt(Math.abs(m - d))}% profit`, `${fmt(Math.abs(net))}% ${net > 0 ? 'loss' : 'profit'}`, 'No profit, no loss', `${fmt((m * d) / 100)}% loss`, `${fmt(Math.abs(m - d))}% loss`, `${fmt(m + d)}% profit`], `Let CP = 100. MP = ${100 + m}. SP = ${100 + m} × (100 − ${d})/100 = ${fmt(sp)}. So the result is: ${label}.`);
  },
  r => {
    const p = pick(r, [10, 20, 25, 30, 40]);
    const loss = (p * p) / 100;
    return build(r, `A man sells two articles at the same price. One is sold at ${p}% profit and the other at ${p}% loss. What is his overall result?`, `${fmt(loss)}% loss`, [`${fmt(loss)}% profit`, 'No profit, no loss', `${p}% loss`, `${fmt(p / 2)}% loss`, `${p}% profit`], `When two articles are sold at the same price with equal profit and loss percent, there is always a loss of (${p}/10)² = ${fmt(loss)}%.`);
  },
  r => attempt(() => {
    const [n, m] = pick(r, [[10, 8], [12, 10], [15, 12], [20, 16], [25, 20], [9, 6], [8, 5], [7, 5], [6, 4], [30, 24]]);
    const p = ((n - m) / m) * 100;
    if (!whole(p)) return null;
    return build(r, `The cost price of ${n} articles equals the selling price of ${m} articles. What is the profit percent?`, pct(p), [pct(((n - m) / n) * 100), ...around(r, p, 5, pct)], `Let the selling price of one article be ₹1. The cost of ${n} articles is ₹${m}, so one article costs ₹${m}/${n}. Profit % = (${n} − ${m})/${m} × 100 = ${fmt(p)}%.`);
  })
];

const speedGens = [
  r => {
    const s = pick(r, [40, 50, 60, 72, 80, 90]);
    const t = pick(r, [2, 2.5, 3, 3.5, 4, 5]);
    const d = s * t;
    return build(r, `A car travels at ${s} km/h for ${fmt(t)} hours. What distance does it cover?`, unit('km')(d), around(r, d, 10, unit('km')), `Distance = speed × time = ${s} × ${fmt(t)} = ${fmt(d)} km.`);
  },
  r => {
    const s = pick(r, [40, 50, 60, 72, 80, 90]);
    const t = pick(r, [2, 2.5, 3, 3.5, 4, 5]);
    const d = s * t;
    return build(r, `How long will a bus take to cover ${fmt(d)} km at ${s} km/h?`, unit('hours')(t), around(r, t, 0.5, unit('hours')), `Time = distance / speed = ${fmt(d)} / ${s} = ${fmt(t)} hours.`);
  },
  r => {
    if (r() < 0.5) {
      const v = 18 * int(r, 2, 9);
      const m = (v * 5) / 18;
      return build(r, `Convert ${v} km/h into m/s.`, unit('m/s')(m), around(r, m, 2, unit('m/s')), `${v} km/h = ${v} × 5/18 = ${fmt(m)} m/s.`);
    }
    const m = 5 * int(r, 2, 10);
    const v = (m * 18) / 5;
    return build(r, `Convert ${m} m/s into km/h.`, unit('km/h')(v), around(r, v, 9, unit('km/h')), `${m} m/s = ${m} × 18/5 = ${fmt(v)} km/h.`);
  },
  r => {
    const [x, y] = pick(r, [[40, 60], [30, 60], [60, 90], [20, 30], [50, 75], [60, 120], [30, 45], [45, 90], [40, 120], [24, 40], [36, 60], [20, 60]]);
    const avg = (2 * x * y) / (x + y);
    return build(r, `A car goes from A to B at ${x} km/h and returns at ${y} km/h along the same road. What is its average speed for the whole journey?`, unit('km/h')(avg), [unit('km/h')((x + y) / 2), ...around(r, avg, 3, unit('km/h'))], `Average speed for equal distances = 2xy/(x + y) = 2 × ${x} × ${y}/${x + y} = ${fmt(avg)} km/h.`);
  },
  r => {
    const a = pick(r, [40, 45, 50, 55, 60, 65, 70]);
    const b = pick(r, [40, 45, 50, 55, 60, 65, 70]);
    const t = pick(r, [2, 3, 4, 5]);
    const d = (a + b) * t;
    return build(r, `Two cars start from towns ${d} km apart and move towards each other at ${a} km/h and ${b} km/h. After how many hours do they meet?`, unit('hours')(t), around(r, t, 1, unit('hours')), `They close the gap at ${a} + ${b} = ${a + b} km/h, so time = ${d} / ${a + b} = ${t} hours.`);
  },
  r => attempt(() => {
    const x = pick(r, [50, 60, 70, 80, 90]);
    const y = pick(r, [20, 30, 40, 45, 50]);
    if (x <= y) return null;
    const t = pick(r, [2, 3, 4, 5, 6]);
    const d = (x - y) * t;
    return build(r, `Two vehicles start together in the same direction at ${x} km/h and ${y} km/h. How far apart are they after ${t} hours?`, unit('km')(d), around(r, d, 10, unit('km')), `Relative speed = ${x} − ${y} = ${x - y} km/h. Gap = ${x - y} × ${t} = ${d} km.`);
  }),
  r => {
    const [a, b] = pick(r, [[3, 4], [4, 5], [5, 6], [2, 3]]);
    const late = pick(r, [10, 15, 20, 25, 30]);
    const usual = (late * a) / (b - a);
    return build(r, `Walking at ${a}/${b} of his usual speed, a man reaches office ${late} minutes late. What is his usual time to reach office?`, unit('minutes')(usual), around(r, usual, 5, unit('minutes')), `At ${a}/${b} of the speed, time becomes ${b}/${a} of usual. Extra time = usual × (${b}/${a} − 1) = usual × ${b - a}/${a} = ${late}, so usual = ${fmt(usual)} minutes.`);
  }
];

const trainGens = [
  r => attempt(() => {
    const v = 18 * int(r, 2, 8);
    const t = pick(r, [5, 6, 8, 10, 12, 15, 20]);
    const L = ((v * 5) / 18) * t;
    if (L < 50) return null;
    return build(r, `A ${fmt(L)} m long train crosses a pole in ${t} seconds. What is its speed in km/h?`, unit('km/h')(v), [unit('km/h')(L / t), ...around(r, v, 9, unit('km/h'))], `Speed = ${fmt(L)} / ${t} = ${fmt(L / t)} m/s = ${fmt(L / t)} × 18/5 = ${v} km/h.`);
  }),
  r => attempt(() => {
    const v = 18 * int(r, 2, 6);
    const ms = (v * 5) / 18;
    const t = pick(r, [20, 24, 30, 36, 40, 45]);
    const total = ms * t;
    const L = pick(r, [100, 120, 150, 180, 200, 250]);
    const P = total - L;
    if (P < 50) return null;
    return build(r, `A ${L} m long train running at ${v} km/h crosses a ${P} m long platform. How many seconds does it take?`, unit('seconds')(t), around(r, t, 4, unit('seconds')), `Distance = ${L} + ${P} = ${total} m. Speed = ${v} × 5/18 = ${ms} m/s. Time = ${total} / ${ms} = ${t} seconds.`);
  }),
  r => attempt(() => {
    const v = 18 * int(r, 2, 6);
    const ms = (v * 5) / 18;
    const t = pick(r, [20, 24, 30, 36, 40, 45]);
    const total = ms * t;
    const L = pick(r, [100, 120, 150, 180, 200, 250]);
    const P = total - L;
    if (P < 50) return null;
    return build(r, `A ${L} m long train running at ${v} km/h crosses a bridge in ${t} seconds. What is the length of the bridge?`, unit('m')(P), around(r, P, 20, unit('m')), `Speed = ${v} × 5/18 = ${ms} m/s. Distance in ${t} s = ${total} m. Bridge = ${total} − ${L} = ${P} m.`);
  }),
  r => attempt(() => {
    const v1 = pick(r, [36, 54, 72, 90]);
    const v2 = pick(r, [36, 54, 72, 90, 108]);
    const L1 = pick(r, [100, 120, 150, 180, 200, 250]);
    const L2 = pick(r, [100, 120, 150, 180, 200, 250]);
    const ms = ((v1 + v2) * 5) / 18;
    const t = (L1 + L2) / ms;
    if (!whole(t * 10)) return null;
    return build(r, `Two trains of lengths ${L1} m and ${L2} m run in opposite directions at ${v1} km/h and ${v2} km/h. In how many seconds do they completely cross each other?`, unit('seconds')(t), around(r, t, 1, unit('seconds')), `Relative speed = (${v1} + ${v2}) × 5/18 = ${fmt(ms)} m/s. Time = (${L1} + ${L2}) / ${fmt(ms)} = ${fmt(t)} seconds.`);
  }),
  r => attempt(() => {
    const v1 = pick(r, [90, 108, 72, 126]);
    const v2 = pick(r, [36, 54, 45, 63]);
    if (v1 <= v2) return null;
    const L1 = pick(r, [100, 120, 150, 180, 200, 250]);
    const L2 = pick(r, [100, 120, 150, 180, 200, 250]);
    const ms = ((v1 - v2) * 5) / 18;
    const t = (L1 + L2) / ms;
    if (!whole(t * 10)) return null;
    return build(r, `Two trains of lengths ${L1} m and ${L2} m run in the same direction at ${v1} km/h and ${v2} km/h. In how many seconds does the faster train completely overtake the slower one?`, unit('seconds')(t), around(r, t, 2, unit('seconds')), `Relative speed = (${v1} − ${v2}) × 5/18 = ${fmt(ms)} m/s. Time = (${L1} + ${L2}) / ${fmt(ms)} = ${fmt(t)} seconds.`);
  }),
  r => attempt(() => {
    const [v, u] = pick(r, [[63, 9], [54, 18], [45, 9], [81, 9], [72, 18], [90, 18], [117, 9]]);
    const L = pick(r, [100, 150, 200, 250, 300]);
    const ms = ((v + u) * 5) / 18;
    const t = L / ms;
    if (!whole(t * 10)) return null;
    return build(r, `A ${L} m long train runs at ${v} km/h. A man walks at ${u} km/h in the direction opposite to the train. In how many seconds does the train pass him?`, unit('seconds')(t), around(r, t, 1, unit('seconds')), `Relative speed = (${v} + ${u}) × 5/18 = ${fmt(ms)} m/s. Time = ${L} / ${fmt(ms)} = ${fmt(t)} seconds.`);
  }),
  r => attempt(() => {
    const v = 18 * int(r, 2, 8);
    const ms = (v * 5) / 18;
    const t = pick(r, [6, 8, 10, 12, 15]);
    const L = ms * t;
    if (L < 50) return null;
    return build(r, `A train running at ${v} km/h passes a signal post in ${t} seconds. What is the length of the train?`, unit('m')(L), [unit('m')(v * t), ...around(r, L, 20, unit('m'))], `Speed = ${v} × 5/18 = ${ms} m/s. Length = speed × time = ${ms} × ${t} = ${L} m.`);
  })
];

const raceGens = [
  r => attempt(() => {
    const d1 = pick(r, [100, 200, 400, 500, 1000]);
    const x = pick(r, [5, 10, 20, 25, 40, 50, 100]);
    const d2 = pick(r, [50, 100, 200, 250, 500, 2000]);
    const y = (x * d2) / d1;
    if (x >= d1 || d2 === d1 || !whole(y)) return null;
    return build(r, `In a ${d1} m race, A beats B by ${x} m. By how many metres will A beat B in a ${d2} m race, if both run at the same speeds?`, unit('m')(y), around(r, y, Math.max(1, Math.round(y / 4)), unit('m')), `When A runs ${d1} m, B runs ${d1 - x} m. In a ${d2} m race A beats B by ${d2} × ${x}/${d1} = ${fmt(y)} m.`);
  }),
  r => attempt(() => {
    const D = pick(r, [400, 800, 1000]);
    const ta = pick(r, [100, 120, 150, 160, 180, 200, 240]);
    const tb = pick(r, [120, 150, 160, 180, 200, 240, 250, 300]);
    if (tb <= ta) return null;
    const beat = (D * (tb - ta)) / tb;
    if (!whole(beat)) return null;
    const bRuns = D - beat;
    return build(r, `A runs ${D} m in ${ta} s and B runs the same distance in ${tb} s. By how many metres does A beat B?`, unit('m')(beat), around(r, beat, Math.max(5, Math.round(beat / 8)), unit('m')), `In ${ta} s, B covers ${D} × ${ta}/${tb} = ${fmt(bRuns)} m. So A wins by ${D} − ${fmt(bRuns)} = ${fmt(beat)} m.`);
  }),
  r => attempt(() => {
    const D = pick(r, [100, 200, 400, 800, 1000]);
    const d = pick(r, [10, 20, 25, 40, 50]);
    const t = pick(r, [2, 4, 5, 8, 10]);
    const tb = (D * t) / d;
    if (!whole(tb) || d >= D) return null;
    return build(r, `In a ${D} m race, A beats B by ${d} m or by ${t} seconds. How long does B take to finish the race?`, unit('seconds')(tb), around(r, tb, Math.max(2, Math.round(tb / 8)), unit('seconds')), `B covers ${d} m in ${t} s, so B's speed = ${fmt(d / t)} m/s. Time for ${D} m = ${D} / ${fmt(d / t)} = ${fmt(tb)} seconds.`);
  }),
  r => attempt(() => {
    const L = pick(r, [200, 300, 400, 500, 600, 800]);
    const a = int(r, 2, 9);
    const b = int(r, 1, 8);
    const t = L / (a + b);
    if (!whole(t)) return null;
    return build(r, `Two runners start from the same point on a circular track ${L} m long, running in opposite directions at ${a} m/s and ${b} m/s. After how many seconds do they first meet?`, unit('seconds')(t), around(r, t, Math.max(2, Math.round(t / 6)), unit('seconds')), `They approach each other at ${a} + ${b} = ${a + b} m/s. Time = ${L} / ${a + b} = ${fmt(t)} seconds.`);
  }),
  r => attempt(() => {
    const L = pick(r, [200, 300, 400, 500, 600, 800]);
    const a = int(r, 3, 10);
    const b = int(r, 1, 8);
    if (a <= b) return null;
    const t = L / (a - b);
    if (!whole(t)) return null;
    return build(r, `Two runners start together on a circular track ${L} m long and run in the same direction at ${a} m/s and ${b} m/s. After how many seconds will the faster runner first lap the slower one?`, unit('seconds')(t), around(r, t, Math.max(2, Math.round(t / 6)), unit('seconds')), `The faster runner gains ${a} − ${b} = ${a - b} m every second. To gain one full lap of ${L} m takes ${L} / ${a - b} = ${fmt(t)} seconds.`);
  })
];

const workGens = [
  r => {
    const [a, b] = pick(r, [[10, 15], [12, 24], [20, 30], [18, 9], [30, 45], [12, 6], [20, 5], [40, 60], [15, 30], [24, 8], [36, 18], [45, 90], [60, 12], [16, 48], [10, 40], [14, 35], [21, 28]]);
    const t = (a * b) / (a + b);
    return build(r, `A can finish a job in ${a} days and B can finish it in ${b} days. In how many days can they finish it together?`, unit('days')(t), around(r, t, 1, unit('days')), `Together in one day: 1/${a} + 1/${b} = ${a + b}/${a * b}. Days = ${a * b}/${a + b} = ${fmt(t)}.`);
  },
  r => {
    const [a, b] = pick(r, [[10, 15], [12, 24], [20, 30], [30, 45], [12, 6], [40, 60], [15, 30], [24, 8], [36, 18], [16, 48], [14, 35], [21, 28]]);
    const t = (a * b) / (a + b);
    return build(r, `A alone can do a work in ${a} days. A and B together can do it in ${fmt(t)} days. How many days will B alone take?`, unit('days')(b), around(r, b, Math.max(1, Math.round(b / 6)), unit('days')), `B's one day work = 1/${fmt(t)} − 1/${a} = 1/${b}. So B alone takes ${b} days.`);
  },
  r => {
    const [a, b, c] = pick(r, [[10, 15, 30], [12, 18, 36], [20, 30, 60], [6, 12, 12], [8, 12, 24], [10, 20, 20], [30, 45, 90], [24, 36, 72], [15, 20, 60]]);
    const t = 1 / (1 / a + 1 / b + 1 / c);
    return build(r, `A, B and C can complete a work alone in ${a}, ${b} and ${c} days respectively. In how many days can they complete it working together?`, unit('days')(t), around(r, t, 1, unit('days')), `One day work = 1/${a} + 1/${b} + 1/${c} = 1/${fmt(t)}. So they need ${fmt(t)} days.`);
  },
  r => {
    const a = pick(r, [10, 12, 15, 18, 20, 24, 30]);
    const x = int(r, 2, a - 2);
    return build(r, `A can complete a job in ${a} days. What fraction of the job is left after he has worked for ${x} days?`, frac(a - x, a), [frac(x, a), frac(a - x - 1, a), frac(a - x + 1, a), frac(x, a - x)], `Work done in ${x} days = ${x}/${a}. Work left = 1 − ${x}/${a} = ${frac(a - x, a)}.`);
  },
  r => attempt(() => {
    const m = pick(r, [6, 8, 10, 12, 15, 20]);
    const d = pick(r, [6, 8, 10, 12, 15, 18, 20, 24]);
    const m2 = pick(r, [4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30]);
    const ans = (m * d) / m2;
    if (m2 === m || !whole(ans)) return null;
    return build(r, `${m} men can complete a piece of work in ${d} days. In how many days will ${m2} men complete the same work?`, unit('days')(ans), around(r, ans, 1, unit('days')), `Total work = ${m} × ${d} = ${m * d} man-days. Days for ${m2} men = ${m * d}/${m2} = ${fmt(ans)}.`);
  }),
  r => {
    const [a, b] = pick(r, [[10, 15], [6, 9], [12, 16], [8, 12], [15, 20], [20, 30], [10, 20]]);
    const t = (a * b) / (b - a);
    return build(r, `Pipe A can fill a tank in ${a} hours and pipe B can empty it in ${b} hours. If both are opened together, how long will it take to fill the empty tank?`, unit('hours')(t), around(r, t, Math.max(1, Math.round(t / 6)), unit('hours')), `Net filling in one hour = 1/${a} − 1/${b} = ${b - a}/${a * b}. Time = ${a * b}/${b - a} = ${fmt(t)} hours.`);
  },
  r => {
    const t = pick(r, [8, 10, 12, 14, 16, 20]);
    return build(r, `A is twice as efficient as B. Together they finish a job in ${t} days. How many days would B alone take?`, unit('days')(3 * t), [unit('days')(1.5 * t), unit('days')(2 * t), unit('days')(4 * t), unit('days')(t + 6)], `A:B efficiency = 2:1, so together they do 3 units a day. Total work = 3 × ${t} = ${3 * t} units. B does 1 unit a day, so B alone takes ${3 * t} days.`);
  }
];

const ratioGens = [
  r => {
    const [a, b] = pick(r, [[2, 3], [3, 5], [4, 5], [5, 7], [3, 4], [2, 5], [1, 3]]);
    const N = (a + b) * 10 * int(r, 3, 20);
    const share = (N * b) / (a + b);
    return build(r, `${rupee(N)} is divided between A and B in the ratio ${a}:${b}. How much does B get?`, rupee(share), [rupee((N * a) / (a + b)), ...around(r, share, Math.max(10, Math.round(share / 50) * 10), rupee)], `B's share = ${b}/${a + b} × ${N} = ${rupee(share)}.`);
  },
  r => attempt(() => {
    const [a, b] = pick(r, [[2, 3], [3, 5], [4, 7], [5, 8], [3, 7], [2, 5]]);
    const S = (a + b) * int(r, 4, 20);
    const diff = (S * (b - a)) / (a + b);
    return build(r, `The sum of two numbers is ${S} and they are in the ratio ${a}:${b}. What is their difference?`, fmt(diff), around(r, diff, 2, fmt), `Each part = ${S}/${a + b} = ${fmt(S / (a + b))}. Difference = (${b} − ${a}) × ${fmt(S / (a + b))} = ${fmt(diff)}.`);
  }),
  r => {
    const a = pick(r, [2, 3, 4, 5, 6]);
    const b = a * int(r, 2, 6);
    const c = int(r, 3, 15);
    const x = (b * c) / a;
    return build(r, `Find the fourth proportional to ${a}, ${b} and ${c}.`, fmt(x), around(r, x, Math.max(1, Math.round(x / 8)), fmt), `Fourth proportional x satisfies ${a}:${b} = ${c}:x, so x = ${b} × ${c}/${a} = ${fmt(x)}.`);
  },
  r => {
    const [a, b] = pick(r, [[4, 9], [9, 16], [2, 8], [3, 12], [5, 20], [4, 25], [8, 18], [12, 27], [16, 25], [18, 32], [9, 25], [6, 24]]);
    const m = Math.sqrt(a * b);
    return build(r, `What is the mean proportional between ${a} and ${b}?`, fmt(m), [fmt((a + b) / 2), ...around(r, m, 1, fmt)], `Mean proportional = √(${a} × ${b}) = √${a * b} = ${fmt(m)}.`);
  },
  r => attempt(() => {
    const a = int(r, 2, 7);
    const b = int(r, 2, 9);
    const c = int(r, 2, 7);
    const d = int(r, 2, 9);
    const x = a * c;
    const y = b * d;
    const g = gcd(x, y);
    if (g === 1 && (a + c === x || b + d === y)) return null;
    const ans = `${x / g}:${y / g}`;
    return build(r, `If A:B = ${a}:${b} and B:C = ${c}:${d}, what is A:C?`, ans, [`${a * d}:${b * c}`, `${a + c}:${b + d}`, `${a}:${d}`, `${b}:${c}`, `${c}:${a}`], `A:C = (${a} × ${c}) : (${b} × ${d}) = ${x}:${y} = ${ans}.`);
  }),
  r => attempt(() => {
    const [a, b] = pick(r, [[3, 2], [2, 1], [3, 1], [4, 1], [5, 3], [3, 5]]);
    const c = pick(r, [1, 2, 3, 4, 5]);
    const N = pick(r, [40, 50, 60, 80, 90, 100, 120, 150, 160, 200]);
    const milk = (N * a) / (a + b);
    const water = N - milk;
    const add = (milk * c) / a - water;
    if (!whole(milk) || !whole(add) || add <= 0 || c === b) return null;
    return build(r, `A ${N} litre mixture contains milk and water in the ratio ${a}:${b}. How many litres of water must be added to make the ratio ${a}:${c}?`, unit('litres')(add), around(r, add, Math.max(2, Math.round(add / 4)), unit('litres')), `Milk = ${fmt(milk)} L and water = ${fmt(water)} L. For ratio ${a}:${c}, water must be ${fmt(milk)} × ${c}/${a} = ${fmt((milk * c) / a)} L. Add ${fmt(add)} L.`);
  })
];

const interestGens = [
  r => {
    const P = 1000 * int(r, 2, 20);
    const R = pick(r, [5, 6, 8, 10, 12]);
    const T = pick(r, [2, 3, 4, 5]);
    const si = (P * R * T) / 100;
    return build(r, `What is the simple interest on ${rupee(P)} for ${T} years at ${R}% per annum?`, rupee(si), around(r, si, Math.max(10, Math.round(si / 20 / 10) * 10), rupee), `SI = P × R × T/100 = ${P} × ${R} × ${T}/100 = ${rupee(si)}.`);
  },
  r => {
    const P = 1000 * int(r, 2, 20);
    const R = pick(r, [4, 5, 6, 8, 10, 12]);
    const T = pick(r, [2, 3, 4, 5]);
    const si = (P * R * T) / 100;
    return build(r, `A sum of ${rupee(P)} earns simple interest of ${rupee(si)} in ${T} years. What is the rate of interest per annum?`, pct(R), around(r, R, 1, pct), `R = SI × 100/(P × T) = ${si} × 100/(${P} × ${T}) = ${R}%.`);
  },
  r => {
    const P = 1000 * int(r, 2, 20);
    const R = pick(r, [5, 6, 8, 10, 12]);
    const T = pick(r, [2, 3, 4, 5]);
    const si = (P * R * T) / 100;
    const A = P + si;
    return build(r, `What amount will ${rupee(P)} become after ${T} years at ${R}% simple interest per annum?`, rupee(A), [rupee(si), ...around(r, A, Math.max(10, Math.round(A / 25 / 10) * 10), rupee)], `SI = ${P} × ${R} × ${T}/100 = ${si}. Amount = ${P} + ${si} = ${rupee(A)}.`);
  },
  r => attempt(() => {
    const P = pick(r, [2000, 4000, 5000, 8000, 10000, 20000]);
    const R = pick(r, [5, 10, 20]);
    const ci = (P * (100 + R) * (100 + R)) / 10000 - P;
    if (!whole(ci)) return null;
    return build(r, `What is the compound interest on ${rupee(P)} for 2 years at ${R}% per annum, compounded annually?`, rupee(ci), [rupee((P * R * 2) / 100), ...around(r, ci, Math.max(10, Math.round(ci / 20 / 10) * 10), rupee)], `Amount = ${P} × (1 + ${R}/100)² = ${fmt(P + ci)}. CI = ${fmt(P + ci)} − ${P} = ${rupee(ci)}.`);
  }),
  r => attempt(() => {
    const P = pick(r, [5000, 8000, 10000, 20000, 25000, 40000]);
    const R = pick(r, [5, 10, 20]);
    const diff = (P * R * R) / 10000;
    if (!whole(diff)) return null;
    return build(r, `What is the difference between compound interest and simple interest on ${rupee(P)} for 2 years at ${R}% per annum?`, rupee(diff), around(r, diff, Math.max(5, Math.round(diff / 5 / 5) * 5), rupee), `For 2 years, CI − SI = P × (R/100)² = ${P} × (${R}/100)² = ${rupee(diff)}.`);
  }),
  r => {
    const R = pick(r, [4, 5, 10, 20, 25]);
    const T = 100 / R;
    return build(r, `In how many years will a sum of money double itself at ${R}% simple interest per annum?`, unit('years')(T), around(r, T, Math.max(1, Math.round(T / 5)), unit('years')), `To double, interest must equal the principal: 100 = R × T, so T = 100/${R} = ${fmt(T)} years.`);
  }
];

const averageGens = [
  r => attempt(() => {
    const nums = Array.from({ length: 5 }, () => int(r, 10, 60));
    const sum = nums.reduce((s, v) => s + v, 0);
    if (sum % 5) return null;
    const avg = sum / 5;
    return build(r, `What is the average of ${nums.join(', ')}?`, fmt(avg), around(r, avg, 2, fmt), `Sum = ${sum}. Average = ${sum}/5 = ${avg}.`);
  }),
  r => {
    const n = pick(r, [10, 15, 20, 25, 30, 50, 100]);
    const avg = (n + 1) / 2;
    return build(r, `What is the average of the first ${n} natural numbers?`, fmt(avg), [fmt(n / 2), ...around(r, avg, 1, fmt)], `Sum = ${n}(${n} + 1)/2, so average = (${n} + 1)/2 = ${fmt(avg)}.`);
  },
  r => {
    const n = pick(r, [20, 25, 30, 35, 40]);
    const a = pick(r, [14, 15, 16, 18, 20]);
    const k = pick(r, [1, 2, 3]);
    const t = a + k * (n + 1);
    return build(r, `The average age of ${n} students is ${a} years. When the teacher's age is included, the average rises by ${k} year${k > 1 ? 's' : ''}. What is the teacher's age?`, unit('years')(t), around(r, t, 2, unit('years')), `Total with teacher = ${n + 1} × ${a + k} = ${(n + 1) * (a + k)}. Students' total = ${n} × ${a} = ${n * a}. Teacher = ${(n + 1) * (a + k) - n * a} years.`);
  },
  r => {
    const n = pick(r, [5, 10]);
    const a = int(r, 20, 60);
    const d = int(r, 2, 8);
    const x = int(r, 10, 40);
    const y = x + n * d;
    return build(r, `The average of ${n} numbers is ${a}. If one number, ${x}, is replaced by ${y}, what is the new average?`, fmt(a + d), around(r, a + d, 1, fmt), `Total increases by ${y} − ${x} = ${y - x}. Average increases by ${y - x}/${n} = ${d}, so the new average is ${a + d}.`);
  },
  r => {
    const n = pick(r, [10, 12, 15, 20]);
    const k = pick(r, [2, 3, 4, 5]);
    const A = int(r, 30, 60);
    const runs = A + k * (n - 1);
    return build(r, `A batsman's average after his ${n}th innings is ${A}, which is ${k} more than his average before that innings. How many runs did he score in the ${n}th innings?`, fmt(runs), [fmt(A), ...around(r, runs, 3, fmt)], `Total after ${n} innings = ${n} × ${A}. Total before = ${n - 1} × ${A - k}. Runs in last innings = ${n * A} − ${(n - 1) * (A - k)} = ${runs}.`);
  },
  r => attempt(() => {
    const n1 = pick(r, [20, 30, 40, 50]);
    const n2 = pick(r, [10, 20, 30, 40]);
    const m1 = int(r, 40, 80);
    const m2 = int(r, 40, 80);
    const avg = (n1 * m1 + n2 * m2) / (n1 + n2);
    if (!whole(avg) || m1 === m2) return null;
    return build(r, `Section A has ${n1} students with an average of ${m1} marks and Section B has ${n2} students with an average of ${m2} marks. What is the combined average?`, fmt(avg), [fmt((m1 + m2) / 2), ...around(r, avg, 1, fmt)], `Total = ${n1} × ${m1} + ${n2} × ${m2} = ${n1 * m1 + n2 * m2}. Students = ${n1 + n2}. Average = ${fmt(avg)}.`);
  })
];

function seriesQuestion(r, terms, ans, rule) {
  const step = Math.max(2, Math.round(ans * 0.06));
  return build(r, `Find the next number in the series: ${terms.join(', ')}, ?`, fmt(ans), around(r, ans, step, fmt), rule);
}

const seriesGens = [
  r => {
    const s = int(r, 2, 40);
    const d = int(r, 2, 12);
    const t = Array.from({ length: 5 }, (_, i) => s + d * i);
    return seriesQuestion(r, t, s + d * 5, `Each term increases by ${d}. Next = ${t[4]} + ${d} = ${s + d * 5}.`);
  },
  r => {
    const s = int(r, 1, 5);
    const m = pick(r, [2, 3]);
    const t = Array.from({ length: 5 }, (_, i) => s * m ** i);
    return seriesQuestion(r, t, s * m ** 5, `Each term is multiplied by ${m}. Next = ${t[4]} × ${m} = ${s * m ** 5}.`);
  },
  r => {
    const n = int(r, 2, 14);
    const t = Array.from({ length: 5 }, (_, i) => (n + i) ** 2);
    return seriesQuestion(r, t, (n + 5) ** 2, `The terms are consecutive squares: ${n}², ${n + 1}², ... Next = ${n + 5}² = ${(n + 5) ** 2}.`);
  },
  r => {
    const s = int(r, 1, 20);
    const d = int(r, 1, 5);
    const k = int(r, 1, 3);
    const t = [s];
    for (let i = 0; i < 4; i++) t.push(t[i] + d + k * i);
    const ans = t[4] + d + k * 4;
    return seriesQuestion(r, t, ans, `The differences are ${d}, ${d + k}, ${d + 2 * k}, ${d + 3 * k}, and so on, growing by ${k}. Next difference = ${d + 4 * k}, so next term = ${t[4]} + ${d + 4 * k} = ${ans}.`);
  },
  r => {
    const a = int(r, 1, 6);
    const b = int(r, 1, 8);
    const t = [a, b];
    for (let i = 2; i < 5; i++) t.push(t[i - 1] + t[i - 2]);
    const ans = t[4] + t[3];
    return seriesQuestion(r, t, ans, `Each term is the sum of the previous two. Next = ${t[3]} + ${t[4]} = ${ans}.`);
  },
  r => {
    const n = int(r, 1, 6);
    const t = Array.from({ length: 4 }, (_, i) => (n + i) ** 3);
    return seriesQuestion(r, t, (n + 4) ** 3, `The terms are consecutive cubes: ${n}³, ${n + 1}³, ... Next = ${n + 4}³ = ${(n + 4) ** 3}.`);
  },
  r => {
    const a = int(r, 2, 15);
    const d1 = int(r, 2, 6);
    const b = int(r, 20, 40);
    const d2 = int(r, 1, 5);
    const t = [a, b, a + d1, b + d2, a + 2 * d1, b + 2 * d2];
    return seriesQuestion(r, t, a + 3 * d1, `Two series are interleaved. Odd positions: ${a}, ${a + d1}, ${a + 2 * d1}, ... (add ${d1}). Even positions: ${b}, ${b + d2}, ${b + 2 * d2}, ... (add ${d2}). The 7th term is ${a + 3 * d1}.`);
  },
  r => {
    const s = int(r, 1, 4);
    const m = pick(r, [2, 3]);
    const c = int(r, 1, 4);
    const t = [s];
    for (let i = 0; i < 4; i++) t.push(t[i] * m + c);
    const ans = t[4] * m + c;
    return seriesQuestion(r, t, ans, `Each term = previous × ${m} + ${c}. Next = ${t[4]} × ${m} + ${c} = ${ans}.`);
  }
];

const mixGens = [
  percentGens[0], percentGens[2], percentGens[4], profitGens[0], profitGens[2], profitGens[4],
  speedGens[3], speedGens[4], trainGens[0], trainGens[1], raceGens[0], workGens[0], workGens[3],
  workGens[6], ratioGens[0], ratioGens[3], interestGens[0], interestGens[3], averageGens[0],
  averageGens[2], seriesGens[0], seriesGens[3]
];

const logicalItems = [
  { q: 'Find the odd one out: 8, 27, 64, 100, 125', a: '100', w: ['8', '64', '125'], e: 'All others are perfect cubes (2³, 3³, 4³, 5³). 100 is not.' },
  { q: "If 'SMART' is written as 'TRAMS' in a code, how is 'BRAIN' written?", a: 'NIARB', w: ['NIRAB', 'BRAIN', 'NAIRB'], e: 'The word is written in reverse order, so BRAIN becomes NIARB.' },
  { q: 'A man walks 5 km north, then 3 km east, then 5 km south. How far is he from his starting point?', a: '3 km', w: ['5 km', '8 km', '13 km'], e: 'The north and south walks cancel out, leaving only the 3 km east.' },
  { q: "Pointing to a man, Riya says, 'He is the son of my mother's only brother.' How is the man related to Riya?", a: 'Cousin', w: ['Brother', 'Uncle', 'Nephew'], e: "Her mother's brother is her maternal uncle, and his son is her cousin." },
  { q: "A is B's sister. C is B's mother. D is C's father. E is D's mother. How is A related to D?", a: 'Granddaughter', w: ['Daughter', 'Great granddaughter', 'Grandmother'], e: "D is C's father and C is A's mother, so D is A's grandfather. A is D's granddaughter." },
  { q: 'Find the next letter in the series: A, C, F, J, O, ?', a: 'U', w: ['T', 'V', 'S'], e: 'The gaps are +2, +3, +4, +5, so the next gap is +6. O is the 15th letter, and 15 + 6 = 21, which is U.' },
  { q: 'Statements: All pens are books. All books are tables. Which conclusion definitely follows?', a: 'All pens are tables', w: ['All tables are pens', 'Some tables are not books', 'No pen is a table'], e: 'Pens are inside books, and books are inside tables, so every pen is a table.' },
  { q: 'Doctor : Hospital :: Teacher : ?', a: 'School', w: ['Student', 'Book', 'Classroom bell'], e: 'A doctor works in a hospital, as a teacher works in a school.' },
  { q: 'In a row of 40 students, Ravi is 15th from the left. What is his position from the right?', a: '26th', w: ['25th', '24th', '27th'], e: 'Position from right = 40 − 15 + 1 = 26.' },
  { q: 'What is the angle between the hour hand and the minute hand at 3:00?', a: '90°', w: ['60°', '120°', '180°'], e: 'Each hour mark is 30°, and at 3:00 the hands are 3 hours apart: 3 × 30 = 90°.' },
  { q: 'Today is Wednesday. What day of the week will it be after 100 days?', a: 'Friday', w: ['Thursday', 'Saturday', 'Wednesday'], e: '100 = 14 weeks + 2 days. Two days after Wednesday is Friday.' },
  { q: 'P is taller than Q. R is taller than P. S is shorter than Q. T is taller than R. Who is the shortest?', a: 'S', w: ['Q', 'P', 'T'], e: 'The order from tallest is T > R > P > Q > S, so S is the shortest.' },
  { q: "Pointing to a photograph, a man says, 'He is the son of my father's only son.' Whose photograph is it?", a: "The man's own son", w: ["The man's father", 'The man himself', "The man's brother"], e: "My father's only son is me, so the photograph shows my son." },
  { q: 'Facing north, Mohan turns right, then right again, then left. Which direction is he facing now?', a: 'East', w: ['North', 'South', 'West'], e: 'North → right → East → right → South → left → East.' },
  { q: 'Find the odd one out: Mango, Apple, Potato, Banana', a: 'Potato', w: ['Mango', 'Apple', 'Banana'], e: 'Potato is a vegetable; the others are fruits.' },
  { q: 'If 5 machines take 5 minutes to make 5 items, how long will 100 machines take to make 100 items?', a: '5 minutes', w: ['100 minutes', '20 minutes', '1 minute'], e: 'Each machine makes one item in 5 minutes, so 100 machines make 100 items in the same 5 minutes.' },
  { q: 'A is 2 years older than B. B is twice as old as C. The sum of their ages is 27. How old is B?', a: '10', w: ['8', '12', '14'], e: 'Let B = x. Then A = x + 2 and C = x/2. x + 2 + x + x/2 = 27 gives 2.5x = 25, so x = 10.' },
  { q: 'Find the missing number: 2, 3, 5, 9, 17, ?', a: '33', w: ['31', '34', '35'], e: 'The differences are 1, 2, 4, 8, so the next difference is 16. 17 + 16 = 33.' },
  { q: "If 'TABLE' is coded as 'UBCMF', how is 'CHAIR' coded?", a: 'DIBJS', w: ['DIBJR', 'BGZHQ', 'DJBIS'], e: 'Each letter moves one place forward: C→D, H→I, A→B, I→J, R→S.' },
  { q: 'Statements: Some doctors are teachers. All teachers are singers. Which conclusion follows?', a: 'Some doctors are singers', w: ['All doctors are singers', 'No doctor is a singer', 'All singers are teachers'], e: 'The doctors who are teachers are also singers, so some doctors are singers.' }
];

const verbalItems = [
  { q: "Choose the synonym of 'abundant'.", a: 'Plentiful', w: ['Scarce', 'Rare', 'Meagre'], e: 'Abundant means existing in large quantities, the same as plentiful.' },
  { q: "Choose the antonym of 'benevolent'.", a: 'Malevolent', w: ['Generous', 'Kind', 'Charitable'], e: 'Benevolent means well-meaning and kind; malevolent means wishing harm.' },
  { q: "Choose the synonym of 'candid'.", a: 'Frank', w: ['Secretive', 'Sweet', 'Shy'], e: 'Candid means open and honest, like frank.' },
  { q: "Choose the antonym of 'expand'.", a: 'Contract', w: ['Enlarge', 'Stretch', 'Grow'], e: 'To expand is to get bigger; to contract is to get smaller.' },
  { q: 'Choose the grammatically correct sentence.', a: "She doesn't like coffee.", w: ["She don't like coffee.", "She not like coffee.", "She doesn't likes coffee."], e: 'A third-person singular subject takes "doesn\'t" followed by the base verb.' },
  { q: 'Fill in the blank: Neither of the answers ___ correct.', a: 'is', w: ['are', 'were', 'be'], e: '"Neither" is singular, so it takes the singular verb "is".' },
  { q: 'Fill in the blank: He has been working here ___ 2019.', a: 'since', w: ['for', 'from', 'by'], e: '"Since" is used with a point in time; "for" is used with a duration.' },
  { q: 'Fill in the blank: I look forward to ___ you at the campus drive.', a: 'meeting', w: ['meet', 'have met', 'met'], e: 'After "look forward to" we use the -ing form, so "meeting".' },
  { q: "What does the idiom 'a piece of cake' mean?", a: 'Something very easy', w: ['A small dessert', 'A rare opportunity', 'A difficult problem'], e: 'It describes a task that is very easy to do.' },
  { q: "What does the idiom 'break the ice' mean?", a: 'Start a conversation in an awkward social situation', w: ['Break something frozen', 'End a friendship', 'Win an argument'], e: 'It means to ease the tension at the start of a meeting or conversation.' },
  { q: 'One word for: a person who loves books.', a: 'Bibliophile', w: ['Philatelist', 'Bibliographer', 'Linguist'], e: 'A bibliophile is a lover or collector of books.' },
  { q: 'One word for: speaking without any preparation.', a: 'Extempore', w: ['Soliloquy', 'Monologue', 'Rehearsed'], e: 'Extempore means spoken or done without preparation.' },
  { q: 'Choose the correctly spelt word.', a: 'Accommodation', w: ['Acommodation', 'Accomodation', 'Accommadation'], e: 'The correct spelling has double c and double m.' },
  { q: 'Fill in the blank: She is very good ___ mathematics.', a: 'at', w: ['in', 'on', 'with'], e: 'The standard preposition with "good" for a skill is "at".' },
  { q: 'Fill in the blank: He is ___ honest man.', a: 'an', w: ['a', 'the', 'no article'], e: '"Honest" starts with a vowel sound (the h is silent), so we use "an".' },
  { q: 'Fill in the blank: By the time we reached the station, the train ___.', a: 'had left', w: ['has left', 'leaves', 'was leave'], e: 'The past perfect "had left" shows the action finished before another past action.' },
  { q: "Choose the passive form of: 'The cat chased the mouse.'", a: 'The mouse was chased by the cat.', w: ['The mouse chased the cat.', 'The mouse is chased by the cat.', 'The cat was chased by the mouse.'], e: 'The object becomes the subject and the verb becomes "was chased".' },
  { q: "Choose the synonym of 'diligent'.", a: 'Hardworking', w: ['Lazy', 'Careless', 'Hasty'], e: 'Diligent means showing steady, careful effort.' },
  { q: "Choose the antonym of 'transparent'.", a: 'Opaque', w: ['Clear', 'Sheer', 'Glassy'], e: 'Transparent means see-through; opaque means not see-through.' },
  { q: 'Choose the sentence with correct subject-verb agreement.', a: 'Each of the students has submitted the form.', w: ['Each of the students have submitted the form.', 'Each of the student has submitted the form.', 'Each of students have submitted the form.'], e: '"Each" is singular, so it takes "has", and "of the" is followed by a plural noun.' }
];

const softItems = [
  { q: 'A teammate misses a deadline that affects your part of the project. What is the best first step?', a: 'Talk to them privately to understand the cause and offer help', w: ['Report them to the manager immediately without speaking to them', 'Redo their work silently and complain later', 'Ignore it and let your own work slip'], e: 'Speaking directly and constructively solves the problem and keeps trust in the team.' },
  { q: 'In an interview you do not know the answer to a technical question. What should you do?', a: 'Say you are not sure and explain how you would work it out', w: ['Make up a confident answer', 'Stay silent until the next question', 'Say the question is unfair'], e: 'Honesty plus a clear problem-solving approach shows maturity and learning ability.' },
  { q: 'Your mentor gives you critical feedback on your project. What is the best response?', a: 'Listen, ask clarifying questions and make an improvement plan', w: ['Defend every decision you made', 'Treat it as a personal attack', 'Agree politely and change nothing'], e: 'Feedback is useful only when you understand it and act on it.' },
  { q: 'Several deadlines clash this week. What is the best way to cope?', a: 'List tasks by urgency and importance and agree priorities with your lead', w: ['Do the easiest ones first and hope for the best', 'Work all night without telling anyone', 'Quietly drop some tasks'], e: 'Prioritising and communicating early prevents surprises.' },
  { q: 'You are emailing a faculty member to request a deadline extension. Which email is best?', a: 'A clear subject, polite tone, short reason and a specific request', w: ['A casual message with slang', 'A long emotional story with no clear request', 'The same email sent to every faculty member'], e: 'Professional emails are clear, polite and specific about what you need.' },
  { q: 'Two team members disagree on the technical approach and you are the lead. What should you do?', a: 'Let each explain, compare both against project goals and decide using evidence', w: ['Choose the one you like', 'Let them argue until one gives up', 'Split the team permanently'], e: 'Decisions based on goals and evidence are fair and keep the team together.' },
  { q: 'Which behaviour best shows active listening?', a: 'Paraphrasing what was said and asking follow-up questions', w: ['Planning your reply while the other person talks', 'Checking your phone now and then', 'Finishing their sentences'], e: 'Paraphrasing confirms understanding and shows respect.' },
  { q: 'One member of your group project is not contributing. What is the best approach?', a: 'Discuss expectations in a team meeting and assign clear tasks with deadlines', w: ['Exclude them without telling them', 'Complain about them on social media', 'Do their share silently'], e: 'Clear expectations and shared accountability usually fix the problem.' },
  { q: 'Your team is moving to a tool you have never used. What is the best attitude?', a: 'Take the initiative to learn the basics and ask for guidance', w: ['Wait until you are forced to use it', 'Argue that the old tool was better', 'Avoid tasks that need the new tool'], e: 'Adaptability means learning quickly and asking for help when needed.' },
  { q: 'You made a mistake that affects the whole team. What should you do?', a: 'Admit it quickly, explain what happened and propose a fix', w: ['Hide it and hope nobody notices', 'Blame the tool', 'Wait to see if anyone finds out'], e: 'Owning mistakes early limits damage and builds credibility.' },
  { q: 'Which body language creates the best impression in an interview?', a: 'Eye contact, upright posture and a calm voice', w: ['Crossed arms and looking at the floor', 'Constant fidgeting', 'Leaning back casually'], e: 'Confident, open body language signals interest and composure.' },
  { q: 'What is the most constructive way to give feedback to a colleague?', a: 'Be specific, focus on behaviour and suggest an improvement', w: ['Give vague general criticism', 'Point out their personality flaws', 'Give it in front of everyone'], e: 'Specific, behaviour-focused feedback in private is easiest to act on.' },
  { q: 'A client is angry about a delay in delivery. What is the best response?', a: 'Listen calmly, apologise for the delay and give a realistic plan', w: ['Argue that the delay was not your fault', 'Promise an unrealistic date to calm them down', 'Transfer the call without explanation'], e: 'Empathy and a realistic plan rebuild trust.' },
  { q: 'You keep postponing a big assignment. What helps most?', a: 'Break it into small steps with set times', w: ['Wait until you feel motivated', 'Multitask on everything at once', 'Do only the parts you enjoy'], e: 'Small scheduled steps make a big task manageable and reduce procrastination.' },
  { q: 'A classmate asks you to share your lab record so they can copy it. What should you do?', a: 'Politely decline and offer to explain the concepts', w: ['Give it to them', 'Sell it to them', 'Give it but ask them to change a few words'], e: 'Academic integrity matters, and helping them understand is the honest way to support them.' },
  { q: 'What is the best way to connect with a professional on LinkedIn?', a: 'Send a personalised note that mentions a common interest', w: ['Send generic requests to hundreds of people', 'Ask for a job in the first message', 'Never reach out first'], e: 'Personalised, respectful messages build genuine connections.' },
  { q: 'Your team has a tight deadline. How can a leader best motivate them?', a: 'Recognise effort, clarify goals and remove blockers', w: ['Threaten them with poor reviews', 'Only increase pressure', 'Stay away until the deadline'], e: 'Support and clarity keep a team productive under pressure.' },
  { q: "How should you answer 'Tell me about yourself' in an interview?", a: 'A short summary of your education, skills and goals relevant to the role', w: ['Your entire life story', 'Your resume read out line by line', 'Only your weaknesses'], e: 'A focused summary shows that you can communicate clearly and are suited to the role.' },
  { q: 'A teammate from a different culture communicates in a style you are not used to. What is the best approach?', a: 'Be patient, clarify when needed and respect different styles', w: ['Assume they are being rude', 'Avoid working with them', 'Imitate their accent jokingly'], e: 'Respect and clarification make diverse teams stronger.' },
  { q: 'How should you handle stress before an exam or placement drive?', a: 'Plan your preparation, take short breaks, sleep well and ask for support when needed', w: ['Skip sleep to study more', 'Isolate yourself from everyone', 'Keep comparing yourself with others'], e: 'Healthy routines and support keep you focused and calm.' }
];

function fromItems(r, items) {
  return items.map(i => build(r, i.q, i.a, i.w, i.e));
}

const defs = [
  { key: 'percentages', title: 'Percentages Practice Set', topic: 'Percentages', category: 'Quantitative', difficulty: 'Easy', duration: 20, gens: percentGens, count: 20, seed: 101 },
  { key: 'profit-loss', title: 'Profit and Loss Practice Set', topic: 'Profit and Loss', category: 'Quantitative', difficulty: 'Medium', duration: 25, gens: profitGens, count: 20, seed: 202 },
  { key: 'speed-distance', title: 'Time, Speed and Distance', topic: 'Speed and Distance', category: 'Quantitative', difficulty: 'Medium', duration: 25, gens: speedGens, count: 20, seed: 303 },
  { key: 'trains', title: 'Problems on Trains', topic: 'Trains', category: 'Quantitative', difficulty: 'Medium', duration: 25, gens: trainGens, count: 20, seed: 404 },
  { key: 'races', title: 'Races and Circular Tracks', topic: 'Races', category: 'Quantitative', difficulty: 'Hard', duration: 25, gens: raceGens, count: 20, seed: 505 },
  { key: 'time-work', title: 'Time, Work and Pipes', topic: 'Time and Work', category: 'Quantitative', difficulty: 'Medium', duration: 25, gens: workGens, count: 20, seed: 606 },
  { key: 'ratio', title: 'Ratio and Proportion', topic: 'Ratio and Proportion', category: 'Quantitative', difficulty: 'Easy', duration: 20, gens: ratioGens, count: 20, seed: 707 },
  { key: 'interest', title: 'Simple and Compound Interest', topic: 'Interest', category: 'Quantitative', difficulty: 'Medium', duration: 25, gens: interestGens, count: 20, seed: 808 },
  { key: 'averages', title: 'Averages', topic: 'Averages', category: 'Quantitative', difficulty: 'Easy', duration: 20, gens: averageGens, count: 20, seed: 909 },
  { key: 'series', title: 'Number Series', topic: 'Number Series', category: 'Quantitative', difficulty: 'Medium', duration: 20, gens: seriesGens, count: 20, seed: 1010 },
  { key: 'quant-mixed', title: 'Quantitative Aptitude Mixed Test', topic: 'Quantitative Mix', category: 'Quantitative', difficulty: 'Hard', duration: 45, gens: mixGens, count: 30, seed: 1111 },
  { key: 'logical', title: 'Logical Reasoning', topic: 'Logical Reasoning', category: 'Logical', difficulty: 'Medium', duration: 25, items: logicalItems, seed: 1212 },
  { key: 'verbal', title: 'Verbal Ability', topic: 'Verbal Ability', category: 'Verbal', difficulty: 'Easy', duration: 20, items: verbalItems, seed: 1313 },
  { key: 'soft-skills', title: 'Soft Skills and Workplace Behaviour', topic: 'Soft Skills', category: 'Soft Skills', difficulty: 'Easy', duration: 20, items: softItems, seed: 1414 }
];

function generate(def) {
  const r = rng(def.seed);
  if (def.items) return fromItems(r, def.items);
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < def.count && guard++ < 6000) {
    const item = def.gens[out.length % def.gens.length](r);
    if (item && !seen.has(item.question)) {
      seen.add(item.question);
      out.push(item);
    }
  }
  return out;
}

function buildAll() {
  return defs.map(def => ({ def, questions: generate(def) }));
}

function seedQuizzes(db) {
  const admin = db.findOne('users', u => u.role === 'ADMIN');
  if (!admin) return;
  db.all('quizzes', q => !q.archived && !q.seed_key && /Starter Quiz$/.test(q.title)).forEach(q => {
    db.update('quizzes', q.id, { archived: true });
  });
  for (const { def, questions } of buildAll()) {
    if (db.findOne('quizzes', q => q.seed_key === def.key)) continue;
    db.insert('quizzes', {
      seed_key: def.key, title: def.title, topic: def.topic, category: def.category,
      difficulty: def.difficulty, duration_minutes: def.duration, questions,
      created_by: admin.id, created_by_name: 'PrepMate', published: true, archived: false
    });
  }
}

module.exports = seedQuizzes;
module.exports.buildAll = buildAll;
