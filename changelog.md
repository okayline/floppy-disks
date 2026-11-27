# floppy-disks changelog

Newest first.

## A steadier install screen
- The Defrag bar's outline is always on screen, with its colors only while it runs. The install line keeps room for two lines, so the progress bar stays in place. A press no longer makes the fragmentation number go up. Footer version v0.63. Removed: the Defrag bar vanishing between presses, the progress bar shifting with the line's length, and the screen redraw after a miss.

## One bar for each install
- Each install is now one progress bar, fragmentation and the Defrag button show from the start, and the fragmentation pace is rebalanced. Footer version v0.62. Removed: the second bar for hardware installs, and the "Copying files" line.

## Parts named for the machine
- From the motherboard on, the parts list names the machine's own motherboard, CPU and graphics card. Footer version v0.61. Removed: the plain part names for those three.

## Free install wording
- The free install lines at the last two free levels now name the parts they add. Removed: the old part names in those two lines.

## Parts in a new order
- The parts now go in a different order, starting with the floppy drive. Footer version v0.60. Removed: the old order.

## Part names capitalized
- The part names on the motherboard now start with capital letters, to match the free installs. Footer version v0.59. Removed: the lowercase part names.

## Free install wording
- The free installs now read with capital letters, and two of them have their own wording. Footer version v0.58. Removed: the lowercase part names.

## Free installs name the part
- A free install now says "Installing" and the part it adds, instead of its own separate name. Footer version v0.57. Removed: the six separate free-install names.

## Main page title
- The main page's disk panel has a title line above the pink disk. Footer version v0.56. Removed: nothing.

## Privacy panel
- The Privacy panel on the main page now says more plainly what is and isn't kept, in three short paragraphs. Footer version v0.55. Removed: the two-paragraph Privacy text.

## Defrag gets harder
- Each successful Defrag hit makes the next one harder, and a hit shows how much fragmentation it took off. Footer version v0.54. Removed: the same difficulty on every try.

## Main page
- The main page (no disk) now shows the pink disk picture, then the How to play panel, then a Privacy panel. Footer version v0.53. Removed: the "Tap a disk with your phone" line and its plain panel.

## How it works
- The tapped page has a closed, collapsible "How it works" panel at the bottom, and no longer shows How to play (the public page still does). Footer version v0.52. Removed: How to play from the tapped page.

## How to play
- Every disk page now has a short "How to play" panel, on the public page and on the tapped page (under the Disk panel). Footer version v0.51. Removed: nothing.

## New look
- The pages have a fresher look: a bright teal background, rounded Windows-grey panels, rounded buttons, and the disk name in brackets. The loading bar and the Defrag colours are unchanged. Footer version v0.50. Removed: the flat teal background, the square beveled panels and the plain buttons.

## Fragmentation on every install
- The Fragmentation line now shows on every install screen from the first one (starting at 0%), not only the free installs, and builds more slowly. Defrag takes off half as much. Footer version v0.49. Removed: the line being hidden on the question installs, and the faster build and bigger Defrag.

## Disk panel sizes to its screen
- The Disk panel is no longer one fixed height. Each kind of screen (question, install, free install, boot) keeps the tallest height it has reached, so small text changes do not make it wobble, and a free install leaves room for the Defrag meter from the start. Footer version v0.48. Removed: the fixed 410px panel height.

## Disk centered over Wake up, bigger names, tighter panel
- On a sleeping disk the picture is centered over the Wake up button, the name choices have bigger text, and the awake Disk panel is a little shorter so there is less empty space at the bottom. Footer version v0.47. Removed: the empty motherboard box beside a sleeping disk and the taller panel.

## Bigger Wake up button
- The Wake up button is bigger, centered and sits below the disk, and a sleeping disk's panel is only as tall as it needs to be; it gets its fixed height once it wakes. Footer version v0.46. Removed: the small button above the disk and the fixed height on a sleeping page.

## Slower fragmentation, slower boot screen
- Fragmentation now builds up more slowly. The boot screen reads Booting disk, Checking 14 installs, Built (the machine), then the awake line, one by one with animated dots, when you watch the disk finish. Footer version v0.45. Removed: the "Starting disk" and "Found" wording and the boot lines appearing all at once.

## Defrag takes a fifth
- A successful Defrag now lowers fragmentation by a fifth instead of back to zero, and the saved-time line is gone. Footer version v0.44. Removed: the reset to zero and the "saved" line.

## Fixed Disk panel height
- The Disk panel keeps one height whatever screen it shows. Footer version v0.43. Removed: the panel resizing with its contents.

## Defrag zone narrower
- The Defrag hit zone is a little narrower. Footer version v0.42. Removed: the wider zone.

## Defrag bounce, fragmentation shown rising
- The ^ now sweeps right, bounces back left, then goes right again and off the end; a hit counts on any pass. The fragmentation percentage on a free install now rises on its own while the screen is open. Footer version v0.41. Removed: the single one-way sweep and the fragmentation line that stayed at the number it loaded with.

## Defrag miss
- A missed Defrag swing now shows no message; the screen just resets. Footer version v0.40. Removed: the "Missed" text.

## Defrag layout
- The Defrag bar now sits above its button, in lighter pastel colours. Footer version v0.39. Removed: the old darker bar colours and the button-above-bar order.

## Defrag is a timing game
- Pressing Defrag now starts a bar with a ^ that sweeps across; stop it in the yellow zone and the defrag works, miss and nothing happens. Footer version v0.38. Removed: the Defrag that worked on a single press.

## Defrag
- A free install's screen now has a Defrag button and a fragmentation line; pressing it takes time off the wait. Footer version v0.37. Removed: nothing.

## 8 questions, 6 free installs
- The build is still 14 steps, but only 8 are questions; the other 6 install by themselves. A disk's questions are drawn from the pool and differ from disk to disk. The machine now comes from some of the answers, not a count. Footer version v0.36. Removed: the 14 fixed questions and the count that picked the machine.

## Lines break at words, smaller time-left line
- Text now wraps between words instead of between letters (a long code with no spaces still wraps). The "Estimated time remaining" line is a little smaller. Footer version v0.35. Removed: the break-anywhere rule.

## Floppy in the disk picture box
- On a tapper's page the floppy now sits in the disk picture's box in the Disk panel, with the parts list beside it in much smaller text; the install buttons' text is a little smaller. The public page keeps its floppy at the top. Footer version v0.34. Removed: the floppy at the top of the tapper page and the "[disk image]" placeholder.

## New tap closes old disk tabs
- When a tap opens a disk page, older disk pages open in the same browser try to close themselves (browsers only allow it for some tabs). Footer version v0.33. Removed: nothing.

## Footer and smaller Info text
- Every page now ends with the shared footer. The Info panel's text is smaller (the Secured line is unchanged). Removed: nothing.

## Floppy still until the boot, no shadow
- The floppy faces straight ahead and sits still until the disk has booted, then it turns and can be dragged. Removed: the shadow under it, and the turning while a disk is asleep or building.

## Short address
- After a good tap the address bar shows the short /disk/NN instead of the long tap link. Removed: nothing.

## Floppy shows up on the live site
- The floppy didn't draw on the live site (only its shadow showed); the page now carries what the site's bundler assumes. Removed: nothing.

## No tap hint on the public page
- The public page no longer says "Tap the disk with your phone to open it." Removed: that line.

## Public panel on top
- A tapper's page now starts with the public panel (with the floppy), then the Disk panel, then the Info panel. Removed: the public panel at the bottom.

## Title off the Disk panel
- The Disk panel no longer repeats the disk's name under the floppy; the name stays in the public panel at the bottom. Removed: the Disk panel's heading.

## 3D floppy at the top
- Each disk page now starts with a see-through 3D floppy in the disk's colour. It sits still until the disk is awake, then turns slowly and can be dragged. It sits straight on the panel's grey, with no white box. Removed: nothing.

## Taps on the public panel
- The public panel now shows the number of taps. Removed: nothing.

## Public panel at the bottom
- A tapper's page now ends with the public panel too. Removed: nothing.

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
