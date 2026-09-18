import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import 'ol/ol.css';
import './styles.css';
import './themes.css';
import App from './App';
import { applyTheme, readTheme } from './theme';

applyTheme(readTheme());
createRoot(document.getElementById('root')!).render(<App />);
