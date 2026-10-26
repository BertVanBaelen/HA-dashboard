<script>
  import { FLOOR_TYPES } from '$shared/config.js';
  import { validateLayout, overlappingRooms, doorGeometry, ROOM_ICON_KEYS, MAX_ROOMS } from '$shared/layout.js';
  import { defaultLayout } from '$shared/default-layout.js';
  import { household, topology, saveLayout, toast } from '../lib/api.js';
  import { ROOM_ICONS } from '../tabs/plattegrond/icons.js';
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import FloorSvg from '../tabs/plattegrond/FloorSvg.svelte';

  /** @type {{ open?: boolean }} */
  let { open = $bindable(false) } = $props();

  const GRID = 2;
  const snap = (v) => Math.round(v / GRID) * GRID;
  const ICON_LABELS = { home: 'Huis', sofa: 'Zetel', bed: 'Bed', kitchen: 'Keuken', shower: 'Douche', toilet: 'Toilet', hall: 'Hal', stair: 'Trap', storage: 'Berging', terrace: 'Terras', mistique: 'Mistique', desk: 'Bureau', dining: 'Eettafel', kids: 'Kinderen', laundry: 'Was', garage: 'Garage', garden: 'Tuin' };

  let draft = $state(/** @type {any} */ (null));
  let sel = $state(/** @type {{kind:'room'|'door'|'window', id:string}|null} */ (null));
  let saving = $state(false);
  let svgEl = $state(/** @type {SVGSVGElement|null} */ (null));
  let drag = null;

  $effect(() => {
    if (open && !draft && $household?.layout) draft = structuredClone($state.snapshot($household.layout));
    if (!open) (draft = null), (sel = null);
  });

  const areas = $derived($topology?.areas ?? []);
  const areaName = (id) => areas.find((a) => a.id === id)?.name ?? id;
  const hasDevices = (id) => {
    const r = $topology?.rooms?.[id];
    return !!r && (r.lights.length || r.switches.length || r.scripts.length || r.sensors.length || r.openings.length || r.climate || r.media.length);
  };
  const placedAreas = $derived(new Set((draft?.rooms ?? []).map((r) => r.areaId).filter(Boolean)));
  const freeAreas = $derived(areas.filter((a) => !placedAreas.has(a.id)));
  const error = $derived.by(() => {
    if (!draft) return null;
    try {
      validateLayout($state.snapshot(draft));
      return null;
    } catch (e) {
      return e.message;
    }
  });
  const warnings = $derived.by(() => {
    if (!draft) return [];
    const label = (id) => {
      const r = draft.rooms.find((x) => x.id === id);
      return r?.areaId ? areaName(r.areaId) : r?.name || 'Tekening';
    };
    return [
      ...overlappingRooms(draft).map(([a, b]) => `${label(a)} en ${label(b)} overlappen`),
      ...freeAreas.filter((a) => hasDevices(a.id)).map((a) => `${a.name} heeft toestellen maar staat niet op de plattegrond`),
    ];
  });
  const selected = $derived(
    !draft || !sel ? null : (sel.kind === 'room' ? draft.rooms : sel.kind === 'door' ? draft.doors : draft.windows).find((x) => x.id === sel.id) ?? null,
  );

  const newId = (prefix, list) => {
    let i = list.length + 1;
    while (list.some((x) => x.id === `${prefix}${i}`)) i++;
    return `${prefix}${i}`;
  };
  const center = () => [snap(draft.viewBox[0] + draft.viewBox[2] / 2), snap(draft.viewBox[1] + draft.viewBox[3] / 2)];

  function addRoom(areaId) {
    if (draft.rooms.length >= MAX_ROOMS) return toast(`Maximaal ${MAX_ROOMS} ruimtes`, 'error');
    const [cx, cy] = center();
    const id = areaId && !draft.rooms.some((r) => r.id === areaId) && /^[\w-]{1,40}$/.test(areaId) ? areaId : newId('r', draft.rooms);
    const icon = ROOM_ICON_KEYS.includes(areas.find((a) => a.id === areaId)?.icon) ? areas.find((a) => a.id === areaId).icon : 'home';
    draft.rooms.push({ id, areaId: areaId || null, name: areaId ? '' : 'Nieuwe ruimte', icon, rect: [cx - 30, cy - 30, 60, 60], floor: 'plain', furniture: null });
    sel = { kind: 'room', id };
  }
  function addDoor() {
    const [cx, cy] = center();
    const id = newId('d', draft.doors);
    draft.doors.push({ id, x: cx - 10, y: cy, wall: 'h', size: 20, thick: 6, swing: 'in', hinge: 'start' });
    sel = { kind: 'door', id };
  }
  function addWindow() {
    const [cx, cy] = center();
    const id = newId('w', draft.windows);
    draft.windows.push({ id, rect: [cx - 20, cy, 40, 6] });
    sel = { kind: 'window', id };
  }
  function remove() {
    if (!sel) return;
    const key = sel.kind === 'room' ? 'rooms' : sel.kind === 'door' ? 'doors' : 'windows';
    draft[key] = draft[key].filter((x) => x.id !== sel.id);
    sel = null;
  }
  function reset() {
    if (!confirm('De standaard plattegrond terugzetten? Je wijzigingen gaan verloren.')) return;
    const l = defaultLayout();
    const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s_-]+/g, ' ');
    const taken = new Set();
    for (const r of l.rooms) {
      if (!r.name) continue;
      const a = areas.find((x) => !taken.has(x.id) && (norm(x.id) === norm(r.id) || norm(x.name) === norm(r.name)));
      if (a) taken.add((r.areaId = a.id));
    }
    draft = l;
    sel = null;
  }
  async function save() {
    let clean;
    try {
      clean = validateLayout($state.snapshot(draft));
    } catch (e) {
      return toast(e.message, 'error');
    }
    saving = true;
    try {
      await saveLayout(clean);
      open = false;
    } catch {
    } finally {
      saving = false;
    }
  }

  function point(e) {
    const p = svgEl.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svgEl.getScreenCTM().inverse());
  }
  function startDrag(e, kind, id, mode = 'move') {
    e.stopPropagation();
    sel = { kind, id };
    const item = (kind === 'room' ? draft.rooms : kind === 'door' ? draft.doors : draft.windows).find((x) => x.id === id);
    const p = point(e);
    drag = { item, mode, x: p.x, y: p.y, orig: kind === 'door' ? [item.x, item.y, item.size] : [...item.rect] };
    svgEl.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!drag) return;
    const p = point(e);
    const dx = snap(p.x - drag.x);
    const dy = snap(p.y - drag.y);
    const [a, b, c, d] = drag.orig;
    if (drag.item.rect) {
      drag.item.rect = drag.mode === 'move' ? [a + dx, b + dy, c, d] : [a, b, Math.max(GRID * 2, c + dx), Math.max(GRID * 2, d + dy)];
    } else if (drag.mode === 'move') {
      drag.item.x = a + dx;
      drag.item.y = b + dy;
    } else {
      drag.item.size = Math.max(4, Math.min(120, c + (drag.item.wall === 'h' ? dx : dy)));
    }
  }
  const end = () => (drag = null);

  const roomLabel = (r) => (r.areaId ? areaName(r.areaId) : r.name || 'Tekening');
  const numInput = (obj, key, i = null) => (e) => {
    const v = Number(e.currentTarget.value);
    if (!Number.isFinite(v)) return;
    if (i === null) obj[key] = v;
    else obj[key][i] = v;
  };
</script>

<Sheet bind:open title="Plattegrond bewerken" wide>
  {#if draft}
    <div class="editor">
      <div class="tools row">
        <select class="input sm" value="" onchange={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; if (v) addRoom(v === '-' ? null : v); }}>
          <option value="">+ Ruimte</option>
          {#each freeAreas as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
          <option value="-">Geen – enkel tekening</option>
        </select>
        <button class="btn soft sm" onclick={addDoor}><Icon name="plus" size={16} />Deur</button>
        <button class="btn soft sm" onclick={addWindow}><Icon name="plus" size={16} />Raam</button>
        <span class="grow"></span>
        <label class="row tiny">Breedte<input class="input num" type="number" min="50" max="2000" value={draft.viewBox[2]} onchange={numInput(draft, 'viewBox', 2)} /></label>
        <label class="row tiny">Hoogte<input class="input num" type="number" min="50" max="2000" value={draft.viewBox[3]} onchange={numInput(draft, 'viewBox', 3)} /></label>
      </div>

      <div class="canvas" style="aspect-ratio:{draft.viewBox[2]} / {draft.viewBox[3]}">
        <FloorSvg layout={draft} uid="le" />
        <svg
          bind:this={svgEl}
          class="overlay"
          viewBox={draft.viewBox.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          aria-label="Plattegrond"
          onpointermove={move}
          onpointerup={end}
          onpointercancel={end}
          onpointerdown={() => (sel = null)}
        >
          {#each draft.rooms as r (r.id)}
            {@const on = sel?.kind === 'room' && sel.id === r.id}
            <g class="item" class:on>
              <rect x={r.rect[0]} y={r.rect[1]} width={r.rect[2]} height={r.rect[3]} class="hit" role="button" tabindex="-1" aria-label={roomLabel(r)} onpointerdown={(e) => startDrag(e, 'room', r.id)} />
              <text x={r.rect[0] + r.rect[2] / 2} y={r.rect[1] + r.rect[3] / 2} class="lbl">{roomLabel(r)}</text>
              {#if on}<rect x={r.rect[0] + r.rect[2] - 6} y={r.rect[1] + r.rect[3] - 6} width="10" height="10" class="handle" role="button" tabindex="-1" aria-label="Grootte" onpointerdown={(e) => startDrag(e, 'room', r.id, 'resize')} />{/if}
            </g>
          {/each}
          {#each draft.windows as w (w.id)}
            {@const on = sel?.kind === 'window' && sel.id === w.id}
            <g class="item win" class:on>
              <rect x={w.rect[0] - 2} y={w.rect[1] - 2} width={w.rect[2] + 4} height={w.rect[3] + 4} class="hit" role="button" tabindex="-1" aria-label="Raam" onpointerdown={(e) => startDrag(e, 'window', w.id)} />
              {#if on}<rect x={w.rect[0] + w.rect[2] - 4} y={w.rect[1] + w.rect[3] - 4} width="8" height="8" class="handle" role="button" tabindex="-1" aria-label="Grootte" onpointerdown={(e) => startDrag(e, 'window', w.id, 'resize')} />{/if}
            </g>
          {/each}
          {#each draft.doors as d (d.id)}
            {@const on = sel?.kind === 'door' && sel.id === d.id}
            {@const g = doorGeometry(d).gap}
            <g class="item door" class:on>
              <rect x={g[0] - 2} y={g[1] - 2} width={g[2] + 4} height={g[3] + 4} class="hit" role="button" tabindex="-1" aria-label="Deur" onpointerdown={(e) => startDrag(e, 'door', d.id)} />
              {#if on}<rect x={g[0] + g[2] - 4} y={g[1] + g[3] - 4} width="8" height="8" class="handle" role="button" tabindex="-1" aria-label="Breedte" onpointerdown={(e) => startDrag(e, 'door', d.id, 'resize')} />{/if}
            </g>
          {/each}
        </svg>
      </div>

      <div class="panel">
        {#if !selected}
          <p class="muted small">Tik een ruimte, deur of raam om te bewerken. Sleep om te verplaatsen, sleep het hoekje om de grootte te wijzigen.</p>
        {:else if sel?.kind === 'room'}
          <label class="field">Ruimte in Home Assistant
            <select class="input" value={selected.areaId ?? ''} onchange={(e) => (selected.areaId = e.currentTarget.value || null)}>
              <option value="">Geen – enkel tekening</option>
              {#each areas.filter((a) => a.id === selected.areaId || !placedAreas.has(a.id)) as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
            </select>
          </label>
          {#if !selected.areaId}
            <label class="field">Naam<input class="input" maxlength="40" bind:value={selected.name} /></label>
          {/if}
          <div class="icons">
            {#each ROOM_ICON_KEYS as k (k)}
              <button class="icn" class:sel={selected.icon === k} title={ICON_LABELS[k]} aria-label={ICON_LABELS[k]} onclick={() => (selected.icon = k)}><Icon path={ROOM_ICONS[k]} size={18} /></button>
            {/each}
          </div>
          <label class="field">Vloer
            <select class="input" bind:value={selected.floor}>
              {#each FLOOR_TYPES as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
            </select>
          </label>
          <div class="nums">
            {#each ['X', 'Y', 'B', 'H'] as l, i (l)}
              <label class="tiny">{l}<input class="input num" type="number" value={selected.rect[i]} onchange={numInput(selected, 'rect', i)} /></label>
            {/each}
          </div>
        {:else if sel?.kind === 'door'}
          <div class="nums">
            <label class="tiny">X<input class="input num" type="number" value={selected.x} onchange={numInput(selected, 'x')} /></label>
            <label class="tiny">Y<input class="input num" type="number" value={selected.y} onchange={numInput(selected, 'y')} /></label>
            <label class="tiny">Breedte<input class="input num" type="number" min="4" max="120" value={selected.size} onchange={numInput(selected, 'size')} /></label>
          </div>
          <label class="field">Muur
            <select class="input" bind:value={selected.wall}><option value="h">Horizontaal</option><option value="v">Verticaal</option></select>
          </label>
          <label class="field">Draairichting
            <select class="input" bind:value={selected.swing}><option value="in">Naar binnen</option><option value="out">Naar buiten</option><option value="none">Geen deur (opening)</option></select>
          </label>
          <label class="field">Scharnier
            <select class="input" bind:value={selected.hinge}><option value="start">Begin</option><option value="end">Einde</option></select>
          </label>
        {:else}
          <div class="nums">
            {#each ['X', 'Y', 'B', 'H'] as l, i (l)}
              <label class="tiny">{l}<input class="input num" type="number" value={selected.rect[i]} onchange={numInput(selected, 'rect', i)} /></label>
            {/each}
          </div>
        {/if}
        {#if selected}
          <button class="btn danger sm" onclick={remove}><Icon name="delete" size={16} />Verwijderen</button>
        {/if}
      </div>

      {#if error}<p class="msg err small">{error}</p>{/if}
      {#each warnings as w (w)}<p class="msg warn small">{w}</p>{/each}
    </div>
  {/if}
  {#snippet footer()}
    <button class="btn ghost" onclick={reset}>Herstel standaard</button>
    <span class="grow"></span>
    <button class="btn soft" onclick={() => (open = false)}>Annuleren</button>
    <button class="btn primary" disabled={!!error || saving} onclick={save}><Icon name="check" size={18} />Opslaan</button>
  {/snippet}
</Sheet>

<style>
  .editor { display: flex; flex-direction: column; gap: 12px; }
  .tools { flex-wrap: wrap; gap: 8px; }
  .tools label { gap: 6px; }
  .input.sm { width: auto; padding: 6px 10px; }
  .input.num { width: 72px; padding: 6px 8px; }
  .canvas { position: relative; isolation: isolate; width: 100%; max-height: 60vh; margin: 0 auto; border-radius: 14px; background: var(--surface-2); touch-action: none; }
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; display: block; user-select: none; }
  .hit { fill: transparent; stroke: transparent; stroke-width: 1; cursor: move; }
  .item:hover .hit { stroke: var(--accent); stroke-dasharray: 3 2; }
  .item.on .hit { fill: color-mix(in srgb, var(--accent) 12%, transparent); stroke: var(--accent); stroke-dasharray: none; }
  .win .hit, .door .hit { stroke: color-mix(in srgb, var(--accent) 40%, transparent); }
  .lbl { font-size: 9px; font-weight: 600; text-anchor: middle; dominant-baseline: middle; fill: var(--text); pointer-events: none; opacity: 0.8; }
  .handle { fill: var(--accent); cursor: nwse-resize; }
  .panel { background: var(--surface-2); border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .nums { display: flex; flex-wrap: wrap; gap: 8px; }
  .nums label { display: flex; flex-direction: column; gap: 2px; }
  .icons { display: flex; flex-wrap: wrap; gap: 6px; }
  .icn { width: 38px; height: 38px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); display: grid; place-items: center; cursor: pointer; }
  .icn.sel { background: var(--accent); color: #fff; }
  .msg { margin: 0; padding: 8px 12px; border-radius: 12px; }
  .err { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
  .warn { background: color-mix(in srgb, var(--warn) 15%, transparent); }
</style>
