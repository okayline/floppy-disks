// Which seal is on which disk: disk number -> the hologram seal number. A disk's tag key is made from TAG_SECRET and its seal number. Add one line when a disk is pressed.
// Disk numbers are picked at random (1 to 999) so a number doesn't read as a place in line. Disk 1 is the test disk.
export const DISKS = {
  1: "702500", // the pink test disk
  417: "702490", // purple
  862: "702491", // orange
  235: "702492", // green
  598: "702494", // blue
};

// Each disk's colour, as recorded at pressing (the pressings sheet). A disk's colour name, like PINK-DISK, is always offered when it wakes.
export const COLOURS = {
  1: "pink",
  417: "purple",
  862: "orange",
  235: "green",
  598: "blue",
};
