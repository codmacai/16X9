// Written by scripts/make-shots.mjs (before each build), by each film's file in the bucket: a real
// frame from it, and a 5-second preview clip cut from the same moment. Edit by replacing the files in
// public/work/shots and public/work/previews, not these lists.
export const SHOTS: Record<string, string> = {
  "TVC_s/cleveland_clinic_1.mp4_v1 (1080p).mp4": "/work/shots/tvc-s-cleveland-clinic-1-mp4-v1-1080p.jpg",
};

// a film named without its folder -> where it was found in the bucket
export const FILM_KEYS: Record<string, string> = {

};

export const PREVIEW_CLIPS: Record<string, string> = {
  "TVC_s/cleveland_clinic_1.mp4_v1 (1080p).mp4": "/work/previews/tvc-s-cleveland-clinic-1-mp4-v1-1080p.mp4",
};
