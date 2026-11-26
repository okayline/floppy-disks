// Which seal is on which disk: disk number -> the hologram seal number. A disk's tag key is made from TAG_SECRET and its seal number. Add one line when a disk is pressed.
export const DISKS = {
  1: "702500", // the pink test disk
  2: "702490", // purple
  3: "702491", // orange
  4: "702492", // green
  5: "702494", // blue
};

// Each disk's colour, as recorded at pressing (the pressings sheet). A disk's colour name, like PINK-DISK, is always offered when it wakes.
export const COLOURS = {
  1: "pink",
  2: "purple",
  3: "orange",
  4: "green",
  5: "blue",
};
