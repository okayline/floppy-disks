# floppy-disks changelog

Newest first.

## Countdown on the last wait
- The last wait before the boot now has the same filling bar and time left as the installs. Removed: the sliding bar and the page's once-a-minute check.

## Public page and separate panels
- Search engines are asked not to list the pages. /disk/NN now opens for anyone with a small public panel; a good tap adds a Disk panel and a separate Info panel. Removed: the "Not a real tap" and "Tap the disk again" pages (they show the public panel with a note).

## Layout, dots and buttons
- The disk is alone at first and the motherboard appears beside it after the first install, with the disk staying put. The dots move slower and the install buttons are much bigger. Removed: the motherboard shown before the first install.

## Disk and motherboard pictures
- A woken disk's page shows the disk and the motherboard side by side, with parts listed as installs are made. Placeholders for now. Removed: nothing.

## The bar restarts at every pick
- Each wait now starts at the moment of the pick, so every install shows a full wait. Removed: the shared clock from the first pick, and installs stacking up.

## The boot
- After the last wait, the disk boots: a short start-up screen, a machine, and a number added to its name. Removed: nothing.

## Install screen
- After a pick, the page shows what is installing, with a moving bar and a time estimate, and the last wait has a moving bar too. Removed: the plain "Next install in" line.

## Installs
- A woken disk's page now offers a choice of two to install, one at a time, with the next choice opening after a wait. Removed: the unused step number in a disk's saved state.

## The page uses the picked name
- A woken disk's page now shows its picked name as the heading. Removed: the separate name line.

## Names show the disk number
- A woken disk's name now ends with its disk number. Removed: nothing.

## Names have no number yet
- A woken disk's name now shows as just the word. Removed: the number and dashes after the name.

## A sleeping disk can be woken
- A disk's page now has a Wake up button that lets the tapper pick a name from a few choices; a disk wakes once. Removed: nothing.

## Game state has a database, and a tap opens a visit
- The Worker now keeps each disk's last tap number and its game state in a database instead of KV, and a good tap opens a short visit the page can use for follow-up requests. Removed: the KV store for tap numbers.

## The page shows more about the tap
- A disk's page now says it is secured and lists details of the tap that opened it. Removed: the one-line "Real tap" text.

## Disks 2 to 5 are listed
- Disks 2 to 5 can now open their pages. Removed: nothing.

## Each disk has its own key
- A disk's page now only opens from a tap signed with that disk's own key. Removed: the shared factory key and the chip list.

## A disk's page opens once per tap
- A disk's page now opens only from a fresh tap; a refresh, the back button or an old link says to tap the disk again. Removed: nothing.

## A disk's page checks the chip is that disk
- A disk's page now only opens for its own chip. Removed: nothing.

## Each disk has its own address
- A disk's tag now opens `/disk/NN`, and the page shows which disk it is next to the tap count. Removed: the old `/t` address.

## First version
- Tapping a floppy disk's tag with a phone now opens a page that checks the tap is real and shows how many times the disk has been tapped. Removed: nothing.
