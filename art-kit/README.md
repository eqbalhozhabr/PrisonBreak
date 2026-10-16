# Blind Eye — کیت هنر (Art kit)

این پوشه همه چیزی است که برای کشیدن اسپرایت‌ها لازم داری. هر چیزی که اینجا نیست، همان‌طور که الان هست (با کد) کشیده می‌شود.

## چطور استفاده کنی
1. `geometry.png` را ببین (اندازه‌ی کاشی‌ها و جای ایستادن شخصیت‌ها).
2. برای هر ورقه (sheet) از جدول پایین، فایل `templates/<name>.blank.png` را در برنامه‌ات (Aseprite / Photoshop / ...) باز کن. این فایل شفاف است و **دقیقاً اندازه‌ی نهایی** را دارد. فایل `templates/<name>.guide.png` فقط راهنما است (نام ردیف‌ها، تعداد قاب‌ها، خط زمین و مرکز) و برای کشیدن نیست.
3. قاب‌ها را از چپ به راست و ردیف‌ها را از بالا به پایین به ترتیب جدول بکش، و PNG نهایی را با **همان نام** (مثلاً `thief.png`) در پوشه‌ی `sprites/` بگذار.
4. هر ورقه‌ای که تمام شد برایم بفرست؛ لازم نیست همه با هم باشند. هر ورقه‌ی ناقص یا نیامده، با اسپرایت فعلی (کدکشیده) جایگزین می‌ماند. **اول فقط ردیف‌های اولویت P1 را بکش** (کمترین کار برای بیشترین اثر)، بعد P2، بعد P3.
5. فایل‌های `.aseprite` یا لایه‌دار را هم اگر داری نگه دار؛ بعداً برای اصلاح لازم می‌شود.

## قواعد سبک (مثل رفرنس‌های خودت و نسخه‌ی LCD)
- **چیزهایی که حرکت می‌کنند** (زندانی، نگهبان‌ها، سگ، دوربین، نورافکن): **سیاه** (`ink`). روشن‌ترین چیزی که روی آن‌ها می‌آید فقط `pale` است (پوست، چشم، برق عدسی، راه‌راه لباس زندانی)، و قرمز (`red`) فقط برای چراغ‌های کوچک (LED دوربین) و قلاده‌ی سگ.
- **لایه‌ی ثابت** (کف، دیوار، در، آینه، شیشه، تابلو برق، خروج): کم‌کنتراست و تخت، فقط با سبزخاکستری‌های پالت (`paper`, `g3`, `g2`, `g1`)، **بدون سایه**، انگار لایه‌ی دیگری از کنسول است. خط دور این‌ها سیاه نیست، تیره‌ترین سبز (`g1`) است.
- **سایه نکش.** بازی خودش از شکل (alpha) اسپرایتت یک سایه‌ی کم‌رنگ می‌سازد و با فاصله‌ی پایین-راست زیر آن می‌اندازد. همین‌طور هاله‌ی انتخاب، پرتوهای قرمز دوربین، حلقه‌ی راهنما و علامت «!» را بازی می‌کشد. پس در اسپرایت‌ها هیچ سایه، هاله یا پرتو نکش.
- **پیکسل‌آرت واقعی:** بدون anti-alias، بدون نیمه‌شفاف. هر پیکسل یا کاملاً شفاف است (alpha 0) یا کاملاً پر (alpha 255). (پیکسل نیمه‌شفاف، سایه‌ی نیمه‌کاره می‌دهد.)
- **خط دور** (outline) را خودت بکش و داخل اسپرایت نگه دار. بازی چیزی اضافه نمی‌کند.
- **تقارن چپ/راست:** فقط نمای راست را بکش. بازی برای چپ آن را آینه می‌کند، پس چیزی که معنی‌اش با آینه شدن عوض می‌شود (نوشته، لوگو روی لباس، علامت نامتقارن مهم) نکش.
- اگر جزئیات بیشتری می‌خواهی (مثل رفرنس‌ها)، می‌توانی همه‌ی اندازه‌ها را **۲ برابر** بکشی (کاشی 96×74، شخصیت 64×96 و ...) و به من بگویی؛ فقط یادت باشد روی موبایل کاشی حدود ۵۸ پیکسل و روی دسکتاپ حدود ۱۳۴ پیکسل در صفحه است، پس جزئیات خیلی ریز روی موبایل گم می‌شود. پیشنهاد من همین اندازه‌های ×۱ است.

## هندسه (جزئیات در `geometry.png`)
- نما: مایل (3/4). **کف** از بالا با کمی شیب، **دیوارها** با یک سطح بالا و یک روی جلویی.
- کاشی کف: **48×37**. بلوک دیوار: سطح بالا **48×37** + روی جلویی **48×16** = یک سلول **48×53** (بلوک ۱۶ پیکسل بالاتر از ردیف خودش کشیده می‌شود تا روی جلوییش پایین ردیف بالایی را بپوشاند).
- شخصیت‌ها: بوم **32×48** (سگ 48×32). **لنگرگاه (anchor) = پاها**: وسط پایین بوم. پاها همیشه روی پایین‌ترین ردیف بوم، مرکز افقی. هیچ‌وقت لنگرگاه را بین قاب‌ها جابه‌جا نکن (پاها نباید «بپرند»)؛ حرکت جا به جا شدن را بازی انجام می‌دهد، نه قاب‌ها.
- دوربین، نورافکن، تابلو برق: بوم **40×32**، روی سطح بالای بلوک دیوار می‌نشینند؛ لنگرگاه = وسط پایین بوم (۷۲٪ پایین سطح بالا).
- ترتیب کشیدن: کف‌ها، بعد ردیف به ردیف از بالا به پایین: دیوارها و هر چیزی که پاهایش در آن ردیف است. شخصیتی که جلوتر (ردیف پایین‌تر) است روی بقیه می‌افتد.

## جهت‌ها
زندانی/نگهبان: `down` (رو به ما)، `up` (پشت به ما)، `right` (پهلو). سگ: `right` و (اختیاری) `down/up`. دوربین/نورافکن: `up` (به عقب نگاه می‌کند)، `right`، `down` (به ما نگاه می‌کند). `left` را بازی با آینه‌ی `right` می‌سازد.

## مشخصات انیمیشن
| وضعیت | چطور پخش می‌شود |
|---|---|
| **idle** (ایستاده) | ۲ قاب، تکرار، هر قاب بین ۵۰۰ تا ۶۰۰ میلی‌ثانیه (نفس کشیدن/پلک زدن). تفاوت دو قاب ظریف باشد (۱ تا ۲ پیکسل). |
| **walk** (راه رفتن) | ۴ قاب، تکرار. **قاب بر اساس مسافتی که طی شده انتخاب می‌شود، نه زمان**، پس پا روی زمین نمی‌لغزد: یک دور کامل (۴ قاب) = **۲ قدم = ۲ کاشی**. قاب ۰ و ۲ لحظه‌ی تماس پا با زمین (پاها از هم باز)، قاب ۱ و ۳ حالت «پا در هوا / پاها کنار هم». **بالا-پایین رفتن بدن (bob) را داخل قاب‌ها بکش.** بازی دیگر بدن را بالا و پایین نمی‌برد. |
| **run** (سگ در آژیر) | ۴ قاب، تکرار، مسافتی: یک دور = ۳ کاشی (دویدن کشیده‌تر از راه رفتن). |
| **turn** (چرخش دوربین/نورافکن) | ۳ قاب، یک بار، هر قاب ۹۰ میلی‌ثانیه، یک چهارم دور **در جهت عقربه‌های ساعت**: `up→right`، `right→down`. بقیه را بازی می‌سازد: `down→left` = آینه‌ی معکوسِ `right→down`، `left→up` = آینه‌ی معکوسِ `up→right`. قاب آخر هر چرخش باید دقیقاً همان قاب اول `idle` جهت بعدی باشد. |
| **door**: `states` | قاب ۰ بسته؛ ۱ تا ۴ باز شدن؛ ۵ باز. هر قاب ۸۰ میلی‌ثانیه، یک بار. بستن = همان قاب‌ها برعکس. جعبه‌ی اهرم **وسط کاشی** است و جای لمس همان‌جاست، پس حتماً دیده شود. |
| **mirror**: `states` | قاب ۰ = «/»، ۱ = «\\»، ۲ تا ۴ = چرخیدن از «/» به «\\» (۷۰ میلی‌ثانیه). برعکس‌شان برای برگشت. |
| **exit**: `idle` | ۲ قاب، ۵۰۰ میلی‌ثانیه، چراغ تابلوی خروج چشمک می‌زند. |
| **caught / alert / alarm / bark / sniff** | وضعیت‌های اضافه (P2/P3)، ۲ قاب تکراری، ۱۵۰ تا ۳۰۰ میلی‌ثانیه، فقط وقتی آن اتفاق می‌افتد. |

نکته: زمان‌ها «پیشنهاد»اند؛ اگر حس بهتری با زمان دیگری داشتی بنویس تا در `assets.json` عوض کنم. تعداد قاب‌ها هم قابل تغییر است (مثلاً راه رفتن ۶ قاب) به شرط اینکه ورقه و `assets.json` با هم بروند.

## فهرست ورقه‌ها (P1 = اول، P2 = بعد، P3 = اگر وقت شد)
<!--SHEETS-->
| Sheet (file) | Size px | Cell | Rows (frames) | Priority |
|---|---|---|---|---|
| **thief.png**<br>Prisoner (the player) | 128×384 | 32×48 | `idle_down` (2f, 600 ms) – breathing / blink, front view<br>`idle_up` (2f, 600 ms) – back view<br>`idle_right` (2f, 600 ms) – side view facing right (the game mirrors it for left)<br>`walk_down` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`walk_up` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`walk_right` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`caught` (2f, 300 ms) – front, hands up; frame 0 -> 1 -> repeat<br>`escape_up` (4f, 110 ms) – runs into the exit (walks away from us, shrinks into the door) | P1 |
| **guard_a.png**<br>Guard, type A (slim, cap) | 128×432 | 32×48 | `idle_down` (2f, 600 ms)<br>`idle_up` (2f, 600 ms)<br>`idle_right` (2f, 600 ms)<br>`walk_down` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`walk_up` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`walk_right` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`alert_down` (2f, 200 ms) – surprised pose when he sees the prisoner (the game adds the "!" itself)<br>`alert_up` (2f, 200 ms)<br>`alert_right` (2f, 200 ms) | P1 |
| **guard_b.png**<br>Guard, type B (another build, optional second guard in a level) | 128×288 | 32×48 | `idle_down` (2f, 600 ms)<br>`idle_up` (2f, 600 ms)<br>`idle_right` (2f, 600 ms)<br>`walk_down` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`walk_up` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2<br>`walk_right` (4f, by distance) – one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2 | P3 |
| **dog.png**<br>Guard dog (side view; left = mirrored right) | 192×288 | 48×32 | `idle_right` (2f, 500 ms) – standing, tail / ear twitch<br>`walk_right` (4f, by distance) – one cycle = 2 tiles<br>`run_right` (4f, by distance) – the alarm run: stretched gallop, one cycle = 3 tiles<br>`sniff_right` (2f, 300 ms) – nose down<br>`bark_right` (2f, 150 ms) – head up, mouth open<br>`idle_down` (2f, 500 ms) – front view (the dog also moves up and down rails)<br>`idle_up` (2f, 500 ms) – back view<br>`walk_down` (4f, by distance)<br>`walk_up` (4f, by distance) | P1 |
| **camera.png**<br>Wall camera (sits on the top face of a wall block) | 120×256 | 40×32 | `idle_up` (2f, 500 ms) – back view (it looks away from us); frame 1 = the LED on<br>`idle_right` (2f, 500 ms) – side view facing right; the lens is on the right<br>`idle_down` (2f, 500 ms) – front view; the lens faces us<br>`turn_up_to_right` (3f, 90 ms) – quarter turn clockwise. The other turns are derived: right->down needs its own row below; down->left and left->up are mirrored/reversed<br>`turn_right_to_down` (3f, 90 ms)<br>`alarm_up` (2f, 150 ms) – LED lit, body shaking by 1 px<br>`alarm_right` (2f, 150 ms)<br>`alarm_down` (2f, 150 ms) | P1 |
| **lamp.png**<br>Searchlight on a wall block | 120×160 | 40×32 | `idle_up` (2f, 500 ms) – back view<br>`idle_right` (2f, 500 ms) – side, lens on the right<br>`idle_down` (2f, 500 ms) – front, big lens facing us<br>`turn_up_to_right` (3f, 90 ms)<br>`turn_right_to_down` (3f, 90 ms) | P1 |
| **panel.png**<br>Power panel (fixed on a wall block; its wires are drawn by the game) | 120×128 | 40×32 | `type1_idle` (2f, 600 ms) – lamp symbol: circle (the game links a circle wire to it)<br>`type2_idle` (2f, 600 ms) – lamp symbol: triangle<br>`type3_idle` (2f, 600 ms) – lamp symbol: square. Use different SHAPES, not only colours: the game can be played without colour<br>`pulse` (3f, 80 ms) – when it is pressed: lights flash | P1 |
| **wall.png**<br>Wall blocks: top face 48x37 on top of front face 48x16 (one cell 48x53) | 144×159 | 48×53 | `concrete` (3f) – 3 variations (the game picks one per cell, like a hash)<br>`brick` (3f) – 3 variations<br>`special` (3f) – optional: cracked, with bars, pillar | P1 |
| **floor.png**<br>Floor tiles 48x37 (top view with a little tilt) | 192×74 | 48×37 | `base` (4f) – 4 plain variations, almost the same tone so the floor stays calm<br>`extra` (4f) – warning stripes, drain, cracked, puddle | P1 |
| **door.png**<br>Door (a block 48x53 when closed; when open only the posts stand on the floor tile) | 288×53 | 48×53 | `states` (6f, 80 ms) – frame 0 = closed, frames 1-4 = opening, frame 5 = open (posts and lever box on the lower 37 px, upper 16 px empty). The game plays it backwards for closing. The lever box is in the middle of the tile: that is where a tap lands. | P1 |
| **mirror.png**<br>Mirror block 48x53 | 240×53 | 48×53 | `states` (5f, 70 ms) – frame 0 = "/" , frame 1 = "\" , frames 2-4 = turning from "/" to "\" (played backwards for the other way) | P1 |
| **glass.png**<br>Glass block 48x53 (see-through) | 96×106 | 48×53 | `variants` (2f) – keep it light: the cameras see through it<br>`cracked` (1f) | P1 |
| **exit.png**<br>Exit door on a floor tile 48x37 | 144×74 | 48×37 | `idle` (2f, 500 ms) – sign light blinking<br>`reached` (3f, 100 ms) – opens when the prisoner arrives | P1 |
| **fx.png**<br>Effects | 192×96 | 32×32 | `dust` (4f, 80 ms) – puff at the feet when walking starts<br>`alarm_mark` (2f, 150 ms) – the "!" over a head (the game now draws it with a font)<br>`star_burst` (6f, 70 ms) – win: 3 stars pop | P2 |
| **ui_icons.png**<br>Interface (phase 2) | 144×72 | 24×24 | `heart` (3f, 90 ms) – frame 0 full (black), frame 1 empty (outline), frame 2 breaking<br>`star` (2f) – frame 0 full, frame 1 empty<br>`misc` (6f) – lock, hint lamp, undo, restart, home, play (the game already has pixel icons made from text; replace when ready) | P2 |
| **frame9.png**<br>Screen frame, 9-slice (phase 2) | 48×96 | 48×48 | `stage_frame` (1f) – the bezel around the board; the corners are 12x12, the edges stretch<br>`button_frame` (1f) – a button; corners 6x6 | P3 |
<!--/SHEETS-->

**ترتیب پیشنهادی:** `thief` (idle + walk) → `guard_a` (idle + walk) → `camera` (idle) → `wall` + `floor` → `door` → `mirror` → `exit` → `dog` → `lamp`, `panel`, `glass` → بقیه.

## پالت
`palette.png`، `palette.hex` (یک رنگ در هر خط) و `palette.gpl` (برای Aseprite/GIMP). برای لایه‌ی ثابت می‌توانی سبزخاکستری‌های بیشتری هم اضافه کنی (کم‌کنتراست، مثل رفرنس‌ها)، فقط روشن‌تر از `paper` یا تیره‌تر از `g1` نشو، و سیاه (`ink`) را برای چیزهایی که حرکت می‌کنند نگه دار.

## بقیه‌ی پوشه
- `look-reference/`: نسخه‌ی LCD فعلی (رنگ‌آمیزی خودکار اسپرایت‌های قدیمی) برای دیدن جایگاه سایه و دو لایه.
- `current-placeholders/`: اسپرایت‌های فعلی (کدکشیده، اندازه‌ی واقعی خودشان) برای دیدن حالت و ژست؛ اندازه‌ها با کیت جدید فرق دارد.
- `assets.json`: همین جدول به شکل قابل‌خواندن برای کد (نام فایل، اندازه‌ی سلول، لنگرگاه، ردیف‌ها، قاب‌ها، زمان‌ها). من از همین برای جایگزین کردن استفاده می‌کنم.

## چیزهایی که بازی خودش می‌کشد (نکش)
سایه‌ی اشیای متحرک (از alpha اسپرایت)، هاله‌ی انتخاب، پرتوها و مخروط دید، خانه‌های روشن، مسیر ریل نگهبان‌ها و سگ‌ها، نقطه‌های بو، حلقه و دست راهنما، علامت «!» (فعلاً با فونت)، سیم‌های تابلو برق، متن EXIT روی تابلوی خروج را اگر خودت در اسپرایت نکشی.

## چیزهایی که باید قبل از شروع تصمیم بگیری
1. اندازه‌ها ×۱ باشد یا ×۲ (بالا را ببین).
2. چند نوع نگهبان؟ حداقل `guard_a`؛ `guard_b` اختیاری است (بعضی مرحله‌ها تا ۴ نگهبان دارند و دو تیپ متفاوت خیلی کمک می‌کند).
3. آیا قاب بزرگ دور صفحه (کنسول، مثل رفرنس‌ها) را هم خودت می‌کشی؟ (`frame9`، P3). فعلاً با CSS ساخته شده.
