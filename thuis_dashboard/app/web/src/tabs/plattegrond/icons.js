import {
  mdiFlowerOutline, mdiCrystalBall, mdiBedOutline, mdiDoor, mdiPackageVariantClosed, mdiShower, mdiStove,
  mdiSofaOutline, mdiAlarm, mdiFan, mdiRadiator, mdiHomeVariantOutline, mdiTelevision, mdiSpeaker, mdiSoundbar,
} from '@mdi/js';

/** Icon keys used by FLOORPLAN_ROOMS in shared/config.js */
export const PLAN_ICONS = {
  terrace: mdiFlowerOutline,
  mistique: mdiCrystalBall,
  bed: mdiBedOutline,
  hall: mdiDoor,
  storage: mdiPackageVariantClosed,
  shower: mdiShower,
  kitchen: mdiStove,
  sofa: mdiSofaOutline,
  alarm: mdiAlarm,
  fan: mdiFan,
  heat: mdiRadiator,
  tv: mdiTelevision,
  stereo: mdiSpeaker,
  soundbar: mdiSoundbar,
};

export const planIcon = (/** @type {string|undefined} */ key) => (key && PLAN_ICONS[key]) || mdiHomeVariantOutline;
