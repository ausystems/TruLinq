import '../../styles/main.css';
import '../../styles/pages/podcast.css';
import { boot } from '../main.js';
import { slipStamp } from '../slip-stamp.js';

/* The featured podcast. Its record lies on the desk and the rubber stamp presses the seal onto it as the page arrives,
   and again on a click or a tap: the Trulinq team picked it (src/js/slip-stamp.js). */
function featured() {
  const stage = document.querySelector('[data-stamp-stage]');
  if (!stage || !stage.getClientRects().length) return; // left out on a folded phone's cover screen
  const slip = stage.querySelector('[data-slip]');
  slipStamp(stage, { desk: stage.querySelector('.pcast-hero__desk'), canvas: stage.querySelector('[data-stamp-canvas]'), slip, seal: slip.querySelector('[data-slip-seal]') });
}

boot(null, featured);
