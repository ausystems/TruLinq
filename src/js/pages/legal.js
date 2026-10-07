import '../../styles/main.css';
import '../../styles/pages/legal.css';
import { boot } from '../main.js';

/* The privacy policy and the terms are written into the page by the build (src/data/legal.js through
   legalIndexHTML and legalClausesHTML in src/js/html.js), so every reader and every crawler gets the full text
   without waiting for a script. */
export function legalBoot() { boot(); }
