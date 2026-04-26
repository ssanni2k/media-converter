import './css/index.css';
import { AppStore } from './store/AppStore';
import { mountApp } from './ui/App';

const store = new AppStore();
const root = document.getElementById('root')!;

mountApp(root, store);
