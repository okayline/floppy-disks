// The parts the PC gets, in order: pick 1 is the floppy drive (always shown as the picture), each later pick adds the next part. The 14th pick adds nothing: the boot shows the case and the machine.
// Only the parts already installed are ever sent to the page, never the whole list. Placeholders until there are pictures.
export const PARTS = ["Floppy Drive", "Power Supply", "Mouse Cable", "Keyboard Cable", "Speakers", "CD-ROM", "Modem and Phone Cord", "Motherboard", "CPU", "RAM", "Graphics Card", "Hard Drive", "Sound Card"];

// The part names shown on the motherboard after this many picks (the floppy drive itself is the picture, so it is not listed).
export const installed = (picks) => PARTS.slice(1, Math.min(picks, PARTS.length));
