// The DESK room window on the scroll timeline. From ENTER_T you're inside (OutsideScene hides,
// DeskScene shows); at EXIT_T the room hands off to the ENTER-MONITOR dive. Tune these two knobs
// to move where you go inside and how long the monitor room holds before the next scene.
export const ENTER_T = 0.172;
export const EXIT_T = 0.3;

export function insideBuilding(t: number): boolean {
  return t >= ENTER_T && t < EXIT_T;
}
