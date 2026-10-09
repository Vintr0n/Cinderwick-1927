# Cinderwick - The Vale Syndicate

Strategy and simulation 3D browser-based game set in a fictional 1920s Prohibition-era Chicago suburb. Manage territory, build criminal syndicates, execute hits, and expand your empire while taking on rival gangs.


https://github.com/user-attachments/assets/a41d23d7-da62-416c-a268-8c1f46125c0a



## Run

Install Node.js 24 LTS, then:

```sh
npm install
npm start
```

Open **http://localhost:3000**. In Windows PowerShell with restricted script execution, use `npm.cmd`. Development: `npm run dev`. Everything runs locally; no accounts, paid services, or external assets.

Restart the server after updates to simulation or server code, then refresh the browser. Existing campaigns and replay files are retained and upgraded to the new stats and inventory format. Older saves are normalized to put living hoods inside their respective headquarters at the next planning phase.

New campaigns begin with a setup screen for your boss name, outfit name, and color. For testing, new campaigns start with $1000, a boss, and two unarmed hoods. Use **New campaign** to create a new outfit; this resets the active campaign.

########################################################################
# Game Guide
########################################################################

## Crew-first planning

1. Open **Crew** and click a living hood's portrait/name card.
2. Choose Recruit, Extort, Collect protection, Patrol, Bomb building, Hit hood, Investigate, Buy business, Protect, Assassinate, or Return to HQ.
3. For a map order, click its target in **Street view**. The banner explains eligible targets. A single green pulse confirms that the server accepted the order. Recruitment uses the selected building as a meeting point; the new recruit waits at HQ. Patrol accepts a building or a street click (assigned to that grid block).
4. For Hit, select a previously seen enemy from the contact list. Your hood visits the last-seen block, then searches its four immediate neighboring blocks if the target is absent. It engages a spotted target with a clear line of fire, then returns home; an unsuccessful search also ends in a return to HQ.
5. Review or remove assignments in **Orders**. Choosing another order for a hood replaces its existing assignment.
6. Click **Begin working week**, or wait for the 15-minute planning countdown.

The page stays within the viewport. Crew, contacts, the ledger, and reports scroll inside their dialogs rather than extending the page.

## The working week

- The server computes the complete deterministic week before playback.
- Hoods leave HQ, carry out assignments, and walk home. Patrols walk one circuit around their block on the sidewalks, shoot visible enemies when armed, finish any active encounter, then return. Survivors end regular weeks indoors at HQ, a stationed property, or in hiding after losing all safe homes. A regular week ends as soon as every order, search, fight, flight and return journey is complete. There is no fixed week length or extra replay delay.
- All gangsters are hidden on the map during planning, and indoor hoods disappear during playback. Crew dossiers remain accessible. Clicking your HQ opens Crew when you are not assigning an order.
- A boss death immediately ends the campaign; return journeys stop at that point.
- Pause, change speed (0.5x / 1x / 2x / 4x), or skip to the report. The next planning countdown starts automatically when the active playback finishes, including when skipped. It continues while the report is open. **Reports** reopens past reports and historical playback; watching an old replay does not advance the week or reset the timer.

## Territory and income

- Recruitment has no upfront cost; only weekly wages apply. It rolls four stats from 1 to 5: Intelligence (reserved for future businesses), Intimidate (extortion chance), Firearms (gun accuracy), and Explosives (bomb detonation chance). Ratings show only filled stars.
- Extortion works on neutral or rival shops and the jeweler. A successful roll transfers ownership to the issuing gang.
- Open shops set aside $20 or $30 per week and the jeweler $40. Money accumulates until collected, up to $120 per extorted building. Existing larger balances are capped when loading the new rules. A new week credits the balance once; a newly extorted neutral business credits its first week immediately. Collection takes the entire held balance and empties it. You must still control the business when the hood arrives. Click an owned business to see its expected weekly income and held balance.
- TNT detonates at 20% + 5% per Explosives star. Each indoor occupant has a separate 1% chance to die; surviving occupants evacuate to an intact HQ or purchased property, or go into hiding until repair. A successful bomb and closes the target for **the current week and the following week**. The building becomes brick rubble, broken masonry, and charred timber. Building orders cannot target the rubble, and already-queued assignments fail if the place is destroyed before arrival. Bombing destroys the uncollected balance. A closed business accrues nothing and pays neither gang; its building and availability return automatically afterward. Income already collected before the explosion is not clawed back. Failed detonations do not close buildings.
- Use **Territory** to highlight friendly property and discovered rival property. Select a building to inspect its known ownership and closure.

## Equipment and payroll

Open **Equipment**, then **Buy**, during planning, select an illustrated item, then press the separate **Buy** button to purchase one into the outfit's shared stockpile. Selecting an item never spends cash. The explosive illustration is a TNT bundle. Open a living hood's **Crew** card to equip or return items from that pool; equipping never charges cash. A **Colt M1911 costs $100**, a **Tommy gun costs $250**, and a **TNT bundle costs $200**. Guns are reusable; the Tommy gun improves the chance of a lethal hit. Swapping guns returns the old gun to stock for another hood. Each hood carries one gun and up to 20 bombs. Existing saves retain their equipped gear and start with an empty stockpile. Each actual bomb attempt consumes one bomb, even if detonation fails. Hit orders require a gun; bomb orders require a bomb.

At the end of each regular working week, each living nonboss hood costs **$20**, including new recruits. **The boss is unpaid.** Current wages and old arrears are paid from available cash. Any shortfall becomes debt. Each unpaid week gives each nonboss hood a 10–40% desertion chance, increasing with the unpaid proportion of the bill. Desertion does not erase debt. Equipment purchases and recruitment are blocked while wages remain outstanding; later earnings pay arrears at the next payroll. Reports show the bill, amount paid, debt, and departures.

The report shows **weekly income**, **weekly wages**, **controlled blocks**, and **crew lost** (new deaths plus desertions). Income includes your collected balances, without deducting wages. Enemy transactions are labeled and never counted as your income. Payroll is shown separately for that week only. Treasury is the actual remaining cash after all spending. For example: $1000 minus a $100 gun and $40 wages leaves $860; the next week, $20 collected, free recruitment, and $60 wages leaves $820.

Dead and deserted hoods have no current map position. Death events are labeled casualties; an attacker killed by return fire cannot receive an unqualified success result.

## Combat

Armed patrols engage enemies they spot. Shots require a clear ray between shooter and target, a maximum range of ten world units, and contact within one grid block. Solid buildings block fire; rubble does not block a standing shooter's sightline. Shooting turns the hood toward the target and shows a muzzle flash and tracer.

Each encounter allows **10 pistol shots or 20 Tommy-gun shots per armed participant**, stopping early if a combatant dies or contact is lost. One Firearms star gives a **5% hit-and-kill chance per shot**, increasing by one percentage point per star to **9% at five stars**. Armed survivors return fire under the same rules. An unarmed survivor flees for **10 seconds**, then resumes the order or return trip. Patrols do not endlessly restart a spent encounter with the same enemy during that week.

## Contacts and portraits

Unrecognized rivals appear as unmarked pedestrians while carrying out real orders. Living player hoods within ten world units and a clear line of sight have a 35% chance every two seconds to recognize each nearby rival. Previously identified rivals are recognized immediately on recontact; opening fire also reveals a rival. Contact is lost when enemies move away or enter HQ. Last-seen details persist in the dossier and reports. Hit orders use those observations, not hidden current positions.

Rival crew independently extort, collect, and patrol the streets. Their boss stays indoors while any crew remain, except for moving into purchased protection or a required relocation; a lone boss returns from protection and works to rebuild. They do not react to secret player assignments. Rivals prioritize collections and sustainable recruitment, expand their territory, and allocate patrols when finances allow. Indoor HQ arrivals do not replace useful street sightings.

New campaigns and recruits draw seeded, varied period-style names. Existing identities remain intact. Every hood has a stable, original SVG portrait with a neutral or stern expression derived from their identity, with varied facial features, hair, skin, hats, glasses, scars, and facial hair. Discovered enemies appear with portraits in the contact list and reports. Unknown enemies are never listed.

## Camera and city animation

- **WASD / arrow keys** move the camera freely relative to the current view.
- Mouse orbit, pan, and wheel zoom remain available. **Reset view** returns to the city overview.
- Keyboard movement is suspended while a dialog is open or you are typing.
- Gangsters use articulated models with continuous street-edge movement, arm swings, knee bends, and turning. Hoods, pedestrians, and cars share a travel speed of one world unit per second at 1x: the previous 0.5x pace is now the baseline, with foot placement driven by distance traveled, so planted steps match the path. Playback gives longer street routes enough time to finish at that speed before showing action results; pause and speed changes apply to everyone.
- Departures are exactly 0.5 seconds apart at 1x, and hoods sharing a destination stand apart along the street.
- During replay, click a visible gangster or their marker to see their current action. The card updates to **Heading back to HQ** during the return journey and closes when the hood enters HQ, is no longer visible, or playback ends. Clicking a hood does not move the camera.
- The compact playback panel leaves more of the map visible. Click its latest event to open the closeable transaction/combat log, including individual shots, hit chances, collections and wages.
- Replay time follows elapsed time even when drawing is delayed or the tab is hidden. A browser that suspends the page entirely catches up when it resumes; old sound cues are not played in a burst. Explicit Pause still freezes the replay.
- Equipped pistols and Tommy guns appear in a hood's hands; carried bombs remain hidden.
- Buildings have windows on all four sides, varied masonry colors and roof details, and rear ladders on selected blocks. Windows leave clear space for larger, high-contrast building signs.
- Bomb events trigger fire, debris, a shockwave, and rising smoke. Nearby pedestrians run at twice their normal speed for ten replay seconds, then settle back to walking.
- Fifty pedestrians and twenty moving period-style cars provide ambient city life. They have no combat, visibility, or economic effects. During replay they follow the playback clock, including pause and speed changes.
- Projecting shop awnings have been removed to avoid character clipping.

## Sound

Your files in `sounds/` supply the looping background music, `bomb-1` explosions, three agreement replies, and two rejection replies. Cues follow visible replay outcomes; failed bombs and hidden events do not trigger them. The browser starts music after your first interaction.

Agreement and rejection voices have a 50% chance to play, with at least 4.5 seconds between replies to prevent simultaneous chatter. Every visible gunfire event plays `handgun-1.wav` or `tommy-gun-1.wav` according to the weapon, including missed shots and return fire. Gunfire bypasses the voice probability and cooldown. This presentation randomness does not change simulation outcomes.

The **Sound on / Sound off** button beside the map controls mutes both music and effects immediately, prevents new cues, and remembers your preference across reloads. Pausing or skipping playback stops current effect clips. The large background WAV is streamed with HTTP range support rather than loaded into server memory in full.

## Verification

```sh
npm test
node scripts/browser-check.js
node scripts/animation-check.js
node scripts/replay-inspection-check.js
node scripts/timeline-check.js
node scripts/sound-rubble-check.js
npm run replay -- 1927
```

Browser checks require Microsoft Edge and use temporary campaign data. Screenshots are saved in `test-results/`. The replay command prints the authoritative JSON replay.

Tests cover deterministic replay ordering, both campaign outcomes, recruitment, enemy ownership transfer, HQ return events, bomb closure/reopening, last-seen hit orders, WebSocket persistence, timer expiry, the crew-first UI, viewport sizing, keyboard camera movement, traffic, planning visibility, stockpile transfers, cash reconciliation, shared movement speed, and weapon sounds.

## Architecture

- `shared/buildings.json`: data-defined 10x10 map (100 blocks); business size controls purchase terms.
- `shared/config.js`: stats, sight radius, and planning duration.
- `server/sim/`: headless seeded simulation with 500 ms ticks, timed street journeys and encounters, stable hood-ID order, order registry, rule-based rival AI, and server-authoritative observation.
- `server/data/store.js`: JSON persistence interface.
- `server/index.js`: local HTTP/WebSocket boundary and phase coordination.
- `public/app.js`: crew-first organizer, contacts, reports, and replay player.
- `public/scene.js`, `characters.js`, `effects.js`, `portraits.js`, `playback.js`: rendering and presentation.

The replay retains the event schema, including explicit move/arrive/attempt/result/death/ownership events. Return movement uses `data.journey: "return"`. Additive `indoors` and `closedUntilWeek` state fields describe HQ occupancy and temporary business closures. New replays use `timelineVersion: 2` and explicit path durations; historical replays retain their original outcomes. Observed `data.view` snapshots let the client render without deciding outcomes or visibility.

The full replay stays on disk; the WebSocket projection removes unseen identities and outcomes. All simulation randomness uses a seeded PRNG. Replay UUID-v4-format IDs are seeded and reproducible, so identical input produces byte-identical logs. Game/week identifies each stored replay.

`data/game.json` holds the active session, roster, orders, and deadline. Replays live at `data/replays/{gameId}/week-{n}.json`. Atomic replacement protects individual writes; startup recovers a replay committed before its session update. The synchronous local store supports one active campaign.

Set `PORT` or `PLANNING_MS` to override defaults. Multiplayer, police behavior, bribery, business setup, and detailed building models remain outside this prototype.

Existing campaigns keep their treasury and accumulated protection balances; the $20/$30/$40 rates apply to future accruals. Start a new campaign for the $1000 testing treasury.

### Combat and crew updates

- Each living crew member has a planning toggle to shoot revealed enemies on sight during any assignment. The default is off; armed patrols and hit orders still engage their targets.
- Both combatants stay visible for the fight. Both gun types show tracers; their sounds stop immediately on death or combat completion.
- Bodies remain on the street for that week?s replay, with closed eyes. Click a body to see its dead status.
- Guns remain equipped after firing and across weeks. Guns on fallen crew are recovered to the outfit stockpile at week end, with a log entry. Bomb attempts consume one bomb.
- Recruitment has a 50% success chance and no fee. Successful recruits add their usual weekly wages.
- Crew details have a Back to crew button. Log names carry an outfit-colored square with the outfit name on hover.

## Property, intelligence, and victory

The city now has 100 blocks. Existing campaigns retain their original 25 blocks, cash, and ownership; new districts are added without resetting progress. Old replay outcomes are unchanged.

Enemy territory can be revealed by extortion, successful investigation, or a 10% discovery check every five seconds while living outdoor crew are within one grid block. Discovery is remembered and logged, and known enemy blocks show an outfit marker even with the territory overlay off. Discovery does not reveal occupants or substitute for investigation. Investigations succeed at 35% + 2% per Intelligence star. Armed enemy occupants impose a 70% investigator death risk first; a killed investigator returns no report. Successful reports show ownership, occupants (including bosses and armed defenders), purchase price, and weekly business income. Reports describe the time of investigation and may become stale.

| Business size | Purchase | Automatic weekly income | Sale value |
| --- | ---: | ---: | ---: |
| Small | $1,000 | $40 | $800 |
| Medium | $1,500 | $100 | $1,200 |
| Large | $2,500 | $175 | $2,000 |

Investigate first, then assign Buy business or choose Buy business on the map details and select a crew member. Enemy-controlled businesses cannot be purchased. Purchased properties reject extortion. Their automatic income pays at week end before wages; rubble earns nothing. When an extorted business is purchased, its existing protection balance is paid into the treasury. Purchased properties cannot be collected from, investigated, or bombed by their owner. Sell from the property panel during planning for 80% of purchase price; rubble cannot be sold. Selling schedules occupants to walk to a safe home during the next work week. Return to HQ is available only when away from HQ.

Protect stations an armed crew member or boss inside a purchased property. They stay across weeks, receive wages, and must use Return to HQ before another assignment. If every safe home is rubble, occupants are **in hiding**, still accrue wages, and cannot act until a home repairs. Retire dismisses a non-boss immediately during planning, cancels their queued order, returns their equipment, and stops future wages; previously owed wage debt remains owed.

Assassinate requires a gun and an investigation that found an enemy boss inside the target. On arrival, the boss must still be there. Each armed non-boss defender independently has a 10% chance to kill the assassin before the assassination roll. If the assassin survives, success is 1% + 1% per Firearms star. Killing either boss ends the game immediately, whether through street combat, assassination, or bombing. Taking all extortion businesses or destroying income alone does not win.

Rivals budget for wages and equipment, collect held income regularly, recruit within their means, expand even with only their boss left, and patrol. Wealthy rivals can investigate and purchase businesses and station their boss. They use the same income, equipment, recruitment, damage, hiding, and payroll rules.

### Street-view and clarity fixes

- Cutaway switches buildings to knee-high perimeter walls so street activity is easier to see. Park greenery and a broad outer tram boulevard add period scenery; trams follow the replay clock.
- Each gun sound loops once per shooter during combat, without stacking a new clip for every shot. Death, combat completion, mute, pause, and replay completion stop the relevant effects.
- Retire asks for confirmation. Rivals reserve regular patrols when solvent and walk their collection blocks before returning home.
- When a rival takes over your extorted business, its former player ownership is cleared. The panel says protection was lost; the new owner remains unknown until investigation or an extortion attempt reveals it.
- Existing purchased-property protection balances are settled into cash once when loading the updated rules.

Equipment now has Buy and Sell modes. Spare pistols sell for $90 and Tommy guns for $225; choose a quantity and confirm the sale. Equipped weapons must be returned through Crew first. Crew defaults to showing living members, including those in hiding; switch off Show alive only to include casualties, deserters, and retirees. Retirement uses an in-game confirmation dialog. The bottom footer bar has been removed.

Crew cards include direct stockpile gun selection, TNT equip/return buttons, and Shoot on sight controls. Compact weapon and TNT icons show each loadout. Individual dossiers have previous/next arrows and an Equipment shortcut. Assigned buildings retain a subtle green base outline through planning and playback; changing or removing orders updates it, and the next week clears it.


### Crew management and recruitment updates

- Crew can be sorted by highest Intelligence, Intimidate, Firearms, or Explosives, and filtered to assigned/stationed or unassigned members. The individual hood panel also shows their queued order or persistent protection post.
- After a server-confirmed map assignment, the green pulse finishes and the same hood panel reopens.
- Each recruitment meeting location starts with two hidden candidates. Successful recruitment consumes one; failed rolls do not. One candidate returns every two completed working weeks, capped at two. The existing 50% roll and wage rules still apply to both outfits. Old saves receive fresh pools when migrated; counts are never exposed to the client.
- New hoods draw from thousands of period-style American and Italian-American name combinations. Existing saved names are unchanged.
- A fatal investigation intercepted by building protection plays one pistol-shot clip, without looping, and respects mute.
- Archived replay controls wait for the selected report to load. Opening Reports during an archived replay stops that playback and restores the live campaign. Playback completion clears its temporary state and resets the progress display for the next replay.


### Undercover headquarters and planning controls

Establishing a new outfit selects two random ordinary storefront locations for headquarters, at least six grid units apart (five clear blocks between the bases). Placement uses the campaign seed, survives reloads, and places each starting crew inside its own HQ. Existing campaigns keep their established locations. HQs use normal building heights and sign placement, and an undiscovered rival HQ is not identified as such in the player map data.

Crew action tiles show names only; hover over a tile for its description or equipment requirement. Beginning a working week with an empty order book opens an in-game confirmation with **Go back** and **Continue to working week**. The automatic planning deadline still follows the existing schedule.
