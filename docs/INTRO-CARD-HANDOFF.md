# Remove the abrupt glow at the end of the startup reveal

The fixed `.brand-intro-host.modern-auth` inherited the 700 px `.modern-auth:before` radial glow. The curtain faded normally, but this separate glow remained above the purple balance card until the host was removed. The last frame therefore changed the card's apparent color abruptly.

Hide only that inherited pseudo-element on the transient intro host. The actual curtain, logo assembly, hold, movement, easing and cleanup remain untouched. No app/domain/backend code, card styling, navigation, final page appearance or dock effects changed. The app stylesheet resource revision is updated for cache invalidation. Production publication is pending explicit approval; the correction is prepared in the private preview.

`tests/intro_card_handoff_browser.py` runs the actual application with fictional local fixtures. It holds cleanup after the original 1161 ms fade has finished, captures the card, then releases cleanup and compares the pixels. At 393 and 440 px the original glow produces a large color jump; with the fix, zero card pixels change. The desktop card at 1440 px is outside the old glow and remains unchanged in both cases. Source invariants verify the original animation JavaScript/keyframes and unrelated runtime files remain unchanged. Chromium checks do not replace a physical iPhone review.
