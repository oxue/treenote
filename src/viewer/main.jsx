import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Viewer from './Viewer';
import '../theme.css';
import '../App.css';
import '../components/deadline.css';
import './Viewer.css';

// `window.__TREENOTE_DATA__` is injected by exportHtml.js right before this
// script runs, replacing the <!--TREENOTE_DATA--> placeholder. If the file is
// opened without injection (e.g. someone opens the raw template), fall back to
// a tiny placeholder tree so we don't crash.
const fallback = {
  tree: [{ text: 'No data was injected into this template.', checked: false, children: [] }],
  theme: 'dark',
  boxWidth: 400,
  exportedAt: new Date().toISOString(),
  sourceUrl: '',
};

const data = (typeof window !== 'undefined' && window.__TREENOTE_DATA__) || fallback;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Viewer data={data} />
  </StrictMode>
);
