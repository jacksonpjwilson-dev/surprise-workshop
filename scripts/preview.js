#!/usr/bin/env node
'use strict';
// Local-only preview of the gallery at http://localhost:<previewPort>/ (bound to 127.0.0.1, never public).
// Unrevealed workshop drafts are available at /workshop/<folder>/ for checking before the reveal.
const { P, config } = require('../lib/common');
const { serve } = require('../lib/static');
const port = Number(process.env.PORT) || config().previewPort;
serve(P.gallery, port, { '/workshop/': P.workshop }).then(s => console.log(`Preview: http://localhost:${s.port}/  (drafts: /workshop/<folder>/). Ctrl-C to stop.`));
