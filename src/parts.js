// The parts the PC gets, in order: pick 1 is the motherboard (always shown as the picture), each later pick adds the next part. The 14th pick adds nothing: the boot shows the case and the machine.
// Only the parts already installed are ever sent to the page, never the whole list. Placeholders until there are pictures.
export const PARTS = ["Motherboard", "Power Supply", "CPU", "RAM", "Hard Drive", "Floppy Drive", "Modem and Phone Cord", "Graphics Card", "CD-ROM", "Sound Card", "Speakers", "Mouse Cable", "Keyboard Cable"];

// The part names shown on the motherboard after this many picks (the motherboard itself is the picture, so it is not listed).
export const installed = (picks) => PARTS.slice(1, Math.min(picks, PARTS.length));
