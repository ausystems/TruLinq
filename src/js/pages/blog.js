import '../../styles/main.css';
import '../../styles/pages/blog.css';
import { boot } from '../main.js';

/* The blog and its guides are written whole by the build (src/build/blog.js): the cards, the contents, the bylines and
   the related guides are already in the page. The boot adds what every page has: the seals, the reviewer's notes,
   the closing call's faces and the theme switch. */
boot();
