<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade, scale } from 'svelte/transition';
  import { mdiThermometer } from '@mdi/js';
  import { HOME, ROOMS, DOOR_SENSORS } from '$shared/config.js';
  import { states, household, isOn, unavailable } from '../../lib/api.js';

  const toNum = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const fmt = (v) => (v == null ? '–' : v.toFixed(1).replace('.', ','));

  const SLOTS = {
    slaapkamer: { x: 146, y: 96, w: 198, h: 62, win: [166, 112, 34, 28], lx: 214, ly: 120, anchor: 'start', extra: [296, 112, 30, 28] },
    living: { x: 146, y: 158, w: 112, h: 68, win: [158, 176, 32, 30], lx: 198, ly: 184, anchor: 'start' },
    badkamer: { x: 258, y: 158, w: 86, h: 68, win: [288, 168, 26, 22], lx: 301, ly: 204, anchor: 'middle' },
  };
  const FALLBACK = [SLOTS.living, SLOTS.slaapkamer, SLOTS.badkamer];

  const extraWindows = $derived(
    DOOR_SENSORS.filter((d) => d.kind === 'window').map((d) => {
      const label = $household?.sensorLabels?.[d.entity] || d.defaultLabel;
      const room = ROOMS.find((r) => label.toLowerCase().includes(r.name.toLowerCase()) || label.toLowerCase().includes(r.key));
      return { entity: d.entity, label, room: room?.key ?? null, open: isOn($states[d.entity]) };
    }),
  );

  const rooms = $derived(
    ROOMS.map((r, i) => {
      const c = $states[r.climate];
      const a = c?.attributes ?? {};
      const temp = toNum($states[r.temperature]?.state) ?? toNum(a.current_temperature);
      const heatPct = toNum($states[r.heating]?.state) ?? 0;
      const heating = !!c && c.state !== 'off' && !unavailable(c) && (a.hvac_action === 'heating' || heatPct > 0);
      const own = extraWindows.filter((w) => w.room === r.key);
      const open = isOn($states[r.window]) || own.some((w) => w.open);
      return { key: r.key, name: r.name, temp, heating, open, slot: SLOTS[r.key] ?? FALLBACK[i % FALLBACK.length] };
    }),
  );
  const loose = $derived(extraWindows.filter((w) => !w.room));
  const looseOpen = $derived(loose.some((w) => w.open));

  const inside = $derived.by(() => {
    const t = rooms.map((r) => r.temp).filter((v) => v != null);
    return t.length ? t.reduce((s, v) => s + /** @type {number} */ (v), 0) / t.length : null;
  });
  const outdoorS = $derived($states[HOME.outdoorTemperature]);
  const outdoor = $derived(unavailable(outdoorS) ? null : toNum(outdoorS?.state));
  const solarS = $derived($states[HOME.solar]);
  const solar = $derived(unavailable(solarS) ? null : Math.max(0, Math.min(100, toNum(solarS?.state) ?? 0)));
  const sunS = $derived($states[HOME.sun]);
  const night = $derived(sunS ? sunS.state === 'below_horizon' : (() => { const h = new Date().getHours(); return h < 7 || h >= 21; })());
  const anyHeating = $derived(rooms.some((r) => r.heating));
  const openCount = $derived(rooms.filter((r) => r.open).length + (looseOpen ? 1 : 0));

  const sunT = new Tween(0, { duration: 1400, easing: cubicOut });
  $effect(() => {
    sunT.target = night ? 0 : (solar ?? 30) / 100;
  });
  const b = $derived(sunT.current);
  const sunR = $derived(14 + 8 * b);
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  const outColor = $derived(outdoor == null ? 'var(--text-3)' : outdoor < 5 ? 'var(--cool)' : outdoor < 15 ? 'var(--info)' : outdoor < 22 ? '#f59e0b' : 'var(--heat)');
  const stars = [[24, 26], [108, 18], [132, 50], [86, 76], [16, 92], [196, 20], [44, 118], [350, 40]];
  const thermo = mdiThermometer;
</script>

<div class="scene" class:night class:sunny={!night && (solar ?? 0) >= 50}>
  <svg viewBox="0 0 360 250" role="img" aria-label="Huis: buiten {fmt(outdoor)}°, binnen {fmt(inside)}°, {openCount ? `${openCount} raam open` : 'alle ramen dicht'}">
    <defs>
      <radialGradient id="hs-sun">
        <stop offset="0%" stop-color="#fde68a" stop-opacity="0.95" />
        <stop offset="45%" stop-color="#fbbf24" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="hs-warm" cx="50%" cy="60%" r="70%">
        <stop offset="0%" stop-color="#fb923c" stop-opacity="0.75" />
        <stop offset="100%" stop-color="#f97316" stop-opacity="0.05" />
      </radialGradient>
      <linearGradient id="hs-roof" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" class="roof-a" />
        <stop offset="100%" class="roof-b" />
      </linearGradient>
      <mask id="hs-moon">
        <rect x="0" y="0" width="360" height="250" fill="white" />
        <circle cx="72" cy="50" r="17" fill="black" />
      </mask>
    </defs>

    {#if night}
      <g transition:fade={{ duration: 600 }}>
        {#each stars as [x, y], i}
          <circle cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} class="star" style="animation-delay:{i * 0.37}s" />
        {/each}
        <circle cx="62" cy="58" r="34" fill="url(#hs-sun)" opacity="0.25" />
        <circle cx="62" cy="58" r="18" class="moon" mask="url(#hs-moon)" />
      </g>
    {:else}
      <g transition:fade={{ duration: 600 }}>
        <circle cx="62" cy="58" r={sunR * 2.6} fill="url(#hs-sun)" opacity={0.25 + 0.75 * b} class="halo" />
        <g class="rays" style="opacity:{0.25 + 0.75 * b}">
          {#each rays as deg}
            <line x1="62" y1={58 - sunR - 5} x2="62" y2={58 - sunR - 7 - 12 * b} transform="rotate({deg} 62 58)" />
          {/each}
        </g>
        <circle cx="62" cy="58" r={sunR} class="sun" style="opacity:{0.55 + 0.45 * b}" />
      </g>
    {/if}

    {#if night || (solar ?? 0) < 70}
      <g class="clouds" style="opacity:{night ? 0.35 : Math.min(0.95, 1.15 - b)}" transition:fade={{ duration: 800 }}>
        <g class="cloud c1"><path d="M40 82 a12 12 0 0 1 12-12 a16 16 0 0 1 30 4 a10 10 0 0 1 4 20 h-42 a9 9 0 0 1 -4-12z" /></g>
        <g class="cloud c2"><path d="M168 40 a8 8 0 0 1 8-8 a11 11 0 0 1 20 3 a7 7 0 0 1 3 13 h-28 a6 6 0 0 1 -3-8z" /></g>
      </g>
    {/if}

    <text x="62" y={night ? 100 : 58 + sunR + 30} text-anchor="middle" class="sun-lbl">{night ? 'Nacht' : solar == null ? 'Zon –' : `Zon ${Math.round(solar)}%`}</text>

    <path d="M0 224 Q 70 210 150 222 T 360 220 V250 H0Z" class="ground" />

    <g class="tree">
      <rect x="125" y="196" width="4" height="28" rx="2" class="trunk" />
      <circle cx="127" cy="190" r="12" class="leaf" />
      <circle cx="120" cy="198" r="8" class="leaf" />
      <circle cx="134" cy="197" r="8" class="leaf" />
    </g>

    <g class="outdoor" transform="translate(10 146)">
      <rect width="104" height="56" rx="16" class="pill" />
      <g transform="translate(8 16)" style="color:{outColor}">
        <path d={thermo} fill="currentColor" transform="scale(1)" />
      </g>
      <text x="38" y="22" class="lbl">Buiten</text>
      <text x="38" y="44" class="val" style="fill:{outColor}">{fmt(outdoor)}°</text>
    </g>

    <rect x="300" y="38" width="16" height="40" rx="2" class="chimney" />
    {#if anyHeating}
      <g class="smoke" transition:fade>
        <circle cx="308" cy="32" r="5" style="animation-delay:0s" />
        <circle cx="308" cy="32" r="6" style="animation-delay:1s" />
        <circle cx="308" cy="32" r="5" style="animation-delay:2s" />
      </g>
    {/if}

    <rect x="146" y="96" width="198" height="130" class="wall" />
    {#each rooms as r (r.key)}
      {@const s = r.slot}
      <g class="room" class:heating={r.heating} class:open={r.open}>
        <rect x={s.x} y={s.y} width={s.w} height={s.h} class="room-bg" />
        <rect x={s.x + 1} y={s.y + 1} width={s.w - 2} height={s.h - 2} fill="url(#hs-warm)" class="warm" />
        <g class="win">
          <rect x={s.win[0] - 4} y={s.win[1] - 4} width={s.win[2] + 8} height={s.win[3] + 8} rx="5" class="halo-win" />
          <rect x={s.win[0]} y={s.win[1]} width={s.win[2]} height={s.win[3]} rx="2" class="hole" />
          <g class="sash" style="transform-origin:{s.win[0]}px {s.win[1] + s.win[3] / 2}px">
            <rect x={s.win[0]} y={s.win[1]} width={s.win[2]} height={s.win[3]} rx="2" class="glass" />
            <line x1={s.win[0] + s.win[2] / 2} y1={s.win[1]} x2={s.win[0] + s.win[2] / 2} y2={s.win[1] + s.win[3]} class="mullion" />
            <line x1={s.win[0]} y1={s.win[1] + s.win[3] / 2} x2={s.win[0] + s.win[2]} y2={s.win[1] + s.win[3] / 2} class="mullion" />
          </g>
          <rect x={s.win[0]} y={s.win[1]} width={s.win[2]} height={s.win[3]} rx="2" class="frame" />
        </g>
        <text x={s.lx} y={s.ly} text-anchor={s.anchor} class="r-name">{r.name}</text>
        <text x={s.lx} y={s.ly + 18} text-anchor={s.anchor} class="r-temp">{fmt(r.temp)}°</text>
        {#if r.heating}
          <text x={s.x + s.w - 8} y={s.y + 16} text-anchor="end" class="flame" in:scale>🔥</text>
        {/if}
      </g>
    {/each}

    {#if loose.length && SLOTS.slaapkamer.extra}
      {@const w = SLOTS.slaapkamer.extra}
      <g class="room" class:open={looseOpen}>
        <title>{loose.map((l) => l.label).join(', ')}</title>
        <g class="win">
          <rect x={w[0] - 4} y={w[1] - 4} width={w[2] + 8} height={w[3] + 8} rx="5" class="halo-win" />
          <rect x={w[0]} y={w[1]} width={w[2]} height={w[3]} rx="2" class="hole" />
          <g class="sash" style="transform-origin:{w[0]}px {w[1] + w[3] / 2}px">
            <rect x={w[0]} y={w[1]} width={w[2]} height={w[3]} rx="2" class="glass" />
            <line x1={w[0] + w[2] / 2} y1={w[1]} x2={w[0] + w[2] / 2} y2={w[1] + w[3]} class="mullion" />
          </g>
          <rect x={w[0]} y={w[1]} width={w[2]} height={w[3]} rx="2" class="frame" />
        </g>
      </g>
    {/if}

    <path d="M136 98 L245 26 L354 98 Z" fill="url(#hs-roof)" class="roof" />
    <text x="245" y="66" text-anchor="middle" class="in-lbl">Binnen</text>
    <text x="245" y="88" text-anchor="middle" class="in-val">{fmt(inside)}°</text>
  </svg>

  <div class="status" class:bad={openCount > 0}>
    {#key openCount}
      <span in:scale={{ start: 0.7, duration: 300 }}>{openCount ? `${openCount} ${openCount === 1 ? 'raam' : 'ramen'} open` : 'Ramen dicht'}</span>
    {/key}
  </div>
</div>

<style>
  .scene {
    position: relative; border-radius: inherit; overflow: hidden;
    background: linear-gradient(180deg, color-mix(in srgb, #38bdf8 26%, var(--surface)) 0%, color-mix(in srgb, #7dd3fc 10%, var(--surface)) 75%);
    transition: background 1s;
  }
  .scene.sunny { background: linear-gradient(180deg, color-mix(in srgb, #38bdf8 34%, var(--surface)) 0%, color-mix(in srgb, #fde68a 18%, var(--surface)) 80%); }
  .scene.night { background: linear-gradient(180deg, color-mix(in srgb, #1e1b4b 70%, var(--surface)) 0%, color-mix(in srgb, #312e81 30%, var(--surface)) 80%); }
  svg { display: block; width: 100%; height: auto; }

  .halo { animation: breathe 5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  .rays { stroke: #fbbf24; stroke-width: 3; stroke-linecap: round; animation: spin 30s linear infinite; transform-origin: 62px 58px; transition: opacity 1s; }
  .sun { fill: #fbbf24; filter: drop-shadow(0 0 8px #fbbf24); transition: opacity 1s; }
  .moon { fill: #fef3c7; filter: drop-shadow(0 0 8px rgba(254, 243, 199, 0.6)); }
  .star { fill: #fef9c3; animation: twinkle 6s ease-in-out infinite; }
  .clouds { transition: opacity 1.2s; }
  .cloud path { fill: color-mix(in srgb, var(--surface-solid) 85%, #94a3b8); }
  .night .cloud path { fill: color-mix(in srgb, #64748b 60%, var(--surface-solid)); }
  .c1 { animation: drift 14s ease-in-out infinite alternate; }
  .c2 { animation: drift 18s ease-in-out infinite alternate-reverse; }
  .sun-lbl { font-size: 10px; font-weight: 800; fill: var(--text-2); letter-spacing: 0.02em; }

  .ground { fill: color-mix(in srgb, #22c55e 28%, var(--surface-solid)); }
  .night .ground { fill: color-mix(in srgb, #14532d 45%, var(--surface-solid)); }
  .trunk { fill: color-mix(in srgb, #92400e 70%, var(--surface-solid)); }
  .leaf { fill: color-mix(in srgb, #16a34a 70%, var(--surface-solid)); }
  .tree { transform-origin: 127px 224px;  }

  .pill { fill: color-mix(in srgb, var(--surface-solid) 82%, transparent); stroke: var(--border); }
  .outdoor .lbl { font-size: 10px; font-weight: 700; fill: var(--text-2); text-transform: uppercase; letter-spacing: 0.06em; }
  .outdoor .val { font-size: 19px; font-weight: 800; letter-spacing: -0.03em; transition: fill 0.6s; }

  .chimney { fill: color-mix(in srgb, #9a3412 55%, var(--surface-solid)); }
  .smoke circle { fill: color-mix(in srgb, var(--text-3) 45%, transparent); opacity: 0; animation: smoke 3s ease-out infinite; transform-box: fill-box; transform-origin: center; }

  .wall { fill: color-mix(in srgb, #f59e0b 8%, var(--surface-solid)); stroke: var(--border); stroke-width: 1.5; }
  .room-bg { fill: transparent; stroke: color-mix(in srgb, var(--text-3) 35%, transparent); stroke-width: 1.2; }
  .warm { opacity: 0; transition: opacity 0.8s; }
  .room.heating .warm { animation: warm 6s ease-in-out infinite; }
  .r-name { font-size: 9.5px; font-weight: 800; fill: var(--text-2); text-transform: uppercase; letter-spacing: 0.05em; }
  .r-temp { font-size: 16px; font-weight: 800; fill: var(--text); letter-spacing: -0.03em; }
  .flame { font-size: 11px; transform-box: fill-box; transform-origin: 50% 90%; }

  .hole { fill: color-mix(in srgb, #0f172a 75%, var(--surface-solid)); }
  .glass { fill: color-mix(in srgb, #7dd3fc 45%, var(--surface-solid)); stroke: color-mix(in srgb, var(--text) 25%, transparent); stroke-width: 1; }
  .night .glass { fill: #fde68a; filter: drop-shadow(0 0 4px rgba(253, 230, 138, 0.8)); }
  .mullion { stroke: color-mix(in srgb, var(--text) 30%, transparent); stroke-width: 1; }
  .frame { fill: none; stroke: color-mix(in srgb, var(--text) 35%, transparent); stroke-width: 1.4; transition: stroke 0.4s; }
  .sash { transition: transform 0.8s var(--spring); }
  .halo-win { fill: none; stroke: var(--danger); stroke-width: 2; opacity: 0; }
  .room.open .sash { transform: scaleX(0.45) skewY(-14deg); }
  .room.open .frame { stroke: var(--danger); stroke-width: 2; }
  .room.open .halo-win { animation: win-pulse 2.6s ease-out infinite; }

  .roof { stroke: color-mix(in srgb, #7c2d12 40%, transparent); stroke-width: 1.5; stroke-linejoin: round; }
  .roof-a { stop-color: color-mix(in srgb, #c2410c 75%, var(--surface-solid)); }
  .roof-b { stop-color: color-mix(in srgb, #9a3412 75%, var(--surface-solid)); }
  .in-lbl { font-size: 9px; font-weight: 800; fill: rgba(255, 255, 255, 0.8); text-transform: uppercase; letter-spacing: 0.1em; }
  .in-val { font-size: 19px; font-weight: 800; fill: #fff; letter-spacing: -0.03em; }

  .status {
    position: absolute; top: 10px; right: 10px; padding: 4px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 800;
    background: color-mix(in srgb, var(--ok) 18%, var(--surface)); color: var(--ok); border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent);
    transition: background 0.4s, color 0.4s, border-color 0.4s;
  }
  .status.bad { background: color-mix(in srgb, var(--danger) 18%, var(--surface)); color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, transparent); }
  .status span { display: inline-block; }

  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
  @keyframes drift { from { transform: translateX(-6px); } to { transform: translateX(10px); } }
  @keyframes sway { 0%, 100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
  @keyframes smoke { 0% { opacity: 0; transform: translate(0, 0) scale(0.6); } 20% { opacity: 0.8; } 100% { opacity: 0; transform: translate(10px, -28px) scale(1.8); } }
  @keyframes warm { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.9; } }
  @keyframes win-pulse { 0% { opacity: 0.9; stroke-width: 2; } 100% { opacity: 0; stroke-width: 8; } }
  @keyframes flicker { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
</style>
