// The parts the PC gets, in order: pick 1 is the motherboard (always shown as the picture), each later pick adds the next part. The 14th pick adds nothing: the boot shows the case and the machine.
// Only the parts already installed are ever sent to the page, never the whole list. Placeholders until there are pictures.
export const PARTS = ["motherboard", "power supply", "CPU", "RAM", "hard drive", "floppy drive", "modem and phone cord", "graphics card", "CD-ROM", "sound card", "speakers", "mouse cable", "keyboard cable"];

// The part names shown on the motherboard after this many picks (the motherboard itself is the picture, so it is not listed).
export const installed = (picks) => PARTS.slice(1, Math.min(picks, PARTS.length));
