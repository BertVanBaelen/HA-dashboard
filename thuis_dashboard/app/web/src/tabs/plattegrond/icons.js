import {
  mdiFlowerOutline, mdiCrystalBall, mdiBedOutline, mdiDoor, mdiPackageVariantClosed, mdiShower, mdiStove,
  mdiSofaOutline, mdiAlarm, mdiFan, mdiRadiator, mdiHomeVariantOutline, mdiTelevision, mdiSpeaker, mdiSoundbar,
  mdiToilet, mdiStairs, mdiDesk, mdiSilverwareForkKnife, mdiTeddyBear, mdiWashingMachine, mdiGarage, mdiTree,
  mdiScriptTextPlayOutline, mdiPowerSocketEu,
} from '@mdi/js';

export const ROOM_ICONS = {
  home: mdiHomeVariantOutline,
  sofa: mdiSofaOutline,
  bed: mdiBedOutline,
  kitchen: mdiStove,
  shower: mdiShower,
  toilet: mdiToilet,
  hall: mdiDoor,
  stair: mdiStairs,
  storage: mdiPackageVariantClosed,
  terrace: mdiFlowerOutline,
  mistique: mdiCrystalBall,
  desk: mdiDesk,
  dining: mdiSilverwareForkKnife,
  kids: mdiTeddyBear,
  laundry: mdiWashingMachine,
  garage: mdiGarage,
  garden: mdiTree,
};

export const PLAN_ICONS = {
  ...ROOM_ICONS,
  alarm: mdiAlarm,
  fan: mdiFan,
  heat: mdiRadiator,
  script: mdiScriptTextPlayOutline,
  socket: mdiPowerSocketEu,
  tv: mdiTelevision,
  stereo: mdiSpeaker,
  soundbar: mdiSoundbar,
};

export const planIcon = (/** @type {string|undefined} */ key) => (key && PLAN_ICONS[key]) || mdiHomeVariantOutline;